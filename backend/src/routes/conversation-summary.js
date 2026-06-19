import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { log, logError } from '../logger.js';
import { callAI } from '../lib/ai-caller.js';

const router = express.Router();
router.use(authenticate);

// Helper: Get user's organization
async function getUserOrg(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role 
     FROM organization_members om 
     WHERE om.user_id = $1 
     ORDER BY CASE om.role
       WHEN 'owner' THEN 1
       WHEN 'admin' THEN 2
       WHEN 'manager' THEN 3
       WHEN 'agent' THEN 4
       ELSE 5
     END, om.created_at ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

function hasUsableApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return Boolean(key && key !== '***' && !key.startsWith('••'));
}

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  return ['openai', 'gemini', 'openrouter'].includes(value) ? value : null;
}

function defaultModel(provider) {
  if (provider === 'openai') return 'gpt-4o-mini';
  if (provider === 'openrouter') return 'openai/gpt-4o-mini';
  return 'gemini-1.5-flash';
}

function envKeyForProvider(provider) {
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return null;
}

function buildAIConfig(row, fallbackApiKey = null) {
  const provider = normalizeProvider(row?.ai_provider);
  if (!provider || provider === 'none') return null;
  const apiKey = hasUsableApiKey(row?.ai_api_key) ? row.ai_api_key.trim() : fallbackApiKey;
  if (!hasUsableApiKey(apiKey)) return null;
  return {
    ai_provider: provider,
    ai_model: row?.ai_model || defaultModel(provider),
    ai_api_key: apiKey.trim(),
  };
}

// Helper: Get AI config from organization or agent
async function getAIConfig(organizationId, connectionId = null) {
  let orgFallbackKey = null;
  let preferredProvider = null;
  let preferredModel = null;

  // 1) Preferred: organization-level AI provider (set in Settings)
  try {
    const orgResult = await query(
      `SELECT ai_provider, ai_model, ai_api_key
         FROM organizations
        WHERE id = $1`,
      [organizationId]
    );
    const org = orgResult.rows[0];
    preferredProvider = normalizeProvider(org?.ai_provider);
    preferredModel = org?.ai_model || null;
    orgFallbackKey = hasUsableApiKey(org?.ai_api_key) ? org.ai_api_key.trim() : null;

    const orgConfig = buildAIConfig(org);
    if (orgConfig) {
      return orgConfig;
    }
  } catch (e) { /* org may lack columns on legacy installs */ }

  // 2) Fallback: active local AutoResponse/AI agent from the organization.
  // Agents may keep provider/model locally while using the organization/provider key.
  try {
    const agentResult = await query(
      `SELECT a.ai_provider::text AS ai_provider, a.ai_model, a.ai_api_key
         FROM ai_agents a
         LEFT JOIN ai_agent_autoreply_config arc ON arc.agent_id = a.id
        WHERE a.organization_id = $1
          AND a.is_active = true
          AND ($2::uuid IS NULL
               OR arc.id IS NULL
               OR COALESCE(cardinality(arc.connection_ids), 0) = 0
               OR $2::uuid = ANY(arc.connection_ids))
        ORDER BY
          CASE WHEN arc.is_active = true THEN 0 ELSE 1 END,
          CASE WHEN NULLIF(BTRIM(a.ai_api_key), '') IS NOT NULL THEN 0 ELSE 1 END,
          a.updated_at DESC NULLS LAST,
          a.created_at DESC
        LIMIT 1`,
      [organizationId, connectionId]
    );
    const agent = agentResult.rows[0];
    const agentConfig = buildAIConfig(agent, orgFallbackKey || envKeyForProvider(normalizeProvider(agent?.ai_provider)));
    if (agentConfig) return agentConfig;
  } catch (e) { /* table may not exist */ }

  // 3) Fallback: active global agent activation with client key
  try {
    const globalResult = await query(
      `SELECT ga.ai_provider, ga.ai_model,
              COALESCE(NULLIF(BTRIM(act.client_ai_api_key), ''), NULLIF(BTRIM(ga.ai_api_key), '')) AS ai_api_key
         FROM global_agent_activations act
         JOIN global_ai_agents ga ON ga.id = act.global_agent_id
        WHERE act.organization_id = $1
          AND act.is_active = true
          AND ($2::uuid IS NULL OR act.connection_id = $2::uuid)
        ORDER BY act.updated_at DESC NULLS LAST, act.created_at DESC
        LIMIT 1`,
      [organizationId, connectionId]
    );
    const globalAgent = globalResult.rows[0];
    const globalConfig = buildAIConfig(globalAgent, orgFallbackKey || envKeyForProvider(normalizeProvider(globalAgent?.ai_provider)));
    if (globalConfig) return globalConfig;
  } catch (e) { /* table may not exist */ }

  // 4) Last resort: org/provider selected but key is provided by deploy environment.
  const envKey = envKeyForProvider(preferredProvider);
  if (preferredProvider && hasUsableApiKey(envKey)) {
    return buildAIConfig({ ai_provider: preferredProvider, ai_model: preferredModel, ai_api_key: envKey });
  }

  return null;
}

// Helper: Call AI API to generate summary
async function generateSummaryWithAI(messages, provider, model, apiKey) {
  const startTime = Date.now();
  
  // Format messages for analysis
  const conversationText = messages.map(m => {
    const sender = m.from_me ? 'Atendente' : 'Cliente';
    const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `[${time}] ${sender}: ${m.content || '[mídia]'}`;
  }).join('\n');

  const systemPrompt = `Você é um assistente especializado em analisar conversas de atendimento ao cliente.
Analise a conversa abaixo e retorne um JSON com:
{
  "summary": "Resumo conciso da conversa em 2-3 frases",
  "key_points": ["ponto 1", "ponto 2", ...],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "topics": ["tópico 1", "tópico 2", ...],
  "action_items": ["ação pendente 1", ...],
  "resolution": "resolved" | "pending" | "escalated" | "unknown"
}

Regras:
- Seja objetivo e direto
- Identifique o motivo principal do contato
- Detecte o sentimento predominante do cliente
- Liste ações pendentes se houver
- Use português brasileiro`;

  const userPrompt = `Analise esta conversa:\n\n${conversationText}`;

  try {
    const normalizedProvider = normalizeProvider(provider);
    if (!normalizedProvider) throw new Error(`Provider ${provider} não suportado`);

    const result = await callAI(
      { provider: normalizedProvider, model: model || defaultModel(normalizedProvider), apiKey },
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { temperature: 0.3, maxTokens: 800, responseFormat: { type: 'json_object' } }
    );

    const processingTime = Date.now() - startTime;

    const content = result.content?.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    
    return {
      summary: parsed.summary || 'Resumo não disponível',
      key_points: parsed.key_points || [],
      sentiment: parsed.sentiment || 'neutral',
      topics: parsed.topics || [],
      action_items: parsed.action_items || [],
      resolution: parsed.resolution || 'unknown',
      processing_time_ms: processingTime
    };
  } catch (error) {
    logError('AI summary generation failed', error);
    throw error;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Get summary for a conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(`
      SELECT cs.*, u.name as triggered_by_name
      FROM conversation_summaries cs
      LEFT JOIN users u ON u.id = cs.triggered_by
      WHERE cs.conversation_id = $1 AND cs.organization_id = $2
    `, [req.params.conversationId, org.organization_id]);

    if (!result.rows[0]) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate summary for a conversation
router.post('/:conversationId/generate', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { conversationId } = req.params;

    // Check conversation exists. Allow if it has no connection (CRM-provisioned)
    // OR if its connection belongs to the user's organization.
    const convCheck = await query(`
      SELECT c.id, c.connection_id, conn.organization_id AS conn_org
      FROM conversations c
      LEFT JOIN connections conn ON conn.id = c.connection_id
      WHERE c.id = $1
    `, [conversationId]);

    if (!convCheck.rows[0]) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }
    // Não bloqueia por org da conexão: conexões podem ser compartilhadas
    // entre orgs (connection_members) ou a conversa pode ter sido transferida.
    // O INSERT abaixo escopa o resumo pela org do usuário autenticado.

    // Get AI configuration
    const aiConfig = await getAIConfig(org.organization_id);
    if (!aiConfig?.ai_api_key) {
      return res.status(400).json({ error: 'Nenhum agente de IA configurado com API key' });
    }

    // Optional time window (?days=N). Default: all messages (capped at 200).
    const daysParam = parseInt(req.query.days, 10);
    const useWindow = Number.isFinite(daysParam) && daysParam > 0;
    const messagesResult = await query(
      useWindow
        ? `SELECT content, from_me, message_type, created_at
             FROM chat_messages
             WHERE conversation_id = $1
               AND created_at >= NOW() - ($2 || ' days')::interval
             ORDER BY created_at ASC
             LIMIT 200`
        : `SELECT content, from_me, message_type, created_at
             FROM chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC
             LIMIT 200`,
      useWindow ? [conversationId, String(daysParam)] : [conversationId]
    );

    if (messagesResult.rows.length === 0) {
      return res.status(400).json({ error: 'Conversa sem mensagens' });
    }

    // Generate summary with AI
    const aiResult = await generateSummaryWithAI(
      messagesResult.rows,
      aiConfig.ai_provider,
      aiConfig.ai_model,
      aiConfig.ai_api_key
    );

    // Save summary
    const result = await query(`
      INSERT INTO conversation_summaries (
        conversation_id, organization_id, summary, key_points, 
        customer_sentiment, topics, action_items, resolution_status,
        messages_analyzed, generated_by, ai_provider, ai_model, 
        processing_time_ms, triggered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (conversation_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        key_points = EXCLUDED.key_points,
        customer_sentiment = EXCLUDED.customer_sentiment,
        topics = EXCLUDED.topics,
        action_items = EXCLUDED.action_items,
        resolution_status = EXCLUDED.resolution_status,
        messages_analyzed = EXCLUDED.messages_analyzed,
        ai_provider = EXCLUDED.ai_provider,
        ai_model = EXCLUDED.ai_model,
        processing_time_ms = EXCLUDED.processing_time_ms,
        triggered_by = EXCLUDED.triggered_by,
        updated_at = NOW()
      RETURNING *
    `, [
      conversationId, org.organization_id, aiResult.summary, 
      JSON.stringify(aiResult.key_points), aiResult.sentiment,
      JSON.stringify(aiResult.topics), JSON.stringify(aiResult.action_items),
      aiResult.resolution, messagesResult.rows.length, 'ai_agent',
      aiConfig.ai_provider, aiConfig.ai_model, aiResult.processing_time_ms,
      req.userId
    ]);

    // Update conversation with quick-access fields
    await query(`
      UPDATE conversations 
      SET ai_summary = $1, ai_sentiment = $2, updated_at = NOW()
      WHERE id = $3
    `, [aiResult.summary, aiResult.sentiment, conversationId]);

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error generating summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate summary when finishing conversation
router.post('/:conversationId/finish-with-summary', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { conversationId } = req.params;

    // Check conversation exists
    const convCheck = await query(`
      SELECT c.id, c.connection_id, conn.organization_id
      FROM conversations c
      JOIN connections conn ON conn.id = c.connection_id
      WHERE c.id = $1 AND conn.organization_id = $2
    `, [conversationId, org.organization_id]);

    if (!convCheck.rows[0]) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    // Finish the conversation
    await query(`
      UPDATE conversations 
      SET attendance_status = 'finished', updated_at = NOW() 
      WHERE id = $1
    `, [conversationId]);

    // Try to generate summary (non-blocking)
    let summary = null;
    try {
      const aiConfig = await getAIConfig(org.organization_id);
      
      if (aiConfig?.ai_api_key) {
        const messagesResult = await query(`
          SELECT content, direction, message_type, created_at
          FROM chat_messages
          WHERE conversation_id = $1
          ORDER BY created_at ASC
          LIMIT 100
        `, [conversationId]);

        if (messagesResult.rows.length >= 3) {
          const aiResult = await generateSummaryWithAI(
            messagesResult.rows,
            aiConfig.ai_provider,
            aiConfig.ai_model,
            aiConfig.ai_api_key
          );

          const summaryResult = await query(`
            INSERT INTO conversation_summaries (
              conversation_id, organization_id, summary, key_points, 
              customer_sentiment, topics, action_items, resolution_status,
              messages_analyzed, generated_by, ai_provider, ai_model, 
              processing_time_ms, triggered_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (conversation_id) DO UPDATE SET
              summary = EXCLUDED.summary,
              key_points = EXCLUDED.key_points,
              customer_sentiment = EXCLUDED.customer_sentiment,
              topics = EXCLUDED.topics,
              action_items = EXCLUDED.action_items,
              resolution_status = EXCLUDED.resolution_status,
              messages_analyzed = EXCLUDED.messages_analyzed,
              processing_time_ms = EXCLUDED.processing_time_ms,
              triggered_by = EXCLUDED.triggered_by,
              updated_at = NOW()
            RETURNING *
          `, [
            conversationId, org.organization_id, aiResult.summary, 
            JSON.stringify(aiResult.key_points), aiResult.sentiment,
            JSON.stringify(aiResult.topics), JSON.stringify(aiResult.action_items),
            aiResult.resolution, messagesResult.rows.length, 'ai_agent',
            aiConfig.ai_provider, aiConfig.ai_model, aiResult.processing_time_ms,
            req.userId
          ]);

          summary = summaryResult.rows[0];

          // Update conversation with quick-access fields
          await query(`
            UPDATE conversations 
            SET ai_summary = $1, ai_sentiment = $2
            WHERE id = $3
          `, [aiResult.summary, aiResult.sentiment, conversationId]);
        }
      }
    } catch (summaryError) {
      log('warn', 'Summary generation failed on finish', { error: summaryError.message });
    }

    res.json({ success: true, summary });
  } catch (error) {
    logError('Error finishing with summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete summary
router.delete('/:conversationId', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    await query(`
      DELETE FROM conversation_summaries 
      WHERE conversation_id = $1 AND organization_id = $2
    `, [req.params.conversationId, org.organization_id]);

    await query(`
      UPDATE conversations 
      SET ai_summary = NULL, ai_sentiment = NULL
      WHERE id = $1
    `, [req.params.conversationId]);

    res.json({ success: true });
  } catch (error) {
    logError('Error deleting summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
