import { query } from './db.js';
import { logInfo, logError } from './logger.js';
import { emitLeadEvent, processPendingLeadEvents } from './lib/event-bus.js';

// Execute flow for a deal automation
// Helper: Get next business day/time respecting schedule
function getNextBusinessDateTime(scheduleDays, startTime, endTime) {
  const now = new Date();
  // Convert to São Paulo timezone
  const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const currentDay = spNow.getDay(); // 0=Sun, 1=Mon...
  const currentHour = spNow.getHours();
  const currentMinute = spNow.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  const days = scheduleDays || [1, 2, 3, 4, 5]; // Default Mon-Fri
  const start = startTime || '08:00';
  const end = endTime || '18:00';

  // Check if current time is within schedule
  if (days.includes(currentDay) && currentTimeStr >= start && currentTimeStr < end) {
    return null; // Can execute now
  }

  // Find next valid time
  for (let offset = 0; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    if (days.includes(checkDay)) {
      if (offset === 0 && currentTimeStr < start) {
        // Today but before start time - schedule for start time today
        const scheduled = new Date(spNow);
        const [h, m] = start.split(':').map(Number);
        scheduled.setHours(h, m, 0, 0);
        return scheduled;
      }
      if (offset > 0) {
        // Future day - schedule for start time
        const scheduled = new Date(spNow);
        scheduled.setDate(scheduled.getDate() + offset);
        const [h, m] = start.split(':').map(Number);
        scheduled.setHours(h, m, 0, 0);
        return scheduled;
      }
    }
  }
  return null;
}

async function executeFlowForDeal(automation, organizationId) {
  try {
    // Check business hours schedule
    const scheduleConfig = await query(
      `SELECT schedule_days, schedule_start_time, schedule_end_time 
       FROM crm_stage_automations WHERE id = $1`,
      [automation.automation_id]
    );
    
    if (scheduleConfig.rows[0]) {
      const cfg = scheduleConfig.rows[0];
      const scheduleDays = typeof cfg.schedule_days === 'string' ? JSON.parse(cfg.schedule_days) : cfg.schedule_days;
      const nextTime = getNextBusinessDateTime(scheduleDays, cfg.schedule_start_time, cfg.schedule_end_time);
      
      if (nextTime) {
        // Not within business hours, reschedule
        await query(
          `UPDATE crm_deal_automations SET wait_until = $1, status = 'waiting', updated_at = NOW() WHERE id = $2`,
          [nextTime, automation.id]
        );
        logInfo(`Automation ${automation.id} rescheduled to ${nextTime.toISOString()} (business hours)`);
        return false;
      }
    }

    // Get connection for the organization - prefer funnel-specific connection
    let connectionResult = await query(
      `SELECT c.* FROM connections c
       JOIN crm_stages s ON s.funnel_id = (SELECT funnel_id FROM crm_stages WHERE id = $2)
       JOIN crm_funnels f ON f.id = s.funnel_id
       WHERE c.id = f.connection_id AND c.status = 'connected'
       LIMIT 1`,
      [organizationId, automation.stage_id]
    );
    
    if (!connectionResult.rows[0]) {
      // Fallback to any active connection
      connectionResult = await query(
        `SELECT * FROM connections 
         WHERE organization_id = $1 AND status = 'connected' 
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId]
      );
    }

    if (!connectionResult.rows[0]) {
      logError(`No active connection for org ${organizationId}`);
      return false;
    }

    const connection = connectionResult.rows[0];

    // Get flow data
    const flowResult = await query(
      `SELECT * FROM flows WHERE id = $1`,
      [automation.flow_id]
    );

    if (!flowResult.rows[0]) {
      logError(`Flow ${automation.flow_id} not found`);
      return false;
    }

    const flow = flowResult.rows[0];

    // Get contact data for variables
    const contactResult = await query(
      `SELECT c.name, c.phone, c.email
       FROM contacts c
       JOIN crm_deal_contacts dc ON dc.contact_id = c.id
       WHERE dc.deal_id = $1 AND dc.is_primary = true`,
      [automation.deal_id]
    );

    const contact = contactResult.rows[0] || {};

    // Get deal data for additional variables
    const dealResult = await query(
      `SELECT d.*, co.name as company_name, s.name as stage_name, f.name as funnel_name
       FROM crm_deals d
       LEFT JOIN crm_companies co ON co.id = d.company_id
       LEFT JOIN crm_stages s ON s.id = d.stage_id
       LEFT JOIN crm_funnels f ON f.id = d.funnel_id
       WHERE d.id = $1`,
      [automation.deal_id]
    );

    const deal = dealResult.rows[0] || {};

    // Create or find conversation for this contact
    let conversationId = null;
    if (automation.contact_phone) {
      const convResult = await query(
        `SELECT id FROM conversations 
         WHERE connection_id = $1 AND phone = $2
         ORDER BY created_at DESC LIMIT 1`,
        [connection.id, automation.contact_phone]
      );

      if (convResult.rows[0]) {
        conversationId = convResult.rows[0].id;
      } else {
        // Create new conversation
        const newConv = await query(
          `INSERT INTO conversations (connection_id, phone, contact_name, status)
           VALUES ($1, $2, $3, 'open')
           RETURNING id`,
          [connection.id, automation.contact_phone, contact.name || 'Lead CRM']
        );
        conversationId = newConv.rows[0].id;
      }
    }

    if (!conversationId) {
      logError(`No conversation could be created for deal ${automation.deal_id}`);
      return false;
    }

    // Parse deal custom_fields and inject as variables
    let dealCustomFields = {};
    try {
      dealCustomFields = typeof deal.custom_fields === 'string'
        ? JSON.parse(deal.custom_fields || '{}')
        : (deal.custom_fields || {});
    } catch (e) {
      dealCustomFields = {};
    }

    // Create flow session with deal variables + custom fields
    const variables = {
      nome: contact.name || '',
      telefone: contact.phone || automation.contact_phone || '',
      email: contact.email || '',
      deal_title: deal.title || '',
      deal_value: deal.value || 0,
      deal_status: deal.status || '',
      deal_stage_id: deal.stage_id || '',
      deal_stage_name: deal.stage_name || '',
      deal_funnel_id: deal.funnel_id || '',
      deal_funnel_name: deal.funnel_name || '',
      deal_company_name: deal.company_name || '',
      deal_source: deal.source || '',
      deal_probability: deal.probability || 0,
      company_name: deal.company_name || '',
      // CRM specific
      deal_id: automation.deal_id,
      automation_id: automation.id,
      custom_fields: dealCustomFields,
      // Inject custom fields as top-level variables
      ...dealCustomFields,
    };

    const sessionResult = await query(
      `INSERT INTO flow_sessions 
       (flow_id, conversation_id, connection_id, contact_phone, status, variables, current_node_id)
       VALUES ($1, $2, $3, $4, 'active', $5, 
         (SELECT node_id FROM flow_nodes WHERE flow_id = $1 AND node_type = 'start' LIMIT 1))
       ON CONFLICT (conversation_id) WHERE status = 'active'
       DO UPDATE SET 
         flow_id = EXCLUDED.flow_id,
         variables = EXCLUDED.variables,
         current_node_id = EXCLUDED.current_node_id,
         updated_at = NOW()
       RETURNING id`,
      [automation.flow_id, conversationId, connection.id, automation.contact_phone, JSON.stringify(variables)]
    );

    // Update automation status
    await query(
      `UPDATE crm_deal_automations 
       SET status = 'flow_sent', flow_session_id = $1, flow_sent_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [sessionResult.rows[0]?.id, automation.id]
    );

    // Log the action
    await query(
      `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
       VALUES ($1, $2, 'flow_triggered', $3)`,
      [automation.id, automation.deal_id, JSON.stringify({ 
        flow_id: automation.flow_id,
        flow_name: flow.name,
        contact_phone: automation.contact_phone
      })]
    );

    logInfo(`Flow ${flow.name} triggered for deal ${automation.deal_id}`);
    return true;
  } catch (error) {
    logError('Error executing flow for deal:', error);
    return false;
  }
}

// Move deal to next stage (timeout)
async function moveDealToNextStage(automation) {
  try {
    // Get automation config for next stage info
    const configResult = await query(
      `SELECT sa.*, s.funnel_id
       FROM crm_stage_automations sa
       JOIN crm_stages s ON s.id = sa.stage_id
       WHERE sa.stage_id = $1`,
      [automation.stage_id]
    );

    const config = configResult.rows[0];
    let nextStageId = automation.next_stage_id;
    let nextFunnelId = null;

    // If no next stage in same funnel, check fallback funnel
    if (!nextStageId && config?.fallback_funnel_id && config?.fallback_stage_id) {
      nextStageId = config.fallback_stage_id;
      nextFunnelId = config.fallback_funnel_id;
    }

    if (!nextStageId) {
      logInfo(`No next stage configured for deal ${automation.deal_id}, marking as completed`);
      await query(
        `UPDATE crm_deal_automations SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [automation.id]
      );
      return false;
    }

    // Move the deal
    const updateFields = nextFunnelId 
      ? `stage_id = $1, funnel_id = $2, last_activity_at = NOW(), updated_at = NOW()`
      : `stage_id = $1, last_activity_at = NOW(), updated_at = NOW()`;
    
    const updateParams = nextFunnelId 
      ? [nextStageId, nextFunnelId, automation.deal_id]
      : [nextStageId, automation.deal_id];

    await query(
      `UPDATE crm_deals SET ${updateFields} WHERE id = $${updateParams.length}`,
      updateParams
    );

    // Update current automation as moved
    await query(
      `UPDATE crm_deal_automations 
       SET status = 'moved', moved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [automation.id]
    );

    // Log the action
    await query(
      `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
       VALUES ($1, $2, 'timeout_move', $3)`,
      [automation.id, automation.deal_id, JSON.stringify({ 
        from_stage_id: automation.stage_id,
        to_stage_id: nextStageId,
        to_funnel_id: nextFunnelId
      })]
    );

    // Add to deal history
    await query(
      `INSERT INTO crm_deal_history (deal_id, action, from_value, to_value, notes)
       VALUES ($1, 'stage_changed', $2, $3, 'Movido automaticamente por falta de resposta')`,
      [automation.deal_id, automation.stage_id, nextStageId]
    );

    // Check if new stage has automation and start it
    const newStageAutomation = await query(
      `SELECT * FROM crm_stage_automations 
       WHERE stage_id = $1 AND is_active = true AND execute_immediately = true`,
      [nextStageId]
    );

    if (newStageAutomation.rows[0]) {
      const newConfig = newStageAutomation.rows[0];
      const waitUntil = new Date();
      waitUntil.setHours(waitUntil.getHours() + (newConfig.wait_hours || 24));

      await query(
        `INSERT INTO crm_deal_automations 
         (deal_id, stage_id, automation_id, status, flow_id, wait_until, contact_phone, next_stage_id)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
        [
          automation.deal_id, 
          nextStageId, 
          newConfig.id, 
          newConfig.flow_id, 
          waitUntil, 
          automation.contact_phone,
          newConfig.next_stage_id
        ]
      );

      logInfo(`New automation started for deal ${automation.deal_id} in stage ${nextStageId}`);
    }

    logInfo(`Deal ${automation.deal_id} moved from stage ${automation.stage_id} to ${nextStageId}`);
    return true;
  } catch (error) {
    logError('Error moving deal to next stage:', error);
    return false;
  }
}

// Check for incoming messages that should stop automation
async function checkForResponses() {
  try {
    // Find active automations with contact phones
    const activeAutomations = await query(
      `SELECT da.* FROM crm_deal_automations da
       WHERE da.status IN ('flow_sent', 'waiting') 
         AND da.contact_phone IS NOT NULL`
    );

    for (const automation of activeAutomations.rows) {
      // Check if there's a recent incoming message from this contact
      const messageResult = await query(
        `SELECT id FROM chat_messages 
         WHERE phone = $1 
           AND direction = 'incoming'
           AND created_at > $2
         LIMIT 1`,
        [automation.contact_phone, automation.flow_sent_at || automation.created_at]
      );

      if (messageResult.rows[0]) {
        // Contact responded! Cancel the automation
        await query(
          `UPDATE crm_deal_automations 
           SET status = 'responded', responded_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [automation.id]
        );

        // Log the response
        await query(
          `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
           VALUES ($1, $2, 'message_received', '{"source": "incoming_message"}')`,
          [automation.id, automation.deal_id]
        );

        // Update deal activity
        await query(
          `UPDATE crm_deals SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [automation.deal_id]
        );

        logInfo(`Automation stopped for deal ${automation.deal_id} - contact responded`);
      }
    }
  } catch (error) {
    logError('Error checking for responses:', error);
  }
}

function getConditionFieldValue(dealData, variable) {
  if (!variable) return undefined;

  if (Object.prototype.hasOwnProperty.call(dealData, variable)) {
    return dealData[variable];
  }

  const normalizedVariable = String(variable).trim();
  if (!normalizedVariable) return undefined;

  if (normalizedVariable.startsWith('custom_fields.')) {
    const rawKey = normalizedVariable.slice('custom_fields.'.length);
    if (Object.prototype.hasOwnProperty.call(dealData, rawKey)) {
      return dealData[rawKey];
    }
  }

  const parts = normalizedVariable.split('.');
  let current = dealData;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

// Main execution function
export async function executeCRMAutomations() {
  logInfo('🤖 [CRM-AUTOMATION] Starting execution...');

  const stats = {
    pending_processed: 0,
    flows_triggered: 0,
    timeouts_processed: 0,
    deals_moved: 0,
    responses_detected: 0,
    errors: 0
  };

  try {
    // 1. Check for responses first (to stop automations)
    await checkForResponses();

    // 2. Process pending automations (trigger flows)
    const pendingAutomations = await query(
      `SELECT da.*, d.organization_id
       FROM crm_deal_automations da
       JOIN crm_deals d ON d.id = da.deal_id
       WHERE da.status = 'pending' 
         AND da.flow_id IS NOT NULL
       ORDER BY da.created_at ASC
       LIMIT 50`
    );

    for (const automation of pendingAutomations.rows) {
      stats.pending_processed++;
      
      const success = await executeFlowForDeal(automation, automation.organization_id);
      if (success) {
        stats.flows_triggered++;
      } else {
        stats.errors++;
      }

      // Small delay between executions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Process timeouts (move deals to next stage)
    const timedOutAutomations = await query(
      `SELECT da.*, d.organization_id
       FROM crm_deal_automations da
       JOIN crm_deals d ON d.id = da.deal_id
       WHERE da.status IN ('flow_sent', 'waiting')
         AND da.wait_until < NOW()
       ORDER BY da.wait_until ASC
       LIMIT 50`
    );

    for (const automation of timedOutAutomations.rows) {
      stats.timeouts_processed++;
      
      const moved = await moveDealToNextStage(automation);
      if (moved) {
        stats.deals_moved++;
      }

      // Small delay between moves
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    logInfo('🤖 [CRM-AUTOMATION] Execution complete:', stats);
    return stats;
  } catch (error) {
    logError('🤖 [CRM-AUTOMATION] Execution error:', error);
    throw error;
  }
}

// Evaluate a single condition rule against deal data
function evaluateConditionRule(dealData, rule) {
  const rawFieldValue = getConditionFieldValue(dealData, rule.variable);
  const fieldValue = String(rawFieldValue ?? '').toLowerCase();
  const compareValue = String(rule.value || '').toLowerCase();

  switch (rule.operator) {
    case 'equals': case 'equal': return fieldValue === compareValue;
    case 'not_equals': case 'not_equal': return fieldValue !== compareValue;
    case 'contains': return fieldValue.includes(compareValue);
    case 'not_contains': return !fieldValue.includes(compareValue);
    case 'starts_with': return fieldValue.startsWith(compareValue);
    case 'ends_with': return fieldValue.endsWith(compareValue);
    case 'is_empty': return fieldValue === '';
    case 'is_not_empty': return fieldValue !== '';
    case 'greater_than': return parseFloat(rawFieldValue) > parseFloat(rule.value);
    case 'less_than': return parseFloat(rawFieldValue) < parseFloat(rule.value);
    default: return false;
  }
}

// Evaluate all conditions for a stage automation against deal data
function evaluateConditions(conditions, conditionLogic, dealData) {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return null; // No conditions = skip conditional logic, use default flow
  }

  const logic = conditionLogic || 'and';
  let result = logic === 'and';

  for (const rule of conditions) {
    const ruleResult = evaluateConditionRule(dealData, rule);
    if (logic === 'and') {
      result = result && ruleResult;
    } else {
      result = result || ruleResult;
    }
  }

  return result;
}

// Trigger automation when a deal enters a new stage
export async function onDealStageChanged(dealId, newStageId, organizationId) {
  try {
    // Check if new stage has automation
    const automationConfig = await query(
      `SELECT * FROM crm_stage_automations 
       WHERE stage_id = $1 AND is_active = true AND execute_immediately = true`,
      [newStageId]
    );

    if (!automationConfig.rows[0]) {
      return; // No automation for this stage
    }

    const config = automationConfig.rows[0];

    // Get deal data + custom fields for condition evaluation
    const dealResult = await query(
      `SELECT d.*, s.name as stage_name, f.name as funnel_name, co.name as company_name
       FROM crm_deals d
       LEFT JOIN crm_stages s ON s.id = d.stage_id
       LEFT JOIN crm_funnels f ON f.id = d.funnel_id
       LEFT JOIN crm_companies co ON co.id = d.company_id
       WHERE d.id = $1`,
      [dealId]
    );
    const deal = dealResult.rows[0] || {};

    // Build deal data map for condition evaluation
    let customFields = {};
    try {
      customFields = typeof deal.custom_fields === 'string'
        ? JSON.parse(deal.custom_fields || '{}')
        : (deal.custom_fields || {});
    } catch (e) { customFields = {}; }

    const dealData = {
      deal_title: deal.title || '',
      deal_value: deal.value || 0,
      deal_status: deal.status || '',
      deal_stage_name: deal.stage_name || '',
      deal_funnel_name: deal.funnel_name || '',
      deal_company_name: deal.company_name || '',
      deal_source: deal.source || '',
      deal_probability: deal.probability || 0,
      custom_fields: customFields,
      ...customFields,
    };

    // Evaluate conditions
    const conditions = typeof config.conditions === 'string'
      ? JSON.parse(config.conditions || '[]')
      : (config.conditions || []);
    const conditionResult = evaluateConditions(conditions, config.condition_logic, dealData);

    // Determine which flow and stage to use based on condition result
    let effectiveFlowId = config.flow_id;
    let effectiveNextStageId = config.next_stage_id;

    if (conditionResult !== null) {
      // Conditions exist - use conditional paths
      if (conditionResult === true) {
        effectiveFlowId = config.condition_true_flow_id || config.flow_id;
        effectiveNextStageId = config.condition_true_stage_id || config.next_stage_id;
      } else {
        effectiveFlowId = config.condition_false_flow_id || config.flow_id;
        effectiveNextStageId = config.condition_false_stage_id || config.next_stage_id;
      }

      // If condition result has a stage to move to immediately (and no flow), move directly
      const moveStageId = conditionResult ? config.condition_true_stage_id : config.condition_false_stage_id;
      const moveFlowId = conditionResult ? config.condition_true_flow_id : config.condition_false_flow_id;

      if (moveStageId && !moveFlowId) {
        // Direct move without flow
        await query(
          `UPDATE crm_deals SET stage_id = $1, funnel_id = COALESCE((SELECT funnel_id FROM crm_stages WHERE id = $1), funnel_id), last_activity_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [moveStageId, dealId]
        );
        await query(
          `INSERT INTO crm_deal_history (deal_id, action, from_value, to_value, notes)
           VALUES ($1, 'stage_changed', $2, $3, 'Movido automaticamente por condição da automação')`,
          [dealId, newStageId, moveStageId]
        );
        logInfo(`Condition ${conditionResult ? 'TRUE' : 'FALSE'}: Moved deal ${dealId} to stage ${moveStageId} directly`);
        return;
      }
    }

    // Get contact phone for the deal
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

    // Create new automation with resolved flow/stage
    const waitUntil = new Date();
    waitUntil.setHours(waitUntil.getHours() + (config.wait_hours || 24));

    await query(
      `INSERT INTO crm_deal_automations 
       (deal_id, stage_id, automation_id, status, flow_id, wait_until, contact_phone, next_stage_id)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
      [dealId, newStageId, config.id, effectiveFlowId, waitUntil, contactPhone, effectiveNextStageId]
    );

    logInfo(`Automation queued for deal ${dealId} in stage ${newStageId} (condition: ${conditionResult})`);
  } catch (error) {
    logError('Error triggering stage automation:', error);
  }
}
