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

/**
 * Helper: carrega conexão UAZAPI por id
 */
async function loadUazapiConnection(connectionId) {
  const r = await query(
    `SELECT * FROM connections WHERE id = $1 AND provider = 'uazapi' LIMIT 1`,
    [connectionId]
  );
  return r.rows[0] || null;
}

/**
 * Lista chats sincronizados pela instância UAZAPI
 * GET /api/uazapi/:connectionId/chats?limit=200
 */
router.get('/:connectionId/chats', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const out = await uazapiProvider.syncChats(conn.uazapi_url, conn.uazapi_token, {
      limit: Number(req.query.limit) || 200,
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Sincroniza mensagens de um chat (UAZAPI)
 * POST /api/uazapi/:connectionId/sync-messages  body: { chatId, limit? }
 */
router.post('/:connectionId/sync-messages', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { chatId, limit } = req.body || {};
    if (!chatId) return res.status(400).json({ error: 'chatId obrigatório' });
    const out = await uazapiProvider.syncMessages(conn.uazapi_url, conn.uazapi_token, chatId, {
      limit: Number(limit) || 100,
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Envia BOTÕES interativos (UAZAPI exclusivo)
 */
router.post('/:connectionId/send-buttons', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { phone, text, buttons, footer, header } = req.body || {};
    if (!phone || !text || !Array.isArray(buttons)) {
      return res.status(400).json({ error: 'phone, text e buttons[] são obrigatórios' });
    }
    const out = await uazapiProvider.sendButtons(conn.uazapi_url, conn.uazapi_token, phone, text, buttons, { footer, header });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Envia LISTA interativa (UAZAPI exclusivo)
 */
router.post('/:connectionId/send-list', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { phone, text, options, buttonText, footer, sections } = req.body || {};
    if (!phone || !text) return res.status(400).json({ error: 'phone e text são obrigatórios' });
    const out = await uazapiProvider.sendList(conn.uazapi_url, conn.uazapi_token, phone, text, options || [], { buttonText, footer, sections });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Envia ENQUETE (poll) (UAZAPI exclusivo)
 */
router.post('/:connectionId/send-poll', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { phone, question, options, multiSelect } = req.body || {};
    if (!phone || !question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'phone, question e ao menos 2 options são obrigatórios' });
    }
    const out = await uazapiProvider.sendPoll(conn.uazapi_url, conn.uazapi_token, phone, question, options, { multiSelect: !!multiSelect });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Lista contatos do celular sincronizados pelo WhatsApp (UAZAPI)
 * GET /api/uazapi/:connectionId/contacts?search=&limit=
 */
router.get('/:connectionId/contacts', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const out = await uazapiProvider.listContacts(conn.uazapi_url, conn.uazapi_token, {
      limit: Number(req.query.limit) || undefined,
      search: req.query.search || undefined,
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Importa contatos do celular UAZAPI para uma lista do sistema
 * POST /api/uazapi/:connectionId/sync-contacts-to-list
 * body: { listId, onlyMyContacts?, search? }
 */
router.post('/:connectionId/sync-contacts-to-list', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { listId, onlyMyContacts = true, search } = req.body || {};
    if (!listId) return res.status(400).json({ error: 'listId obrigatório' });

    // Verifica se a lista pertence ao usuário/org
    const listCheck = await query(`SELECT id, user_id FROM contact_lists WHERE id = $1 LIMIT 1`, [listId]);
    if (!listCheck.rows.length) return res.status(404).json({ error: 'Lista não encontrada' });

    const out = await uazapiProvider.listContacts(conn.uazapi_url, conn.uazapi_token, { search });
    if (!out.success) return res.status(502).json(out);

    const filtered = onlyMyContacts ? out.contacts.filter((c) => c.isMyContact) : out.contacts;

    let imported = 0;
    let duplicates = 0;
    for (const c of filtered) {
      try {
        const exists = await query(
          `SELECT id FROM contacts WHERE list_id = $1 AND phone = $2 LIMIT 1`,
          [listId, c.phone]
        );
        if (exists.rows.length) {
          duplicates++;
          continue;
        }
        await query(
          `INSERT INTO contacts (list_id, name, phone, is_whatsapp) VALUES ($1, $2, $3, true)`,
          [listId, c.name || c.phone, c.phone]
        );
        imported++;
      } catch {
        // ignora erros individuais
      }
    }
    res.json({ success: true, total: filtered.length, imported, duplicates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * SENDER - Cria campanha de disparo em massa nativa UAZAPI
 * POST /api/uazapi/:connectionId/sender
 * body: { numbers[], type, text?, file?, delayMin?, delayMax?, scheduled_for?, info?, docName? }
 */
router.post('/:connectionId/sender', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const out = await uazapiProvider.senderCreate(conn.uazapi_url, conn.uazapi_token, req.body || {});
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * SENDER - Lista pastas/campanhas
 */
router.get('/:connectionId/sender/folders', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const out = await uazapiProvider.senderListFolders(conn.uazapi_url, conn.uazapi_token);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * SENDER - Lista mensagens de uma pasta
 */
router.get('/:connectionId/sender/folders/:folderId/messages', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const out = await uazapiProvider.senderListMessages(conn.uazapi_url, conn.uazapi_token, req.params.folderId, {
      status: req.query.status || undefined,
      limit: Number(req.query.limit) || 500,
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * SENDER - Pause/Resume/Stop/Delete uma pasta
 * POST /api/uazapi/:connectionId/sender/folders/:folderId/action  body: { action }
 */
router.post('/:connectionId/sender/folders/:folderId/action', async (req, res) => {
  try {
    const conn = await loadUazapiConnection(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Conexão UAZAPI não encontrada' });
    const { action } = req.body || {};
    if (!['play', 'pause', 'stop', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action deve ser play|pause|stop|delete' });
    }
    const out = await uazapiProvider.senderEdit(conn.uazapi_url, conn.uazapi_token, req.params.folderId, action);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
