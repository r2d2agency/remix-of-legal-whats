import * as whatsappProvider from './whatsapp-provider.js';
import * as wapiProvider from './wapi-provider.js';
import * as uazapiProvider from './uazapi-provider.js';
import { query } from '../db.js';
import { callAI } from './ai-caller.js';
import { logError, logInfo, logWarn } from '../logger.js';

async function ensureAutoReplySchema() {
  await query(`ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS agent_mode VARCHAR(20) DEFAULT 'standard'`);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_agent_autoreply_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL UNIQUE REFERENCES ai_agents(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT false,
      paused_until TIMESTAMPTZ,
      filter_mode VARCHAR(20) DEFAULT 'all',
      included_tags TEXT[] DEFAULT '{}',
      excluded_tags TEXT[] DEFAULT '{}',
      included_contact_ids UUID[] DEFAULT '{}',
      excluded_contact_ids UUID[] DEFAULT '{}',
      included_groups TEXT[] DEFAULT '{}',
      excluded_groups TEXT[] DEFAULT '{}',
      schedule_enabled BOOLEAN DEFAULT false,
      schedule_windows JSONB DEFAULT '[]'::jsonb,
      response_template TEXT,
      max_responses_per_contact INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_agent_autoreply_org ON ai_agent_autoreply_config(organization_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_agent_autoreply_active ON ai_agent_autoreply_config(is_active) WHERE is_active = true`);
  await query(`ALTER TABLE ai_agent_autoreply_config ADD COLUMN IF NOT EXISTS connection_ids UUID[] DEFAULT '{}'`);
  await query(`ALTER TABLE ai_agent_autoreply_config ADD COLUMN IF NOT EXISTS reply_mode VARCHAR(20) DEFAULT 'fixed'`);
  await query(`ALTER TABLE ai_agent_autoreply_config ADD COLUMN IF NOT EXISTS sdr_max_replies INTEGER DEFAULT 5`);
}

/**
 * Checks if current time is within business hours
 */
function isWithinBusinessHours(hours) {
  if (!hours || !Array.isArray(hours) || hours.length === 0) return true;

  // Use America/Sao_Paulo as default timezone
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  const dayConfig = hours.find(h => h.day === currentDay);
  if (!dayConfig || !dayConfig.enabled) return false;

  const [startH, startM] = dayConfig.start.split(':').map(Number);
  const [endH, endM] = dayConfig.end.split(':').map(Number);
  
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;
  const currentTime = currentH * 60 + currentM;
  
  return currentTime >= startTime && currentTime <= endTime;
}

function normalizePhone(value) {
  return String(value || '').replace(/@s\.whatsapp\.net|@c\.us|@lid|@g\.us/g, '').replace(/[^0-9]/g, '');
}

function buildRemoteJidVariants(value) {
  const raw = String(value || '').trim();
  const phone = normalizePhone(raw);
  return Array.from(new Set([
    raw,
    phone,
    phone ? `${phone}@s.whatsapp.net` : '',
    phone ? `${phone}@c.us` : '',
  ].filter(Boolean)));
}

function normalizeTagName(value) {
  return String(value || '').trim().toLowerCase();
}

function allowsLinkedAutoReplyFallback(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  return normalized === 'uazapi' || normalized === 'wapi' || normalized === 'meta';
}

async function getConversationContext(connectionId, remoteJid) {
  const variants = buildRemoteJidVariants(remoteJid);
  const phone = normalizePhone(remoteJid);
  const res = await query(
    `SELECT id, remote_jid, contact_phone, contact_name
       FROM conversations
      WHERE connection_id = $1
        AND (
          remote_jid = ANY($2::text[])
          OR ($3 <> '' AND contact_phone = $3)
        )
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [connectionId, variants, phone]
  );

  return res.rows[0] || null;
}

async function getConversationTagNames(conversationId) {
  if (!conversationId) return [];

  const res = await query(
    `SELECT t.name
       FROM conversation_tag_links ctl
       JOIN conversation_tags t ON t.id = ctl.tag_id
      WHERE ctl.conversation_id = $1`,
    [conversationId]
  );

  return res.rows.map((row) => String(row.name || '')).filter(Boolean);
}

async function getActiveAgentConfigs(organizationId, connectionId, allowLinkedFallback = false) {
  const res = await query(
    `SELECT c.*, a.name AS agent_name, a.system_prompt, a.ai_provider, a.ai_model, a.ai_api_key,
            a.temperature, a.max_tokens, a.organization_id AS agent_organization_id
       FROM ai_agent_autoreply_config c
       JOIN ai_agents a ON a.id = c.agent_id
      WHERE (
          c.organization_id = $1
          OR $2::uuid = ANY(c.connection_ids)
        )
        AND c.is_active = true
        AND (c.paused_until IS NULL OR c.paused_until > NOW())
        AND a.is_active = true
         AND (
           COALESCE(a.agent_mode, 'standard') = 'autoreply'
           OR (
             $3::boolean = true
             AND EXISTS (
               SELECT 1
                 FROM ai_agent_connections ac
                WHERE ac.agent_id = a.id
                  AND ac.connection_id = $2
                  AND ac.is_active = true
             )
           )
         )
        AND (
          c.connection_ids IS NULL
          OR c.connection_ids = '{}'
          OR $2::uuid = ANY(c.connection_ids)
        )
      ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC`,
    [organizationId, connectionId, allowLinkedFallback]
  );

  return res.rows;
}

async function ensureDefaultAutoReplyConfigs(organizationId, connectionId, allowLinkedFallback = false) {
  if (!organizationId || !connectionId) return 0;

  try {
    await ensureAutoReplySchema();
    const res = await query(
      `INSERT INTO ai_agent_autoreply_config (agent_id, organization_id, is_active, filter_mode, connection_ids)
       SELECT a.id,
              a.organization_id,
              COALESCE(a.is_active, true),
              'all',
              CASE
                WHEN COALESCE(a.agent_mode, 'standard') = 'autoreply' THEN '{}'::uuid[]
                ELSE ARRAY[$2::uuid]
              END
         FROM ai_agents a
         LEFT JOIN ai_agent_autoreply_config c ON c.agent_id = a.id
        WHERE a.organization_id = $1
          AND a.organization_id IS NOT NULL
          AND (
            COALESCE(a.agent_mode, 'standard') = 'autoreply'
            OR (
              $3::boolean = true
              AND EXISTS (
                SELECT 1
                  FROM ai_agent_connections ac
                 WHERE ac.agent_id = a.id
                   AND ac.connection_id = $2
                   AND ac.is_active = true
              )
            )
          )
          AND c.id IS NULL
       ON CONFLICT (agent_id) DO NOTHING
       RETURNING agent_id`,
      [organizationId, connectionId, allowLinkedFallback]
    );

    return res.rowCount || 0;
  } catch (error) {
    logError('auto_reply.ensure_default_configs_failed', error, {
      organization_id: organizationId,
      connection_id: connectionId,
      allow_linked_fallback: allowLinkedFallback,
    });
    throw error;
  }
}

async function getAutoReplyCandidatesDiagnostic(organizationId, connectionId) {
  if (!organizationId || !connectionId) return [];

  const res = await query(
    `SELECT a.id AS agent_id,
            a.name AS agent_name,
            a.organization_id AS agent_org,
            a.agent_mode,
            a.is_active AS agent_active,
            EXISTS (
              SELECT 1
                FROM ai_agent_connections ac
               WHERE ac.agent_id = a.id
                 AND ac.connection_id = $2
                 AND ac.is_active = true
            ) AS linked_to_connection,
            (
              SELECT json_build_object(
                'config_id', c.id,
                'config_org', c.organization_id,
                'is_active', c.is_active,
                'paused_until', c.paused_until,
                'connection_ids', c.connection_ids
              )
                FROM ai_agent_autoreply_config c
               WHERE c.agent_id = a.id
               LIMIT 1
            ) AS autoreply_config
       FROM ai_agents a
      WHERE a.organization_id = $1
         OR COALESCE(a.agent_mode, 'standard') = 'autoreply'
         OR EXISTS (
              SELECT 1 FROM ai_agent_autoreply_config c
               WHERE c.agent_id = a.id
                 AND $2::uuid = ANY(c.connection_ids)
            )
      ORDER BY linked_to_connection DESC, a.updated_at DESC NULLS LAST, a.created_at DESC
      LIMIT 50`,
    [organizationId, connectionId]
  ).catch(() => ({ rows: [] }));

  return res.rows;
}

async function getOrganizationAiConfig(organizationId) {
  if (!organizationId) return null;

  const orgResult = await query(
    `SELECT ai_provider, ai_model, ai_api_key
       FROM organizations
      WHERE id = $1
      LIMIT 1`,
    [organizationId]
  ).catch(() => ({ rows: [] }));

  const org = orgResult.rows[0];
  if (!org || !org.ai_api_key || !org.ai_provider || org.ai_provider === 'none') {
    return null;
  }

  return {
    provider: org.ai_provider,
    model: org.ai_model || null,
    apiKey: org.ai_api_key,
  };
}

function matchesAutoReplyFilters(config, tagNames, hasConversation) {
  const mode = config.filter_mode || 'all';
  const normalizedTags = new Set((tagNames || []).map(normalizeTagName));
  const includedTags = (config.included_tags || []).map(normalizeTagName).filter(Boolean);
  const excludedTags = (config.excluded_tags || []).map(normalizeTagName).filter(Boolean);

  if (mode === 'all') {
    if (excludedTags.some((tag) => normalizedTags.has(tag))) {
      return { matched: false, reason: 'excluded_tag_match' };
    }
    return { matched: true, reason: 'all_mode' };
  }

  if (!hasConversation && (includedTags.length > 0 || excludedTags.length > 0)) {
    return { matched: false, reason: 'conversation_not_found_for_tag_filter' };
  }

  if (mode === 'include') {
    if (includedTags.length === 0) {
      return { matched: true, reason: 'include_mode_without_tags' };
    }

    const hasIncludedTag = includedTags.some((tag) => normalizedTags.has(tag));
    return { matched: hasIncludedTag, reason: hasIncludedTag ? 'included_tag_match' : 'missing_included_tag' };
  }

  if (mode === 'exclude') {
    const hasExcludedTag = excludedTags.some((tag) => normalizedTags.has(tag));
    return { matched: !hasExcludedTag, reason: hasExcludedTag ? 'excluded_tag_match' : 'exclude_mode_clear' };
  }

  return { matched: true, reason: 'fallback' };
}

async function countPreviousAutoReplies(agentId, conversationId) {
  if (!conversationId) return 0;

  const res = await query(
    `SELECT COUNT(*)::int AS total
       FROM ai_agent_autoreply_log
      WHERE agent_id = $1
        AND conversation_id = $2`,
    [agentId, conversationId]
  );

  return res.rows[0]?.total || 0;
}

async function persistAutoReplyMessage(conversationId, content, messageId) {
  if (!conversationId || !content) return;

  await query(
    `INSERT INTO chat_messages (
       conversation_id, message_id, from_me, content, message_type, status, timestamp
     ) VALUES ($1, $2, true, $3, 'text', 'sent', NOW())
     ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id NOT LIKE 'temp_%' DO NOTHING`,
    [conversationId, messageId || `temp_autoreply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, content]
  ).catch(() => {});

  await query(
    `UPDATE conversations
        SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [conversationId]
  ).catch(() => {});
}

async function logAutoReplySent(agentId, conversationId, text) {
  await query(
    `INSERT INTO ai_agent_autoreply_log (agent_id, conversation_id, message_sent)
     VALUES ($1, $2, $3)`,
    [agentId, conversationId || null, text]
  ).catch(() => {});
}

async function generateAgentReply(config, organizationId, inboundMessage) {
  let provider = config.ai_provider || null;
  let model = config.ai_model || null;
  let apiKey = config.ai_api_key || null;

  if (!apiKey) {
    const orgConfig = await getOrganizationAiConfig(organizationId);
    if (orgConfig) {
      provider = orgConfig.provider;
      model = orgConfig.model;
      apiKey = orgConfig.apiKey;
    }
  }

  if (!apiKey && config.agent_organization_id && config.agent_organization_id !== organizationId) {
    const agentOrgConfig = await getOrganizationAiConfig(config.agent_organization_id);
    if (agentOrgConfig) {
      provider = agentOrgConfig.provider;
      model = agentOrgConfig.model;
      apiKey = agentOrgConfig.apiKey;
    }
  }

  provider = provider || 'gemini';

  if (!apiKey) {
    if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;
  }

  if (!apiKey) {
    throw new Error(`Sem chave de IA configurada para provider=${provider}`);
  }

  const systemPrompt = [
    config.system_prompt || 'Você é um atendente virtual da empresa.',
    config.response_template ? `Diretriz específica da auto-resposta:\n${config.response_template}` : '',
    'Responda em português do Brasil, de forma natural, curta e objetiva.',
    'Nunca diga que é uma IA, assistente virtual ou robô.',
    'Retorne apenas o texto final que será enviado ao cliente.',
  ].filter(Boolean).join('\n\n');

  const aiRes = await callAI(
    {
      provider,
      model: model || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
      apiKey,
    },
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Mensagem recebida do cliente:\n${String(inboundMessage || '').trim() || '[sem texto]'}\n\nGere a resposta agora.` },
    ],
    {
      temperature: Number(config.temperature) || 0.7,
      maxTokens: Number(config.max_tokens) || 300,
    }
  );

  return String(aiRes.content || '').trim();
}

/**
 * Handles auto-replies for a connection
 */
export async function handleAutoReplies(connection, remoteJid, messageContent) {
  try {
    const isGroup = !remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@temp.g.us') || remoteJid.includes('-');
    if (isGroup) {
      logInfo('auto_reply.debug.skip_group', {
        connection_id: connection?.id || null,
        remote_jid: remoteJid || null,
      });
      return;
    }

    logInfo('auto_reply.debug.start', {
      connection_id: connection?.id || null,
      organization_id: connection?.organization_id || null,
      provider: connection?.provider || null,
      remote_jid: remoteJid,
      message_preview: String(messageContent || '').slice(0, 120),
    });

    // 1. Out of Office Check (Fora do horário de trabalho)
    if (connection.out_of_office_message_enabled && connection.out_of_office_message) {
      const withinHours = isWithinBusinessHours(connection.business_hours);
      
      if (!withinHours) {
        logInfo('auto_reply.debug.out_of_office_triggered', {
          connection_id: connection.id,
          remote_jid: remoteJid,
        });
        await sendAutoReply(connection, remoteJid, connection.out_of_office_message);
        return;
      }
    }

    if (!connection?.organization_id) {
      logWarn('auto_reply.debug.skip_missing_org', {
        connection_id: connection?.id || null,
        remote_jid: remoteJid,
      });
      return;
    }

    const allowLinkedFallback = allowsLinkedAutoReplyFallback(connection?.provider);
    let configs = await getActiveAgentConfigs(connection.organization_id, connection.id, allowLinkedFallback);
    logInfo('auto_reply.debug.configs_loaded', {
      connection_id: connection.id,
      organization_id: connection.organization_id,
      allow_linked_fallback: allowLinkedFallback,
      total_configs: configs.length,
      agent_ids: configs.map((cfg) => cfg.agent_id),
    });

    if (configs.length === 0) {
      const backfilled = await ensureDefaultAutoReplyConfigs(connection.organization_id, connection.id, allowLinkedFallback);
      logInfo('auto_reply.debug.backfilled_missing_configs', {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        allow_linked_fallback: allowLinkedFallback,
        inserted_configs: backfilled,
      });
      configs = await getActiveAgentConfigs(connection.organization_id, connection.id, allowLinkedFallback);
    }

    if (configs.length === 0) {
      // Diagnóstico extra: por que nenhuma config bateu?
      try {
        const diag = await query(
          `SELECT c.id AS config_id, c.agent_id, c.is_active AS config_active,
                  c.paused_until, c.connection_ids, c.included_tags, c.filter_mode,
                  c.organization_id AS config_org,
                  a.name AS agent_name, a.is_active AS agent_active, a.agent_mode,
                  a.organization_id AS agent_org,
                  (c.connection_ids IS NULL OR c.connection_ids = '{}' OR $2::uuid = ANY(c.connection_ids)) AS connection_match
             FROM ai_agent_autoreply_config c
             LEFT JOIN ai_agents a ON a.id = c.agent_id
            WHERE c.organization_id = $1
               OR $2::uuid = ANY(c.connection_ids)
            ORDER BY c.updated_at DESC NULLS LAST`,
          [connection.organization_id, connection.id]
        );
        logWarn('auto_reply.debug.no_configs_diagnostic', {
          connection_id: connection.id,
          organization_id: connection.organization_id,
          allow_linked_fallback: allowLinkedFallback,
          total_rows_in_org: diag.rows.length,
          rows: diag.rows.map((r) => ({
            config_id: r.config_id,
            agent_id: r.agent_id,
            agent_name: r.agent_name,
            agent_mode: r.agent_mode,
            config_active: r.config_active,
            agent_active: r.agent_active,
            paused_until: r.paused_until,
            connection_ids: r.connection_ids,
            connection_match: r.connection_match,
            filter_mode: r.filter_mode,
            // Motivo provável da rejeição
            rejected_reason: !r.config_active ? 'config_inactive'
              : !r.agent_active ? 'agent_inactive'
              : r.agent_mode !== 'autoreply' ? `agent_mode_is_${r.agent_mode || 'null'}_expected_autoreply`
              : (r.paused_until && new Date(r.paused_until) > new Date()) ? 'paused'
              : !r.connection_match ? 'connection_not_in_connection_ids'
              : 'unknown',
          })),
          candidate_agents: await getAutoReplyCandidatesDiagnostic(connection.organization_id, connection.id),
        });
      } catch (diagErr) {
        logError('auto_reply.debug.no_configs_diagnostic_failed', diagErr);
      }
      return;
    }

    const conversation = await getConversationContext(connection.id, remoteJid);
    const tagNames = conversation?.id ? await getConversationTagNames(conversation.id) : [];

    logInfo('auto_reply.debug.context_loaded', {
      connection_id: connection.id,
      remote_jid: remoteJid,
      conversation_id: conversation?.id || null,
      contact_phone: conversation?.contact_phone || normalizePhone(remoteJid),
      tags: tagNames,
    });

    for (const config of configs) {
      const filterDecision = matchesAutoReplyFilters(config, tagNames, Boolean(conversation?.id));
      logInfo('auto_reply.debug.filter_check', {
        connection_id: connection.id,
        agent_id: config.agent_id,
        agent_name: config.agent_name || null,
        filter_mode: config.filter_mode,
        included_tags: config.included_tags || [],
        excluded_tags: config.excluded_tags || [],
        conversation_id: conversation?.id || null,
        tags: tagNames,
        matched: filterDecision.matched,
        reason: filterDecision.reason,
      });

      if (!filterDecision.matched) continue;

      const previousReplies = await countPreviousAutoReplies(config.agent_id, conversation?.id || null);
      logInfo('auto_reply.debug.rate_check', {
        connection_id: connection.id,
        agent_id: config.agent_id,
        conversation_id: conversation?.id || null,
        previous_replies: previousReplies,
        max_responses_per_contact: config.max_responses_per_contact || 1,
      });

      if (conversation?.id && previousReplies >= (config.max_responses_per_contact || 1)) {
        logInfo('auto_reply.debug.skip_rate_limit', {
          connection_id: connection.id,
          agent_id: config.agent_id,
          conversation_id: conversation.id,
        });
        continue;
      }

      const replyText = await generateAgentReply(config, connection.organization_id, messageContent);
      if (!replyText) {
        logWarn('auto_reply.debug.empty_ai_response', {
          connection_id: connection.id,
          agent_id: config.agent_id,
          conversation_id: conversation?.id || null,
        });
        continue;
      }

      logInfo('auto_reply.debug.ai_generated', {
        connection_id: connection.id,
        agent_id: config.agent_id,
        conversation_id: conversation?.id || null,
        message_preview: replyText.slice(0, 160),
      });

      const sendResult = await sendAutoReply(connection, remoteJid, replyText);
      logInfo('auto_reply.debug.send_result', {
        connection_id: connection.id,
        agent_id: config.agent_id,
        conversation_id: conversation?.id || null,
        success: Boolean(sendResult?.success ?? true),
        error: sendResult?.error || null,
        message_id: sendResult?.messageId || null,
      });

      if (sendResult?.success === false) continue;

      await persistAutoReplyMessage(conversation?.id || null, replyText, sendResult?.messageId || null);
      await logAutoReplySent(config.agent_id, conversation?.id || null, replyText);

      logInfo('auto_reply.debug.completed', {
        connection_id: connection.id,
        agent_id: config.agent_id,
        conversation_id: conversation?.id || null,
      });

      return;
    }

    logInfo('auto_reply.debug.no_matching_config', {
      connection_id: connection.id,
      conversation_id: conversation?.id || null,
      remote_jid: remoteJid,
      tags: tagNames,
    });
  } catch (error) {
    logError('auto_reply.debug.failure', error, {
      connection_id: connection?.id || null,
      organization_id: connection?.organization_id || null,
      remote_jid: remoteJid || null,
    });
  }
}

async function sendAutoReply(connection, remoteJid, text) {
  const provider = connection.provider || 'evolution';
  
  try {
    if (provider === 'evolution' || provider === 'wapi' || provider === 'uazapi') {
      return await whatsappProvider.sendMessage(connection, remoteJid, text, 'text');
    } else if (provider === 'meta') {
      // If there is a meta provider, use it. Otherwise, use fetch directly.
      const metaToken = connection.meta_token;
      const phoneId = connection.meta_phone_number_id;
      if (metaToken && phoneId) {
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', ''),
            type: 'text',
            text: { body: text },
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return { success: false, error: data?.error?.message || `Meta HTTP ${response.status}` };
        }
        return { success: true, messageId: data?.messages?.[0]?.id || null };
      }
    }
    return { success: false, error: `Provider ${provider} sem credenciais suficientes` };
  } catch (error) {
    console.error(`[AutoReply] Failed to send ${provider} message:`, error.message);
    return { success: false, error: error.message };
  }
}
