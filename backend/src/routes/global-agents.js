import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Ensure tables exist
(async () => {
  try {
    await query(`SELECT 1 FROM global_ai_agents LIMIT 0`);
  } catch {
    // Tables not yet created - will be created by migration
  }
})();

// Helper: get user org
async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role FROM organization_members om WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

function isAdmin(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}

// Helper: check superadmin
async function requireSuperadmin(req, res, next) {
  const userResult = await query(`SELECT is_superadmin FROM users WHERE id = $1`, [req.userId]);
  if (!userResult.rows[0]?.is_superadmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

// =============================================
// SUPERADMIN ROUTES - Global Agent CRUD
// =============================================

// List all global agents (superadmin)
router.get('/admin/list', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT ga.*, 
        (SELECT COUNT(*) FROM global_agent_org_assignments WHERE global_agent_id = ga.id) as org_count,
        (SELECT COUNT(*) FROM global_agent_activations WHERE global_agent_id = ga.id AND is_active = true) as active_count
      FROM global_ai_agents ga
      ORDER BY ga.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing global agents:', err);
    res.status(500).json({ error: 'Erro ao listar agentes globais' });
  }
});

// Get single global agent (superadmin)
router.get('/admin/:id', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM global_ai_agents WHERE id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Agente não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar agente' });
  }
});

// Create global agent (superadmin)
router.post('/admin', requireSuperadmin, async (req, res) => {
  try {
    const {
      name, description, avatar_url, ai_provider, ai_model, ai_api_key,
      system_prompt, temperature, max_tokens, context_window,
      custom_fields, capabilities, handoff_message, handoff_keywords,
      greeting_message
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await query(`
      INSERT INTO global_ai_agents (
        name, description, avatar_url, ai_provider, ai_model, ai_api_key,
        system_prompt, temperature, max_tokens, context_window,
        custom_fields, capabilities, handoff_message, handoff_keywords,
        greeting_message, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      name, description || null, avatar_url || null,
      ai_provider || 'openai', ai_model || 'gpt-4o-mini', ai_api_key || null,
      system_prompt || 'Você é um assistente virtual profissional.',
      temperature || 0.7, max_tokens || 1000, context_window || 20,
      JSON.stringify(custom_fields || []),
      capabilities || ['respond_messages'],
      handoff_message || 'Vou transferir você para um atendente humano.',
      handoff_keywords || ['humano', 'atendente', 'pessoa'],
      greeting_message || null, req.userId
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating global agent:', err);
    res.status(500).json({ error: 'Erro ao criar agente global' });
  }
});

// Update global agent (superadmin)
router.patch('/admin/:id', requireSuperadmin, async (req, res) => {
  try {
    const allowed = [
      'name', 'description', 'avatar_url', 'ai_provider', 'ai_model', 'ai_api_key',
      'system_prompt', 'temperature', 'max_tokens', 'context_window',
      'custom_fields', 'capabilities', 'handoff_message', 'handoff_keywords',
      'greeting_message', 'is_active'
    ];

    const updates = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = key === 'custom_fields' ? JSON.stringify(req.body[key]) : req.body[key];
        updates.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE global_ai_agents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating global agent:', err);
    res.status(500).json({ error: 'Erro ao atualizar agente' });
  }
});

// Delete global agent (superadmin)
router.delete('/admin/:id', requireSuperadmin, async (req, res) => {
  try {
    await query(`DELETE FROM global_ai_agents WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar agente' });
  }
});

// =============================================
// SUPERADMIN - Organization assignments
// =============================================

// Get orgs assigned to an agent
router.get('/admin/:id/organizations', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT o.id, o.name, o.slug, o.logo_url,
        gaoa.assigned_at,
        (SELECT COUNT(*) FROM global_agent_activations 
         WHERE global_agent_id = $1 AND organization_id = o.id AND is_active = true) as active_connections
      FROM global_agent_org_assignments gaoa
      JOIN organizations o ON o.id = gaoa.organization_id
      WHERE gaoa.global_agent_id = $1
      ORDER BY o.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar organizações' });
  }
});

// Assign agent to organizations
router.put('/admin/:id/organizations', requireSuperadmin, async (req, res) => {
  try {
    const { organization_ids } = req.body;
    const agentId = req.params.id;

    // Remove existing assignments not in new list
    await query(`DELETE FROM global_agent_org_assignments WHERE global_agent_id = $1`, [agentId]);

    // Add new assignments
    for (const orgId of (organization_ids || [])) {
      await query(`
        INSERT INTO global_agent_org_assignments (global_agent_id, organization_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (global_agent_id, organization_id) DO NOTHING
      `, [agentId, orgId, req.userId]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error assigning orgs:', err);
    res.status(500).json({ error: 'Erro ao atribuir organizações' });
  }
});

// =============================================
// CLIENT ROUTES - Available agents for my org
// =============================================

// List agents available to my organization
router.get('/available', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.json([]);

    const result = await query(`
      SELECT ga.id, ga.name, ga.description, ga.avatar_url, ga.custom_fields, ga.is_active,
        ga.system_prompt, ga.greeting_message,
        act.id as activation_id, act.is_active as activation_active, 
        act.schedule_mode, act.schedule_windows, act.custom_field_values,
        act.prompt_additions, act.connection_id
      FROM global_agent_org_assignments gaoa
      JOIN global_ai_agents ga ON ga.id = gaoa.global_agent_id AND ga.is_active = true
      LEFT JOIN global_agent_activations act ON act.global_agent_id = ga.id AND act.organization_id = $1
      WHERE gaoa.organization_id = $1
      ORDER BY ga.name
    `, [org.organization_id]);

    // Group by agent (may have multiple activations for different connections)
    const agentMap = new Map();
    for (const row of result.rows) {
      if (!agentMap.has(row.id)) {
        agentMap.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description,
          avatar_url: row.avatar_url,
          custom_fields: row.custom_fields,
          system_prompt: row.system_prompt,
          greeting_message: row.greeting_message,
          activations: []
        });
      }
      if (row.activation_id) {
        agentMap.get(row.id).activations.push({
          id: row.activation_id,
          connection_id: row.connection_id,
          is_active: row.activation_active,
          schedule_mode: row.schedule_mode,
          schedule_windows: row.schedule_windows,
          custom_field_values: row.custom_field_values,
          prompt_additions: row.prompt_additions
        });
      }
    }

    res.json(Array.from(agentMap.values()));
  } catch (err) {
    console.error('Error listing available agents:', err);
    res.status(500).json({ error: 'Erro ao listar agentes disponíveis' });
  }
});

// Activate/configure a global agent on a connection
router.post('/activate', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    if (!isAdmin(org.role)) return res.status(403).json({ error: 'Apenas admins podem ativar agentes' });

    const { global_agent_id, connection_id, schedule_mode, schedule_windows, custom_field_values, prompt_additions } = req.body;

    if (!global_agent_id || !connection_id) {
      return res.status(400).json({ error: 'global_agent_id e connection_id são obrigatórios' });
    }

    // Verify assignment exists
    const assignment = await query(
      `SELECT 1 FROM global_agent_org_assignments WHERE global_agent_id = $1 AND organization_id = $2`,
      [global_agent_id, org.organization_id]
    );
    if (assignment.rows.length === 0) return res.status(403).json({ error: 'Agente não disponível para esta organização' });

    const result = await query(`
      INSERT INTO global_agent_activations (
        global_agent_id, organization_id, connection_id, is_active,
        schedule_mode, schedule_windows, custom_field_values, prompt_additions, activated_by
      ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
      ON CONFLICT (global_agent_id, connection_id) DO UPDATE SET
        is_active = true,
        schedule_mode = EXCLUDED.schedule_mode,
        schedule_windows = EXCLUDED.schedule_windows,
        custom_field_values = EXCLUDED.custom_field_values,
        prompt_additions = EXCLUDED.prompt_additions,
        activated_by = EXCLUDED.activated_by
      RETURNING *
    `, [
      global_agent_id, org.organization_id, connection_id,
      schedule_mode || 'manual',
      JSON.stringify(schedule_windows || []),
      JSON.stringify(custom_field_values || {}),
      prompt_additions || null,
      req.userId
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error activating global agent:', err);
    res.status(500).json({ error: 'Erro ao ativar agente' });
  }
});

// Update activation settings
router.patch('/activation/:id', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    if (!isAdmin(org.role)) return res.status(403).json({ error: 'Apenas admins' });

    const allowed = ['is_active', 'schedule_mode', 'schedule_windows', 'custom_field_values', 'prompt_additions'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const val = ['schedule_windows', 'custom_field_values'].includes(key) 
          ? JSON.stringify(req.body[key]) : req.body[key];
        updates.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });

    params.push(req.params.id);
    params.push(org.organization_id);
    const result = await query(
      `UPDATE global_agent_activations SET ${updates.join(', ')} 
       WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ativação não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating activation:', err);
    res.status(500).json({ error: 'Erro ao atualizar ativação' });
  }
});

// Deactivate (toggle off)
router.post('/deactivate/:id', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const result = await query(
      `UPDATE global_agent_activations SET is_active = false 
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [req.params.id, org.organization_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Ativação não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar' });
  }
});

// Delete activation
router.delete('/activation/:id', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    await query(
      `DELETE FROM global_agent_activations WHERE id = $1 AND organization_id = $2`,
      [req.params.id, org.organization_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover' });
  }
});

export default router;
