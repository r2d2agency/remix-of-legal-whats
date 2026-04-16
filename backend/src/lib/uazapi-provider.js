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
const webhookEvents = []; // { at, instanceId, eventType, payload }

export function pushUazapiEvent(event) {
  try {
    webhookEvents.unshift({ at: new Date().toISOString(), ...event });
    if (webhookEvents.length > EVENTS_MAX) webhookEvents.length = EVENTS_MAX;
  } catch {
    // no-op
  }
}

export function getUazapiEvents({ instanceId, limit = 100 } = {}) {
  const filtered = instanceId
    ? webhookEvents.filter((e) => e.instanceId === instanceId)
    : webhookEvents;
  return filtered.slice(0, Math.max(1, Math.min(EVENTS_MAX, Number(limit) || 100)));
}

export function clearUazapiEvents(instanceId) {
  if (!instanceId) {
    webhookEvents.length = 0;
    return;
  }
  for (let i = webhookEvents.length - 1; i >= 0; i--) {
    if (webhookEvents[i]?.instanceId === instanceId) webhookEvents.splice(i, 1);
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
  // Estados: disconnected | connecting | connected
  const stateRaw = d.status || d.state || d.instance?.status || d.connectionStatus || 'disconnected';
  const state = String(stateRaw).toLowerCase();
  const isConnected = state === 'connected' || state === 'open';
  return {
    status: isConnected ? 'connected' : (state === 'connecting' ? 'connecting' : 'disconnected'),
    phoneNumber: d.phone || d.wid || d.instance?.phone || d.profileNumber || null,
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
 * Sender unificado (compatível com whatsapp-provider.js)
 */
export async function sendMessage(baseUrl, token, phone, content, messageType, mediaUrl) {
  if (messageType === 'text' || !messageType) {
    return sendText(baseUrl, token, phone, content);
  }
  return sendMedia(baseUrl, token, phone, mediaUrl, messageType, content);
}
