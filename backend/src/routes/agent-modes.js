import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { logError, logInfo, getRecentLogs } from '../logger.js';
import { callAI } from '../lib/ai-caller.js';

const router = Router();

// Deactivates other autoreply configs in the same org that overlap by connection
// (only one autoreply per connection can be active at a time).
async function deactivateConflicting(agentId, organizationId, connectionIds) {
  const arr = Array.isArray(connectionIds) ? connectionIds : [];
  const r = await query(
    `UPDATE ai_agent_autoreply_config
        SET is_active = false, paused_until = NULL, updated_at = NOW()
      WHERE organization_id = $1
        AND agent_id <> $2
        AND is_active = true
        AND (
          COALESCE(array_length(connection_ids, 1), 0) = 0
          OR $3::int = 0
          OR connection_ids && $4::uuid[]
        )
      RETURNING agent_id`,
    [organizationId, agentId, arr.length, arr]
  );
  if (r.rowCount > 0) {
    logInfo('agent_modes.autoreply_conflict_deactivated', {
      activated_agent: agentId,
      deactivated_agents: r.rows.map((x) => x.agent_id),
    });
  }
  return r.rows.map((x) => x.agent_id);
}

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

// Logs em tempo real do processamento de Auto-Resposta (buffer em memória)
router.get('/debug/auto-reply-logs', authenticate, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '150'), 10) || 150, 1), 500);
    const level = typeof req.query.level === 'string' ? req.query.level : null;
    const logs = getRecentLogs({
      limit,
      level,
      eventPrefixes: ['auto_reply.', 'ai_caller.'],
    });
    res.json({ logs });
  } catch (error) {
    logError('agent_modes.debug_logs_error', error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

async function getUserContext(userId) {
  const r = await query(
    `SELECT u.id, u.name, u.email, om.organization_id, om.role
     FROM users u
     LEFT JOIN organization_members om ON om.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

async function ensureAgentOwnership(agentId, organizationId) {
  const r = await query(
    `SELECT id, organization_id, agent_mode, ai_provider, ai_model, ai_api_key,
            system_prompt, temperature, max_tokens
       FROM ai_agents WHERE id = $1 LIMIT 1`,
    [agentId]
  );
  const a = r.rows[0];
  if (!a) return null;
  if (a.organization_id !== organizationId) return null;
  return a;
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return ['openai', 'gemini', 'openrouter'].includes(provider) ? provider : null;
}

function cleanAIKey(value) {
  const key = String(value || '').trim();
  if (!key || key.startsWith('••')) return null;
  return key;
}

function inferProviderFromKey(apiKey, fallbackProvider = null) {
  const key = String(apiKey || '').trim();
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  return normalizeProvider(fallbackProvider) || 'openai';
}

function defaultModelForProvider(provider) {
  if (provider === 'gemini') return 'gemini-2.5-flash';
  if (provider === 'openrouter') return 'openai/gpt-4o-mini';
  return 'gpt-4o-mini';
}

function modelMatchesProvider(provider, model) {
  const m = String(model || '').trim().toLowerCase();
  if (!m) return false;
  if (provider === 'gemini') return m.startsWith('gemini-');
  if (provider === 'openrouter') return m.includes('/');
  if (provider === 'openai') return !m.includes('/') && !m.startsWith('gemini-');
  return false;
}

function resolveModelForProvider(provider, model) {
  return modelMatchesProvider(provider, model) ? String(model).trim() : defaultModelForProvider(provider);
}

async function getPublicTableColumns(tableName) {
  const r = await query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(r.rows.map((row) => row.column_name));
}

async function getOrganizationAIConfig(organizationId) {
  const r = await query(
    `SELECT ai_provider, ai_model, ai_api_key
       FROM organizations
      WHERE id = $1
      LIMIT 1`,
    [organizationId]
  ).catch((e) => {
    logError('agent_modes.org_ai_config.lookup', e);
    return { rows: [] };
  });

  const org = r.rows[0];
  const apiKey = cleanAIKey(org?.ai_api_key);
  if (!org || !apiKey || org.ai_provider === 'none') return null;

  const provider = normalizeProvider(org.ai_provider) || inferProviderFromKey(apiKey);
  return {
    provider,
    model: org.ai_model || defaultModelForProvider(provider),
    apiKey,
    keySource: 'organizations.ai_api_key',
  };
}

// ================= COPILOT ACTIONS =================

router.get('/:agentId/actions', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    const r = await query(
      `SELECT * FROM ai_agent_actions WHERE agent_id = $1 ORDER BY order_index ASC, created_at ASC`,
      [req.params.agentId]
    );
    res.json(r.rows);
  } catch (e) {
    logError('agent_modes.actions_list', e);
    res.status(500).json({ error: 'Erro ao listar ações' });
  }
});

router.post('/:agentId/actions', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const countR = await query(`SELECT COUNT(*)::int AS c FROM ai_agent_actions WHERE agent_id = $1`, [req.params.agentId]);
    if (countR.rows[0].c >= 4) {
      return res.status(400).json({ error: 'Máximo de 4 ações por agente. Edite ou remova uma existente.' });
    }

    const { name, icon, prompt, order_index } = req.body || {};
    if (!name || !prompt) return res.status(400).json({ error: 'name e prompt obrigatórios' });

    const r = await query(
      `INSERT INTO ai_agent_actions (agent_id, name, icon, prompt, order_index)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.agentId, String(name).slice(0, 80), icon || 'Sparkles', prompt, order_index ?? countR.rows[0].c]
    );
    res.json(r.rows[0]);
  } catch (e) {
    logError('agent_modes.actions_create', e);
    res.status(500).json({ error: 'Erro ao criar ação' });
  }
});

router.put('/:agentId/actions/:actionId', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    const { name, icon, prompt, order_index } = req.body || {};
    const r = await query(
      `UPDATE ai_agent_actions
         SET name = COALESCE($1, name),
             icon = COALESCE($2, icon),
             prompt = COALESCE($3, prompt),
             order_index = COALESCE($4, order_index),
             updated_at = NOW()
       WHERE id = $5 AND agent_id = $6 RETURNING *`,
      [name ? String(name).slice(0, 80) : null, icon ?? null, prompt ?? null, order_index ?? null, req.params.actionId, req.params.agentId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Ação não encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    logError('agent_modes.actions_update', e);
    res.status(500).json({ error: 'Erro ao atualizar ação' });
  }
});

router.delete('/:agentId/actions/:actionId', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    await query(`DELETE FROM ai_agent_actions WHERE id = $1 AND agent_id = $2`, [req.params.actionId, req.params.agentId]);
    res.json({ ok: true });
  } catch (e) {
    logError('agent_modes.actions_delete', e);
    res.status(500).json({ error: 'Erro ao remover ação' });
  }
});

// ===== COPILOT: list agents available for current user =====
router.get('/copilot/available', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `SELECT a.id, a.name, a.description, a.avatar_url,
              (SELECT COUNT(*)::int FROM ai_agent_actions WHERE agent_id = a.id) AS action_count
         FROM ai_agents a
        WHERE a.organization_id = $1 AND a.is_active = true AND a.agent_mode = 'copilot'
        ORDER BY a.name ASC`,
      [ctx.organization_id]
    );
    res.json(r.rows);
  } catch (e) {
    logError('agent_modes.copilot_available', e);
    res.status(500).json({ error: 'Erro ao listar copilotos' });
  }
});

// ===== COPILOT: run action against a conversation context =====
router.post('/:agentId/actions/:actionId/run', authenticate, async (req, res) => {
  try {
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const actR = await query(
      `SELECT * FROM ai_agent_actions WHERE id = $1 AND agent_id = $2 LIMIT 1`,
      [req.params.actionId, req.params.agentId]
    );
    const action = actR.rows[0];
    if (!action) return res.status(404).json({ error: 'Ação não encontrada' });

    const { conversation_id, last_n = 20 } = req.body || {};
    let history = '';
    if (conversation_id) {
      try {
        const msgR = await query(
          `SELECT from_me, content, created_at FROM chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC LIMIT $2`,
          [conversation_id, Math.min(Math.max(parseInt(last_n) || 20, 1), 80)]
        );
        history = msgR.rows
          .reverse()
          .map((m) => `${m.from_me ? 'VENDEDOR' : 'CLIENTE'}: ${String(m.content || '').slice(0, 800)}`)
          .join('\n');
      } catch (e) {
        logError('agent_modes.run_action.history', e);
      }
    }

    const orgConfig = await getOrganizationAIConfig(ctx.organization_id);
    const agentApiKey = cleanAIKey(agent.ai_api_key);
    let provider = null;
    let model = null;
    let apiKey = null;
    let keySource = null;

    if (orgConfig?.apiKey) {
      provider = orgConfig.provider;
      model = orgConfig.model;
      apiKey = orgConfig.apiKey;
      keySource = orgConfig.keySource;
    } else if (agentApiKey) {
      provider = normalizeProvider(agent.ai_provider) || inferProviderFromKey(agentApiKey);
      model = resolveModelForProvider(provider, agent.ai_model);
      apiKey = agentApiKey;
      keySource = 'ai_agents.ai_api_key';
    }

    const systemPrompt = `${agent.system_prompt || 'Você é um copiloto de vendas.'}\n\nVocê é o copiloto interno do vendedor. Responda direto, em português, prático, sem floreio. Nunca se apresente como IA.`;
    const userPrompt = `Tarefa: ${action.prompt}\n\n${history ? `Histórico recente da conversa:\n${history}` : 'Sem histórico fornecido.'}`;

    if (!apiKey) {
      logError('agent_modes.run_action.no_key', {
        organization_id: ctx.organization_id,
        agent_id: agent.id,
        agent_provider: agent.ai_provider,
        org_has_key: !!orgConfig?.apiKey,
      });
      return res.status(400).json({ error: 'Configure a chave de IA da organização' });
    }

    logInfo('agent_modes.run_action.resolved', {
      organization_id: ctx.organization_id,
      agent_id: agent.id,
      provider,
      model,
      key_source: keySource || 'env',
    });

    const aiRes = await callAI(
      { provider, model, apiKey },
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: Number(agent.temperature) || 0.7, maxTokens: Number(agent.max_tokens) || 800 }
    );

    res.json({ content: aiRes.content || '', tokens: aiRes.tokensUsed || 0, model: aiRes.model });
  } catch (e) {
    logError('agent_modes.run_action', e);
    res.status(500).json({ error: e.message || 'Erro ao executar ação' });
  }
});

// ================= AUTO-REPLY =================

router.get('/:agentId/autoreply', authenticate, async (req, res) => {
  try {
    await ensureAutoReplySchema();
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    const r = await query(`SELECT * FROM ai_agent_autoreply_config WHERE agent_id = $1 LIMIT 1`, [req.params.agentId]);
    res.json(r.rows[0] || null);
  } catch (e) {
    logError('agent_modes.autoreply_get', e);
    res.status(500).json({ error: 'Erro ao buscar config' });
  }
});

router.put('/:agentId/autoreply', authenticate, async (req, res) => {
  try {
    await ensureAutoReplySchema();
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const b = req.body || {};
    const fields = {
      filter_mode: ['all', 'include', 'exclude'].includes(b.filter_mode) ? b.filter_mode : 'all',
      included_tags: Array.isArray(b.included_tags) ? b.included_tags : [],
      excluded_tags: Array.isArray(b.excluded_tags) ? b.excluded_tags : [],
      included_contact_ids: Array.isArray(b.included_contact_ids) ? b.included_contact_ids : [],
      excluded_contact_ids: Array.isArray(b.excluded_contact_ids) ? b.excluded_contact_ids : [],
      included_groups: Array.isArray(b.included_groups) ? b.included_groups : [],
      excluded_groups: Array.isArray(b.excluded_groups) ? b.excluded_groups : [],
      schedule_enabled: !!b.schedule_enabled,
      schedule_windows: Array.isArray(b.schedule_windows) ? JSON.stringify(b.schedule_windows) : '[]',
      response_template: b.response_template ?? null,
      max_responses_per_contact: Number(b.max_responses_per_contact) || 1,
      connection_ids: Array.isArray(b.connection_ids) ? b.connection_ids : [],
      reply_mode: ['fixed', 'sdr'].includes(b.reply_mode) ? b.reply_mode : 'fixed',
      sdr_max_replies: Math.max(1, Math.min(50, Number(b.sdr_max_replies) || 5)),
      // Se vier explícito, usa; senão, salvar configurações = ativar (preserva valor no UPDATE)
      is_active: typeof b.is_active === 'boolean' ? b.is_active : true,
    };

    const r = await query(
      `INSERT INTO ai_agent_autoreply_config (
         agent_id, organization_id, filter_mode, included_tags, excluded_tags,
         included_contact_ids, excluded_contact_ids, included_groups, excluded_groups,
         schedule_enabled, schedule_windows, response_template, max_responses_per_contact,
         connection_ids, is_active, reply_mode, sdr_max_replies
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (agent_id) DO UPDATE SET
         filter_mode = EXCLUDED.filter_mode,
         included_tags = EXCLUDED.included_tags,
         excluded_tags = EXCLUDED.excluded_tags,
         included_contact_ids = EXCLUDED.included_contact_ids,
         excluded_contact_ids = EXCLUDED.excluded_contact_ids,
         included_groups = EXCLUDED.included_groups,
         excluded_groups = EXCLUDED.excluded_groups,
         schedule_enabled = EXCLUDED.schedule_enabled,
         schedule_windows = EXCLUDED.schedule_windows,
         response_template = EXCLUDED.response_template,
         max_responses_per_contact = EXCLUDED.max_responses_per_contact,
         connection_ids = EXCLUDED.connection_ids,
         is_active = EXCLUDED.is_active,
         reply_mode = EXCLUDED.reply_mode,
         sdr_max_replies = EXCLUDED.sdr_max_replies,
         updated_at = NOW()
       RETURNING *`,
      [
        req.params.agentId, ctx.organization_id, fields.filter_mode,
        fields.included_tags, fields.excluded_tags,
        fields.included_contact_ids, fields.excluded_contact_ids,
        fields.included_groups, fields.excluded_groups,
        fields.schedule_enabled, fields.schedule_windows,
        fields.response_template, fields.max_responses_per_contact,
        fields.connection_ids, fields.is_active,
        fields.reply_mode, fields.sdr_max_replies,
      ]
    );
    if (fields.is_active) {
      const deactivated = await deactivateConflicting(
        req.params.agentId, ctx.organization_id, fields.connection_ids,
      );
      if (deactivated.length) r.rows[0]._deactivated_conflicts = deactivated;
    }
    res.json(r.rows[0]);
  } catch (e) {
    logError('agent_modes.autoreply_put', e);
    res.status(500).json({ error: 'Erro ao salvar config' });
  }
});

router.post('/:agentId/autoreply/toggle', authenticate, async (req, res) => {
  try {
    await ensureAutoReplySchema();
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const agent = await ensureAgentOwnership(req.params.agentId, ctx.organization_id);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const { active, duration_minutes } = req.body || {};
    let pausedUntil = null;
    if (active && duration_minutes && Number(duration_minutes) > 0) {
      pausedUntil = new Date(Date.now() + Number(duration_minutes) * 60000).toISOString();
    }

    // Ensure row exists
    await query(
      `INSERT INTO ai_agent_autoreply_config (agent_id, organization_id, is_active)
       VALUES ($1, $2, false) ON CONFLICT (agent_id) DO NOTHING`,
      [req.params.agentId, ctx.organization_id]
    );

    const r = await query(
      `UPDATE ai_agent_autoreply_config
          SET is_active = $1, paused_until = $2, updated_at = NOW()
        WHERE agent_id = $3 RETURNING *`,
      [!!active, pausedUntil, req.params.agentId]
    );
    let deactivated = [];
    if (active && r.rows[0]) {
      deactivated = await deactivateConflicting(
        req.params.agentId, ctx.organization_id, r.rows[0].connection_ids || [],
      );
    }
    logInfo('agent_modes.autoreply_toggle', { agent_id: req.params.agentId, active: !!active, until: pausedUntil });
    if (deactivated.length && r.rows[0]) r.rows[0]._deactivated_conflicts = deactivated;
    res.json(r.rows[0]);
  } catch (e) {
    logError('agent_modes.autoreply_toggle_err', e);
    res.status(500).json({ error: 'Erro ao alternar auto-resposta' });
  }
});

// List active autoreply agents for current org (for chat header badge)
router.get('/autoreply/active', authenticate, async (req, res) => {
  try {
    await ensureAutoReplySchema();
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });
    const r = await query(
      `SELECT a.id, a.name, c.is_active, c.paused_until
         FROM ai_agent_autoreply_config c
         JOIN ai_agents a ON a.id = c.agent_id
        WHERE c.organization_id = $1 AND c.is_active = true
          AND (c.paused_until IS NULL OR c.paused_until > NOW())`,
      [ctx.organization_id]
    );
    res.json(r.rows);
  } catch (e) {
    logError('agent_modes.autoreply_active', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// Returns per-connection map: which autoreply agent is currently active on each connection.
router.get('/autoreply/by-connection', authenticate, async (req, res) => {
  try {
    await ensureAutoReplySchema();
    const ctx = await getUserContext(req.userId);
    if (!ctx?.organization_id) return res.status(403).json({ error: 'Sem organização' });

    const cfgR = await query(
      `SELECT c.agent_id, c.connection_ids, c.paused_until, c.schedule_enabled,
              c.schedule_windows, a.name AS agent_name
         FROM ai_agent_autoreply_config c
         JOIN ai_agents a ON a.id = c.agent_id
        WHERE c.organization_id = $1 AND c.is_active = true
          AND (c.paused_until IS NULL OR c.paused_until > NOW())`,
      [ctx.organization_id]
    );

    // All org connections (so "vale para todas" maps to every connection)
    const connR = await query(
      `SELECT id, name, phone_number, provider, status
         FROM connections WHERE organization_id = $1`,
      [ctx.organization_id]
    ).catch(() => ({ rows: [] }));

    const byConn = {};
    for (const c of connR.rows) {
      byConn[c.id] = {
        connection_id: c.id,
        connection_name: c.name,
        phone_number: c.phone_number,
        status: c.status,
        agent: null,
      };
    }

    for (const cfg of cfgR.rows) {
      const targets = Array.isArray(cfg.connection_ids) && cfg.connection_ids.length
        ? cfg.connection_ids
        : connR.rows.map((c) => c.id);
      for (const cid of targets) {
        if (!byConn[cid]) continue;
        // first active wins (deactivateConflicting guarantees at most one)
        if (!byConn[cid].agent) {
          byConn[cid].agent = {
            agent_id: cfg.agent_id,
            agent_name: cfg.agent_name,
            paused_until: cfg.paused_until,
            scoped_to_all: !cfg.connection_ids?.length,
          };
        }
      }
    }

    res.json(Object.values(byConn));
  } catch (e) {
    logError('agent_modes.autoreply_by_connection', e);
    res.status(500).json({ error: 'Erro ao listar status por conexão' });
  }
});

export default router;