// ============================================
// CRM STAGE WELCOME MESSAGE
// ============================================
// Sends an automatic text message to the lead when the deal enters a
// configured Kanban column. Uses the responsible seller's connection
// (assigned_to → funnel default → org fallback), persists the message
// in chat history so it appears in the conversation, and logs the
// action in crm_automation_logs.
// ============================================

import { query } from '../db.js';
import { logInfo, logError } from '../logger.js';
import * as whatsappProvider from './whatsapp-provider.js';

/**
 * Replace {variable} / {{variable}} tokens in a template string.
 */
function renderTemplate(template, vars) {
  if (!template) return '';
  return String(template).replace(/\{\{?\s*([\w.]+)\s*\}?\}/g, (_m, path) => {
    const parts = String(path).split('.');
    let cur = vars;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return '';
      cur = cur[p];
    }
    return cur == null ? '' : String(cur);
  });
}

/**
 * Resolve the connection to use for the welcome message.
 * Hierarchy:
 *   1) Seller (deal.assigned_to / deal.owner_id) default connection
 *   2) Funnel default connection
 *   3) Any active org connection
 */
async function resolveConnection(deal, organizationId) {
  const assignedTo = deal.assigned_to || deal.owner_id || null;

  // Funnel default (used as tie-breaker for seller match too)
  const funnelConnRes = await query(
    `SELECT connection_id FROM crm_funnels WHERE id = $1`,
    [deal.funnel_id]
  );
  const funnelConnectionId = funnelConnRes.rows[0]?.connection_id || null;

  // 1) Seller connection
  if (assignedTo) {
    const sellerConn = await query(
      `SELECT c.*, cm.is_default
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
    if (sellerConn.rows[0]) {
      return { connection: sellerConn.rows[0], source: 'assigned_user' };
    }
    logInfo(
      `[welcome-msg] vendedor ${assignedTo} sem conexão ativa — caindo para fallback`
    );
  }

  // 2) Funnel default
  if (funnelConnectionId) {
    const funnelConn = await query(
      `SELECT * FROM connections WHERE id = $1 AND status = 'connected' LIMIT 1`,
      [funnelConnectionId]
    );
    if (funnelConn.rows[0]) {
      return { connection: funnelConn.rows[0], source: 'funnel_default' };
    }
  }

  // 3) Any active org connection
  const anyConn = await query(
    `SELECT * FROM connections
      WHERE organization_id = $1 AND status = 'connected'
      ORDER BY created_at DESC LIMIT 1`,
    [organizationId]
  );
  if (anyConn.rows[0]) {
    return { connection: anyConn.rows[0], source: 'org_fallback' };
  }

  return { connection: null, source: null };
}

/**
 * Persist the outbound message in chat history so it shows up in the
 * conversation panel for the lead.
 */
async function persistChatMessage({ connectionId, phone, contactName, content, externalMessageId }) {
  try {
    const remoteJid = String(phone).includes('@')
      ? String(phone)
      : `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;

    let convId;
    const existing = await query(
      `SELECT id FROM conversations WHERE connection_id = $1 AND remote_jid = $2`,
      [connectionId, remoteJid]
    );
    if (existing.rows[0]) {
      convId = existing.rows[0].id;
    } else {
      const created = await query(
        `INSERT INTO conversations
           (connection_id, remote_jid, contact_name, contact_phone, last_message_at, updated_at, attendance_status)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), 'attending')
         RETURNING id`,
        [connectionId, remoteJid, contactName || '', String(phone).replace(/\D/g, '')]
      );
      convId = created.rows[0].id;
    }

    await query(
      `INSERT INTO chat_messages
         (conversation_id, message_id, from_me, content, message_type, status, timestamp)
       VALUES ($1, $2, true, $3, 'text', 'sent', NOW())`,
      [convId, externalMessageId || null, content]
    );
    await query(
      `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [convId]
    );
    return convId;
  } catch (err) {
    logError('[welcome-msg] falha ao persistir mensagem no chat', err);
    return null;
  }
}

/**
 * Try to send the configured welcome message for a deal that just entered
 * the given stage. Returns true if a message was sent, false otherwise.
 *
 * Idempotent guard: at most one welcome message per (deal_id, stage_id)
 * — uses crm_automation_logs.action = 'welcome_message_sent' as the marker.
 */
export async function sendStageWelcomeMessage(dealId, stageId, organizationId) {
  try {
    // 1) Load config
    const cfgRes = await query(
      `SELECT * FROM crm_stage_automations
        WHERE stage_id = $1 AND is_active = true`,
      [stageId]
    );
    const cfg = cfgRes.rows[0];
    if (!cfg || !cfg.welcome_message_enabled) return false;
    const text = (cfg.welcome_message_text || '').trim();
    if (!text) return false;

    // 2) Idempotency — only one welcome per (deal, stage)
    const already = await query(
      `SELECT 1 FROM crm_automation_logs
        WHERE deal_id = $1
          AND action = 'welcome_message_sent'
          AND details->>'stage_id' = $2
        LIMIT 1`,
      [dealId, stageId]
    );
    if (already.rows[0]) {
      logInfo(`[welcome-msg] deal ${dealId} já recebeu mensagem nesta etapa, ignorando.`);
      return false;
    }

    // 3) Load deal + contact
    const dealRes = await query(
      `SELECT d.*, co.name AS company_name, s.name AS stage_name,
              f.name AS funnel_name, u.name AS seller_name
         FROM crm_deals d
         LEFT JOIN crm_companies co ON co.id = d.company_id
         LEFT JOIN crm_stages s    ON s.id  = d.stage_id
         LEFT JOIN crm_funnels f   ON f.id  = d.funnel_id
         LEFT JOIN users u         ON u.id  = COALESCE(d.assigned_to, d.owner_id)
        WHERE d.id = $1`,
      [dealId]
    );
    const deal = dealRes.rows[0];
    if (!deal) return false;

    const contactRes = await query(
      `SELECT c.name, c.phone, c.email
         FROM contacts c
         JOIN crm_deal_contacts dc ON dc.contact_id = c.id
        WHERE dc.deal_id = $1 AND dc.is_primary = true
        ORDER BY dc.created_at ASC
        LIMIT 1`,
      [dealId]
    );
    const contact = contactRes.rows[0] || {};
    const phone = contact.phone;
    if (!phone) {
      logInfo(`[welcome-msg] deal ${dealId} sem telefone — nada a enviar.`);
      return false;
    }

    // 4) Resolve connection
    const { connection, source } = await resolveConnection(deal, organizationId);
    if (!connection) {
      logError(`[welcome-msg] nenhuma conexão ativa para org ${organizationId} (deal ${dealId})`);
      return false;
    }

    // 5) Render template
    let customFields = {};
    try {
      customFields = typeof deal.custom_fields === 'string'
        ? JSON.parse(deal.custom_fields || '{}')
        : (deal.custom_fields || {});
    } catch (e) { customFields = {}; }

    const vars = {
      nome: contact.name || '',
      name: contact.name || '',
      first_name: (contact.name || '').split(' ')[0] || '',
      primeiro_nome: (contact.name || '').split(' ')[0] || '',
      telefone: contact.phone || phone,
      phone: contact.phone || phone,
      email: contact.email || '',
      deal_title: deal.title || '',
      deal_value: deal.value || 0,
      deal_stage_name: deal.stage_name || '',
      deal_funnel_name: deal.funnel_name || '',
      company_name: deal.company_name || '',
      empresa: deal.company_name || '',
      vendedor: deal.seller_name || '',
      seller_name: deal.seller_name || '',
      ...customFields,
    };
    const rendered = renderTemplate(text, vars);

    // 6) Optional delay (small, bounded — runs inline)
    const delay = Math.max(0, Math.min(60, Number(cfg.welcome_message_delay_seconds || 0)));
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay * 1000));
    }

    // 7) Send
    const sendResult = await whatsappProvider.sendMessage(
      connection,
      phone,
      rendered,
      'text',
      null
    );

    const success = !!(sendResult && (sendResult.success || sendResult.messageId));

    // 8) Persist into chat history (best-effort)
    if (success) {
      await persistChatMessage({
        connectionId: connection.id,
        phone,
        contactName: contact.name,
        content: rendered,
        externalMessageId: sendResult.messageId || null,
      });
    }

    // 9) Audit log
    await query(
      `INSERT INTO crm_automation_logs (deal_id, action, details)
       VALUES ($1, $2, $3)`,
      [
        dealId,
        success ? 'welcome_message_sent' : 'welcome_message_failed',
        JSON.stringify({
          stage_id: stageId,
          connection_id: connection.id,
          connection_name: connection.name || connection.instance_name || null,
          connection_source: source,
          assigned_to: deal.assigned_to || deal.owner_id || null,
          seller_name: deal.seller_name || null,
          phone,
          preview: rendered.slice(0, 280),
          error: success ? null : (sendResult?.error || 'unknown'),
        }),
      ]
    );

    if (success) {
      logInfo(`[welcome-msg] ✅ enviada para deal ${dealId} via ${source} (${connection.id})`);
    } else {
      logError(`[welcome-msg] ❌ falha ao enviar para deal ${dealId}: ${sendResult?.error}`);
    }
    return success;
  } catch (err) {
    logError('[welcome-msg] erro inesperado', err);
    return false;
  }
}