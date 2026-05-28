import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { callAI } from '../lib/ai-caller.js';

const router = Router();
router.use(authenticate);

// Helper to get user's organization
async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role 
     FROM organization_members om 
     WHERE om.user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

// TRACKERS CRUD
// ==========================================

// TRACKERS CRUD
// ==========================================

// List trackers
router.get('/trackers', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    // Ensure tables exist (hotfix)
    await query(`
      CREATE TABLE IF NOT EXISTS sales_seo_trackers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          phrase TEXT NOT NULL,
          connection_ids UUID[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sales_seo_leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          tracker_id UUID REFERENCES sales_seo_trackers(id) ON DELETE SET NULL,
          connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          entry_message TEXT,
          evolution_status INTEGER DEFAULT 1,
          ia_analysis JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    const result = await query(
      `SELECT * FROM sales_seo_trackers WHERE organization_id = $1 ORDER BY created_at DESC`,
      [org.organization_id]
    );
    res.json(result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('List trackers error:', error);
    res.status(500).json({ error: 'Erro ao listar rastreadores', details: error.message });
  }
});

// Create tracker
router.post('/trackers', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const { name, phrase, connection_ids } = req.body;
    if (!name || !phrase) {
      return res.status(400).json({ error: 'Nome e frase são obrigatórios' });
    }

    const result = await query(
      `INSERT INTO sales_seo_trackers (organization_id, name, phrase, connection_ids)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [org.organization_id, name, phrase, connection_ids || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tracker error:', error);
    res.status(500).json({ error: 'Erro ao criar rastreador' });
  }
});

// Delete tracker
router.delete('/trackers/:id', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const { id } = req.params;
    await query(
      `DELETE FROM sales_seo_trackers WHERE id = $1 AND organization_id = $2`,
      [id, org.organization_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete tracker error:', error);
    res.status(500).json({ error: 'Erro ao excluir rastreador' });
  }
});

// ==========================================
// ANALYTICS & LEADS
// ==========================================

// Get analytics overview
router.get('/analytics', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const { start_date, end_date, tracker_id } = req.query;

    let whereClause = 'l.organization_id = $1';
    const params = [org.organization_id];
    let paramIndex = 2;

    if (start_date) {
      whereClause += ` AND l.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      whereClause += ` AND l.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    if (tracker_id) {
      whereClause += ` AND l.tracker_id = $${paramIndex}`;
      params.push(tracker_id);
      paramIndex++;
    }

    // Stats by status
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE evolution_status = 1) as just_arrived,
        COUNT(*) FILTER (WHERE evolution_status = 2) as engaged,
        COUNT(*) FILTER (WHERE evolution_status = 3) as converted,
        COUNT(*) FILTER (WHERE evolution_status = 4) as lost
       FROM sales_seo_leads l
       WHERE ${whereClause}`,
      params
    );

    // Stats by day
    const dailyResult = await query(
      `SELECT 
        DATE(l.created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE evolution_status = 3) as converted
       FROM sales_seo_leads l
       WHERE ${whereClause}
       GROUP BY DATE(l.created_at)
       ORDER BY date ASC`,
      params
    );

    // Stats by hour
    const hourlyResult = await query(
      `SELECT 
        EXTRACT(HOUR FROM l.created_at) as hour,
        COUNT(*) as total
       FROM sales_seo_leads l
       WHERE ${whereClause}
       GROUP BY hour
       ORDER BY hour ASC`,
      params
    );

    res.json({
      stats: statsResult.rows[0],
      daily: dailyResult.rows,
      hourly: hourlyResult.rows
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Erro ao buscar analíticos', details: error.message });
  }
});

// List leads
router.get('/leads', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const { tracker_id, limit = 50 } = req.query;

    let whereClause = 'l.organization_id = $1';
    const params = [org.organization_id];
    let paramIndex = 2;

    if (tracker_id) {
      whereClause += ` AND l.tracker_id = $${paramIndex}`;
      params.push(tracker_id);
      paramIndex++;
    }

    params.push(parseInt(limit));

    const result = await query(
      `SELECT 
        l.*,
        t.name as tracker_name,
        c.name as connection_name,
        conv.contact_name
       FROM sales_seo_leads l
       LEFT JOIN sales_seo_trackers t ON t.id = l.tracker_id
       LEFT JOIN connections c ON c.id = l.connection_id
       LEFT JOIN conversations conv ON conv.id = l.conversation_id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List leads error:', error);
    res.status(500).json({ error: 'Erro ao listar leads', details: error.message });
  }
});

// Analyze lead with IA
router.post('/analyze-ia', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const { lead_id } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'ID do lead é obrigatório' });

    // 1. Get lead and messages
    const leadRes = await query(
      `SELECT l.*, conv.id as conversation_id 
       FROM sales_seo_leads l
       JOIN conversations conv ON conv.id = l.conversation_id
       WHERE l.id = $1 AND l.organization_id = $2`,
      [lead_id, org.organization_id]
    );

    if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead não encontrado' });
    const lead = leadRes.rows[0];

    const messagesRes = await query(
      `SELECT content, from_me, timestamp 
       FROM chat_messages 
       WHERE conversation_id = $1 
       ORDER BY timestamp ASC LIMIT 50`,
      [lead.conversation_id]
    );

    const history = messagesRes.rows.map(m => 
      `${m.from_me ? 'Operador' : 'Cliente'} (${new Date(m.timestamp).toLocaleString()}): ${m.content}`
    ).join('\n');

    // 2. Get AI config
    const aiConfigRes = await query(
      `SELECT * FROM system_settings WHERE key IN ('openai_api_key', 'openai_model')`
    );
    const settings = Object.fromEntries(aiConfigRes.rows.map(r => [r.key, r.value]));
    
    if (!settings.openai_api_key) {
      return res.status(400).json({ error: 'IA não configurada. Configure a API Key no painel Admin.' });
    }

    const aiConfig = {
      provider: 'openai',
      apiKey: settings.openai_api_key,
      model: settings.openai_model || 'gpt-4o-mini'
    };

    const prompt = `Analise a seguinte conversa de WhatsApp que começou com a frase: "${lead.entry_message}".
    Histórico:
    ${history}

    Responda em formato JSON com:
    - status: 1 (apenas primeira mensagem), 2 (engajado/diálogo), 3 (venda realizada/encaminhada), 4 (perda/churn)
    - resumo: um resumo curto da interação (max 200 caracteres)
    - oportunidade: chance de upsell ou risco de churn (texto curto)`;

    const aiResponse = await callAI(aiConfig, [{ role: 'user', content: prompt }], { responseFormat: { type: 'json_object' } });
    
    const result = JSON.parse(aiResponse.content);

    // 3. Update lead
    await query(
      `UPDATE sales_seo_leads 
       SET evolution_status = $1, 
           ia_analysis = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [result.status || lead.evolution_status, aiResponse.content, lead_id]
    );

    res.json({ success: true, analysis: result });
  } catch (error) {
    console.error('IA Analysis error:', error);
    res.status(500).json({ error: 'Erro na análise de IA' });
  }
});

export default router;
