// UAZAPI Routes - Webhook handler + diagnostics
// https://docs.uazapi.com/

import { Router } from 'express';
import { query } from '../db.js';
import * as uazapiProvider from '../lib/uazapi-provider.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  if (ev.includes('message') || payload?.message || payload?.text || payload?.data?.message) {
    if (payload?.fromMe || payload?.message?.fromMe) return 'message_sent';
    return 'message_received';
  }
  return 'unknown';
}

function isTruthy(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'sim'].includes(value.trim().toLowerCase());
  }
  return false;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function normalizeChatId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function extractMessagePayload(payload) {
  return payload?.message || payload?.data?.message || payload?.data || payload;
}

function getMessageId(payload, messagePayload) {
  return (
    payload?.messageId ||
    payload?.id ||
    payload?.key?.id ||
    messagePayload?.id ||
    messagePayload?.messageId ||
    messagePayload?.key?.id ||
    `uazapi_${Date.now()}_${crypto.randomUUID()}`
  );
}

function extractMessageData(payload) {
  const msg = extractMessagePayload(payload);
  const fromMe = isTruthy(
    payload?.fromMe ??
    msg?.fromMe ??
    payload?.key?.fromMe ??
    msg?.key?.fromMe
  );

  const chatId = normalizeChatId(
    payload?.chatId ||
    payload?.chatid ||
    payload?.remoteJid ||
    payload?.from ||
    msg?.chatId ||
    msg?.chatid ||
    msg?.remoteJid ||
    msg?.from ||
    msg?.jid ||
    msg?.id
  );

  const isGroup = String(chatId || '').includes('@g.us');
  const phone = normalizePhone(
    payload?.phone ||
    payload?.number ||
    payload?.from ||
    msg?.phone ||
    msg?.number ||
    msg?.from ||
    chatId
  );

  const messageId = getMessageId(payload, msg);
  const senderName =
    payload?.senderName ||
    payload?.pushName ||
    msg?.senderName ||
    msg?.pushName ||
    msg?.sender?.pushName ||
    payload?.sender?.pushName ||
    payload?.name ||
    msg?.name ||
    null;

  const groupName =
    payload?.groupName ||
    msg?.groupName ||
    payload?.chat?.name ||
    msg?.chat?.name ||
    payload?.chat?.subject ||
    msg?.chat?.subject ||
    null;

  // ===== Detecção de tipo + extração de mídia =====
  // UAZAPI/Baileys pode entregar:
  //   - msg.type = 'image'|'video'|'audio'|'document'|'sticker'|'text'
  //   - msg.imageMessage / videoMessage / audioMessage / documentMessage / stickerMessage
  //   - msg.image / video / audio / document (objetos com URL/mimetype/caption ou string JSON)
  //   - msg.text, msg.body, msg.caption, msg.conversation (texto puro)
  //
  // ATENÇÃO: campos como msg.image podem vir como STRING contendo JSON inteiro
  // ({"URL":"...enc","mimetype":"image/jpeg",...}). Precisamos parsear e extrair.

  function tryParseJSON(v) {
    if (!v || typeof v !== 'string') return v;
    const s = v.trim();
    if (!s.startsWith('{') && !s.startsWith('[')) return v;
    try { return JSON.parse(s); } catch { return v; }
  }

  function pickMediaObject() {
    const candidates = [
      ['image', 'image'],
      ['video', 'video'],
      ['audio', 'audio'],
      ['document', 'document'],
      ['sticker', 'sticker'],
      ['imageMessage', 'image'],
      ['videoMessage', 'video'],
      ['audioMessage', 'audio'],
      ['documentMessage', 'document'],
      ['stickerMessage', 'sticker'],
    ];
    for (const [field, type] of candidates) {
      const raw = msg?.[field] ?? payload?.[field];
      if (!raw) continue;
      const obj = typeof raw === 'object' ? raw : tryParseJSON(raw);
      if (obj && typeof obj === 'object') return { obj, type };
    }
    return null;
  }

  // Algumas instâncias UAZAPI colocam o JSON da mídia direto em text/body/content
  function tryExtractMediaFromText() {
    const candidates = [msg?.text, msg?.body, msg?.content, msg?.caption, payload?.text, payload?.body];
    for (const c of candidates) {
      if (!c || typeof c !== 'string') continue;
      const s = c.trim();
      if (!s.startsWith('{')) continue;
      const parsed = tryParseJSON(s);
      if (parsed && typeof parsed === 'object' && (parsed.URL || parsed.url || parsed.directPath || parsed.mediaKey)) {
        const mt = String(parsed.mimetype || parsed.mimeType || '').toLowerCase();
        let type = 'document';
        if (mt.startsWith('image/')) type = 'sticker' === parsed.kind ? 'sticker' : 'image';
        else if (mt.startsWith('video/')) type = 'video';
        else if (mt.startsWith('audio/')) type = 'audio';
        return { obj: parsed, type };
      }
    }
    return null;
  }

  function tryExtractMediaFromContent() {
    const c = msg?.content;
    if (!c || typeof c !== 'object') return null;
    if (c.URL || c.url || c.directPath || c.mediaKey) {
      const mt = String(c.mimetype || c.mimeType || '').toLowerCase();
      let type = 'document';
      if (mt.startsWith('image/')) type = 'image';
      else if (mt.startsWith('video/')) type = 'video';
      else if (mt.startsWith('audio/')) type = 'audio';
      return { obj: c, type };
    }
    return null;
  }

  let mediaObj = pickMediaObject() || tryExtractMediaFromText();
  if (!mediaObj) mediaObj = tryExtractMediaFromContent();

  const typeRaw = String(
    msg?.type ||
    msg?.messageType ||
    payload?.messageType ||
    payload?.type ||
    ''
  ).toLowerCase().replace(/message$/, '');

  // ===== Album (Baileys/UAZAPI) =====
  // O 'albumMessage' é apenas um container — as imagens/vídeos chegam como
  // mensagens individuais separadas no webhook. Ignoramos o container para
  // evitar registros sem conteúdo (ex.: "Album: 1 Image, 1 video").
  const isAlbumContainer =
    typeRaw === 'album' ||
    !!msg?.albumMessage ||
    !!payload?.albumMessage ||
    !!msg?.album ||
    !!payload?.album ||
    // Texto literal gerado pelo provedor para containers de álbum
    (typeof (msg?.text || msg?.body || msg?.content) === 'string' &&
      /^album:\s*\d+\s+(image|video|photo)/i.test(
        String(msg?.text || msg?.body || msg?.content).trim()
      ));

  // Texto: prioriza campos de texto puros; se for JSON de mídia, ignora
  function pickText() {
    const candidates = [
      mediaObj?.obj?.caption,
      msg?.caption,
      payload?.caption,
      msg?.text,
      msg?.body,
      msg?.content,
      msg?.conversation,
      payload?.text,
      payload?.body,
    ];
    for (const c of candidates) {
      if (!c || typeof c !== 'string') continue;
      const s = c.trim();
      if (s.startsWith('{') && (s.includes('"URL"') || s.includes('"directPath"') || s.includes('"mediaKey"'))) continue;
      if (s) return s;
    }
    return '';
  }

  const text = pickText();

  // URL da mídia: prefere URL pública direta; .enc precisa ser baixada via UAZAPI.
  // Algumas versões entregam a URL em campos diferentes.
  const rawMediaUrl = [
    msg?.content?.URL,
    msg?.content?.url,
    msg?.content?.mediaUrl,
    msg?.content?.file,
    msg?.mediaUrl,
    msg?.url,
    msg?.file,
    msg?.media?.url,
    payload?.mediaUrl,
    payload?.url,
    payload?.file,
    mediaObj?.obj?.mediaUrl,
    mediaObj?.obj?.url,
    mediaObj?.obj?.URL,
    mediaObj?.obj?.file,
    msg?.urlFull, // Algumas versões da UAZAPI usam urlFull para a URL pública
    payload?.urlFull
  ].find(v => !!v) || null;

  const mediaMimetype = [
    mediaObj?.obj?.mimetype,
    mediaObj?.obj?.mimeType,
    msg?.mimetype,
    msg?.mimeType,
    msg?.media?.mimetype,
    payload?.mimetype,
    payload?.mimeType,
    payload?.data?.mimetype,
    payload?.data?.mimeType
  ].find(v => !!v) || null;

  let messageType = (() => {
    if (['image', 'video', 'audio', 'document', 'sticker'].includes(typeRaw)) return typeRaw;
    if (mediaObj?.type) return mediaObj.type;
    if (rawMediaUrl) {
      const m = String(mediaMimetype || '').toLowerCase();
      if (m.startsWith('image/')) return 'image';
      if (m.startsWith('video/')) return 'video';
      if (m.startsWith('audio/')) return 'audio';
      return 'document';
    }
    return 'text';
  })();

  const content = text || (
    messageType === 'image' ? '[Imagem]' :
    messageType === 'video' ? '[Vídeo]' :
    messageType === 'audio' ? '[Áudio]' :
    messageType === 'sticker' ? '[Sticker]' :
    messageType === 'document' ? '[Documento]' :
    ''
  );

  // mediaUrl final: marcamos com placeholder especial para o persist resolver.
  // (precisa do connection.uazapi_url para montar o proxy de download). 
  // Priorizamos o download via endpoint decifrado se o mediaObj existir e não houver uma URL pública clara.
  const needsProxy = !!(mediaObj && (!rawMediaUrl || String(rawMediaUrl).includes('.enc') || String(rawMediaUrl).includes('mmg.whatsapp.net')));
  const mediaUrl = needsProxy ? `__UAZAPI_DOWNLOAD__:${messageId}` : (rawMediaUrl || null);

  return {
    chatId,
    phone,
    isGroup,
    fromMe,
    messageId,
    senderName,
    groupName,
    content,
    messageType,
    mediaUrl,
    mediaMimetype,
    isAlbumContainer,
  };
}

async function persistIncomingMessage(connection, payload) {
  const message = extractMessageData(payload);

  // Ignora containers de álbum: as mídias virão em webhooks separados
  if (message.isAlbumContainer) {
    return { skipped: true, reason: 'album_container' };
  }

  if (!message.chatId || (!message.content && !message.mediaUrl)) {
    return { skipped: true, reason: 'not_incoming_or_empty' };
  }

  // Resolve placeholder de download da UAZAPI: baixa mídia decifrada,
  // salva em /uploads e substitui mediaUrl pelo caminho público.
  if (typeof message.mediaUrl === 'string' && message.mediaUrl.startsWith('__UAZAPI_DOWNLOAD__:')) {
    const msgIdForDownload = message.mediaUrl.slice('__UAZAPI_DOWNLOAD__:'.length);
    try {
      const dl = await uazapiProvider.downloadMedia(
        connection.uazapi_url,
        connection.uazapi_token,
        msgIdForDownload
      );
      if (dl?.success) {
        if (dl.url) {
          message.mediaUrl = dl.url;
          if (!message.mediaMimetype && dl.mimetype) message.mediaMimetype = dl.mimetype;
        } else if (dl.buffer || dl.base64) {
          const buf = dl.buffer || Buffer.from(dl.base64, 'base64');
          const mt = (dl.mimetype || message.mediaMimetype || 'application/octet-stream').toLowerCase();
          const extMap = {
            'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
            'image/gif': '.gif', 'image/webp': '.webp',
            'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/3gpp': '.3gp',
            'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
            'audio/wav': '.wav', 'audio/webm': '.webm',
            'application/pdf': '.pdf',
          };
          const ext = extMap[mt] || '.bin';
          const fname = `uazapi_${Date.now()}_${crypto.randomUUID()}${ext}`;
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          fs.writeFileSync(path.join(uploadsDir, fname), buf);
          message.mediaUrl = `/uploads/${fname}`;
          if (!message.mediaMimetype) message.mediaMimetype = mt;
        } else {
          message.mediaUrl = null;
        }
      } else {
        console.warn('[UAZAPI] downloadMedia falhou para', msgIdForDownload, dl?.error);
        message.mediaUrl = null;
      }
    } catch (e) {
      console.error('[UAZAPI] erro ao baixar mídia', e?.message);
      message.mediaUrl = null;
    }
  }

  const existingMessage = await query(
    `SELECT id FROM chat_messages WHERE message_id = $1 LIMIT 1`,
    [message.messageId]
  );

  if (existingMessage.rows.length > 0) {
    return { skipped: true, reason: 'duplicate' };
  }

  let conversationResult = await query(
    `SELECT id FROM conversations WHERE connection_id = $1 AND remote_jid = $2 LIMIT 1`,
    [connection.id, message.chatId]
  );

  if (conversationResult.rows.length === 0 && !message.isGroup && message.phone) {
    conversationResult = await query(
      `SELECT id FROM conversations
       WHERE connection_id = $1 AND contact_phone = $2 AND COALESCE(is_group, false) = false
       ORDER BY last_message_at DESC
       LIMIT 1`,
      [connection.id, message.phone]
    );
  }

  let conversationId;
  if (conversationResult.rows.length === 0) {
    const contactName = message.isGroup
      ? (message.groupName || 'Grupo')
      : (message.senderName || message.phone || 'Contato');

    const createdConversation = await query(
      `INSERT INTO conversations (connection_id, remote_jid, contact_name, contact_phone, is_group, group_name, last_message_at, unread_count, attendance_status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1, 'waiting')
       RETURNING id`,
      [
        connection.id,
        message.chatId,
        contactName,
        message.isGroup ? null : message.phone,
        message.isGroup,
        message.isGroup ? message.groupName : null,
      ]
    );
    conversationId = createdConversation.rows[0].id;
  } else {
    conversationId = conversationResult.rows[0].id;
    await query(
      `UPDATE conversations
       SET last_message_at = NOW(),
           unread_count = unread_count + 1,
           contact_name = COALESCE($2, contact_name),
           group_name = CASE WHEN COALESCE(is_group, false) = true THEN COALESCE($3, group_name) ELSE group_name END,
           attendance_status = CASE WHEN attendance_status = 'finished' THEN 'waiting' ELSE attendance_status END,
           updated_at = NOW()
       WHERE id = $1`,
      [conversationId, message.senderName, message.groupName]
    );
  }

  // Verifica se chat_messages tem a coluna connection_id
  const chatMessagesHasConnectionId = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'chat_messages' AND column_name = 'connection_id'
    ) as exists_column
  `).then(r => r.rows[0].exists_column);

  if (chatMessagesHasConnectionId) {
    await query(
      `INSERT INTO chat_messages (conversation_id, message_id, content, message_type, media_url, media_mimetype, from_me, sender_name, sender_phone, status, timestamp, connection_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)`,
      [
        conversationId,
        message.messageId,
        message.content,
        message.messageType,
        message.mediaUrl,
        message.mediaMimetype,
        message.fromMe,
        message.senderName,
        message.phone,
        message.fromMe ? 'sent' : 'received',
        connection.id
      ]
    );
  } else {
    await query(
      `INSERT INTO chat_messages (conversation_id, message_id, content, message_type, media_url, media_mimetype, from_me, sender_name, sender_phone, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        conversationId,
        message.messageId,
        message.content,
        message.messageType,
        message.mediaUrl,
        message.mediaMimetype,
        message.fromMe,
        message.senderName,
        message.phone,
        message.fromMe ? 'sent' : 'received',
      ]
    );
  }

  return { skipped: false, conversationId, messageId: message.messageId };
}

/**
 * Webhook handler
 * Configurar em UAZAPI: POST {SUA_URL}/api/uazapi/webhook
 */
async function handleWebhook(req, res, routeMeta = {}) {
  try {
    const payload = {
      ...(req.body || {}),
      event: req.body?.event || routeMeta.event || req.params?.event || null,
      messageType: req.body?.messageType || routeMeta.messageType || req.params?.messageType || null,
    };
    const instanceId = extractInstanceId(payload);
    const eventType = detectEventType(payload);

    console.log('[UAZAPI Webhook] Received:', JSON.stringify(payload).slice(0, 400));

    if (!instanceId) {
      uazapiProvider.pushUazapiEvent({ instanceId, eventType, payload });
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

    uazapiProvider.pushUazapiEvent({
      instanceId,
      eventType,
      payload,
      connectionId: connection.id,
      connectionInstanceId: connection.instance_id,
      connectionToken: connection.uazapi_token,
    });

    // Atualizar status quando recebe evento de conexão
    if (eventType === 'connection_update') {
      const status = String(payload?.status || payload?.state || '').toLowerCase();
      const dbStatus = (status === 'connected' || status === 'open') ? 'connected' : 'disconnected';
      await query(
        `UPDATE connections SET status = $1, phone_number = COALESCE($2, phone_number), updated_at = NOW() WHERE id = $3`,
        [dbStatus, payload?.phone || payload?.wid || null, connection.id]
      );
    }

    let persistence = null;
    if (eventType === 'message_received' || eventType === 'message_sent') {
      persistence = await persistIncomingMessage(connection, payload);
    }

    res.status(200).json({ received: true, processed: eventType, persistence });
  } catch (error) {
    console.error('[UAZAPI Webhook] Error:', error);
    res.status(200).json({ received: true, error: error.message });
  }
}

router.post('/webhook', async (req, res) => {
  return handleWebhook(req, res);
});

router.post('/webhook/:event/:messageType?', async (req, res) => {
  return handleWebhook(req, res, {
    event: req.params.event,
    messageType: req.params.messageType,
  });
});

/**
 * Eventos diagnósticos (apenas leitura)
 */
router.get('/events', (req, res) => {
  const { instanceId, connectionId, limit } = req.query;
  res.json({ events: uazapiProvider.getUazapiEvents({ instanceId, connectionId, limit: Number(limit) || 100 }) });
});

router.delete('/events', (req, res) => {
  const { instanceId, connectionId } = req.query;
  uazapiProvider.clearUazapiEvents({ instanceId, connectionId });
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
