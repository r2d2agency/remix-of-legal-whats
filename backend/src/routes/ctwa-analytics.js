import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get user's organization
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
// CAMPAIGNS CRUD
// ==========================================

// List campaigns with stats
router.get('/campaigns', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const result = await query(
      `SELECT 
        c.*,
        COUNT(l.id) as total_leads,
        COUNT(l.id) FILTER (WHERE l.status = 'converted') as converted_leads,
        COUNT(l.id) FILTER (WHERE l.status = 'qualified') as qualified_leads,
        COALESCE(SUM(l.conversion_value), 0) as total_revenue,
        ROUND(AVG(l.response_time_seconds)) as avg_response_time
       FROM ctwa_campaigns c
       LEFT JOIN ctwa_leads l ON l.campaign_id = c.id
       WHERE c.organization_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [userOrg.organization_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List CTWA campaigns error:', error);
    res.status(500).json({ error: 'Erro ao listar campanhas' });
  }
});

// Get single campaign with detailed stats
router.get('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { id } = req.params;

    const campaign = await query(
      `SELECT c.* FROM ctwa_campaigns c
       WHERE c.id = $1 AND c.organization_id = $2`,
      [id, userOrg.organization_id]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Get funnel stats
    const funnelStats = await query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM ctwa_leads
       WHERE campaign_id = $1
       GROUP BY status`,
      [id]
    );

    // Get daily leads
    const dailyLeads = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'converted') as converted
       FROM ctwa_leads
       WHERE campaign_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [id]
    );

    res.json({
      ...campaign.rows[0],
      funnel_stats: funnelStats.rows,
      daily_leads: dailyLeads.rows
    });
  } catch (error) {
    console.error('Get CTWA campaign error:', error);
    res.status(500).json({ error: 'Erro ao buscar campanha' });
  }
});

// Create campaign
router.post('/campaigns', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { 
      name, 
      platform = 'meta',
      campaign_id,
      ad_set_id,
      ad_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      total_spend = 0
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    // Generate unique tracking code
    const trackingCode = `ctwa_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const result = await query(
      `INSERT INTO ctwa_campaigns 
        (organization_id, name, platform, campaign_id, ad_set_id, ad_id,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         tracking_code, total_spend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userOrg.organization_id,
        name,
        platform,
        campaign_id,
        ad_set_id,
        ad_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        trackingCode,
        total_spend
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create CTWA campaign error:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

// Update campaign
router.patch('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'platform', 'campaign_id', 'ad_set_id', 'ad_id',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'total_spend', 'is_active'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id, userOrg.organization_id);

    const result = await query(
      `UPDATE ctwa_campaigns 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update CTWA campaign error:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

// Delete campaign
router.delete('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { id } = req.params;

    const result = await query(
      `DELETE FROM ctwa_campaigns 
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, userOrg.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete CTWA campaign error:', error);
    res.status(500).json({ error: 'Erro ao excluir campanha' });
  }
});

// ==========================================
// LEADS
// ==========================================

// List leads with filters
router.get('/leads', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { campaign_id, status, start_date, end_date, limit = 100 } = req.query;

    let whereClause = 'l.organization_id = $1';
    const params = [userOrg.organization_id];
    let paramIndex = 2;

    if (campaign_id) {
      whereClause += ` AND l.campaign_id = $${paramIndex}`;
      params.push(campaign_id);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

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

    params.push(parseInt(limit));

    const result = await query(
      `SELECT 
        l.*,
        c.name as campaign_name,
        c.platform,
        u.name as assigned_user_name
       FROM ctwa_leads l
       LEFT JOIN ctwa_campaigns c ON c.id = l.campaign_id
       LEFT JOIN users u ON u.id = l.assigned_user_id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List CTWA leads error:', error);
    res.status(500).json({ error: 'Erro ao listar leads' });
  }
});

// Register lead (called from webhook or form)
router.post('/leads', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { 
      phone,
      contact_name,
      conversation_id,
      tracking_code,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      entry_message,
      referrer_url,
      landing_page
    } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    // Find campaign by tracking code or UTM
    let campaignId = null;
    if (tracking_code) {
      const campaign = await query(
        `SELECT id FROM ctwa_campaigns 
         WHERE tracking_code = $1 AND organization_id = $2`,
        [tracking_code, userOrg.organization_id]
      );
      if (campaign.rows.length > 0) {
        campaignId = campaign.rows[0].id;
      }
    } else if (utm_campaign) {
      const campaign = await query(
        `SELECT id FROM ctwa_campaigns 
         WHERE utm_campaign = $1 AND organization_id = $2
         LIMIT 1`,
        [utm_campaign, userOrg.organization_id]
      );
      if (campaign.rows.length > 0) {
        campaignId = campaign.rows[0].id;
      }
    }

    // Check if lead already exists
    const existing = await query(
      `SELECT id FROM ctwa_leads 
       WHERE phone = $1 AND organization_id = $2`,
      [phone, userOrg.organization_id]
    );

    if (existing.rows.length > 0) {
      // Update existing lead
      const result = await query(
        `UPDATE ctwa_leads 
         SET campaign_id = COALESCE($1, campaign_id),
             contact_name = COALESCE($2, contact_name),
             conversation_id = COALESCE($3, conversation_id),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [campaignId, contact_name, conversation_id, existing.rows[0].id]
      );
      return res.json(result.rows[0]);
    }

    // Create new lead
    const result = await query(
      `INSERT INTO ctwa_leads 
        (organization_id, campaign_id, phone, contact_name, conversation_id,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         tracking_code, entry_message, referrer_url, landing_page, source_platform)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        userOrg.organization_id,
        campaignId,
        phone,
        contact_name,
        conversation_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        tracking_code,
        entry_message,
        referrer_url,
        landing_page,
        utm_source || 'direct'
      ]
    );

    // Log event
    await query(
      `INSERT INTO ctwa_lead_events (lead_id, event_type, event_data)
       VALUES ($1, 'lead_created', $2)`,
      [result.rows[0].id, JSON.stringify({ utm_campaign, tracking_code })]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create CTWA lead error:', error);
    res.status(500).json({ error: 'Erro ao registrar lead' });
  }
});

// Update lead status
router.patch('/leads/:id', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { id } = req.params;
    const { status, conversion_value, deal_id } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;

      if (status === 'converted') {
        updates.push(`converted_at = NOW()`);
      }
    }

    if (conversion_value !== undefined) {
      updates.push(`conversion_value = $${paramIndex}`);
      values.push(conversion_value);
      paramIndex++;
    }

    if (deal_id) {
      updates.push(`deal_id = $${paramIndex}`);
      values.push(deal_id);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, userOrg.organization_id);

    const result = await query(
      `UPDATE ctwa_leads 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Log event
    await query(
      `INSERT INTO ctwa_lead_events (lead_id, event_type, event_data)
       VALUES ($1, $2, $3)`,
      [id, `status_${status}`, JSON.stringify({ conversion_value, deal_id })]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update CTWA lead error:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

// ==========================================
// ANALYTICS DASHBOARD
// ==========================================

// Get overview stats
router.get('/overview', authenticate, async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) {
      return res.status(403).json({ error: 'Usuário sem organização' });
    }

    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [userOrg.organization_id];
    
    if (start_date && end_date) {
      dateFilter = 'AND l.created_at BETWEEN $2 AND $3';
      params.push(start_date, end_date);
    }

    // Overall stats
    const stats = await query(
      `SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE status = 'engaged') as engaged_leads,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
        COUNT(*) FILTER (WHERE status = 'converted') as converted_leads,
        COUNT(*) FILTER (WHERE status = 'lost') as lost_leads,
        COALESCE(SUM(conversion_value), 0) as total_revenue,
        ROUND(AVG(response_time_seconds)) as avg_response_time,
        ROUND(COUNT(*) FILTER (WHERE status = 'converted')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate
       FROM ctwa_leads l
       WHERE organization_id = $1 ${dateFilter}`,
      params
    );

    // Leads by campaign
    const byCampaign = await query(
      `SELECT 
        c.id,
        c.name,
        c.platform,
        c.total_spend,
        COUNT(l.id) as leads,
        COUNT(l.id) FILTER (WHERE l.status = 'converted') as conversions,
        COALESCE(SUM(l.conversion_value), 0) as revenue,
        CASE WHEN c.total_spend > 0 
          THEN ROUND(c.total_spend / NULLIF(COUNT(l.id), 0), 2) 
          ELSE 0 
        END as cost_per_lead,
        CASE WHEN c.total_spend > 0 
          THEN ROUND((COALESCE(SUM(l.conversion_value), 0) - c.total_spend) / c.total_spend * 100, 2)
          ELSE 0 
        END as roi
       FROM ctwa_campaigns c
       LEFT JOIN ctwa_leads l ON l.campaign_id = c.id ${dateFilter.replace('l.', 'l.')}
       WHERE c.organization_id = $1
       GROUP BY c.id
       ORDER BY leads DESC`,
      params
    );

    // Leads by day (last 30 days)
    const byDay = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'converted') as converted
       FROM ctwa_leads
       WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userOrg.organization_id]
    );

    // Leads by source
    const bySource = await query(
      `SELECT 
        COALESCE(source_platform, 'direct') as source,
        COUNT(*) as leads,
        COUNT(*) FILTER (WHERE status = 'converted') as conversions
       FROM ctwa_leads
       WHERE organization_id = $1 ${dateFilter}
       GROUP BY source_platform
       ORDER BY leads DESC`,
      params
    );

    res.json({
      stats: stats.rows[0],
      by_campaign: byCampaign.rows,
      by_day: byDay.rows,
      by_source: bySource.rows
    });
  } catch (error) {
    console.error('Get CTWA overview error:', error);
    res.status(500).json({ error: 'Erro ao buscar overview' });
  }
});

export default router;
