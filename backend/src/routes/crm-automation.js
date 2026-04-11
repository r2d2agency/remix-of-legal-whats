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

// Helper: Check if user can manage CRM
function canManage(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}

// ============================================
// STAGE AUTOMATIONS
// ============================================

// Get automation config for a stage
router.get('/stages/:stageId/automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `SELECT sa.*, f.name as flow_name, 
              ns.name as next_stage_name,
              ff.name as fallback_funnel_name,
              fs.name as fallback_stage_name
       FROM crm_stage_automations sa
       LEFT JOIN flows f ON f.id = sa.flow_id
       LEFT JOIN crm_stages ns ON ns.id = sa.next_stage_id
       LEFT JOIN crm_funnels ff ON ff.id = sa.fallback_funnel_id
       LEFT JOIN crm_stages fs ON fs.id = sa.fallback_stage_id
       WHERE sa.stage_id = $1`,
      [req.params.stageId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    logError('Error fetching stage automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save automation config for a stage
router.put('/stages/:stageId/automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { 
      flow_id, 
      wait_hours, 
      next_stage_id, 
      fallback_funnel_id,
      fallback_stage_id,
      is_active,
      execute_immediately,
      schedule_days,
      schedule_start_time,
      schedule_end_time,
      conditions,
      condition_logic,
      condition_true_flow_id,
      condition_true_stage_id,
      condition_false_flow_id,
      condition_false_stage_id
    } = req.body;

    // Upsert automation
    const result = await query(
      `INSERT INTO crm_stage_automations 
       (stage_id, flow_id, wait_hours, next_stage_id, fallback_funnel_id, fallback_stage_id, is_active, execute_immediately, schedule_days, schedule_start_time, schedule_end_time, conditions, condition_logic, condition_true_flow_id, condition_true_stage_id, condition_false_flow_id, condition_false_stage_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (stage_id) 
       DO UPDATE SET
         flow_id = EXCLUDED.flow_id,
         wait_hours = EXCLUDED.wait_hours,
         next_stage_id = EXCLUDED.next_stage_id,
         fallback_funnel_id = EXCLUDED.fallback_funnel_id,
         fallback_stage_id = EXCLUDED.fallback_stage_id,
         is_active = EXCLUDED.is_active,
         execute_immediately = EXCLUDED.execute_immediately,
         schedule_days = EXCLUDED.schedule_days,
         schedule_start_time = EXCLUDED.schedule_start_time,
         schedule_end_time = EXCLUDED.schedule_end_time,
         conditions = EXCLUDED.conditions,
         condition_logic = EXCLUDED.condition_logic,
         condition_true_flow_id = EXCLUDED.condition_true_flow_id,
         condition_true_stage_id = EXCLUDED.condition_true_stage_id,
         condition_false_flow_id = EXCLUDED.condition_false_flow_id,
         condition_false_stage_id = EXCLUDED.condition_false_stage_id,
         updated_at = NOW()
       RETURNING *`,
      [
        req.params.stageId,
        flow_id || null,
        wait_hours || 24,
        next_stage_id || null,
        fallback_funnel_id || null,
        fallback_stage_id || null,
        is_active !== false,
        execute_immediately !== false,
        schedule_days ? JSON.stringify(schedule_days) : JSON.stringify([1,2,3,4,5]),
        schedule_start_time || '08:00',
        schedule_end_time || '18:00',
        conditions ? JSON.stringify(conditions) : '[]',
        condition_logic || 'and',
        condition_true_flow_id || null,
        condition_true_stage_id || null,
        condition_false_flow_id || null,
        condition_false_stage_id || null
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error saving stage automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete automation config for a stage
router.delete('/stages/:stageId/automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await query(
      `DELETE FROM crm_stage_automations WHERE stage_id = $1`,
      [req.params.stageId]
    );

    res.json({ success: true });
  } catch (error) {
    logError('Error deleting stage automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all automations for a funnel
router.get('/funnels/:funnelId/automations', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `SELECT sa.*, s.name as stage_name, s.position, f.name as flow_name
       FROM crm_stage_automations sa
       JOIN crm_stages s ON s.id = sa.stage_id
       LEFT JOIN flows f ON f.id = sa.flow_id
       WHERE s.funnel_id = $1
       ORDER BY s.position`,
      [req.params.funnelId]
    );

    res.json(result.rows);
  } catch (error) {
    logError('Error fetching funnel automations:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEAL AUTOMATIONS
// ============================================

// Start automation for a deal
router.post('/deals/:dealId/start-automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    // Get deal and its current stage automation
    const dealResult = await query(
      `SELECT d.*, sa.*,
              dc.contact_id,
              (SELECT phone FROM contacts WHERE id = dc.contact_id) as contact_phone
       FROM crm_deals d
       LEFT JOIN crm_stage_automations sa ON sa.stage_id = d.stage_id AND sa.is_active = true
       LEFT JOIN crm_deal_contacts dc ON dc.deal_id = d.id AND dc.is_primary = true
       WHERE d.id = $1 AND d.organization_id = $2`,
      [req.params.dealId, org.organization_id]
    );

    if (!dealResult.rows[0]) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    
    if (!deal.flow_id) {
      return res.status(400).json({ error: 'No automation configured for this stage' });
    }

    // Cancel any existing pending automations for this deal
    await query(
      `UPDATE crm_deal_automations 
       SET status = 'cancelled', updated_at = NOW()
       WHERE deal_id = $1 AND status IN ('pending', 'flow_sent', 'waiting')`,
      [req.params.dealId]
    );

    // Create new automation record
    const waitUntil = new Date();
    waitUntil.setHours(waitUntil.getHours() + (deal.wait_hours || 24));

    const automationResult = await query(
      `INSERT INTO crm_deal_automations 
       (deal_id, stage_id, automation_id, status, flow_id, wait_until, contact_phone, next_stage_id)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.dealId,
        deal.stage_id,
        deal.id, // automation config id
        deal.flow_id,
        waitUntil,
        deal.contact_phone,
        deal.next_stage_id
      ]
    );

    // Log the action
    await query(
      `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
       VALUES ($1, $2, 'automation_started', $3)`,
      [automationResult.rows[0].id, req.params.dealId, JSON.stringify({ flow_id: deal.flow_id, wait_hours: deal.wait_hours })]
    );

    res.json(automationResult.rows[0]);
  } catch (error) {
    logError('Error starting deal automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel automation for a deal
router.post('/deals/:dealId/cancel-automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `UPDATE crm_deal_automations 
       SET status = 'cancelled', updated_at = NOW()
       WHERE deal_id = $1 AND status IN ('pending', 'flow_sent', 'waiting')
       RETURNING *`,
      [req.params.dealId]
    );

    if (result.rows.length > 0) {
      await query(
        `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
         VALUES ($1, $2, 'manual_cancel', '{}')`,
        [result.rows[0].id, req.params.dealId]
      );
    }

    res.json({ success: true, cancelled: result.rows.length });
  } catch (error) {
    logError('Error cancelling deal automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get automation status for a deal
router.get('/deals/:dealId/automation-status', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `SELECT da.*, f.name as flow_name, s.name as stage_name, ns.name as next_stage_name
       FROM crm_deal_automations da
       LEFT JOIN flows f ON f.id = da.flow_id
       LEFT JOIN crm_stages s ON s.id = da.stage_id
       LEFT JOIN crm_stages ns ON ns.id = da.next_stage_id
       WHERE da.deal_id = $1
       ORDER BY da.created_at DESC
       LIMIT 5`,
      [req.params.dealId]
    );

    res.json(result.rows);
  } catch (error) {
    logError('Error fetching deal automation status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get automation logs for a deal
router.get('/deals/:dealId/automation-logs', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `SELECT * FROM crm_automation_logs
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.dealId]
    );

    res.json(result.rows);
  } catch (error) {
    logError('Error fetching automation logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BULK OPERATIONS
// ============================================

// Start automation for multiple deals (bulk move to automated funnel)
router.post('/deals/bulk-start-automation', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { deal_ids, target_stage_id } = req.body;

    if (!deal_ids || !Array.isArray(deal_ids) || deal_ids.length === 0) {
      return res.status(400).json({ error: 'No deals provided' });
    }

    // Get target stage automation
    const automationResult = await query(
      `SELECT sa.*, s.funnel_id
       FROM crm_stage_automations sa
       JOIN crm_stages s ON s.id = sa.stage_id
       WHERE sa.stage_id = $1 AND sa.is_active = true`,
      [target_stage_id]
    );

    if (!automationResult.rows[0]) {
      return res.status(400).json({ error: 'No active automation for target stage' });
    }

    const automation = automationResult.rows[0];
    let started = 0;
    let failed = 0;

    for (const dealId of deal_ids) {
      try {
        // Move deal to target stage
        await query(
          `UPDATE crm_deals SET stage_id = $1, funnel_id = $2, updated_at = NOW()
           WHERE id = $3 AND organization_id = $4`,
          [target_stage_id, automation.funnel_id, dealId, org.organization_id]
        );

        // Get deal contact phone
        const contactResult = await query(
          `SELECT c.phone FROM crm_deal_contacts dc
           JOIN contacts c ON c.id = dc.contact_id
           WHERE dc.deal_id = $1 AND dc.is_primary = true`,
          [dealId]
        );

        const contactPhone = contactResult.rows[0]?.phone;

        // Cancel existing automations
        await query(
          `UPDATE crm_deal_automations 
           SET status = 'cancelled', updated_at = NOW()
           WHERE deal_id = $1 AND status IN ('pending', 'flow_sent', 'waiting')`,
          [dealId]
        );

        // Create new automation
        const waitUntil = new Date();
        waitUntil.setHours(waitUntil.getHours() + (automation.wait_hours || 24));

        await query(
          `INSERT INTO crm_deal_automations 
           (deal_id, stage_id, automation_id, status, flow_id, wait_until, contact_phone, next_stage_id)
           VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
          [dealId, target_stage_id, automation.id, automation.flow_id, waitUntil, contactPhone, automation.next_stage_id]
        );

        started++;
      } catch (err) {
        logError(`Failed to start automation for deal ${dealId}:`, err);
        failed++;
      }
    }

    res.json({ success: true, started, failed });
  } catch (error) {
    logError('Error in bulk start automation:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
