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

async function executeFlowForDeal(automation, organizationId, opts = {}) {
  const overrideFlowId = opts.overrideFlowId || null;
  const skipScheduleCheck = !!opts.skipScheduleCheck;
  const skipStatusUpdate = !!opts.skipStatusUpdate;
  try {
    // Check business hours schedule
    const scheduleConfig = skipScheduleCheck ? { rows: [] } : await query(
      `SELECT schedule_days, schedule_start_time, schedule_end_time, outside_hours_flow_id
       FROM crm_stage_automations WHERE id = $1`,
      [automation.automation_id]
    );
    
    if (scheduleConfig.rows[0]) {
      const cfg = scheduleConfig.rows[0];
      const scheduleDays = typeof cfg.schedule_days === 'string' ? JSON.parse(cfg.schedule_days) : cfg.schedule_days;
      const nextTime = getNextBusinessDateTime(scheduleDays, cfg.schedule_start_time, cfg.schedule_end_time);
      
      if (nextTime) {
        // Optionally fire the "outside hours" flow once per lead/stage before rescheduling
        if (cfg.outside_hours_flow_id) {
          try {
            const sentCheck = await query(
              `SELECT outside_hours_sent_at FROM crm_deal_automations WHERE id = $1`,
              [automation.id]
            );
            if (!sentCheck.rows[0]?.outside_hours_sent_at) {
              await executeFlowForDeal(
                { ...automation, flow_id: cfg.outside_hours_flow_id },
                organizationId,
                { skipScheduleCheck: true, skipStatusUpdate: true }
              );
              await query(
                `UPDATE crm_deal_automations SET outside_hours_sent_at = NOW() WHERE id = $1`,
                [automation.id]
              );
              await query(
                `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
                 VALUES ($1, $2, 'outside_hours_flow_triggered', $3)`,
                [automation.id, automation.deal_id, JSON.stringify({ flow_id: cfg.outside_hours_flow_id })]
              );
              logInfo(`Outside-hours flow fired once for automation ${automation.id}`);
            }
          } catch (e) {
            logError('[outside-hours-flow] failed', e);
          }
        }
        // Not within business hours, reschedule
        await query(
          `UPDATE crm_deal_automations SET wait_until = $1, status = 'waiting', updated_at = NOW() WHERE id = $2`,
          [nextTime, automation.id]
        );
        logInfo(`Automation ${automation.id} rescheduled to ${nextTime.toISOString()} (business hours)`);
        return false;
      }
    }

    // ============================================================
    // HIERARQUIA DE SELEÇÃO DE CONEXÃO (envio automático Kanban)
    // 1) Conexão do vendedor responsável (assigned_to via connection_members)
    // 2) Conexão configurada no funil (crm_funnels.connection_id)
    // 3) Fallback: qualquer conexão ativa da organização
    // ------------------------------------------------------------
    // Logs sempre indicam qual estratégia foi usada e alertam quando
    // o vendedor responsável não tem conexão ativa vinculada.
    // ============================================================
    const dealOwnerResult = await query(
      `SELECT d.assigned_to, u.name as assigned_name
         FROM crm_deals d
         LEFT JOIN users u ON u.id = d.assigned_to
        WHERE d.id = $1`,
      [automation.deal_id]
    );
    const assignedTo = dealOwnerResult.rows[0]?.assigned_to || null;
    const assignedName = dealOwnerResult.rows[0]?.assigned_name || null;

    let connectionResult = { rows: [] };
    let connectionSource = null;

    // 1) Conexão do vendedor responsável
    if (assignedTo) {
      // Busca a conexão do funil para usar como preferência (caso o vendedor também tenha acesso)
      const funnelConnRes = await query(
        `SELECT f.connection_id
           FROM crm_stages s
           JOIN crm_funnels f ON f.id = s.funnel_id
          WHERE s.id = $1`,
        [automation.stage_id]
      );
      const funnelConnectionId = funnelConnRes.rows[0]?.connection_id || null;

      // Prioridade ao escolher a conexão do vendedor:
      //   (a) Conexão padrão do vendedor (connection_members.is_default = true)
      //   (b) Conexão do funil, se o vendedor tiver acesso a ela
      //   (c) Qualquer conexão dele com can_send (mais antiga primeiro)
      connectionResult = await query(
        `SELECT c.*
              , cm.is_default
           FROM connections c
           JOIN connection_members cm ON cm.connection_id = c.id
          WHERE c.organization_id = $1
            AND cm.user_id = $2
            AND cm.can_send = true
            AND c.status = 'connected'
          ORDER BY cm.is_default DESC, (c.id = $3) DESC, cm.created_at ASC
          LIMIT 1`,
        [organizationId, assignedTo, funnelConnectionId]
      );
      if (connectionResult.rows[0]) {
        if (connectionResult.rows[0].is_default) {
          connectionSource = 'user_default';
        } else if (funnelConnectionId && connectionResult.rows[0].id === funnelConnectionId) {
          connectionSource = 'assigned_user_funnel_match';
        } else {
          connectionSource = 'assigned_user';
        }
      } else {
        logError(
          `[CRM-Auto] ⚠️ Vendedor responsável (${assignedName || assignedTo}) ` +
          `do deal ${automation.deal_id} não possui conexão ativa vinculada. ` +
          `Caindo para fallback (funil/organização).`
        );
      }
    } else {
      logInfo(`[CRM-Auto] Deal ${automation.deal_id} sem vendedor responsável (assigned_to=null) — usando funil/organização.`);
    }

    // 2) Conexão do funil
    if (!connectionResult.rows[0]) {
      connectionResult = await query(
        `SELECT c.* FROM connections c
           JOIN crm_stages s ON s.funnel_id = (SELECT funnel_id FROM crm_stages WHERE id = $2)
           JOIN crm_funnels f ON f.id = s.funnel_id
          WHERE c.id = f.connection_id AND c.status = 'connected'
          LIMIT 1`,
        [organizationId, automation.stage_id]
      );
      if (connectionResult.rows[0]) {
        connectionSource = 'funnel_default';
      }
    }

    // 3) Qualquer conexão ativa da org
    if (!connectionResult.rows[0]) {
      connectionResult = await query(
        `SELECT * FROM connections
          WHERE organization_id = $1 AND status = 'connected'
          ORDER BY created_at DESC LIMIT 1`,
        [organizationId]
      );
      if (connectionResult.rows[0]) {
        connectionSource = 'org_fallback';
      }
    }

    if (!connectionResult.rows[0]) {
      logError(
        `[CRM-Auto] ❌ Nenhuma conexão ativa encontrada para org ${organizationId} ` +
        `(deal ${automation.deal_id}, vendedor=${assignedName || 'sem responsável'})`
      );
      return false;
    }

    const connection = connectionResult.rows[0];

    // Log de auditoria — qual conexão será usada e por qual motivo
    logInfo(
      `[CRM-Auto] ✅ Disparo deal=${automation.deal_id} ` +
      `vendedor=${assignedName || 'n/a'} (${assignedTo || 'sem assigned_to'}) ` +
      `→ conexão=${connection.name || connection.instance_name || connection.id} ` +
      `[id=${connection.id}] origem=${connectionSource}`
    );

    // Registrar no log da automação para auditoria via UI
    try {
      await query(
        `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
         VALUES ($1, $2, 'connection_selected', $3)`,
        [
          automation.id,
          automation.deal_id,
          JSON.stringify({
            connection_id: connection.id,
            connection_name: connection.name || connection.instance_name || null,
            source: connectionSource,
            assigned_to: assignedTo,
            assigned_name: assignedName,
            warning: connectionSource !== 'assigned_user' && assignedTo
              ? 'Vendedor responsável sem conexão vinculada — usado fallback'
              : null,
          }),
        ]
      );
    } catch (logErr) {
      // Não bloqueia execução se o log falhar
      logError(`[CRM-Auto] Falha ao gravar log de seleção de conexão: ${logErr.message}`);
    }

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

    // Update automation status (skip when firing the outside-hours flow as a side-effect)
    if (!skipStatusUpdate) {
      await query(
        `UPDATE crm_deal_automations 
         SET status = 'flow_sent', flow_session_id = $1, flow_sent_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [sessionResult.rows[0]?.id, automation.id]
      );
    }

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

// Move deal to next stage (timeout) — now emits no_reply_timeout event
async function moveDealToNextStage(automation) {
  try {
    // Get automation config for next stage info (incl. new next_stage_on_timeout)
    const configResult = await query(
      `SELECT sa.*, s.funnel_id
       FROM crm_stage_automations sa
       JOIN crm_stages s ON s.id = sa.stage_id
       WHERE sa.stage_id = $1`,
      [automation.stage_id]
    );

    const config = configResult.rows[0];
    // Priority: explicit next_stage_on_timeout > automation's next_stage_id > fallback funnel
    let nextStageId =
      config?.next_stage_on_timeout || automation.next_stage_id || null;
    let nextFunnelId = null;

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

    // Look up org for the event bus
    const dealOrg = await query(
      `SELECT organization_id FROM crm_deals WHERE id = $1`,
      [automation.deal_id]
    );
    const organizationId = dealOrg.rows[0]?.organization_id;

    // Mark current automation as moved BEFORE the event so reactors don't double-fire
    await query(
      `UPDATE crm_deal_automations
       SET status = 'moved', moved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [automation.id]
    );

    await query(
      `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
       VALUES ($1, $2, 'timeout_move', $3)`,
      [automation.id, automation.deal_id, JSON.stringify({
        from_stage_id: automation.stage_id,
        to_stage_id: nextStageId,
        to_funnel_id: nextFunnelId
      })]
    );

    // Emit no_reply_timeout — the event handler does the actual stage move
    // and emits stage_changed (which queues the next automation).
    if (organizationId) {
      await emitLeadEvent({
        organizationId,
        dealId: automation.deal_id,
        contactPhone: automation.contact_phone,
        eventType: 'no_reply_timeout',
        payload: {
          from_stage_id: automation.stage_id,
          to_stage_id: nextStageId,
          to_funnel_id: nextFunnelId,
        },
        source: 'scheduler',
      });
    } else {
      // Fallback: legacy direct move when org cannot be resolved
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
    }

    logInfo(`Deal ${automation.deal_id} moved from ${automation.stage_id} → ${nextStageId} (timeout)`);
    return true;
  } catch (error) {
    logError('Error moving deal to next stage:', error);
    return false;
  }
}

// Trigger a follow-up flow for a deal automation (without moving stages)
async function triggerFollowUp(automation, organizationId) {
  try {
    const cfg = await query(
      `SELECT follow_up_flow_id FROM crm_stage_automations WHERE id = $1`,
      [automation.automation_id]
    );
    const followUpFlowId = cfg.rows[0]?.follow_up_flow_id || automation.flow_id;
    if (!followUpFlowId) return false;

    // Reuse executeFlowForDeal but with the follow-up flow id
    const success = await executeFlowForDeal(
      { ...automation, flow_id: followUpFlowId },
      organizationId
    );
    if (!success) return false;

    await query(
      `UPDATE crm_deal_automations SET follow_up_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [automation.id]
    );
    await query(
      `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
       VALUES ($1, $2, 'follow_up_sent', $3)`,
      [automation.id, automation.deal_id, JSON.stringify({ flow_id: followUpFlowId })]
    );

    await emitLeadEvent({
      organizationId,
      dealId: automation.deal_id,
      contactPhone: automation.contact_phone,
      eventType: 'follow_up_sent',
      payload: { flow_id: followUpFlowId },
      source: 'scheduler',
    });
    return true;
  } catch (err) {
    logError('Error triggering follow-up:', err);
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
      // Look up org for the event bus
      const dealOrg = await query(
        `SELECT organization_id FROM crm_deals WHERE id = $1`,
        [automation.deal_id]
      );
      const organizationId = dealOrg.rows[0]?.organization_id;

      // Check if there's a recent incoming message from this contact (via conversation)
      const messageResult = await query(
        `SELECT cm.id
         FROM chat_messages cm
         JOIN conversations c ON c.id = cm.conversation_id
         WHERE c.phone = $1
           AND cm.from_me = false
           AND cm.timestamp > $2
         LIMIT 1`,
        [automation.contact_phone, automation.flow_sent_at || automation.created_at]
      );

      if (messageResult.rows[0]) {
        // Emit lead_replied — the handler will mark automation as responded.
        if (organizationId) {
          await emitLeadEvent({
            organizationId,
            dealId: automation.deal_id,
            contactPhone: automation.contact_phone,
            eventType: 'lead_replied',
            payload: { source: 'incoming_message', message_id: messageResult.rows[0].id },
            source: 'scheduler',
          });
        } else {
          // Fallback: legacy direct cancel
          await query(
            `UPDATE crm_deal_automations
             SET status = 'responded', responded_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [automation.id]
          );
        }

        await query(
          `INSERT INTO crm_automation_logs (deal_automation_id, deal_id, action, details)
           VALUES ($1, $2, 'message_received', '{"source": "incoming_message"}')`,
          [automation.id, automation.deal_id]
        );

        logInfo(`Automation stopped for deal ${automation.deal_id} - contact responded`);
      }
    }
  } catch (error) {
    logError('Error checking for responses:', error);
  }
}

// Process due follow-ups (intermediate message before timeout)
async function processFollowUps() {
  try {
    const due = await query(
      `SELECT da.*, d.organization_id
       FROM crm_deal_automations da
       JOIN crm_deals d ON d.id = da.deal_id
       WHERE da.status IN ('flow_sent', 'waiting')
         AND da.follow_up_sent_at IS NULL
         AND da.follow_up_due_at IS NOT NULL
         AND da.follow_up_due_at <= NOW()
       ORDER BY da.follow_up_due_at ASC
       LIMIT 50`
    );
    for (const automation of due.rows) {
      await triggerFollowUp(automation, automation.organization_id);
      await new Promise((r) => setTimeout(r, 300));
    }
    return due.rows.length;
  } catch (err) {
    logError('Error processing follow-ups:', err);
    return 0;
  }
}

 function getConditionFieldValue(dealData, variable) {
   if (!variable) return undefined;
 
   const normalizedVariable = String(variable).trim();
   const normalizedLower = normalizedVariable.toLowerCase();
   if (!normalizedVariable) return undefined;
 
   // 1. Direct match (case sensitive first for performance)
   if (Object.prototype.hasOwnProperty.call(dealData, normalizedVariable)) {
     return dealData[normalizedVariable];
   }
 
   // 2. Case-insensitive match in top-level
   for (const key of Object.keys(dealData)) {
     if (key.toLowerCase() === normalizedLower) return dealData[key];
   }
 
   // 3. Handle prefixes "custom_fields." or "custom_fields:"
   for (const sep of ['custom_fields.', 'custom_fields:']) {
     if (normalizedLower.startsWith(sep)) {
       const rawKey = normalizedVariable.slice(sep.length);
       const rawKeyLower = rawKey.toLowerCase();
       
       // Check top-level again with rawKey
       if (Object.prototype.hasOwnProperty.call(dealData, rawKey)) return dealData[rawKey];
       for (const key of Object.keys(dealData)) {
         if (key.toLowerCase() === rawKeyLower) return dealData[key];
       }
 
       // Check inside custom_fields
       const cf = dealData.custom_fields || {};
       if (Object.prototype.hasOwnProperty.call(cf, rawKey)) return cf[rawKey];
       for (const key of Object.keys(cf)) {
         if (key.toLowerCase() === rawKeyLower) return cf[key];
       }
       return undefined;
     }
   }
 
   // 4. Case-insensitive match inside custom_fields (if not already found)
   const cf = dealData.custom_fields || {};
   if (Object.prototype.hasOwnProperty.call(cf, normalizedVariable)) return cf[normalizedVariable];
   for (const key of Object.keys(cf)) {
     if (key.toLowerCase() === normalizedLower) return cf[key];
   }
 
   // 5. Nested path access (e.g. "metadata.source")
   const parts = normalizedVariable.split('.');
   let current = dealData;
   for (const part of parts) {
     if (current === null || current === undefined || typeof current !== 'object') {
       return undefined;
     }
     // Try case-sensitive then case-insensitive for the part
     if (Object.prototype.hasOwnProperty.call(current, part)) {
       current = current[part];
     } else {
       const foundKey = Object.keys(current).find(k => k.toLowerCase() === part.toLowerCase());
       if (foundKey) {
         current = current[foundKey];
       } else {
         return undefined;
       }
     }
   }
 
   return current;
 }

// Main execution function
export async function executeCRMAutomations() {
  logInfo('🤖 [CRM-AUTOMATION] Starting execution...');

  const stats = {
    events_dispatched: 0,
    pending_processed: 0,
    flows_triggered: 0,
    follow_ups_sent: 0,
    timeouts_processed: 0,
    deals_moved: 0,
    responses_detected: 0,
    errors: 0
  };

  try {
    // 0. Drain any pending lead events (safety net for failed inline dispatches)
    stats.events_dispatched = await processPendingLeadEvents(100);

    // 1. Check for responses first (to stop automations) — emits lead_replied
    await checkForResponses();

    // 2. Process pending automations (trigger flows + queue follow-up timer)
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
        // Schedule follow-up if configured on the stage automation
        const cfg = await query(
          `SELECT follow_up_minutes FROM crm_stage_automations WHERE id = $1`,
          [automation.automation_id]
        );
        const fum = cfg.rows[0]?.follow_up_minutes;
        if (fum && fum > 0) {
          await query(
            `UPDATE crm_deal_automations
             SET follow_up_due_at = NOW() + ($1 || ' minutes')::interval,
                 updated_at = NOW()
             WHERE id = $2`,
            [String(fum), automation.id]
          );
        }
      } else {
        stats.errors++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Process due follow-ups
    stats.follow_ups_sent = await processFollowUps();

    // 4. Process timeouts (move deals to next stage via no_reply_timeout event)
    const timedOutAutomations = await query(
      `SELECT da.*, d.organization_id,
              COALESCE(sa.timeout_hours * 3600, EXTRACT(EPOCH FROM (NOW() - da.flow_sent_at))) as elapsed
       FROM crm_deal_automations da
       JOIN crm_deals d ON d.id = da.deal_id
       LEFT JOIN crm_stage_automations sa ON sa.id = da.automation_id
       WHERE da.status IN ('flow_sent', 'waiting')
         AND (
           da.wait_until < NOW()
           OR (sa.timeout_hours IS NOT NULL
               AND da.flow_sent_at IS NOT NULL
               AND da.flow_sent_at + (sa.timeout_hours || ' hours')::interval < NOW())
         )
       ORDER BY da.wait_until ASC NULLS LAST
       LIMIT 50`
    );

    for (const automation of timedOutAutomations.rows) {
      stats.timeouts_processed++;
      const moved = await moveDealToNextStage(automation);
      if (moved) stats.deals_moved++;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    logInfo('🤖 [CRM-AUTOMATION] Execution complete:', stats);
    return stats;
  } catch (error) {
    logError('🤖 [CRM-AUTOMATION] Execution error:', error);
    throw error;
  }
}

// Parse a possibly-formatted number (handles "R$ 65.000,00", "65,000.00", "65 mil" → fails gracefully)
function parseNumeric(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return NaN;
  // Strip currency symbols / spaces / letters
  s = s.replace(/[^\d,.\-]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever comes last is the decimal separator
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Only comma present: treat as decimal if 1-2 digits after, otherwise thousands
    const after = s.length - lastComma - 1;
    if (after === 1 || after === 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Evaluate a single condition rule against deal data
function evaluateConditionRule(dealData, rule) {
  const rawFieldValue = getConditionFieldValue(dealData, rule.variable);
  const fieldValue = String(rawFieldValue ?? '').toLowerCase().trim();
  const compareValue = String(rule.value ?? '').toLowerCase().trim();
  const op = String(rule.operator || '').toLowerCase();

  const numField = parseNumeric(rawFieldValue);
  const numCompare = parseNumeric(rule.value);

  let result;
  switch (op) {
    case 'equals': case 'equal': case '=': case '==':
      // If both are numeric, compare numerically (handles "65000" vs 65000)
      result = (!isNaN(numField) && !isNaN(numCompare))
        ? numField === numCompare
        : fieldValue === compareValue;
      break;
    case 'not_equals': case 'not_equal': case '!=':
      result = (!isNaN(numField) && !isNaN(numCompare))
        ? numField !== numCompare
        : fieldValue !== compareValue;
      break;
     case 'contains':
       // If user writes "sim ou nao", check for either
       if (compareValue.includes(' ou ')) {
         const options = compareValue.split(' ou ').map(s => s.trim()).filter(Boolean);
         result = options.some(opt => fieldValue.includes(opt));
       } else if (compareValue.includes(',')) {
         const options = compareValue.split(',').map(s => s.trim()).filter(Boolean);
         result = options.some(opt => fieldValue.includes(opt));
       } else {
         result = fieldValue.includes(compareValue);
       }
       break;
    case 'not_contains': result = !fieldValue.includes(compareValue); break;
    case 'starts_with': result = fieldValue.startsWith(compareValue); break;
    case 'ends_with': result = fieldValue.endsWith(compareValue); break;
    case 'is_empty': result = fieldValue === ''; break;
    case 'is_not_empty': result = fieldValue !== ''; break;
    case 'greater_than': case 'gt': case '>':
      result = !isNaN(numField) && !isNaN(numCompare) && numField > numCompare; break;
    case 'greater_than_or_equal': case 'gte': case '>=':
      result = !isNaN(numField) && !isNaN(numCompare) && numField >= numCompare; break;
    case 'less_than': case 'lt': case '<':
      result = !isNaN(numField) && !isNaN(numCompare) && numField < numCompare; break;
    case 'less_than_or_equal': case 'lte': case '<=':
      result = !isNaN(numField) && !isNaN(numCompare) && numField <= numCompare; break;
    default: result = false;
  }

  logInfo(`[CRM-AUTOMATION] cond ${rule.variable} (${op}) ${rule.value} → raw="${rawFieldValue}" num=${numField} vs ${numCompare} = ${result}`);
  return result;
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
     // Check if new stage has automation (fetch even if not execute_immediately to handle conditional routing)
     const automationConfig = await query(
       `SELECT * FROM crm_stage_automations 
        WHERE stage_id = $1 AND is_active = true`,
       [newStageId]
     );
 
     if (!automationConfig.rows[0]) {
       return; // No automation for this stage
     }
 
     const config = automationConfig.rows[0];
     const executeImmediately = config.execute_immediately === true;

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

      if (moveStageId) {
        // Se houver um destino de etapa condicional, movemos IMEDIATAMENTE.
        // Isso permite que a nova etapa processe suas próprias automações (ex: Boas vindas).
        if (moveStageId !== newStageId) {
          await query(
            `UPDATE crm_deals 
             SET stage_id = $1, 
                 funnel_id = COALESCE((SELECT funnel_id FROM crm_stages WHERE id = $1), funnel_id), 
                 last_activity_at = NOW(), 
                 updated_at = NOW() 
             WHERE id = $2`,
            [moveStageId, dealId]
          );
          await query(
            `INSERT INTO crm_deal_history (deal_id, action, from_value, to_value, notes)
             VALUES ($1, 'stage_changed', $2, $3, 'Movido automaticamente por condição da automação')`,
            [dealId, newStageId, moveStageId]
          );
          logInfo(`[CRM-Auto] Condição ${conditionResult ? 'VERDADEIRA' : 'FALSA'}: Lead ${dealId} movido para etapa ${moveStageId}`);
          
          // Disparar automação da NOVA etapa recursivamente
          return onDealStageChanged(dealId, moveStageId, organizationId);
        }
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
    // wait_hours is stored as decimal hours (e.g. 0.5 = 30min)
    const waitHours = Number(config.wait_hours) || 24;
    const waitUntil = new Date(Date.now() + Math.round(waitHours * 3600 * 1000));

    await query(
      `INSERT INTO crm_deal_automations 
       (deal_id, stage_id, automation_id, status, flow_id, wait_until, contact_phone, next_stage_id)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
      [dealId, newStageId, config.id, effectiveFlowId, waitUntil, contactPhone, effectiveNextStageId]
    );

  } catch (error) {
    logError('Error triggering stage automation:', error);
  }
}
