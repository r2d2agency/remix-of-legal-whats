import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

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

// Get Supervisor Stats
router.get('/stats', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { period, sellerId, teamId, tag, channel, funnelId, status } = req.query;

    let whereClause = `WHERE d.organization_id = $1`;
    const params = [org.organization_id];

    if (sellerId) {
      params.push(sellerId);
      whereClause += ` AND d.owner_id = $${params.length}`;
    }
    if (funnelId) {
      params.push(funnelId);
      whereClause += ` AND d.funnel_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND d.status = $${params.length}`;
    }
    // Add more filters as needed

    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE d.status = 'open' AND d.first_seller_message_at IS NULL) as leads_novos,
        COUNT(*) FILTER (WHERE d.status = 'open' AND d.first_seller_message_at IS NULL AND d.created_at < NOW() - INTERVAL '30 minutes') as leads_sem_abordagem,
        COUNT(*) FILTER (WHERE d.status = 'open' AND d.last_customer_message_at > d.last_seller_message_at) as leads_sem_resposta,
        COUNT(*) FILTER (WHERE d.status = 'open') as leads_em_atendimento,
        COUNT(*) FILTER (WHERE d.status = 'won') as leads_convertidos,
        COUNT(*) FILTER (WHERE d.status = 'lost') as leads_perdidos,
        COUNT(*) FILTER (WHERE d.status = 'lost' AND d.lost_at < NOW() - INTERVAL '30 days') as leads_reativacao,
        COUNT(*) FILTER (WHERE d.status = 'open' AND (d.next_followup_at < NOW() OR d.next_followup_at IS NULL)) as leads_followup_pendente,
        COUNT(*) FILTER (WHERE d.status = 'open' AND d.proposal_sent_at IS NULL) as leads_aguardando_proposta,
        COUNT(*) FILTER (WHERE d.status = 'open' AND d.payment_pending_at IS NOT NULL) as leads_aguardando_pagamento
      FROM crm_deals d
      ${whereClause}
    `;

    const result = await query(statsQuery, params);
    res.json(result.rows[0]);
  } catch (error) {
    logError('Error fetching supervisor stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Semaphore Data
router.get('/semaphore', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    // Fetch settings for SLAs
    const settingsResult = await query(
      `SELECT * FROM supervisor_settings WHERE organization_id = $1`,
      [org.organization_id]
    );
    const settings = settingsResult.rows[0] || {
      new_lead_sla_minutes: 30,
      no_followup_sla_hours: 24,
      no_response_sla_days: 2
    };

    const semaphoreQuery = `
      SELECT 
        id, title, owner_id, status, created_at, last_seller_message_at, last_customer_message_at, first_seller_message_at, next_followup_at,
        CASE 
          WHEN status != 'open' THEN 'GREEN'
          -- RED CRITERIA
          WHEN first_seller_message_at IS NULL AND created_at < NOW() - INTERVAL '${settings.new_lead_sla_minutes} minutes' THEN 'RED'
          WHEN next_followup_at < NOW() - INTERVAL '1 hour' THEN 'RED'
          WHEN last_customer_message_at > last_seller_message_at AND last_customer_message_at < NOW() - INTERVAL '${settings.no_response_sla_days} days' THEN 'RED'
          -- YELLOW CRITERIA
          WHEN first_seller_message_at IS NULL AND created_at < NOW() - INTERVAL '${settings.new_lead_sla_minutes / 2} minutes' THEN 'YELLOW'
          WHEN next_followup_at BETWEEN NOW() AND NOW() + INTERVAL '2 hours' THEN 'YELLOW'
          WHEN last_activity_at < NOW() - INTERVAL '12 hours' THEN 'YELLOW'
          -- GREEN
          ELSE 'GREEN'
        END as semaphore_color
      FROM crm_deals
      WHERE organization_id = $1 AND status = 'open'
    `;

    const result = await query(semaphoreQuery, [org.organization_id]);
    
    const summary = {
      GREEN: result.rows.filter(r => r.semaphore_color === 'GREEN').length,
      YELLOW: result.rows.filter(r => r.semaphore_color === 'YELLOW').length,
      RED: result.rows.filter(r => r.semaphore_color === 'RED').length,
      leads: result.rows
    };

    res.json(summary);
  } catch (error) {
    logError('Error fetching semaphore data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview Settings (Calculate semaphore with hypothetical settings)
router.post('/preview-settings', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const settings = {
      new_lead_sla_minutes: req.body.new_lead_sla_minutes || 30,
      no_followup_sla_hours: req.body.no_followup_sla_hours || 24,
      no_response_sla_days: req.body.no_response_sla_days || 2,
      proposal_sla_hours: req.body.proposal_sla_hours || 4,
      payment_sla_days: req.body.payment_sla_days || 3
    };

    const semaphoreQuery = `
      SELECT 
        CASE 
          WHEN status != 'open' THEN 'GREEN'
          -- RED CRITERIA
          WHEN first_seller_message_at IS NULL AND created_at < NOW() - INTERVAL '${settings.new_lead_sla_minutes} minutes' THEN 'RED'
          WHEN next_followup_at < NOW() - INTERVAL '1 hour' THEN 'RED'
          WHEN last_customer_message_at > last_seller_message_at AND last_customer_message_at < NOW() - INTERVAL '${settings.no_response_sla_days} days' THEN 'RED'
          -- YELLOW CRITERIA
          WHEN first_seller_message_at IS NULL AND created_at < NOW() - INTERVAL '${settings.new_lead_sla_minutes / 2} minutes' THEN 'YELLOW'
          WHEN next_followup_at BETWEEN NOW() AND NOW() + INTERVAL '2 hours' THEN 'YELLOW'
          WHEN last_activity_at < NOW() - INTERVAL '12 hours' THEN 'YELLOW'
          -- GREEN
          ELSE 'GREEN'
        END as semaphore_color
      FROM crm_deals
      WHERE organization_id = $1 AND status = 'open'
    `;

    const result = await query(semaphoreQuery, [org.organization_id]);
    
    const summary = {
      GREEN: result.rows.filter(r => r.semaphore_color === 'GREEN').length,
      YELLOW: result.rows.filter(r => r.semaphore_color === 'YELLOW').length,
      RED: result.rows.filter(r => r.semaphore_color === 'RED').length
    };

    res.json(summary);
  } catch (error) {
    logError('Error previewing supervisor settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Seller Performance
router.get('/sellers', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const sellerQuery = `
      SELECT 
        u.id, u.name,
        COUNT(d.id) as total_leads,
        COUNT(d.id) FILTER (WHERE d.status = 'won') as conversions,
        COUNT(d.id) FILTER (WHERE d.first_seller_message_at IS NULL) as no_approach,
        AVG(EXTRACT(EPOCH FROM (d.first_seller_message_at - d.created_at))) as avg_response_time,
        (COUNT(d.id) FILTER (WHERE d.status = 'won')::float / NULLIF(COUNT(d.id), 0)) * 100 as conversion_rate
      FROM users u
      JOIN organization_members om ON om.user_id = u.id
      LEFT JOIN crm_deals d ON d.owner_id = u.id AND d.organization_id = $1
      WHERE om.organization_id = $1
      GROUP BY u.id, u.name
      ORDER BY conversion_rate DESC NULLS LAST
    `;

    const result = await query(sellerQuery, [org.organization_id]);
    res.json(result.rows);
  } catch (error) {
    logError('Error fetching seller performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Audits
router.get('/audits', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    const result = await query(
      `SELECT a.*, d.title as lead_name, u.name as seller_name
       FROM supervisor_audits a
       JOIN crm_deals d ON d.id = a.deal_id
       LEFT JOIN users u ON u.id = a.owner_id
       WHERE a.organization_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [org.organization_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings CRUD

router.get('/settings', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    const result = await query(`SELECT * FROM supervisor_settings WHERE organization_id = $1`, [org.organization_id]);
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    const { 
      new_lead_sla_minutes, no_followup_sla_hours, no_response_sla_days,
      reactivation_days, proposal_sla_hours, payment_sla_days 
    } = req.body;

    const result = await query(
      `INSERT INTO supervisor_settings (
        organization_id, new_lead_sla_minutes, no_followup_sla_hours, no_response_sla_days,
        reactivation_days, proposal_sla_hours, payment_sla_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id) DO UPDATE SET
        new_lead_sla_minutes = EXCLUDED.new_lead_sla_minutes,
        no_followup_sla_hours = EXCLUDED.no_followup_sla_hours,
        no_response_sla_days = EXCLUDED.no_response_sla_days,
        reactivation_days = EXCLUDED.reactivation_days,
        proposal_sla_hours = EXCLUDED.proposal_sla_hours,
        payment_sla_days = EXCLUDED.payment_sla_days,
        updated_at = NOW()
      RETURNING *`,
      [org.organization_id, new_lead_sla_minutes, no_followup_sla_hours, no_response_sla_days, reactivation_days, proposal_sla_hours, payment_sla_days]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
