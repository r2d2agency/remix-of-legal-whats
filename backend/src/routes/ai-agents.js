import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { logInfo, logError, getRecentLogs } from '../logger.js';
import { callAI, callAIWithTools } from '../lib/ai-caller.js';
import { processKnowledgeSource, searchKnowledge } from '../lib/knowledge-processor.js';

const router = Router();

// Helper to get user's organization and info
async function getUserContext(userId) {
  const result = await query(
    `SELECT u.id, u.name, u.email, om.organization_id, om.role 
     FROM users u 
     LEFT JOIN organization_members om ON om.user_id = u.id 
     WHERE u.id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ==================== AGENTES ====================

// Listar agentes da organização
router.get('/', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const result = await query(`
      SELECT 
        a.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM ai_knowledge_sources WHERE agent_id = a.id AND is_active = true) as knowledge_sources_count,
        (SELECT COUNT(*) FROM ai_agent_connections WHERE agent_id = a.id AND is_active = true) as connections_count,
        (SELECT COUNT(*) FROM ai_agent_sessions WHERE agent_id = a.id AND is_active = true) as active_sessions
      FROM ai_agents a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.organization_id = $1
      ORDER BY a.created_at DESC
    `, [userCtx.organization_id]);

    res.json(result.rows);
  } catch (error) {
    logError('ai_agents.list_error', error);
    res.status(500).json({ error: 'Erro ao buscar agentes' });
  }
});

// Logs em tempo real do processamento de IA (buffer em memória)
router.get('/debug/logs', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 300);
    const level = typeof req.query.level === 'string' ? req.query.level : null;

    const logs = getRecentLogs({
      limit,
      level,
      eventPrefixes: ['ai_agent_processor.', 'ai_caller.', 'knowledge_processor.', 'ai_agents.'],
    });

    res.json({ logs });
  } catch (error) {
    logError('ai_agents.debug_logs_error', error);
    res.status(500).json({ error: 'Erro ao buscar logs de IA' });
  }
});

// Buscar agente por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const result = await query(`
      SELECT 
        a.*,
        u.name as created_by_name
      FROM ai_agents a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1 AND a.organization_id = $2
    `, [req.params.id, userCtx.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.get_error', error);
    res.status(500).json({ error: 'Erro ao buscar agente', details: error.message });
  }
});

// Criar agente
router.post('/', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const {
      name,
      description,
      avatar_url,
      ai_provider = 'openai',
      ai_model = 'gpt-4o-mini',
      ai_api_key,
      system_prompt,
      personality_traits = [],
      language = 'pt-BR',
      temperature = 0.7,
      max_tokens = 1000,
      context_window = 10,
      capabilities = ['respond_messages'],
      greeting_message,
      fallback_message,
      handoff_message,
      handoff_keywords = ['humano', 'atendente', 'pessoa'],
      auto_handoff_after_failures = 3,
      default_department_id,
      default_user_id,
      lead_scoring_criteria = {},
      auto_create_deal_funnel_id,
      auto_create_deal_stage_id,
      call_agent_config = {}
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

     const result = await query(`
      INSERT INTO ai_agents (
        organization_id, name, description, avatar_url,
        ai_provider, ai_model, ai_api_key,
        system_prompt, personality_traits, language,
        temperature, max_tokens, context_window,
        capabilities, greeting_message, fallback_message, handoff_message,
        handoff_keywords, auto_handoff_after_failures,
        default_department_id, default_user_id,
        lead_scoring_criteria, auto_create_deal_funnel_id, auto_create_deal_stage_id,
        call_agent_config,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14::agent_capability[], $15, $16, $17, $18::text[], $19,
        $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *
    `, [
      userCtx.organization_id, name, description, avatar_url,
      ai_provider, ai_model, ai_api_key,
      system_prompt || 'Você é um assistente virtual prestativo e profissional.',
      JSON.stringify(personality_traits), language,
      temperature, max_tokens, context_window,
      capabilities, greeting_message, fallback_message, handoff_message,
      handoff_keywords, auto_handoff_after_failures,
      default_department_id || null, default_user_id || null,
      JSON.stringify(lead_scoring_criteria), auto_create_deal_funnel_id || null, auto_create_deal_stage_id || null,
      JSON.stringify(call_agent_config),
      userCtx.id
    ]);

    logInfo('ai_agents.created', { agentId: result.rows[0].id, userId: userCtx.id });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.create_error', error);
    res.status(500).json({ error: 'Erro ao criar agente', details: error.message });
  }
});

// Atualizar agente
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    // Verificar propriedade
    const check = await query(
      'SELECT id FROM ai_agents WHERE id = $1 AND organization_id = $2',
      [req.params.id, userCtx.organization_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const allowedFields = [
      'name', 'description', 'avatar_url', 'is_active',
      'ai_provider', 'ai_model', 'ai_api_key',
      'system_prompt', 'personality_traits', 'language',
      'temperature', 'max_tokens', 'context_window',
      'capabilities', 'greeting_message', 'fallback_message', 'handoff_message',
      'handoff_keywords', 'auto_handoff_after_failures',
      'default_department_id', 'default_user_id',
      'lead_scoring_criteria', 'auto_create_deal_funnel_id', 'auto_create_deal_stage_id',
      'call_agent_config',
      'notify_external_enabled', 'notify_external_phone', 'notify_external_summary'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

     for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
         // Ensure correct Postgres types for array columns
         let assignment = `${field} = $${paramIndex}`;
         if (field === 'capabilities') assignment = `${field} = $${paramIndex}::agent_capability[]`;
         if (field === 'handoff_keywords') assignment = `${field} = $${paramIndex}::text[]`;

         updates.push(assignment);
        let value = req.body[field];
        // Convert empty strings to null for UUID foreign key fields
        if (['default_user_id', 'default_department_id', 'auto_create_deal_funnel_id', 'auto_create_deal_stage_id'].includes(field) && (value === '' || value === null)) {
          value = null;
        }
        if (['personality_traits', 'lead_scoring_criteria', 'call_agent_config'].includes(field) && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.id);
    const result = await query(`
      UPDATE ai_agents 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.update_error', error);
    res.status(500).json({ error: 'Erro ao atualizar agente', details: error.message });
  }
});

// Deletar agente
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const result = await query(
      'DELETE FROM ai_agents WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, userCtx.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('ai_agents.delete_error', error);
    res.status(500).json({ error: 'Erro ao deletar agente' });
  }
});

// Toggle ativo/inativo
router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const result = await query(`
      UPDATE ai_agents 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING id, is_active
    `, [req.params.id, userCtx.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.toggle_error', error);
    res.status(500).json({ error: 'Erro ao alternar agente' });
  }
});

// ==================== KNOWLEDGE BASE ====================

// Listar fontes de conhecimento de um agente
router.get('/:id/knowledge', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ks.*,
        u.name as created_by_name
      FROM ai_knowledge_sources ks
      LEFT JOIN users u ON ks.created_by = u.id
      WHERE ks.agent_id = $1
      ORDER BY ks.priority DESC, ks.created_at DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    logError('ai_agents.knowledge_list_error', error);
    res.status(500).json({ error: 'Erro ao buscar fontes de conhecimento' });
  }
});

// Adicionar fonte de conhecimento
router.post('/:id/knowledge', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const {
      source_type,
      name,
      description,
      source_content,
      file_type,
      file_size,
      original_filename,
      priority = 0
    } = req.body;

    if (!source_type || !name || !source_content) {
      return res.status(400).json({ error: 'Tipo, nome e conteúdo são obrigatórios' });
    }

    // Verificar propriedade do agente
    const agentCheck = await query(
      'SELECT id FROM ai_agents WHERE id = $1 AND organization_id = $2',
      [req.params.id, userCtx.organization_id]
    );

    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const result = await query(`
      INSERT INTO ai_knowledge_sources (
        agent_id, source_type, name, description, source_content,
        file_type, file_size, original_filename, priority,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
      RETURNING *
    `, [
      req.params.id, source_type, name, description, source_content,
      file_type, file_size, original_filename, priority,
      userCtx.id
    ]);

    // Disparar processamento assíncrono para chunking + embeddings
    processKnowledgeSource(result.rows[0].id).catch(err => {
      logError('ai_agents.knowledge_process_background_error', err);
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.knowledge_add_error', error);
    res.status(500).json({ error: 'Erro ao adicionar fonte de conhecimento', details: error.message });
  }
});

// Atualizar fonte de conhecimento
router.patch('/:id/knowledge/:sourceId', authenticate, async (req, res) => {
  try {
    const { name, description, priority, is_active } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.sourceId, req.params.id);

    const result = await query(`
      UPDATE ai_knowledge_sources 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${idx++} AND agent_id = $${idx}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fonte não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.knowledge_update_error', error);
    res.status(500).json({ error: 'Erro ao atualizar fonte' });
  }
});

// Deletar fonte de conhecimento
router.delete('/:id/knowledge/:sourceId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM ai_knowledge_sources WHERE id = $1 AND agent_id = $2 RETURNING id',
      [req.params.sourceId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fonte não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('ai_agents.knowledge_delete_error', error);
    res.status(500).json({ error: 'Erro ao deletar fonte' });
  }
});

// Reprocessar fonte de conhecimento
router.post('/:id/knowledge/:sourceId/reprocess', authenticate, async (req, res) => {
  try {
    const result = await query(`
      UPDATE ai_knowledge_sources 
      SET status = 'pending', error_message = NULL, updated_at = NOW()
      WHERE id = $1 AND agent_id = $2
      RETURNING *
    `, [req.params.sourceId, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fonte não encontrada' });
    }

    // Disparar reprocessamento assíncrono
    processKnowledgeSource(req.params.sourceId).catch(err => {
      logError('ai_agents.knowledge_reprocess_background_error', err);
    });

    res.json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.knowledge_reprocess_error', error);
    res.status(500).json({ error: 'Erro ao reprocessar fonte' });
  }
});

// Buscar na base de conhecimento (RAG search)
router.post('/:id/knowledge/search', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { query: searchQuery, top_k = 5 } = req.body;
    if (!searchQuery) {
      return res.status(400).json({ error: 'Query é obrigatória' });
    }

    // Get agent and AI config
    const agentResult = await query(
      `SELECT a.*, org.ai_provider as org_ai_provider, org.ai_api_key as org_ai_api_key
       FROM ai_agents a
       JOIN organizations org ON org.id = a.organization_id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, userCtx.organization_id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const agent = agentResult.rows[0];
    const provider = agent.ai_provider || agent.org_ai_provider || 'openai';
    const apiKey = agent.ai_api_key || agent.org_ai_api_key;

    if (!apiKey) {
      return res.status(400).json({ error: 'Nenhuma API key configurada' });
    }

    const results = await searchKnowledge(req.params.id, searchQuery, { provider, apiKey }, top_k);
    res.json({ results });
  } catch (error) {
    logError('ai_agents.knowledge_search_error', error);
    res.status(500).json({ error: 'Erro ao buscar na base de conhecimento', details: error.message });
  }
});

// Processar fonte manualmente
router.post('/:id/knowledge/:sourceId/process', authenticate, async (req, res) => {
  try {
    const result = await processKnowledgeSource(req.params.sourceId);
    res.json(result);
  } catch (error) {
    logError('ai_agents.knowledge_process_error', error);
    res.status(500).json({ error: 'Erro ao processar fonte' });
  }
});

// ==================== CONSULTA IA (Chat Sidebar) ====================

// Consultar agente de IA com contexto de conversa
router.post('/:id/consult', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { messages: chatMessages, custom_prompt } = req.body;
    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return res.status(400).json({ error: 'Mensagens da conversa são obrigatórias' });
    }

    // Get agent with org AI config fallback
    const agentResult = await query(
      `SELECT a.*, org.ai_provider as org_ai_provider, org.ai_api_key as org_ai_api_key
       FROM ai_agents a
       JOIN organizations org ON org.id = a.organization_id
       WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, userCtx.organization_id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const agent = agentResult.rows[0];
    const provider = agent.ai_provider || agent.org_ai_provider || 'openai';
    const apiKey = agent.ai_api_key || agent.org_ai_api_key;

    if (!apiKey) {
      return res.status(400).json({ error: 'Nenhuma API key configurada para este agente' });
    }

    // Build conversation context string
    const conversationContext = chatMessages
      .slice(-30) // last 30 messages
      .map(m => `[${m.sender === 'me' ? 'Atendente' : 'Cliente'}]: ${m.content || '(mídia)'}`)
      .join('\n');

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    if (custom_prompt) {
      try {
        const knowledgeResults = await searchKnowledge(req.params.id, custom_prompt, { provider, apiKey }, 3);
        if (knowledgeResults.length > 0) {
          knowledgeContext = '\n\n--- Base de Conhecimento ---\n' +
            knowledgeResults.map(r => r.content).join('\n---\n');
        }
      } catch (e) {
        logError('ai_agents.consult_knowledge_error', e);
      }
    }

    // Build the system prompt for consultation
    const agentDesc = agent.description?.trim() ? `\n\n${agent.description.trim()}` : '';
    const systemPrompt = `${agent.system_prompt}${agentDesc}

Você está sendo consultado por um atendente humano que precisa de sua ajuda durante um atendimento ao cliente.
Analise o histórico da conversa abaixo e responda à solicitação do atendente.

Seja direto, prático e forneça sugestões acionáveis.
Se for pedido de ajuda com fechamento, sugira frases e argumentos.
Se for elaboração de resposta, escreva a resposta pronta para enviar.
Se for análise, forneça insights sobre o cliente e a situação.
${knowledgeContext}

--- Histórico da Conversa ---
${conversationContext}
--- Fim do Histórico ---`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: custom_prompt || 'Analise esta conversa e me dê sugestões de como proceder com este atendimento.' },
    ];

    const result = await callAI(
      { provider, model: agent.ai_model, apiKey },
      aiMessages,
      { temperature: parseFloat(agent.temperature) || 0.7, maxTokens: parseInt(agent.max_tokens) || 1500 }
    );

    res.json({
      response: result.content,
      tokens_used: result.tokensUsed,
      model: result.model,
      agent_name: agent.name,
    });
  } catch (error) {
    logError('ai_agents.consult_error', error);
    const errorMsg = error?.message || 'Erro desconhecido';
    res.status(500).json({ error: `Erro ao consultar agente de IA: ${errorMsg}` });
  }
});

// ==================== CONEXÕES WHATSAPP ====================

// Listar conexões vinculadas ao agente
router.get('/:id/connections', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ac.*,
        c.name as connection_name,
        c.phone_number as connection_phone,
        c.status as connection_status
      FROM ai_agent_connections ac
      JOIN connections c ON ac.connection_id = c.id
      WHERE ac.agent_id = $1
      ORDER BY ac.priority DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    logError('ai_agents.connections_list_error', error);
    res.status(500).json({ error: 'Erro ao buscar conexões' });
  }
});

// Vincular agente a uma conexão
router.post('/:id/connections', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const {
      connection_id,
      mode = 'always',
      trigger_keywords = [],
      business_hours_start = '08:00',
      business_hours_end = '18:00',
      business_days = [1, 2, 3, 4, 5],
      priority = 0
    } = req.body;

    if (!connection_id) {
      return res.status(400).json({ error: 'connection_id é obrigatório' });
    }

    // Verificar se a conexão pertence à organização
    const connCheck = await query(
      'SELECT id FROM connections WHERE id = $1 AND organization_id = $2',
      [connection_id, userCtx.organization_id]
    );

    if (connCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const result = await query(`
      INSERT INTO ai_agent_connections (
        agent_id, connection_id, mode, trigger_keywords,
        business_hours_start, business_hours_end, business_days, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (agent_id, connection_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        trigger_keywords = EXCLUDED.trigger_keywords,
        business_hours_start = EXCLUDED.business_hours_start,
        business_hours_end = EXCLUDED.business_hours_end,
        business_days = EXCLUDED.business_days,
        priority = EXCLUDED.priority,
        is_active = true
      RETURNING *
    `, [
      req.params.id, connection_id, mode, trigger_keywords,
      business_hours_start, business_hours_end, business_days, priority
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.connection_link_error', error);
    res.status(500).json({ error: 'Erro ao vincular agente' });
  }
});

// Desvincular agente de uma conexão
router.delete('/:id/connections/:connectionId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM ai_agent_connections WHERE agent_id = $1 AND connection_id = $2 RETURNING id',
      [req.params.id, req.params.connectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vínculo não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('ai_agents.connection_unlink_error', error);
    res.status(500).json({ error: 'Erro ao desvincular agente' });
  }
});

// ==================== ESTATÍSTICAS ====================

// Estatísticas do agente
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [req.params.id];

    if (start_date && end_date) {
      dateFilter = 'AND date >= $2 AND date <= $3';
      params.push(start_date, end_date);
    }

    // Estatísticas agregadas
    const statsResult = await query(`
      SELECT
        COALESCE(SUM(total_sessions), 0) as total_sessions,
        COALESCE(SUM(total_messages), 0) as total_messages,
        COALESCE(SUM(total_tokens_used), 0) as total_tokens_used,
        COALESCE(SUM(handoff_count), 0) as handoff_count,
        COALESCE(AVG(avg_response_time_ms), 0) as avg_response_time_ms,
        COALESCE(SUM(positive_feedback_count), 0) as positive_feedback,
        COALESCE(SUM(negative_feedback_count), 0) as negative_feedback,
        COALESCE(SUM(deals_created), 0) as deals_created,
        COALESCE(SUM(meetings_scheduled), 0) as meetings_scheduled,
        COALESCE(SUM(leads_qualified), 0) as leads_qualified
      FROM ai_agent_stats
      WHERE agent_id = $1 ${dateFilter}
    `, params);

    // Dados diários
    const dailyResult = await query(`
      SELECT 
        date,
        total_sessions,
        total_messages,
        handoff_count,
        deals_created
      FROM ai_agent_stats
      WHERE agent_id = $1 ${dateFilter}
      ORDER BY date DESC
      LIMIT 30
    `, params);

    // Sessões ativas
    const activeResult = await query(
      'SELECT COUNT(*) as count FROM ai_agent_sessions WHERE agent_id = $1 AND is_active = true',
      [req.params.id]
    );

    res.json({
      summary: statsResult.rows[0],
      daily: dailyResult.rows,
      active_sessions: parseInt(activeResult.rows[0].count)
    });
  } catch (error) {
    logError('ai_agents.stats_error', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// ==================== PROCESSAR MENSAGEM (TEST & PRODUÇÃO) ====================

/**
 * Get AI config for an agent (agent-specific key or org fallback)
 */
async function getAgentAIConfig(agent, organizationId) {
  if (agent.ai_api_key) {
    return {
      provider: agent.ai_provider,
      model: agent.ai_model,
      apiKey: agent.ai_api_key,
    };
  }

  // Fallback to org AI config
  const orgResult = await query(
    `SELECT ai_provider, ai_model, ai_api_key FROM organizations WHERE id = $1`,
    [organizationId]
  );
  const org = orgResult.rows[0];

  if (!org || !org.ai_api_key || org.ai_provider === 'none') {
    throw new Error('Nenhuma chave de API configurada. Configure uma API Key no agente ou nas configurações da organização.');
  }

  return {
    provider: org.ai_provider || agent.ai_provider,
    model: agent.ai_model || org.ai_model || (org.ai_provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'),
    apiKey: org.ai_api_key,
  };
}

/**
 * Build the call_agent tool definition for OpenAI/Gemini
 */
function buildCallAgentTool(availableAgents) {
  const agentNames = availableAgents.map(a => a.name);
  const agentDescriptions = availableAgents.map(a => `- ${a.name}: ${a.description || a.system_prompt?.substring(0, 100) || 'Agente especialista'}`).join('\n');

  return {
    type: 'function',
    function: {
      name: 'consult_specialist_agent',
      description: `Consulta outro agente especialista da equipe para obter informações sobre um assunto específico. Agentes disponíveis:\n${agentDescriptions}`,
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: `Nome do agente a consultar. Opções: ${agentNames.join(', ')}`,
          },
          question: {
            type: 'string',
            description: 'A pergunta ou contexto a enviar para o agente especialista',
          },
        },
        required: ['agent_name', 'question'],
      },
    },
  };
}

// ==================== TOOL: CREATE DEAL ====================

function buildCreateDealTool(funnels) {
  const funnelDesc = funnels.map(f => `- Funil "${f.name}" (id: ${f.id}), etapas: ${f.stages.map(s => `"${s.name}" (id: ${s.id})`).join(', ')}`).join('\n');
  return {
    type: 'function',
    function: {
      name: 'create_deal',
      description: `Cria um novo negócio/deal no CRM. Funis disponíveis:\n${funnelDesc}`,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título do negócio' },
          value: { type: 'number', description: 'Valor do negócio em reais' },
          funnel_id: { type: 'string', description: 'ID do funil' },
          stage_id: { type: 'string', description: 'ID da etapa no funil' },
          description: { type: 'string', description: 'Descrição do negócio' },
          expected_close_date: { type: 'string', description: 'Data prevista de fechamento (YYYY-MM-DD)' },
        },
        required: ['title', 'funnel_id', 'stage_id'],
      },
    },
  };
}

async function executeCreateDeal(organizationId, userId, args) {
  try {
    const result = await query(`
      INSERT INTO crm_deals (organization_id, funnel_id, stage_id, title, value, description, expected_close_date, created_by, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING id, title, value, status
    `, [
      organizationId, args.funnel_id, args.stage_id, args.title,
      args.value || 0, args.description || null,
      args.expected_close_date || null, userId
    ]);
    const deal = result.rows[0];
    logInfo('ai_agents.tool_create_deal', { dealId: deal.id, title: deal.title });
    return `Negócio "${deal.title}" criado com sucesso (ID: ${deal.id}, valor: R$ ${deal.value})`;
  } catch (error) {
    logError('ai_agents.tool_create_deal_error', error);
    return `Erro ao criar negócio: ${error.message}`;
  }
}

// ==================== TOOL: MANAGE TASKS ====================

function buildManageTasksTool() {
  return {
    type: 'function',
    function: {
      name: 'manage_tasks',
      description: 'Cria ou lista tarefas no CRM. Use action "create" para criar ou "list" para listar tarefas pendentes.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list'], description: 'Ação: create ou list' },
          title: { type: 'string', description: 'Título da tarefa (para create)' },
          description: { type: 'string', description: 'Descrição da tarefa (para create)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Prioridade (para create)' },
          type: { type: 'string', enum: ['task', 'call', 'meeting', 'email', 'follow_up'], description: 'Tipo da tarefa (para create)' },
          due_date: { type: 'string', description: 'Data de vencimento ISO 8601 (para create)' },
          limit: { type: 'number', description: 'Quantidade máxima de tarefas a listar (para list, padrão 10)' },
        },
        required: ['action'],
      },
    },
  };
}

async function executeManageTasks(organizationId, userId, args) {
  try {
    if (args.action === 'create') {
      if (!args.title) return 'Título da tarefa é obrigatório';
      const result = await query(`
        INSERT INTO crm_tasks (organization_id, assigned_to, created_by, title, description, type, priority, due_date)
        VALUES ($1, $2, $2, $3, $4, $5, $6, $7)
        RETURNING id, title, priority, due_date, status
      `, [
        organizationId, userId, args.title, args.description || null,
        args.type || 'task', args.priority || 'medium', args.due_date || null
      ]);
      const task = result.rows[0];
      logInfo('ai_agents.tool_create_task', { taskId: task.id });
      return `Tarefa "${task.title}" criada (ID: ${task.id}, prioridade: ${task.priority}, vencimento: ${task.due_date || 'sem data'})`;
    } else {
      const limit = Math.min(args.limit || 10, 20);
      const result = await query(`
        SELECT id, title, priority, type, due_date, status
        FROM crm_tasks
        WHERE organization_id = $1 AND status IN ('pending', 'in_progress')
        ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date ASC NULLS LAST
        LIMIT $2
      `, [organizationId, limit]);
      if (result.rows.length === 0) return 'Nenhuma tarefa pendente encontrada.';
      const list = result.rows.map(t => `- [${t.priority}] ${t.title} (${t.type}, vence: ${t.due_date || 'sem data'}, status: ${t.status})`).join('\n');
      return `${result.rows.length} tarefas pendentes:\n${list}`;
    }
  } catch (error) {
    logError('ai_agents.tool_manage_tasks_error', error);
    return `Erro ao gerenciar tarefas: ${error.message}`;
  }
}

// ==================== TOOL: QUALIFY LEADS ====================

function buildQualifyLeadsTool() {
  return {
    type: 'function',
    function: {
      name: 'qualify_lead',
      description: 'Qualifica um lead atribuindo uma pontuação de 0 a 100 com base na conversa. Use para avaliar o potencial do lead como cliente.',
      parameters: {
        type: 'object',
        properties: {
          score: { type: 'number', description: 'Pontuação de 0 a 100 (0=frio, 100=muito quente)' },
          qualification: { type: 'string', enum: ['cold', 'warm', 'hot', 'very_hot'], description: 'Classificação do lead' },
          reasoning: { type: 'string', description: 'Justificativa da qualificação em 1-2 frases' },
          recommended_action: { type: 'string', description: 'Ação recomendada (ex: agendar reunião, enviar proposta, nurturing)' },
          key_interests: { type: 'string', description: 'Interesses principais identificados, separados por vírgula' },
        },
        required: ['score', 'qualification', 'reasoning'],
      },
    },
  };
}

async function executeQualifyLead(organizationId, args) {
  // This tool returns the qualification data for the AI to incorporate in response
  // In real chat flow, this would also update the contact's lead score in DB
  logInfo('ai_agents.tool_qualify_lead', { score: args.score, qualification: args.qualification });
  return JSON.stringify({
    score: args.score,
    qualification: args.qualification,
    reasoning: args.reasoning,
    recommended_action: args.recommended_action || 'Sem ação definida',
    key_interests: args.key_interests || '',
  });
}

// ==================== TOOL: SUMMARIZE HISTORY ====================

function buildSummarizeHistoryTool() {
  return {
    type: 'function',
    function: {
      name: 'summarize_conversation',
      description: 'Gera um resumo estruturado da conversa atual com pontos-chave, próximos passos e sentimento do cliente.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Resumo da conversa em 2-3 parágrafos' },
          key_points: { type: 'string', description: 'Pontos-chave da conversa, separados por |' },
          customer_sentiment: { type: 'string', enum: ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'], description: 'Sentimento geral do cliente' },
          next_steps: { type: 'string', description: 'Próximos passos recomendados, separados por |' },
          topics_discussed: { type: 'string', description: 'Temas discutidos, separados por vírgula' },
        },
        required: ['summary', 'key_points', 'customer_sentiment'],
      },
    },
  };
}

async function executeSummarizeHistory(args) {
  logInfo('ai_agents.tool_summarize', { sentiment: args.customer_sentiment });
  return JSON.stringify({
    summary: args.summary,
    key_points: (args.key_points || '').split('|').map(s => s.trim()).filter(Boolean),
    customer_sentiment: args.customer_sentiment,
    next_steps: (args.next_steps || '').split('|').map(s => s.trim()).filter(Boolean),
    topics_discussed: (args.topics_discussed || '').split(',').map(s => s.trim()).filter(Boolean),
  });
}

// ==================== TOOL: READ FILES ====================

function buildReadFilesTool() {
  return {
    type: 'function',
    function: {
      name: 'analyze_file',
      description: 'Analisa o conteúdo de um arquivo enviado pelo cliente (imagem, PDF, documento). Descreva o que o cliente enviou e forneça uma análise útil.',
      parameters: {
        type: 'object',
        properties: {
          file_description: { type: 'string', description: 'Descrição do arquivo recebido baseada no contexto da conversa' },
          analysis_type: { type: 'string', enum: ['general', 'document', 'image', 'contract', 'invoice', 'report'], description: 'Tipo de análise a realizar' },
          analysis: { type: 'string', description: 'Análise detalhada do conteúdo do arquivo' },
          key_findings: { type: 'string', description: 'Principais descobertas, separadas por |' },
          recommendations: { type: 'string', description: 'Recomendações baseadas na análise, separadas por |' },
        },
        required: ['file_description', 'analysis_type', 'analysis'],
      },
    },
  };
}

async function executeReadFiles(args) {
  logInfo('ai_agents.tool_read_files', { type: args.analysis_type });
  return JSON.stringify({
    file_description: args.file_description,
    analysis_type: args.analysis_type,
    analysis: args.analysis,
    key_findings: (args.key_findings || '').split('|').map(s => s.trim()).filter(Boolean),
    recommendations: (args.recommendations || '').split('|').map(s => s.trim()).filter(Boolean),
  });
}

// ==================== TOOL: SCHEDULE MEETINGS ====================

function buildScheduleMeetingsTool() {
  return {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description: `Agenda uma reunião ou encontro. Ações disponíveis:
- "check_agenda": Consulta a agenda de um responsável específico para ver compromissos existentes. SEMPRE use antes de agendar.
- "find_available_slots": Busca horários livres na agenda do responsável.
- "create": Cria a reunião após verificar conflitos na agenda do responsável.`,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'check_agenda', 'find_available_slots'], description: 'Ação a executar. Use check_agenda ou find_available_slots ANTES de criar.' },
          title: { type: 'string', description: 'Título da reunião (para create)' },
          date: { type: 'string', description: 'Data e hora da reunião (ISO 8601, ex: 2025-01-15T14:00:00) (para create)' },
          duration_minutes: { type: 'number', description: 'Duração em minutos (padrão: 60)' },
          assigned_to_name: { type: 'string', description: 'Nome ou email do responsável cuja agenda será verificada. Se não informado, usa o responsável padrão do agente.' },
          attendees: { type: 'string', description: 'Participantes, separados por vírgula' },
          location: { type: 'string', description: 'Local ou link da reunião' },
          notes: { type: 'string', description: 'Observações ou pauta da reunião' },
          days_ahead: { type: 'number', description: 'Dias à frente para buscar (padrão: 7)' },
          preferred_period: { type: 'string', enum: ['morning', 'afternoon', 'any'], description: 'Preferência de período (para find_available_slots)' },
        },
        required: ['action'],
      },
    },
  };
}

/**
 * Resolve a user by name or email within the organization
 */
async function resolveUserInOrg(organizationId, nameOrEmail) {
  if (!nameOrEmail) return null;
  const result = await query(`
    SELECT u.id, u.name, u.email FROM users u
    JOIN organization_members om ON om.user_id = u.id
    WHERE om.organization_id = $1 AND (u.name ILIKE $2 OR u.email ILIKE $2)
    LIMIT 1
  `, [organizationId, `%${nameOrEmail.trim()}%`]);
  return result.rows[0] || null;
}

async function executeScheduleMeeting(organizationId, userId, args) {
  try {
    // Resolve assigned user
    let assignedUserId = userId;
    let assignedUserName = null;
    if (args.assigned_to_name) {
      const resolved = await resolveUserInOrg(organizationId, args.assigned_to_name);
      if (resolved) {
        assignedUserId = resolved.id;
        assignedUserName = resolved.name;
      } else {
        return `Usuário "${args.assigned_to_name}" não encontrado na organização.`;
      }
    }

    const action = args.action || 'create';

    // CHECK AGENDA: list existing tasks/meetings for the user
    if (action === 'check_agenda') {
      const daysAhead = args.days_ahead || 7;
      const result = await query(`
        SELECT title, type, due_date, status, priority FROM crm_tasks
        WHERE organization_id = $1 AND assigned_to = $2
          AND status IN ('pending', 'in_progress')
          AND due_date >= NOW() AND due_date <= NOW() + interval '1 day' * $3
        ORDER BY due_date ASC LIMIT 20
      `, [organizationId, assignedUserId, daysAhead]);

      if (result.rows.length === 0) {
        return `📋 Agenda de ${assignedUserName || 'responsável'} está livre nos próximos ${daysAhead} dias.`;
      }
      const items = result.rows.map(t => {
        const d = new Date(t.due_date);
        const dateStr = `${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `- [${t.type}] ${t.title} — ${dateStr} (${t.priority})`;
      }).join('\n');
      return `📋 Agenda de ${assignedUserName || 'responsável'} (próximos ${daysAhead} dias):\n${items}`;
    }

    // FIND AVAILABLE SLOTS for the specific user
    if (action === 'find_available_slots') {
      const daysAhead = args.days_ahead || 7;
      const schedule = await getWorkSchedule(organizationId);
      const slotDuration = args.duration_minutes || schedule.slot_duration_minutes;
      const slots = await findAvailableSlotsForUser(organizationId, assignedUserId, daysAhead, slotDuration, args.preferred_period, schedule);
      if (slots.length === 0) return `Nenhum horário disponível para ${assignedUserName || 'responsável'} nos próximos ${daysAhead} dias.`;
      const slotList = slots.map((s, i) => `${i + 1}. ${s.day_of_week} ${s.date} das ${s.start} às ${s.end}`).join('\n');
      return `Horários disponíveis de ${assignedUserName || 'responsável'}:\n${slotList}`;
    }

    // CREATE: check conflicts for the assigned user first
    if (!args.title || !args.date) return 'Título e data são obrigatórios para criar reunião.';
    const durationMin = args.duration_minutes || 60;

    // Check user-specific conflicts
    const conflictResult = await query(`
      SELECT id, title, due_date FROM crm_tasks
      WHERE organization_id = $1 AND assigned_to = $2 AND type IN ('meeting', 'call')
        AND status IN ('pending', 'in_progress')
        AND due_date >= $3::timestamp - interval '1 hour'
        AND due_date <= $3::timestamp + interval '1 hour'
    `, [organizationId, assignedUserId, args.date]);

    if (conflictResult.rows.length > 0) {
      const conflicts = conflictResult.rows.map(c => {
        const d = new Date(c.due_date);
        return `"${c.title}" (${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')})`;
      }).join(', ');
      return `⚠️ Conflito na agenda de ${assignedUserName || 'responsável'}: ${conflicts}. Use find_available_slots para horários livres.`;
    }

    const result = await query(`
      INSERT INTO crm_tasks (organization_id, assigned_to, created_by, title, description, type, priority, due_date)
      VALUES ($1, $2, $3, $4, $5, 'meeting', 'high', $6)
      RETURNING id, title, due_date
    `, [
      organizationId, assignedUserId, userId, args.title,
      `Participantes: ${args.attendees || 'A definir'}\nLocal: ${args.location || 'A definir'}\nDuração: ${durationMin}min\n\n${args.notes || ''}`.trim(),
      args.date
    ]);
    const task = result.rows[0];
    logInfo('ai_agents.tool_schedule_meeting', { taskId: task.id, assignedTo: assignedUserId, date: task.due_date });
    return `✅ Reunião "${task.title}" agendada para ${task.due_date} com ${assignedUserName || 'responsável'} (ID: ${task.id}, duração: ${durationMin}min). Sem conflitos.`;
  } catch (error) {
    logError('ai_agents.tool_schedule_meeting_error', error);
    return `Erro ao agendar reunião: ${error.message}`;
  }
}

// ==================== TOOL: GOOGLE CALENDAR (SMART) ====================

function buildGoogleCalendarTool() {
  return {
    type: 'function',
    function: {
      name: 'google_calendar_event',
      description: `Gerencia agenda inteligente. Ações disponíveis:
- "find_available_slots": Busca horários livres respeitando horário comercial e conflitos. USE ESTA AÇÃO quando o cliente quiser agendar algo — NUNCA sugira horários sem consultar antes.
- "create": Cria evento em horário específico (verifica conflitos automaticamente).
- "list": Lista próximos eventos agendados.`,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list', 'find_available_slots'], description: 'Ação a executar' },
          title: { type: 'string', description: 'Título do evento (para create)' },
          start_time: { type: 'string', description: 'Início ISO 8601 (para create)' },
          end_time: { type: 'string', description: 'Fim ISO 8601 (para create)' },
          description: { type: 'string', description: 'Descrição do evento (para create)' },
          duration_minutes: { type: 'number', description: 'Duração desejada em minutos (para find_available_slots, padrão: slot_duration da org)' },
          days_ahead: { type: 'number', description: 'Buscar nos próximos N dias (para list/find_available_slots, padrão 7)' },
          preferred_period: { type: 'string', enum: ['morning', 'afternoon', 'any'], description: 'Preferência de período (para find_available_slots)' },
        },
        required: ['action'],
      },
    },
  };
}

/**
 * Get work schedule config for an organization
 */
async function getWorkSchedule(organizationId) {
  const result = await query(
    `SELECT work_schedule FROM organizations WHERE id = $1`,
    [organizationId]
  );
  const raw = result.rows[0]?.work_schedule;
  const schedule = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  return {
    timezone: schedule.timezone || 'America/Sao_Paulo',
    work_days: schedule.work_days || [1, 2, 3, 4, 5],
    work_start: schedule.work_start || '08:00',
    work_end: schedule.work_end || '18:00',
    lunch_start: schedule.lunch_start || '12:00',
    lunch_end: schedule.lunch_end || '13:00',
    slot_duration_minutes: schedule.slot_duration_minutes || 60,
    buffer_minutes: schedule.buffer_minutes || 15,
  };
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

async function findAvailableSlots(organizationId, daysAhead, durationMinutes, preferredPeriod) {
  return findAvailableSlotsForUser(organizationId, null, daysAhead, durationMinutes, preferredPeriod);
}

/**
 * Find available slots filtering by a specific user's agenda (or org-wide if userId is null)
 */
async function findAvailableSlotsForUser(organizationId, userId, daysAhead, durationMinutes, preferredPeriod, scheduleOverride) {
  const schedule = scheduleOverride || await getWorkSchedule(organizationId);
  const slotDuration = durationMinutes || schedule.slot_duration_minutes;
  const buffer = schedule.buffer_minutes;

  const existingQuery = userId
    ? `SELECT due_date, due_date + interval '1 hour' as estimated_end
       FROM crm_tasks WHERE organization_id = $1 AND assigned_to = $3
         AND type IN ('meeting', 'call') AND status IN ('pending', 'in_progress')
         AND due_date >= NOW() AND due_date <= NOW() + interval '1 day' * $2
       ORDER BY due_date ASC`
    : `SELECT due_date, due_date + interval '1 hour' as estimated_end
       FROM crm_tasks WHERE organization_id = $1
         AND type IN ('meeting', 'call') AND status IN ('pending', 'in_progress')
         AND due_date >= NOW() AND due_date <= NOW() + interval '1 day' * $2
       ORDER BY due_date ASC`;

  const params = userId ? [organizationId, daysAhead, userId] : [organizationId, daysAhead];
  const existingResult = await query(existingQuery, params);

  const existingEvents = existingResult.rows.map(e => ({
    start: new Date(e.due_date).getTime(),
    end: new Date(e.estimated_end).getTime(),
  }));

  const workStartMin = timeToMinutes(schedule.work_start);
  const workEndMin = timeToMinutes(schedule.work_end);
  const lunchStartMin = timeToMinutes(schedule.lunch_start);
  const lunchEndMin = timeToMinutes(schedule.lunch_end);

  const slots = [];
  const now = new Date();
  const maxSlots = 10;

  for (let d = 0; d < daysAhead && slots.length < maxSlots; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dayOfWeek = date.getDay();

    if (!schedule.work_days.includes(dayOfWeek)) continue;

    for (let min = workStartMin; min + slotDuration <= workEndMin && slots.length < maxSlots; min += slotDuration + buffer) {
      if (min < lunchEndMin && min + slotDuration > lunchStartMin) {
        min = lunchEndMin - slotDuration - buffer;
        continue;
      }

      if (preferredPeriod === 'morning' && min >= lunchStartMin) continue;
      if (preferredPeriod === 'afternoon' && min < lunchEndMin) continue;

      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(min / 60), min % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      if (slotStart.getTime() < now.getTime() + 30 * 60000) continue;

      const hasConflict = existingEvents.some(e => 
        slotStart.getTime() < e.end && slotEnd.getTime() > e.start
      );
      if (hasConflict) continue;

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      slots.push({
        date: slotStart.toISOString().split('T')[0],
        day_of_week: dayNames[slotStart.getDay()],
        start: `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`,
        end: `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`,
        start_iso: slotStart.toISOString(),
        end_iso: slotEnd.toISOString(),
      });
    }
  }

  return slots;
}

async function executeGoogleCalendar(organizationId, userId, args) {
  try {
    if (args.action === 'find_available_slots') {
      const daysAhead = args.days_ahead || 7;
      const slots = await findAvailableSlots(organizationId, daysAhead, args.duration_minutes, args.preferred_period);
      
      if (slots.length === 0) {
        return `Nenhum horário disponível encontrado nos próximos ${daysAhead} dias.`;
      }
      
      const schedule = await getWorkSchedule(organizationId);
      const slotList = slots.map((s, i) => 
        `${i + 1}. ${s.day_of_week} ${s.date} das ${s.start} às ${s.end}`
      ).join('\n');
      
      return `Horários disponíveis (expediente ${schedule.work_start}-${schedule.work_end}, intervalo ${schedule.lunch_start}-${schedule.lunch_end}):\n${slotList}\n\nPara agendar, use a ação "create" com o start_time e end_time do slot escolhido.`;
    }
    
    if (args.action === 'create') {
      if (!args.title || !args.start_time) return 'Título e horário de início são obrigatórios para criar evento';
      
      // Verify work hours
      const schedule = await getWorkSchedule(organizationId);
      const startDate = new Date(args.start_time);
      const dayOfWeek = startDate.getDay();
      
      if (!schedule.work_days.includes(dayOfWeek)) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return `⚠️ ${dayNames[dayOfWeek]} não é dia de trabalho. Dias disponíveis: ${schedule.work_days.map(d => dayNames[d]).join(', ')}. Use find_available_slots.`;
      }
      
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const workStart = timeToMinutes(schedule.work_start);
      const workEnd = timeToMinutes(schedule.work_end);
      
      if (startMinutes < workStart || startMinutes >= workEnd) {
        return `⚠️ Horário ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')} fora do expediente (${schedule.work_start}-${schedule.work_end}). Use find_available_slots.`;
      }
      
      // Check conflicts
      const conflictResult = await query(`
        SELECT id, title, due_date FROM crm_tasks
        WHERE organization_id = $1 AND type = 'meeting' AND status = 'pending'
          AND due_date >= $2::timestamp - interval '1 hour'
          AND due_date <= $2::timestamp + interval '1 hour'
      `, [organizationId, args.start_time]);
      
      if (conflictResult.rows.length > 0) {
        const conflicts = conflictResult.rows.map(c => `"${c.title}" (${c.due_date})`).join(', ');
        return `⚠️ Conflito com: ${conflicts}. Use find_available_slots para horários livres.`;
      }
      
      const taskResult = await query(`
        INSERT INTO crm_tasks (organization_id, assigned_to, created_by, title, description, type, priority, due_date)
        VALUES ($1, $2, $2, $3, $4, 'meeting', 'medium', $5)
        RETURNING id, title, due_date
      `, [organizationId, userId, args.title, args.description || '', args.start_time]);
      
      const task = taskResult.rows[0];
      
      try {
        await query(`
          INSERT INTO google_calendar_events (user_id, crm_task_id, google_event_id, google_calendar_id, event_summary, event_start, event_end)
          VALUES ($1, $2, $3, 'primary', $4, $5, $6)
        `, [userId, task.id, `ai-agent-${task.id}`, args.title, args.start_time, args.end_time || args.start_time]);
      } catch (e) {
        logInfo('ai_agents.google_calendar_record_skip', { error: e.message });
      }
      
      logInfo('ai_agents.tool_google_calendar_create', { taskId: task.id });
      return `✅ Evento "${task.title}" agendado para ${args.start_time}${args.end_time ? ` até ${args.end_time}` : ''} (ID: ${task.id}). Sem conflitos.`;
    } else {
      const daysAhead = args.days_ahead || 7;
      const result = await query(`
        SELECT id, title, due_date, description, type
        FROM crm_tasks
        WHERE organization_id = $1 AND type = 'meeting' AND status = 'pending'
          AND due_date >= NOW() AND due_date <= NOW() + interval '1 day' * $2
        ORDER BY due_date ASC
        LIMIT 15
      `, [organizationId, daysAhead]);
      if (result.rows.length === 0) return `Nenhum evento encontrado nos próximos ${daysAhead} dias.`;
      const list = result.rows.map(e => `- ${e.title} (${e.due_date})`).join('\n');
      return `${result.rows.length} eventos nos próximos ${daysAhead} dias:\n${list}`;
    }
  } catch (error) {
    logError('ai_agents.tool_google_calendar_error', error);
    return `Erro no Google Calendar: ${error.message}`;
  }
}

// ==================== TOOL: SUGGEST ACTIONS ====================

function buildSuggestActionsTool() {
  return {
    type: 'function',
    function: {
      name: 'suggest_actions',
      description: 'Sugere próximas ações para o atendente com base no contexto da conversa. Use quando o cliente parece precisar de ajuda adicional ou quando a conversa pode ser otimizada.',
      parameters: {
        type: 'object',
        properties: {
          suggestions: { type: 'string', description: 'Lista de ações sugeridas, separadas por |. Cada sugestão deve ser clara e acionável.' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgência das ações sugeridas' },
          context_summary: { type: 'string', description: 'Breve resumo do contexto que motivou as sugestões' },
          category: { type: 'string', enum: ['sales', 'support', 'follow_up', 'upsell', 'retention', 'general'], description: 'Categoria das sugestões' },
        },
        required: ['suggestions', 'urgency', 'context_summary'],
      },
    },
  };
}

async function executeSuggestActions(args) {
  logInfo('ai_agents.tool_suggest_actions', { urgency: args.urgency, category: args.category });
  return JSON.stringify({
    suggestions: (args.suggestions || '').split('|').map(s => s.trim()).filter(Boolean),
    urgency: args.urgency,
    context_summary: args.context_summary,
    category: args.category || 'general',
  });
}

// ==================== TOOL: GENERATE CONTENT ====================

function buildGenerateContentTool() {
  return {
    type: 'function',
    function: {
      name: 'generate_content',
      description: 'Gera conteúdo de texto como mensagens de follow-up, propostas, e-mails, scripts de ligação ou templates para o atendente usar.',
      parameters: {
        type: 'object',
        properties: {
          content_type: { type: 'string', enum: ['follow_up_message', 'proposal', 'email', 'call_script', 'whatsapp_template', 'social_media_post', 'other'], description: 'Tipo de conteúdo a gerar' },
          title: { type: 'string', description: 'Título ou assunto do conteúdo' },
          content: { type: 'string', description: 'O conteúdo gerado completo' },
          tone: { type: 'string', enum: ['formal', 'informal', 'professional', 'friendly', 'persuasive'], description: 'Tom do conteúdo' },
          target_audience: { type: 'string', description: 'Público-alvo do conteúdo' },
        },
        required: ['content_type', 'title', 'content'],
      },
    },
  };
}

async function executeGenerateContent(args) {
  logInfo('ai_agents.tool_generate_content', { type: args.content_type, tone: args.tone });
  return JSON.stringify({
    content_type: args.content_type,
    title: args.title,
    content: args.content,
    tone: args.tone || 'professional',
    target_audience: args.target_audience || '',
  });
}

/**
 * Execute a consult to another specialist agent
 */
async function executeCallAgent(organizationId, agentName, question) {
  try {
    // Find the specialist agent
    const agentResult = await query(
      `SELECT * FROM ai_agents WHERE organization_id = $1 AND name ILIKE $2 AND is_active = true LIMIT 1`,
      [organizationId, `%${agentName}%`]
    );

    if (agentResult.rows.length === 0) {
      return `Agente "${agentName}" não encontrado ou está inativo.`;
    }

    const specialist = agentResult.rows[0];
    const specialistConfig = await getAgentAIConfig(specialist, organizationId);

    // Get specialist's knowledge base
    const knowledgeResult = await query(
      `SELECT source_content FROM ai_knowledge_sources WHERE agent_id = $1 AND is_active = true ORDER BY priority DESC`,
      [specialist.id]
    );
    const knowledgeContext = knowledgeResult.rows.map(k => k.source_content).join('\n\n');

    const systemPrompt = `${specialist.system_prompt || 'Você é um assistente especialista.'}\n\n${knowledgeContext ? `Base de conhecimento:\n${knowledgeContext}` : ''}`;

    // Call the specialist (no tools - specialists don't chain)
    const result = await callAI(specialistConfig, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ], {
      temperature: specialist.temperature || 0.7,
      maxTokens: specialist.max_tokens || 1000,
    });

    logInfo('ai_agents.call_agent_executed', {
      specialist: specialist.name,
      question: question.substring(0, 100),
      tokensUsed: result.tokensUsed,
    });

    return result.content || 'O agente especialista não retornou uma resposta.';
  } catch (error) {
    logError('ai_agents.call_agent_error', error);
    return `Erro ao consultar agente "${agentName}": ${error.message}`;
  }
}

// Test agent chat endpoint
router.post('/:id/test', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    // Get the agent
    const agentResult = await query(
      'SELECT * FROM ai_agents WHERE id = $1 AND organization_id = $2',
      [req.params.id, userCtx.organization_id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agente não encontrado' });
    }

    const agent = agentResult.rows[0];
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    // Get AI config
    const aiConfig = await getAgentAIConfig(agent, userCtx.organization_id);

    // Build knowledge context
    const knowledgeResult = await query(
      `SELECT source_content FROM ai_knowledge_sources WHERE agent_id = $1 AND is_active = true ORDER BY priority DESC`,
      [agent.id]
    );
    const knowledgeContext = knowledgeResult.rows.map(k => k.source_content).join('\n\n');

    // Build system prompt
    let systemPrompt = agent.system_prompt || 'Você é um assistente virtual profissional e prestativo.';
    if (agent.description && agent.description.trim()) {
      systemPrompt += `\n\n${agent.description.trim()}`;
    }
    if (knowledgeContext) {
      systemPrompt += `\n\nBase de Conhecimento (use estas informações para responder):\n${knowledgeContext}`;
    }

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-(agent.context_window || 10)).map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Parse capabilities
    const capabilities = Array.isArray(agent.capabilities) 
      ? agent.capabilities 
      : (typeof agent.capabilities === 'string' ? agent.capabilities.replace(/[{}]/g, '').split(',') : ['respond_messages']);

    // Check capabilities and build tools
    let tools = [];

    // CALL_AGENT tool
    if (capabilities.includes('call_agent')) {
      const callConfig = typeof agent.call_agent_config === 'string' 
        ? JSON.parse(agent.call_agent_config || '{}') 
        : (agent.call_agent_config || {});
      
      let agentFilter = `organization_id = $1 AND id != $2 AND is_active = true`;
      const params = [userCtx.organization_id, agent.id];

      if (!callConfig.allow_all && callConfig.allowed_agent_ids && callConfig.allowed_agent_ids.length > 0) {
        agentFilter += ` AND id = ANY($3)`;
        params.push(callConfig.allowed_agent_ids);
      }

      const otherAgentsResult = await query(
        `SELECT id, name, description, system_prompt FROM ai_agents WHERE ${agentFilter}`,
        params
      );

      if (otherAgentsResult.rows.length > 0) {
        const rules = callConfig.rules || [];
        let toolAgents = otherAgentsResult.rows;
        if (rules.length > 0) {
          toolAgents = toolAgents.map(a => {
            const rule = rules.find(r => r.agent_id === a.id);
            if (rule && rule.topic_description) {
              return { ...a, description: `${a.description || ''} | Consultar quando: ${rule.topic_description}` };
            }
            return a;
          });
        }
        tools.push(buildCallAgentTool(toolAgents));
      }
    }

    // CREATE_DEALS tool
    if (capabilities.includes('create_deals')) {
      const funnelsResult = await query(
        `SELECT f.id, f.name, json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.position) as stages
         FROM crm_funnels f
         JOIN crm_stages s ON s.funnel_id = f.id
         WHERE f.organization_id = $1
         GROUP BY f.id, f.name`,
        [userCtx.organization_id]
      );
      if (funnelsResult.rows.length > 0) {
        tools.push(buildCreateDealTool(funnelsResult.rows));
      }
    }

    // MANAGE_TASKS tool
    if (capabilities.includes('manage_tasks')) {
      tools.push(buildManageTasksTool());
    }

    // QUALIFY_LEADS tool
    if (capabilities.includes('qualify_leads')) {
      tools.push(buildQualifyLeadsTool());
    }

    // SUMMARIZE_HISTORY tool
    if (capabilities.includes('summarize_history')) {
      tools.push(buildSummarizeHistoryTool());
    }

    // READ_FILES tool
    if (capabilities.includes('read_files')) {
      tools.push(buildReadFilesTool());
    }

    // SCHEDULE_MEETINGS tool
    if (capabilities.includes('schedule_meetings')) {
      tools.push(buildScheduleMeetingsTool());
    }

    // GOOGLE_CALENDAR tool
    if (capabilities.includes('google_calendar')) {
      tools.push(buildGoogleCalendarTool());
    }

    // SUGGEST_ACTIONS tool
    if (capabilities.includes('suggest_actions')) {
      tools.push(buildSuggestActionsTool());
    }

    // GENERATE_CONTENT tool
    if (capabilities.includes('generate_content')) {
      tools.push(buildGenerateContentTool());
    }

    let result;
    let toolCallsExecuted = [];

    if (tools.length > 0) {
      // Use tool-calling flow
      const toolExecutor = async (toolName, args) => {
        switch (toolName) {
          case 'consult_specialist_agent':
            return await executeCallAgent(userCtx.organization_id, args.agent_name, args.question);
          case 'create_deal':
            return await executeCreateDeal(userCtx.organization_id, userCtx.id, args);
          case 'manage_tasks':
            return await executeManageTasks(userCtx.organization_id, userCtx.id, args);
          case 'qualify_lead':
            return await executeQualifyLead(userCtx.organization_id, args);
          case 'summarize_conversation':
            return await executeSummarizeHistory(args);
          case 'analyze_file':
            return await executeReadFiles(args);
          case 'schedule_meeting':
            return await executeScheduleMeeting(userCtx.organization_id, userCtx.id, args);
          case 'google_calendar_event':
            return await executeGoogleCalendar(userCtx.organization_id, userCtx.id, args);
          case 'suggest_actions':
            return await executeSuggestActions(args);
          case 'generate_content':
            return await executeGenerateContent(args);
          default:
            return 'Ferramenta desconhecida';
        }
      };

      result = await callAIWithTools(aiConfig, messages, {
        temperature: parseFloat(agent.temperature) || 0.7,
        maxTokens: parseInt(agent.max_tokens, 10) || 1000,
        tools,
      }, toolExecutor);

      toolCallsExecuted = result.toolCallsExecuted || [];
    } else {
      // Simple call without tools
      result = await callAI(aiConfig, messages, {
        temperature: parseFloat(agent.temperature) || 0.7,
        maxTokens: parseInt(agent.max_tokens, 10) || 1000,
      });
    }

    logInfo('ai_agents.test_chat', {
      agentId: agent.id,
      userId: userCtx.id,
      tokensUsed: result.tokensUsed,
      toolCallsCount: toolCallsExecuted.length,
    });

    res.json({
      response: result.content,
      tokens_used: result.tokensUsed || 0,
      model_used: result.model || aiConfig.model,
      sources_used: knowledgeResult.rows.length > 0 ? ['knowledge_base'] : [],
      tool_calls: toolCallsExecuted.map(tc => ({
        tool: tc.name,
        arguments: tc.arguments,
        response_preview: typeof tc.result === 'string' ? tc.result.substring(0, 300) : JSON.stringify(tc.result).substring(0, 300),
      })),
    });
  } catch (error) {
    logError('ai_agents.test_error', error);
    res.status(500).json({ error: error.message || 'Erro ao processar mensagem' });
  }
});

// ==================== MODELOS DISPONÍVEIS ====================

router.get('/config/models', authenticate, async (req, res) => {
  res.json({
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Mais capaz, multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alto desempenho' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Econômico' }
    ],
    gemini: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Mais capaz, contexto longo' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Rápido e eficiente' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Versão estável' }
    ]
  });
});

// ==================== TEMPLATES DE PROMPT ====================

// Listar templates
router.get('/templates', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { category } = req.query;

    let sql = `
      SELECT * FROM ai_prompt_templates
      WHERE organization_id = $1 OR is_system = true
    `;
    const params = [userCtx.organization_id];

    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }

    sql += ' ORDER BY is_system DESC, usage_count DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    logError('ai_agents.templates_list_error', error);
    res.status(500).json({ error: 'Erro ao buscar templates' });
  }
});

// Criar template
router.post('/templates', authenticate, async (req, res) => {
  try {
    const userCtx = await getUserContext(req.userId);
    if (!userCtx?.organization_id) {
      return res.status(403).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { name, description, category, template, variables = [] } = req.body;

    if (!name || !template) {
      return res.status(400).json({ error: 'Nome e template são obrigatórios' });
    }

    const result = await query(`
      INSERT INTO ai_prompt_templates (
        organization_id, name, description, category, template, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userCtx.organization_id, name, description, category, template,
      JSON.stringify(variables), userCtx.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('ai_agents.template_create_error', error);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

export default router;
