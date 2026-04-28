// UAZAPI Provider - Backend implementation
// Documentação: https://docs.uazapi.com/
//
// Autenticação:
// - Header `token` para endpoints de instância
// - Header `admintoken` para endpoints administrativos
//
// URL Base: configurável (ex: https://meusubdominio.uazapi.com)

import { logError, logInfo, logWarn } from '../logger.js';
import { fetchWithRetry } from './retry-fetch.js';

const DEFAULT_TIMEOUT = 15000;

// Buffer em memória para diagnóstico
const EVENTS_MAX = 300;
const webhookEvents = []; // { at, instanceId, connectionId, connectionInstanceId, connectionToken, eventType, payload }

export function pushUazapiEvent(event) {
  try {
    webhookEvents.unshift({ at: new Date().toISOString(), ...event });
    if (webhookEvents.length > EVENTS_MAX) webhookEvents.length = EVENTS_MAX;
  } catch {
    // no-op
  }
}

export function getUazapiEvents({ instanceId, connectionId, limit = 100 } = {}) {
  const filtered = webhookEvents.filter((event) => {
    if (connectionId && event.connectionId !== connectionId) return false;
    if (!instanceId) return true;

    return [
      event.instanceId,
      event.connectionInstanceId,
      event.connectionToken,
    ].filter(Boolean).includes(instanceId);
  });

  return filtered.slice(0, Math.max(1, Math.min(EVENTS_MAX, Number(limit) || 100)));
}

export function clearUazapiEvents({ instanceId, connectionId } = {}) {
  if (!instanceId && !connectionId) {
    webhookEvents.length = 0;
    return;
  }

  for (let i = webhookEvents.length - 1; i >= 0; i--) {
    const event = webhookEvents[i];
    const matchesConnection = connectionId ? event?.connectionId === connectionId : true;
    const matchesInstance = instanceId
      ? [event?.instanceId, event?.connectionInstanceId, event?.connectionToken].filter(Boolean).includes(instanceId)
      : true;

    if (matchesConnection && matchesInstance) webhookEvents.splice(i, 1);
  }
}

function normalizeBaseUrl(url) {
  if (!url) return '';
  return String(url).replace(/\/+$/, '');
}

function buildHeaders({ token, admintoken } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.token = token;
  if (admintoken) h.admintoken = admintoken;
  return h;
}

async function uazapiFetch(baseUrl, path, { method = 'GET', body, token, admintoken, timeout = DEFAULT_TIMEOUT } = {}) {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  const opts = {
    method,
    headers: buildHeaders({ token, admintoken }),
  };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  opts.signal = controller.signal;

  try {
    const res = await fetch(url, opts);
    const text = await res.text().catch(() => '');
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    // Interceptar erro 463 do WhatsApp (restrição temporária)
    if (res.status === 463 || (data && (String(data.error).includes('463') || String(data.message).includes('463')))) {
      return { 
        ok: false, 
        status: res.status, 
        data: { 
          ...data,
          error: "O WhatsApp reportou que esta conta está com uma restrição temporária para iniciar novas conversas (Erro 463). Isso geralmente ocorre por alto volume de envios ou denúncias. Verifique sua conexão e tente novamente mais tarde." 
        } 
      };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message }, error: err.message };
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Lista todas as instâncias usando admintoken
 */
export async function listInstances(baseUrl, admintoken) {
  const r = await uazapiFetch(baseUrl, '/instance/all', { admintoken });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, instances: [] };
  const list = Array.isArray(r.data) ? r.data : r.data?.instances || r.data?.data || [];
  return { success: true, instances: list };
}

/**
 * Cria uma nova instância (precisa admintoken)
 */
export async function createInstance(baseUrl, admintoken, instanceName) {
  const r = await uazapiFetch(baseUrl, '/instance/init', {
    method: 'POST',
    admintoken,
    body: { name: instanceName },
  });
  if (!r.ok) {
    throw new Error(r.data?.error || r.data?.message || `HTTP ${r.status}`);
  }
  const data = r.data || {};
  return {
    instanceId: data.id || data.instanceId || data.instance?.id || null,
    token: data.token || data.instance?.token || null,
    raw: data,
  };
}

/**
 * Conecta a instância (gera QR)
 */
export async function connectInstance(baseUrl, token) {
  const r = await uazapiFetch(baseUrl, '/instance/connect', { method: 'POST', token, body: {} });
  return { ok: r.ok, status: r.status, data: r.data };
}

/**
 * Verifica status da instância
 */
export async function checkStatus(baseUrl, token) {
  const r = await uazapiFetch(baseUrl, '/instance/status', { token });
  if (!r.ok) {
    return { status: 'disconnected', error: r.data?.error || `HTTP ${r.status}` };
  }
  const d = r.data || {};
  const stateCandidates = [
    d.status,
    d.state,
    d.connectionStatus,
    d.instance?.status,
    d.instance?.state,
    d.instance?.connectionStatus,
    d.data?.status,
    d.data?.state,
    d.data?.connectionStatus,
    d.data?.instance?.status,
    d.data?.instance?.state,
    d.session?.status,
    d.session?.state,
    d.session?.connectionStatus,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value).trim().toLowerCase());

  const connectedFlags = [
    d.connected,
    d.isConnected,
    d.online,
    d.authenticated,
    d.instance?.connected,
    d.instance?.isConnected,
    d.instance?.online,
    d.instance?.authenticated,
    d.data?.connected,
    d.data?.isConnected,
    d.data?.online,
    d.data?.authenticated,
    d.data?.instance?.connected,
    d.data?.instance?.isConnected,
    d.session?.connected,
    d.session?.isConnected,
    d.session === true,
  ].some((value) => value === true);

  const disconnectedStates = ['disconnected', 'close', 'closed', 'offline', 'logout'];
  const connectingStates = ['connecting', 'qr', 'qrcode', 'pairing', 'pending', 'awaiting_qr', 'scan_qr'];
  const connectedStates = ['connected', 'open', 'online', 'authenticated', 'ready'];

  const hasConnectedState = stateCandidates.some((state) => connectedStates.includes(state));
  const hasConnectingState = stateCandidates.some((state) => connectingStates.includes(state));
  const hasDisconnectedState = stateCandidates.some((state) => disconnectedStates.includes(state));

  const isConnected = connectedFlags || hasConnectedState;
  const isConnecting = !isConnected && hasConnectingState;

  return {
    status: isConnected ? 'connected' : (isConnecting ? 'connecting' : (hasDisconnectedState ? 'disconnected' : 'disconnected')),
    phoneNumber:
      d.phone ||
      d.phoneNumber ||
      d.wid ||
      d.number ||
      d.profileNumber ||
      d.instance?.phone ||
      d.instance?.phoneNumber ||
      d.instance?.wid ||
      d.data?.phone ||
      d.data?.phoneNumber ||
      d.data?.wid ||
      d.data?.number ||
      d.data?.instance?.phone ||
      d.data?.instance?.phoneNumber ||
      d.session?.phone ||
      d.session?.phoneNumber ||
      null,
    raw: d,
  };
}

/**
 * Pega QR Code (base64)
 */
export async function getQRCode(baseUrl, token) {
  // Tenta connect primeiro (gera QR se necessário)
  const connect = await connectInstance(baseUrl, token);
  const data = connect.data || {};
  const qr = data.qrcode || data.qr || data.base64 || data.instance?.qrcode || null;
  if (qr) {
    // Garantir prefixo data:image
    if (typeof qr === 'string' && !qr.startsWith('data:')) {
      return `data:image/png;base64,${qr.replace(/^data:image\/[a-z]+;base64,/, '')}`;
    }
    return qr;
  }

  // Fallback: tentar /instance/qrcode
  const r = await uazapiFetch(baseUrl, '/instance/qrcode', { token });
  if (r.ok) {
    const qr2 = r.data?.qrcode || r.data?.base64 || r.data?.qr || null;
    if (qr2 && typeof qr2 === 'string') {
      return qr2.startsWith('data:') ? qr2 : `data:image/png;base64,${qr2}`;
    }
  }
  return null;
}

/**
 * Desconecta instância
 */
export async function disconnect(baseUrl, token) {
  const r = await uazapiFetch(baseUrl, '/instance/disconnect', { method: 'POST', token, body: {} });
  return r.ok;
}

/**
 * Deleta instância (admintoken)
 */
export async function deleteInstance(baseUrl, admintoken, instanceId, instanceToken) {
  // UAZAPI: DELETE /instance precisa do token da instância no header
  const r = await uazapiFetch(baseUrl, '/instance', {
    method: 'DELETE',
    admintoken,
    token: instanceToken,
  });
  return { success: r.ok, status: r.status, data: r.data };
}

/**
 * Atualiza nome da instância
 */
export async function updateInstanceName(baseUrl, token, name) {
  const r = await uazapiFetch(baseUrl, '/instance/updateInstanceName', {
    method: 'POST',
    token,
    body: { name },
  });
  return { success: r.ok, data: r.data };
}

/**
 * Configura webhook
 */
export async function configureWebhook(baseUrl, token, webhookUrl, events = []) {
  const r = await uazapiFetch(baseUrl, '/webhook', {
    method: 'POST',
    token,
    body: {
      url: webhookUrl,
      enabled: true,
      events: events.length > 0 ? events : ['messages', 'connection', 'status'],
    },
  });
  return { success: r.ok, status: r.status, data: r.data };
}

/**
 * Pega configuração atual de webhook
 */
export async function getWebhook(baseUrl, token) {
  const r = await uazapiFetch(baseUrl, '/webhook', { token });
  return { success: r.ok, data: r.data };
}

/**
 * Normaliza número para formato UAZAPI
 */
function normalizePhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned;
}

/**
 * Envia mensagem de texto
 */
/**
 * Baixa mídia decifrada de uma mensagem recebida.
 * UAZAPI expõe POST /message/download com { id } retornando { fileURL } ou bytes.
 * Tenta múltiplos endpoints (varia entre versões da UAZAPI).
 */
export async function downloadMedia(baseUrl, token, messageId) {
  const base = normalizeBaseUrl(baseUrl);
  const headers = buildHeaders({ token });

  // 1) POST /message/download { id }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(`${base}/message/download`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await r.json();
        const url = data?.fileURL || data?.url || data?.URL || data?.mediaUrl || null;
        const mimetype = data?.mimetype || data?.mimeType || null;
        if (url) return { success: true, url, mimetype };
        if (data?.base64) {
          return { success: true, base64: data.base64, mimetype };
        }
      } else {
        const buf = Buffer.from(await r.arrayBuffer());
        return { success: true, buffer: buf, mimetype: ct };
      }
    }
  } catch (e) {
    // continua para próxima tentativa
  }

  // 2) GET /message/download/{id}
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(`${base}/message/download/${encodeURIComponent(messageId)}`, {
      method: 'GET', headers, signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await r.json();
        const url = data?.fileURL || data?.url || data?.URL || data?.mediaUrl || null;
        const mimetype = data?.mimetype || data?.mimeType || null;
        if (url) return { success: true, url, mimetype };
      } else {
        const buf = Buffer.from(await r.arrayBuffer());
        return { success: true, buffer: buf, mimetype: ct };
      }
    }
  } catch (e) {
    // continua
  }

  return { success: false, error: 'Falha ao baixar mídia da UAZAPI' };
}

export async function sendText(baseUrl, token, phone, message) {
  const r = await uazapiFetch(baseUrl, '/send/text', {
    method: 'POST',
    token,
    body: {
      number: normalizePhone(phone),
      text: message,
    },
  });
  if (!r.ok) {
    return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  }
  return {
    success: true,
    messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || null,
  };
}

/**
 * Envia mídia (image, video, audio, document)
 */
export async function sendMedia(baseUrl, token, phone, mediaUrl, type, caption, filename) {
  const typeMap = {
    image: 'image',
    video: 'video',
    audio: 'audio',
    document: 'document',
    sticker: 'sticker',
  };

  const body = {
    number: normalizePhone(phone),
    type: typeMap[type] || 'document',
    file: mediaUrl,
  };

  if (caption) body.text = caption;
  if (filename) body.docName = filename;

  // Áudio como nota de voz (PTT) por padrão
  if (type === 'audio') {
    body.ptt = true;
  }

  const r = await uazapiFetch(baseUrl, '/send/media', {
    method: 'POST',
    token,
    body,
  });

  if (!r.ok) {
    return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  }
  return {
    success: true,
    messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || null,
  };
}

/**
 * Verifica se número está no WhatsApp
 */
export async function checkNumber(baseUrl, token, phone) {
  const r = await uazapiFetch(baseUrl, '/chat/check', {
    method: 'POST',
    token,
    body: { numbers: [normalizePhone(phone)] },
  });
  if (!r.ok) return false;
  const arr = Array.isArray(r.data) ? r.data : r.data?.results || [];
  return arr[0]?.exists === true || arr[0]?.isInWhatsapp === true;
}

/**
 * Envia indicador de digitando
 */
export async function sendPresenceComposing(baseUrl, token, phone) {
  try {
    await uazapiFetch(baseUrl, '/chat/presence', {
      method: 'POST',
      token,
      body: {
        number: normalizePhone(phone),
        presence: 'composing',
      },
    });
  } catch {
    // best-effort
  }
}

/**
 * Envia menu interativo de BOTÕES (até 3)
 * UAZAPI: POST /send/menu  { type: 'button', text, choices: ['Sim','Não'], footerText? }
 */
export async function sendButtons(baseUrl, token, phone, text, buttons, { footer, header, image } = {}) {
  // buttons: array de strings OU objetos { id, label }
  // Suporte a formatos novos: "texto|id", "texto|url:http...", "texto|call:+num", "texto|copy:code"
  const choices = (buttons || []).map((b) => {
    if (typeof b === 'string') return b;
    if (b.url) return `${b.label || b.text}|${b.url}`;
    if (b.phoneNumber) return `${b.label || b.text}|call:${b.phoneNumber}`;
    if (b.copyCode) return `${b.label || b.text}|copy:${b.copyCode}`;
    return b.label || b.text || b.id;
  }).filter(Boolean);

  if (!choices.length) {
    return { success: false, error: 'Nenhum botão informado' };
  }

  const body = {
    number: normalizePhone(phone),
    type: 'button',
    text,
    choices,
  };
  if (footer) body.footerText = footer;
  if (header) body.headerText = header;
  if (image) body.imageButton = image;

  const r = await uazapiFetch(baseUrl, '/send/menu', { method: 'POST', token, body });
  
  // Diagnóstico para o log
  if (!r.ok) {
    logError('uazapi.send_buttons_failed', null, { 
      status: r.status, 
      error: r.data?.error || r.data?.message,
      phone 
    });
    return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  }

  // Retorna sucesso e o ID da mensagem para persistência
  return { 
    success: true, 
    messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || r.data?.message?.key?.id || null 
  };
}

/**
 * Envia LISTA interativa
 * UAZAPI: POST /send/menu  { type: 'list', text, choices: ['Op1','Op2'], buttonText, footerText? }
 *
 * Aceita também formato seccionado:
 *   sections: [{ title, rows: [{ id, title, description }] }]
 */
export async function sendList(baseUrl, token, phone, text, options, { buttonText = 'Ver opções', footer, sections } = {}) {
  const body = {
    number: normalizePhone(phone),
    type: 'list',
    text,
    listButton: buttonText, // Campo correto segundo a documentação é listButton
  };
  if (footer) body.footerText = footer;

  if (Array.isArray(sections) && sections.length) {
    const choices = [];
    sections.forEach((sec) => {
      if (sec.title) choices.push(`[${sec.title}]`);
      (sec.rows || []).forEach((row) => {
        const label = row.title || row.label;
        const id = row.id || label;
        const desc = row.description ? `|${row.description}` : '';
        if (label) choices.push(`${label}|${id}${desc}`);
      });
    });
    body.choices = choices;
  } else {
    body.choices = (options || []).map((o) => (typeof o === 'string' ? o : (o.label || o.title))).filter(Boolean);
  }

  if (!body.choices?.length) {
    return { success: false, error: 'Nenhuma opção informada para a lista' };
  }

  const r = await uazapiFetch(baseUrl, '/send/menu', { method: 'POST', token, body });
  if (!r.ok) return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  return { success: true, messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || null };
}

/**
 * Envia ENQUETE (poll)
 * UAZAPI: POST /send/menu  { type: 'poll', text, choices: [...], selectableCount? }
 */
export async function sendPoll(baseUrl, token, phone, question, options, { multiSelect = false } = {}) {
  const choices = (options || []).map((o) => (typeof o === 'string' ? o : (o.label || o.text))).filter(Boolean);
  if (choices.length < 2) {
    return { success: false, error: 'Enquete requer ao menos 2 opções' };
  }

  const body = {
    number: normalizePhone(phone),
    type: 'poll',
    text: question,
    choices,
    selectableCount: multiSelect ? choices.length : 1,
  };

  const r = await uazapiFetch(baseUrl, '/send/menu', { method: 'POST', token, body });
  if (!r.ok) return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  return { success: true, messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || null };
}

/**
 * Sincroniza CHATS da instância (lista de conversas existentes)
 * UAZAPI: POST /chat/find
 */
export async function syncChats(baseUrl, token, { limit = 200, onlyGroups, onlyContacts } = {}) {
  const body = { limit };
  if (onlyGroups) body.onlyGroups = true;
  if (onlyContacts) body.onlyContacts = true;

  const r = await uazapiFetch(baseUrl, '/chat/find', { method: 'POST', token, body, timeout: 30000 });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, chats: [] };
  const chats = Array.isArray(r.data) ? r.data : (r.data?.chats || r.data?.data || []);
  return { success: true, chats };
}

/**
 * Sincroniza MENSAGENS de um chat específico (histórico)
 * UAZAPI: POST /message/find
 *
 * @param {string} chatId - JID do chat (ex: 5511999999999@s.whatsapp.net)
 */
export async function syncMessages(baseUrl, token, chatId, { limit = 100, fromMe } = {}) {
  const body = {
    chatid: chatId,
    limit,
  };
  if (typeof fromMe === 'boolean') body.fromMe = fromMe;

  const r = await uazapiFetch(baseUrl, '/message/find', { method: 'POST', token, body, timeout: 30000 });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, messages: [] };
  const messages = Array.isArray(r.data) ? r.data : (r.data?.messages || r.data?.data || []);
  return { success: true, messages };
}

/**
 * Lista CONTATOS sincronizados pelo WhatsApp do celular
 * UAZAPI: POST /contacts/list
 *
 * Retorna contatos da agenda do celular vinculado ao WhatsApp
 */
export async function listContacts(baseUrl, token, { limit, offset, search, contactScope } = {}) {
  const body = {};
  if (limit) body.limit = limit;
  if (typeof offset === 'number') body.offset = offset;
  if (search) body.search = search;
  if (contactScope) body.contactScope = contactScope;

  const r = await uazapiFetch(baseUrl, '/contacts/list', { method: 'POST', token, body, timeout: 30000 });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, contacts: [] };
  const raw = Array.isArray(r.data) ? r.data : (r.data?.contacts || r.data?.data || []);

  // Normaliza: { name, phone, isWhatsapp, isBusiness, ... }
  const contacts = raw.map((c) => {
    const jid = c.id || c.jid || c.wid || c.remoteJid || '';
    const phone = String(jid).replace(/@.*/, '').replace(/\D/g, '');
    return {
      name: c.name || c.pushname || c.notify || c.verifiedName || phone,
      phone,
      jid,
      isBusiness: !!c.isBusiness,
      isMyContact: c.isMyContact !== false, // contatos da agenda
      raw: c,
    };
  }).filter((c) => c.phone && c.phone.length >= 10 && !c.jid.includes('@g.us'));

  return { success: true, contacts };
}

/**
 * SENDER - Cria campanha de disparo em massa nativa
 * UAZAPI: POST /sender/simple
 *
 * @param {object} params - { numbers[], type, text?, file?, delayMin, delayMax, scheduled_for?, info? }
 *   - type: 'text' | 'image' | 'video' | 'audio' | 'document'
 *   - delayMin/delayMax em SEGUNDOS (ex: 3, 8 = entre 3-8s entre mensagens)
 *   - scheduled_for: timestamp ms (opcional, agendamento)
 *   - info: nome/identificação da campanha (vira "folder")
 */
export async function senderCreate(baseUrl, token, params) {
  const body = {
    numbers: (params.numbers || []).map((n) => normalizePhone(n)).filter(Boolean),
    type: params.type || 'text',
    delayMin: params.delayMin ?? 3,
    delayMax: params.delayMax ?? 8,
  };
  if (params.text) body.text = params.text;
  if (params.file) body.file = params.file;
  if (params.docName) body.docName = params.docName;
  if (params.scheduled_for) body.scheduled_for = params.scheduled_for;
  if (params.info) body.info = params.info;
  if (params.type === 'audio') body.ptt = true;

  if (!body.numbers.length) {
    return { success: false, error: 'Lista de números vazia' };
  }

  const r = await uazapiFetch(baseUrl, '/sender/simple', { method: 'POST', token, body, timeout: 60000 });
  if (!r.ok) return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  return {
    success: true,
    folder_id: r.data?.folder_id || r.data?.folderId || r.data?.id || null,
    queued: r.data?.count || body.numbers.length,
    raw: r.data,
  };
}

/**
 * SENDER - Edita status de uma campanha (pause/resume/stop/delete)
 * UAZAPI: POST /sender/edit
 *
 * @param {string} folderId - ID da pasta/campanha
 * @param {'play'|'pause'|'stop'|'delete'} action
 */
export async function senderEdit(baseUrl, token, folderId, action) {
  const r = await uazapiFetch(baseUrl, '/sender/edit', {
    method: 'POST',
    token,
    body: { folder_id: folderId, action },
  });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}` };
  return { success: true, data: r.data };
}

/**
 * SENDER - Lista pastas/campanhas existentes
 * UAZAPI: POST /sender/listfolders
 */
export async function senderListFolders(baseUrl, token) {
  const r = await uazapiFetch(baseUrl, '/sender/listfolders', { method: 'POST', token, body: {} });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, folders: [] };
  const folders = Array.isArray(r.data) ? r.data : (r.data?.folders || r.data?.data || []);
  return { success: true, folders };
}

/**
 * SENDER - Lista mensagens de uma pasta (status individual de cada envio)
 * UAZAPI: POST /sender/listmessages
 */
export async function senderListMessages(baseUrl, token, folderId, { status, limit = 500 } = {}) {
  const body = { folder_id: folderId, limit };
  if (status) body.status = status; // 'pending' | 'sent' | 'failed'
  const r = await uazapiFetch(baseUrl, '/sender/listmessages', { method: 'POST', token, body, timeout: 30000 });
  if (!r.ok) return { success: false, error: r.data?.error || `HTTP ${r.status}`, messages: [] };
  const messages = Array.isArray(r.data) ? r.data : (r.data?.messages || r.data?.data || []);
  return { success: true, messages };
}

/**
 * Envia cartão de contato (vCard)
 * UAZAPI: POST /send/contact  { number, fullName, phoneNumber, organization?, email? }
 */
export async function sendContact(baseUrl, token, phone, contactName, contactPhone, extra = {}) {
  const cleanContactPhone = String(contactPhone).replace(/\D/g, '');
  const body = {
    number: normalizePhone(phone),
    fullName: contactName,
    phoneNumber: cleanContactPhone,
  };
  if (extra.organization) body.organization = extra.organization;
  if (extra.email) body.email = extra.email;

  // Tenta /send/contact primeiro; fallback para vcard via /send/text se não suportado
  let r = await uazapiFetch(baseUrl, '/send/contact', { method: 'POST', token, body });
  if (!r.ok) {
    // Fallback: monta vCard e envia como texto
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      `TEL;type=CELL;waid=${cleanContactPhone}:+${cleanContactPhone}`,
      'END:VCARD',
    ].join('\n');
    r = await uazapiFetch(baseUrl, '/send/text', {
      method: 'POST',
      token,
      body: { number: normalizePhone(phone), text: vcard },
    });
    if (!r.ok) return { success: false, error: r.data?.error || r.data?.message || `HTTP ${r.status}` };
  }
  return { success: true, messageId: r.data?.id || r.data?.messageId || r.data?.key?.id || null };
}

/**
 * Sender unificado (compatível com whatsapp-provider.js)
 */
export async function sendMessage(baseUrl, token, phone, content, messageType, mediaUrl, filename = null) {
  if (messageType === 'text' || !messageType) {
    return sendText(baseUrl, token, phone, content);
  }
  if (messageType === 'contact') {
    try {
      const ct = typeof content === 'string' ? JSON.parse(content) : content;
      return sendContact(baseUrl, token, phone, ct.contactName, ct.contactPhone, {
        organization: ct.organization,
        email: ct.email,
      });
    } catch {
      return { success: false, error: 'Invalid contact data' };
    }
  }
  if (messageType === 'interactive_menu') {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      return sendButtons(baseUrl, token, phone, data.text, data.buttons, { footer: data.footer, header: data.header });
    } catch {
      return { success: false, error: 'Invalid interactive menu data' };
    }
  }
  return sendMedia(baseUrl, token, phone, mediaUrl, messageType, content, filename);
}
