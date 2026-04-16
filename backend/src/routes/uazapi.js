// UAZAPI Routes - Webhook handler + diagnostics
// https://docs.uazapi.com/

import { Router } from 'express';
import { query } from '../db.js';
import * as uazapiProvider from '../lib/uazapi-provider.js';

const router = Router();

/**
 * Extrai instanceId do payload (várias formas possíveis)
 */
function extractInstanceId(payload) {
  return (
    payload?.instance ||
    payload?.instanceId ||
    payload?.instance_id ||
    payload?.instance?.id ||
    payload?.data?.instance ||
    payload?.data?.instanceId ||
    payload?.token || // alguns webhooks enviam token como identificador
    null
  );
}

/**
 * Detecta tipo de evento
 */
function detectEventType(payload) {
  const ev = String(payload?.event || payload?.type || '').toLowerCase();
  if (ev.includes('connect') || ev.includes('status')) return 'connection_update';
  if (ev.includes('message') || payload?.message || payload?.text) {
    if (payload?.fromMe || payload?.message?.fromMe) return 'message_sent';
    return 'message_received';
  }
  return 'unknown';
}

/**
 * Webhook handler
 * Configurar em UAZAPI: POST {SUA_URL}/api/uazapi/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const instanceId = extractInstanceId(payload);
    const eventType = detectEventType(payload);

    console.log('[UAZAPI Webhook] Received:', JSON.stringify(payload).slice(0, 400));

    uazapiProvider.pushUazapiEvent({ instanceId, eventType, payload });

    if (!instanceId) {
      return res.status(200).json({ received: true, skipped: 'no instanceId' });
    }

    // Buscar conexão pela instance_id (uazapi armazena em instance_id também)
    const connResult = await query(
      `SELECT * FROM connections
       WHERE provider = 'uazapi' AND (instance_id = $1 OR uazapi_token = $1)
       LIMIT 1`,
      [String(instanceId)]
    );

    if (connResult.rows.length === 0) {
      console.log('[UAZAPI Webhook] Connection not found for:', instanceId);
      return res.status(200).json({ received: true, skipped: 'connection not found' });
    }

    const connection = connResult.rows[0];

    // Atualizar status quando recebe evento de conexão
    if (eventType === 'connection_update') {
      const status = String(payload?.status || payload?.state || '').toLowerCase();
      const dbStatus = (status === 'connected' || status === 'open') ? 'connected' : 'disconnected';
      await query(
        `UPDATE connections SET status = $1, phone_number = COALESCE($2, phone_number), updated_at = NOW() WHERE id = $3`,
        [dbStatus, payload?.phone || payload?.wid || null, connection.id]
      );
    }

    // TODO: handler completo de mensagens (image/audio/text) - similar ao W-API
    // Por enquanto registramos e retornamos OK

    res.status(200).json({ received: true, processed: eventType });
  } catch (error) {
    console.error('[UAZAPI Webhook] Error:', error);
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Eventos diagnósticos (apenas leitura)
 */
router.get('/events', (req, res) => {
  const { instanceId, limit } = req.query;
  res.json({ events: uazapiProvider.getUazapiEvents({ instanceId, limit: Number(limit) || 100 }) });
});

router.delete('/events', (req, res) => {
  const { instanceId } = req.query;
  uazapiProvider.clearUazapiEvents(instanceId);
  res.json({ cleared: true });
});

export default router;
