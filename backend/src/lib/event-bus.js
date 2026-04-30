// ============================================
// LEAD EVENT BUS
// ============================================
// Single source of truth for lead/deal state changes.
// Producers: webhooks, CRM routes, flow executor, schedulers, chat.
// Consumer: handleLeadEvent dispatches to the right reactor.
//
// Design goals:
//   - WhatsApp does NOT touch crm_deals directly.
//   - All stage transitions go through emitLeadEvent('stage_changed', ...).
//   - Automations subscribe by reading lead_events (worker) or by being
//     called inline via dispatchLeadEvent(eventId) immediately after emit.
// ============================================

import { query } from '../db.js';
import { logInfo, logError } from '../logger.js';

// ── Self-healing schema (runtime) ───────────────────────────
// The project pattern is to ALTER/CREATE IF NOT EXISTS at boot so that
// existing deployments pick up new tables/columns without a manual migration.
(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS lead_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        deal_id UUID,
        contact_phone VARCHAR(50),
        event_type VARCHAR(50) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        source VARCHAR(50),
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP WITH TIME ZONE,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_org ON lead_events(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_deal ON lead_events(deal_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_phone ON lead_events(contact_phone)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lead_events_pending ON lead_events(processed, created_at) WHERE processed = false`);

    await query(`ALTER TABLE crm_funnels ADD COLUMN IF NOT EXISTS entry_rules JSONB DEFAULT '[]'::jsonb`);
    await query(`ALTER TABLE crm_stage_automations ADD COLUMN IF NOT EXISTS follow_up_minutes INTEGER`);
    await query(`ALTER TABLE crm_stage_automations ADD COLUMN IF NOT EXISTS follow_up_flow_id UUID`);
    await query(`ALTER TABLE crm_stage_automations ADD COLUMN IF NOT EXISTS timeout_hours INTEGER`);
    await query(`ALTER TABLE crm_stage_automations ADD COLUMN IF NOT EXISTS next_stage_on_timeout UUID`);
    await query(`ALTER TABLE crm_deal_automations ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE crm_deal_automations ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMP WITH TIME ZONE`);
    // Convert wait_hours to NUMERIC to support fractional hours (e.g. minutes via 0.5)
    try { await query(`ALTER TABLE crm_stage_automations ALTER COLUMN wait_hours TYPE NUMERIC(10,4) USING wait_hours::numeric`); } catch(e) {}
    logInfo('[event-bus] schema ready');
  } catch (err) {
    logError('[event-bus] self-heal failed', err);
  }
})();

const VALID_EVENTS = new Set([
  'lead_created',
  'stage_changed',
  'message_sent',
  'lead_replied',
  'no_reply_timeout',
  'follow_up_sent',
]);

/**
 * Persist a new lead event and (optionally) dispatch it inline.
 * Inline dispatch keeps latency low for UX-critical flows (stage_changed,
 * lead_replied). The scheduler also re-processes any unprocessed events
 * as a safety net.
 */
export async function emitLeadEvent({
  organizationId,
  dealId = null,
  contactPhone = null,
  eventType,
  payload = {},
  source = 'system',
  dispatch = true,
}) {
  if (!eventType || !VALID_EVENTS.has(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }
  if (!organizationId) {
    throw new Error('emitLeadEvent requires organizationId');
  }

  try {
    const result = await query(
      `INSERT INTO lead_events
        (organization_id, deal_id, contact_phone, event_type, payload, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        organizationId,
        dealId,
        contactPhone,
        eventType,
        JSON.stringify(payload || {}),
        source,
      ]
    );

    const event = result.rows[0];
    logInfo(`[event-bus] emitted ${eventType}`, {
      id: event.id,
      dealId,
      source,
    });

    if (dispatch) {
      // Fire-and-forget; errors are logged inside dispatchLeadEvent
      dispatchLeadEvent(event).catch((err) =>
        logError('[event-bus] inline dispatch failed', err)
      );
    }
    return event;
  } catch (err) {
    logError('[event-bus] emit failed', err);
    throw err;
  }
}

/**
 * Process a single event by dispatching to the correct handler.
 */
export async function dispatchLeadEvent(event) {
  try {
    switch (event.event_type) {
      case 'lead_created':
        await handleLeadCreated(event);
        break;
      case 'stage_changed':
        await handleStageChanged(event);
        break;
      case 'lead_replied':
        await handleLeadReplied(event);
        break;
      case 'no_reply_timeout':
        await handleNoReplyTimeout(event);
        break;
      case 'message_sent':
      case 'follow_up_sent':
        // Currently informational only — recorded for audit.
        break;
      default:
        logInfo(`[event-bus] no handler for ${event.event_type}`);
    }

    await query(
      `UPDATE lead_events SET processed = true, processed_at = NOW() WHERE id = $1`,
      [event.id]
    );
  } catch (err) {
    logError(`[event-bus] dispatch ${event.event_type} failed`, err);
    await query(
      `UPDATE lead_events SET processed = true, processed_at = NOW(), error = $2 WHERE id = $1`,
      [event.id, err.message || String(err)]
    );
  }
}

/**
 * Worker: process pending events. Called periodically by the scheduler
 * to recover from missed inline dispatches.
 */
export async function processPendingLeadEvents(limit = 100) {
  const result = await query(
    `SELECT * FROM lead_events
     WHERE processed = false
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  for (const event of result.rows) {
    await dispatchLeadEvent(event);
  }
  return result.rows.length;
}

// ============================================
// HANDLERS
// ============================================

/**
 * Apply funnel entry_rules to route a freshly-created deal to the correct
 * stage. Rules are evaluated top-to-bottom; first match wins.
 */
async function handleLeadCreated(event) {
  if (!event.deal_id) return;

  const dealRes = await query(
    `SELECT d.*, f.entry_rules
     FROM crm_deals d
     JOIN crm_funnels f ON f.id = d.funnel_id
     WHERE d.id = $1`,
    [event.deal_id]
  );
  const deal = dealRes.rows[0];
  if (!deal) return;

  const rules =
    typeof deal.entry_rules === 'string'
      ? JSON.parse(deal.entry_rules || '[]')
      : deal.entry_rules || [];
  if (!Array.isArray(rules) || rules.length === 0) return;

  const customFields =
    typeof deal.custom_fields === 'string'
      ? JSON.parse(deal.custom_fields || '{}')
      : deal.custom_fields || {};

  const dealView = { ...deal, custom_fields: customFields, ...customFields };

  for (const rule of rules) {
    if (!rule || !rule.stage_id || !rule.field) continue;
    if (matchRule(dealView, rule)) {
      if (rule.stage_id !== deal.stage_id) {
        // Move deal via stage_changed event (so reactors fire too)
        await query(
          `UPDATE crm_deals SET stage_id = $1, updated_at = NOW() WHERE id = $2`,
          [rule.stage_id, deal.id]
        );
        await emitLeadEvent({
          organizationId: event.organization_id,
          dealId: deal.id,
          contactPhone: event.contact_phone,
          eventType: 'stage_changed',
          payload: {
            from_stage_id: deal.stage_id,
            to_stage_id: rule.stage_id,
            reason: 'entry_rule',
            rule,
          },
          source: 'event-bus',
        });
      }
      return;
    }
  }
}

/**
 * When a deal moves to a new stage, start its automation (if any).
 * Reuses the existing crm-automation-scheduler logic.
 */
async function handleStageChanged(event) {
  if (!event.deal_id) return;
  const { onDealStageChanged } = await import('../crm-automation-scheduler.js');
  const stageId =
    event.payload?.to_stage_id ??
    (await query(`SELECT stage_id FROM crm_deals WHERE id = $1`, [event.deal_id])).rows[0]
      ?.stage_id;
  if (!stageId) return;
  await onDealStageChanged(event.deal_id, stageId, event.organization_id);
}

/**
 * Cancel pending automations for the deal — the lead replied, so the
 * timeout/follow-up cycle should stop. The next stage transition (if any)
 * is the responsibility of the configured automation, not this handler.
 */
async function handleLeadReplied(event) {
  if (!event.deal_id) return;
  await query(
    `UPDATE crm_deal_automations
     SET status = 'responded', responded_at = NOW(), updated_at = NOW()
     WHERE deal_id = $1 AND status IN ('pending', 'flow_sent', 'waiting')`,
    [event.deal_id]
  );
  await query(
    `UPDATE crm_deals SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [event.deal_id]
  );
}

/**
 * Move the deal to next_stage_on_timeout (or next_stage_id) and let
 * stage_changed start the next automation in the chain.
 */
async function handleNoReplyTimeout(event) {
  if (!event.deal_id) return;
  const targetStageId =
    event.payload?.to_stage_id ?? event.payload?.next_stage_id ?? null;
  if (!targetStageId) return;

  const before = await query(
    `SELECT stage_id FROM crm_deals WHERE id = $1`,
    [event.deal_id]
  );
  const fromStageId = before.rows[0]?.stage_id || null;
  if (fromStageId === targetStageId) return;

  await query(
    `UPDATE crm_deals SET stage_id = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [targetStageId, event.deal_id]
  );
  await query(
    `INSERT INTO crm_deal_history (deal_id, action, from_value, to_value, notes)
     VALUES ($1, 'stage_changed', $2, $3, 'Movido por timeout sem resposta')`,
    [event.deal_id, fromStageId, targetStageId]
  );

  await emitLeadEvent({
    organizationId: event.organization_id,
    dealId: event.deal_id,
    contactPhone: event.contact_phone,
    eventType: 'stage_changed',
    payload: {
      from_stage_id: fromStageId,
      to_stage_id: targetStageId,
      reason: 'no_reply_timeout',
    },
    source: 'event-bus',
  });
}

// ============================================
// RULE MATCHING
// ============================================
function getFieldValue(obj, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function matchRule(dealView, rule) {
  const raw = getFieldValue(dealView, rule.field);
  const op = rule.operator || '=';
  const expected = rule.value;

  // Try numeric coerce when possible for comparisons
  const asNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  switch (op) {
    case '=':
    case '==':
      return String(raw ?? '') === String(expected ?? '');
    case '!=':
      return String(raw ?? '') !== String(expected ?? '');
    case '>':
      return (asNum(raw) ?? -Infinity) > (asNum(expected) ?? Infinity);
    case '>=':
      return (asNum(raw) ?? -Infinity) >= (asNum(expected) ?? Infinity);
    case '<':
      return (asNum(raw) ?? Infinity) < (asNum(expected) ?? -Infinity);
    case '<=':
      return (asNum(raw) ?? Infinity) <= (asNum(expected) ?? -Infinity);
    case 'contains':
      return String(raw ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'in':
      return Array.isArray(expected) && expected.map(String).includes(String(raw));
    case 'is_empty':
      return raw === null || raw === undefined || raw === '';
    case 'is_not_empty':
      return !(raw === null || raw === undefined || raw === '');
    default:
      return false;
  }
}
