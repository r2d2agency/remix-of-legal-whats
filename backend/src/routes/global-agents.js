import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { callAI } from '../lib/ai-caller.js';
import { searchKnowledge } from '../lib/knowledge-processor.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

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
      greeting_message, fallback_message, has_knowledge_base
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await query(`
      INSERT INTO global_ai_agents (
        name, description, avatar_url, ai_provider, ai_model, ai_api_key,
        system_prompt, temperature, max_tokens, context_window,
        custom_fields, capabilities, handoff_message, handoff_keywords,
        greeting_message, fallback_message, has_knowledge_base, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
      greeting_message || null,
      fallback_message || 'Desculpe, não consegui entender.',
      has_knowledge_base || false,
      req.userId
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
      'greeting_message', 'fallback_message', 'has_knowledge_base', 'is_active'
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
// SUPERADMIN - Knowledge Base for Global Agents
// =============================================

// List knowledge sources for a global agent
router.get('/admin/:id/knowledge', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM global_agent_knowledge_sources 
      WHERE global_agent_id = $1 
      ORDER BY created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing knowledge:', err);
    res.status(500).json({ error: 'Erro ao listar fontes de conhecimento' });
  }
});

// Add knowledge source
router.post('/admin/:id/knowledge', requireSuperadmin, async (req, res) => {
  try {
    const { source_type, name, source_content, description } = req.body;
    if (!name || !source_content) return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });

    const result = await query(`
      INSERT INTO global_agent_knowledge_sources (global_agent_id, source_type, name, description, source_content, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.id, source_type || 'text', name, description || null, source_content, req.userId]);

    // Process the knowledge source asynchronously
    const sourceId = result.rows[0].id;
    processGlobalKnowledgeSource(sourceId).catch(err => {
      console.error('Error processing global knowledge source:', err);
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding knowledge:', err);
    res.status(500).json({ error: 'Erro ao adicionar fonte' });
  }
});

// Upload file as knowledge source (PDF/DOCX/TXT)
const knowledgeUpload = multer({
  dest: path.join(process.cwd(), 'uploads', 'knowledge-tmp'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não suportado. Use PDF, DOCX ou TXT.'));
  }
});

router.post('/admin/:id/knowledge/upload', requireSuperadmin, knowledgeUpload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const name = req.body.name || req.file.originalname;
    const mime = req.file.mimetype;
    let extractedText = '';

    if (mime === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    } else if (mime === 'text/plain') {
      extractedText = fs.readFileSync(filePath, 'utf-8');
    }

    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({ error: 'Não foi possível extrair texto do arquivo. Verifique se o documento contém texto legível.' });
    }

    const fileExt = path.extname(req.file.originalname).replace('.', '').toUpperCase();

    const result = await query(`
      INSERT INTO global_agent_knowledge_sources (global_agent_id, source_type, name, description, source_content, file_type, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.params.id, 'file', name, `Extraído de ${fileExt} (${(req.file.size / 1024).toFixed(0)} KB)`, extractedText, fileExt, req.userId]);

    const sourceId = result.rows[0].id;
    processGlobalKnowledgeSource(sourceId).catch(err => {
      console.error('Error processing uploaded knowledge source:', err);
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error uploading knowledge file:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar arquivo' });
  } finally {
    // Clean up temp file
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
  }
});

// Delete knowledge source
router.delete('/admin/:id/knowledge/:sourceId', requireSuperadmin, async (req, res) => {
  try {
    await query(`DELETE FROM global_agent_knowledge_chunks WHERE source_id = $1`, [req.params.sourceId]);
    await query(`DELETE FROM global_agent_knowledge_sources WHERE id = $1 AND global_agent_id = $2`, [req.params.sourceId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover fonte' });
  }
});

// =============================================
// SUPERADMIN - Agent Stats (tokens, sessions)
// =============================================

router.get('/admin/:id/stats', requireSuperadmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    const { days = 30 } = req.query;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - parseInt(days));

    // Total sessions and messages
    const totals = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(m.id) as total_messages,
        COALESCE(SUM(m.total_tokens), 0) as total_tokens,
        COALESCE(SUM(m.prompt_tokens), 0) as total_prompt_tokens,
        COALESCE(SUM(m.completion_tokens), 0) as total_completion_tokens,
        COUNT(DISTINCT s.contact_phone) as unique_contacts,
        COUNT(CASE WHEN s.handoff_requested = true THEN 1 END) as handoff_count
      FROM ai_agent_sessions s
      LEFT JOIN ai_agent_messages m ON m.session_id = s.id
      WHERE s.agent_id = $1 AND s.started_at >= $2
    `, [agentId, sinceDate.toISOString()]);

    // Daily breakdown for chart
    const daily = await query(`
      SELECT 
        DATE(s.started_at) as date,
        COUNT(DISTINCT s.id) as sessions,
        COUNT(m.id) as messages,
        COALESCE(SUM(m.total_tokens), 0) as tokens
      FROM ai_agent_sessions s
      LEFT JOIN ai_agent_messages m ON m.session_id = s.id
      WHERE s.agent_id = $1 AND s.started_at >= $2
      GROUP BY DATE(s.started_at)
      ORDER BY date ASC
    `, [agentId, sinceDate.toISOString()]);

    // Per-org breakdown
    const perOrg = await query(`
      SELECT 
        act.organization_id,
        o.name as org_name,
        COUNT(DISTINCT s.id) as sessions,
        COALESCE(SUM(m.total_tokens), 0) as tokens
      FROM global_agent_activations act
      JOIN organizations o ON o.id = act.organization_id
      LEFT JOIN connections c ON c.id = act.connection_id
      LEFT JOIN ai_agent_sessions s ON s.agent_id = $1 
        AND s.conversation_id IN (
          SELECT cv.id FROM conversations cv WHERE cv.connection_id = c.id
        )
        AND s.started_at >= $2
      LEFT JOIN ai_agent_messages m ON m.session_id = s.id
      WHERE act.global_agent_id = $1
      GROUP BY act.organization_id, o.name
      ORDER BY tokens DESC
    `, [agentId, sinceDate.toISOString()]);

    res.json({
      totals: totals.rows[0] || {},
      daily: daily.rows,
      perOrg: perOrg.rows,
    });
  } catch (err) {
    console.error('Error fetching agent stats:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// =============================================
// SUPERADMIN - Test Chat
// =============================================

router.post('/admin/:id/test', requireSuperadmin, async (req, res) => {
  try {
    const { message, history } = req.body;
    const agentResult = await query(`SELECT * FROM global_ai_agents WHERE id = $1`, [req.params.id]);
    const agent = agentResult.rows[0];
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    // Get AI config (agent key or org config)
    const apiKey = agent.ai_api_key;
    if (!apiKey) {
      // Try org AI config
      const org = await getUserOrganization(req.userId);
      if (org) {
        const configResult = await query(`SELECT ai_api_key, ai_provider FROM organizations WHERE id = $1`, [org.organization_id]);
        if (configResult.rows[0]?.ai_api_key) {
          agent.ai_api_key = configResult.rows[0].ai_api_key;
          if (!agent.ai_provider || agent.ai_provider === 'none') {
            agent.ai_provider = configResult.rows[0].ai_provider;
          }
        }
      }
    }

    if (!agent.ai_api_key) {
      return res.status(400).json({ error: 'Nenhuma API key configurada para este agente. Configure na aba IA.' });
    }

    // Build system prompt with knowledge base if enabled
    let systemPrompt = agent.system_prompt || 'Você é um assistente virtual profissional.';
    
    if (agent.has_knowledge_base) {
      try {
        const knowledgeResult = await query(`
          SELECT source_content, name FROM global_agent_knowledge_sources 
          WHERE global_agent_id = $1 AND status = 'completed'
          ORDER BY created_at DESC LIMIT 5
        `, [agent.id]);
        
        if (knowledgeResult.rows.length > 0) {
          systemPrompt += '\n\n=== BASE DE CONHECIMENTO ===\n';
          for (const src of knowledgeResult.rows) {
            systemPrompt += `\n--- ${src.name} ---\n${src.source_content.substring(0, 3000)}\n`;
          }
        }
      } catch (e) {
        console.error('Error loading knowledge for test:', e);
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const aiConfig = {
      provider: agent.ai_provider,
      apiKey: agent.ai_api_key,
      model: agent.ai_model,
    };

    const result = await callAI(aiConfig, messages, {
      temperature: agent.temperature || 0.7,
      maxTokens: agent.max_tokens || 1000,
    });

    res.json({
      response: result.content,
      tokens: result.tokensUsed,
      model: result.model,
    });
  } catch (err) {
    console.error('Error testing global agent:', err);
    res.status(500).json({ error: err.message || 'Erro ao testar agente' });
  }
});

// =============================================
// SUPERADMIN - Organization assignments
// =============================================

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

router.put('/admin/:id/organizations', requireSuperadmin, async (req, res) => {
  try {
    const { organization_ids } = req.body;
    const agentId = req.params.id;

    await query(`DELETE FROM global_agent_org_assignments WHERE global_agent_id = $1`, [agentId]);

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

router.get('/available', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.json([]);

    const result = await query(`
      SELECT ga.id, ga.name, ga.description, ga.avatar_url, ga.custom_fields, ga.is_active,
        ga.system_prompt, ga.greeting_message, ga.ai_provider, ga.ai_model, ga.capabilities,
        ga.has_knowledge_base,
        act.id as activation_id, act.is_active as activation_active, 
        act.schedule_mode, act.schedule_windows, act.custom_field_values,
        act.prompt_additions, act.connection_id, act.client_ai_api_key
      FROM global_agent_org_assignments gaoa
      JOIN global_ai_agents ga ON ga.id = gaoa.global_agent_id AND ga.is_active = true
      LEFT JOIN global_agent_activations act ON act.global_agent_id = ga.id AND act.organization_id = $1
      WHERE gaoa.organization_id = $1
      ORDER BY ga.name
    `, [org.organization_id]);

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
          ai_provider: row.ai_provider,
          ai_model: row.ai_model,
          capabilities: row.capabilities,
          has_knowledge_base: row.has_knowledge_base,
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
          prompt_additions: row.prompt_additions,
          client_ai_api_key: row.client_ai_api_key ? '***' : '', // mask the key
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

    const { global_agent_id, connection_id, schedule_mode, schedule_windows, custom_field_values, prompt_additions, client_ai_api_key } = req.body;

    if (!global_agent_id || !connection_id) {
      return res.status(400).json({ error: 'global_agent_id e connection_id são obrigatórios' });
    }

    const assignment = await query(
      `SELECT 1 FROM global_agent_org_assignments WHERE global_agent_id = $1 AND organization_id = $2`,
      [global_agent_id, org.organization_id]
    );
    if (assignment.rows.length === 0) return res.status(403).json({ error: 'Agente não disponível para esta organização' });

    const result = await query(`
      INSERT INTO global_agent_activations (
        global_agent_id, organization_id, connection_id, is_active,
        schedule_mode, schedule_windows, custom_field_values, prompt_additions, client_ai_api_key, activated_by
      ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (global_agent_id, connection_id) DO UPDATE SET
        is_active = true,
        schedule_mode = EXCLUDED.schedule_mode,
        schedule_windows = EXCLUDED.schedule_windows,
        custom_field_values = EXCLUDED.custom_field_values,
        prompt_additions = EXCLUDED.prompt_additions,
        client_ai_api_key = EXCLUDED.client_ai_api_key,
        activated_by = EXCLUDED.activated_by
      RETURNING *
    `, [
      global_agent_id, org.organization_id, connection_id,
      schedule_mode || 'manual',
      JSON.stringify(schedule_windows || []),
      JSON.stringify(custom_field_values || {}),
      prompt_additions || null,
      client_ai_api_key || null,
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

    const allowed = ['is_active', 'schedule_mode', 'schedule_windows', 'custom_field_values', 'prompt_additions', 'client_ai_api_key'];
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

// =============================================
// CLIENT - AI Models list
// =============================================
router.get('/models', async (req, res) => {
  res.json({
    openai: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Alta qualidade, multimodal' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Potente e rápido' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Econômico e rápido' },
    ],
    gemini: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Rápido e multimodal' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Econômico e rápido' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Alta qualidade' },
    ],
  });
});

// =============================================
// CLIENT - Test chat (validate AI before linking)
// =============================================
router.post('/test/:id', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    if (!isAdmin(org.role)) return res.status(403).json({ error: 'Apenas admins' });

    // Check agent is assigned to this org
    const assignment = await query(
      `SELECT 1 FROM global_agent_org_assignments WHERE global_agent_id = $1 AND organization_id = $2`,
      [req.params.id, org.organization_id]
    );
    if (assignment.rows.length === 0) return res.status(403).json({ error: 'Agente não disponível' });

    const agentResult = await query(`SELECT * FROM global_ai_agents WHERE id = $1`, [req.params.id]);
    const agent = agentResult.rows[0];
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const { message, history, client_ai_api_key, custom_name, prompt_additions } = req.body;

    // Resolve API key: client provided > agent key > org key
    let apiKey = client_ai_api_key || agent.ai_api_key;
    let provider = agent.ai_provider;
    if (!apiKey) {
      const configResult = await query(`SELECT ai_api_key, ai_provider FROM organizations WHERE id = $1`, [org.organization_id]);
      if (configResult.rows[0]?.ai_api_key) {
        apiKey = configResult.rows[0].ai_api_key;
        if (!provider || provider === 'none') provider = configResult.rows[0].ai_provider;
      }
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Nenhuma API key configurada. Informe sua chave na aba API Key.' });
    }

    // Build system prompt
    let systemPrompt = agent.system_prompt || 'Você é um assistente virtual profissional.';
    if (custom_name) {
      systemPrompt = `Seu nome é "${custom_name}". ` + systemPrompt;
    }
    if (prompt_additions) {
      systemPrompt += `\n\nInstruções adicionais do cliente:\n${prompt_additions}`;
    }

    // Include knowledge base
    if (agent.has_knowledge_base) {
      try {
        const knowledgeResult = await query(`
          SELECT source_content, name FROM global_agent_knowledge_sources 
          WHERE global_agent_id = $1 AND status = 'completed'
          ORDER BY created_at DESC LIMIT 5
        `, [agent.id]);
        if (knowledgeResult.rows.length > 0) {
          systemPrompt += '\n\n=== BASE DE CONHECIMENTO ===\n';
          for (const src of knowledgeResult.rows) {
            systemPrompt += `\n--- ${src.name} ---\n${src.source_content.substring(0, 3000)}\n`;
          }
        }
      } catch (e) {
        console.error('Error loading knowledge for client test:', e);
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const result = await callAI(
      { provider, apiKey, model: agent.ai_model },
      messages,
      { temperature: agent.temperature || 0.7, maxTokens: agent.max_tokens || 1000 }
    );

    res.json({ response: result.content, tokens: result.tokensUsed, model: result.model });
  } catch (err) {
    console.error('Error client testing global agent:', err);
    res.status(500).json({ error: err.message || 'Erro ao testar agente' });
  }
});

// =============================================
// Helper: Process global knowledge source
// =============================================
async function processGlobalKnowledgeSource(sourceId) {
  try {
    await query(`UPDATE global_agent_knowledge_sources SET status = 'processing' WHERE id = $1`, [sourceId]);
    
    const sourceResult = await query(`SELECT * FROM global_agent_knowledge_sources WHERE id = $1`, [sourceId]);
    const source = sourceResult.rows[0];
    if (!source) return;

    const text = source.source_content;
    
    // Simple chunking
    const chunkSize = 800;
    const overlap = 200;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.substring(i, i + chunkSize);
      if (chunk.trim().length > 20) {
        chunks.push(chunk);
      }
    }

    // Delete old chunks
    await query(`DELETE FROM global_agent_knowledge_chunks WHERE source_id = $1`, [sourceId]);

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      await query(`
        INSERT INTO global_agent_knowledge_chunks (source_id, content, chunk_index, char_count)
        VALUES ($1, $2, $3, $4)
      `, [sourceId, chunks[i], i, chunks[i].length]);
    }

    await query(`
      UPDATE global_agent_knowledge_sources 
      SET status = 'completed', chunk_count = $1, processed_at = NOW()
      WHERE id = $2
    `, [chunks.length, sourceId]);

  } catch (err) {
    console.error('Error processing global knowledge:', err);
    await query(`
      UPDATE global_agent_knowledge_sources SET status = 'failed', error_message = $1 WHERE id = $2
    `, [err.message, sourceId]).catch(() => {});
  }
}

export default router;
