import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

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

// ==========================================
// TRACKERS CRUD
// ==========================================

// List trackers
router.get('/trackers', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Organização não encontrada' });

    const result = await query(
      `SELECT * FROM sales_seo_trackers WHERE organization_id = $1 ORDER BY created_at DESC`,
      [org.organization_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List trackers error:', error);
    res.status(500).json({ error: 'Erro ao listar rastreadores' });
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
    res.status(500).json({ error: 'Erro ao buscar analíticos' });
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
    res.status(500).json({ error: 'Erro ao listar leads' });
  }
});

export default router;
