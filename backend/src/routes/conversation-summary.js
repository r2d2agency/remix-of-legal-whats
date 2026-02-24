import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { log, logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

// Helper: Get user's organization
async function getUserOrg(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role 
     FROM organization_members om 
     WHERE om.user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

// Helper: Get AI config from organization or agent
async function getAIConfig(organizationId) {
  // First try to get from a configured AI agent
  const agentResult = await query(`
    SELECT ai_provider, ai_model, ai_api_key
    FROM ai_agents 
    WHERE organization_id = $1 AND is_active = true AND ai_api_key IS NOT NULL
    LIMIT 1
  `, [organizationId]);

  if (agentResult.rows[0]) {
    return agentResult.rows[0];
  }

  // Fallback to organization settings if available
  const orgResult = await query(`
    SELECT ai_api_key, ai_provider, ai_model FROM organizations WHERE id = $1
  `, [organizationId]);

  return orgResult.rows[0] || null;
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
    let response;
    
    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: 'json_object' }
        })
      });
    } else if (provider === 'gemini') {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
            responseMimeType: 'application/json'
          }
        })
      });
    } else {
      throw new Error(`Provider ${provider} não suportado`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    let content;
    if (provider === 'openai') {
      content = data.choices?.[0]?.message?.content;
    } else if (provider === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }

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

    // Check conversation exists and belongs to org
    const convCheck = await query(`
      SELECT c.id, c.connection_id, conn.organization_id
      FROM conversations c
      JOIN connections conn ON conn.id = c.connection_id
      WHERE c.id = $1 AND conn.organization_id = $2
    `, [conversationId, org.organization_id]);

    if (!convCheck.rows[0]) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    // Get AI configuration
    const aiConfig = await getAIConfig(org.organization_id);
    if (!aiConfig?.ai_api_key) {
      return res.status(400).json({ error: 'Nenhum agente de IA configurado com API key' });
    }

    // Get conversation messages (limit to last 100 for performance)
    const messagesResult = await query(`
      SELECT content, from_me, message_type, created_at
      FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT 100
    `, [conversationId]);

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
