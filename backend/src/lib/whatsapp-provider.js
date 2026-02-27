// Unified WhatsApp Provider
// Routes requests to the correct provider (Evolution API or W-API)

import { query } from '../db.js';
import * as wapiProvider from './wapi-provider.js';
import { logError, logInfo, logWarn } from '../logger.js';

const globalWapiTokenCache = {
  value: null,
  expiresAt: 0,
};

async function getGlobalWapiToken() {
  if (globalWapiTokenCache.value && Date.now() < globalWapiTokenCache.expiresAt) {
    return globalWapiTokenCache.value;
  }

  const result = await query(`SELECT value FROM system_settings WHERE key = 'wapi_token' LIMIT 1`);
  const token = result.rows[0]?.value || null;

  globalWapiTokenCache.value = token;
  globalWapiTokenCache.expiresAt = Date.now() + 60 * 1000;
  return token;
}

async function resolveWapiToken(connection) {
  // Preferimos o token global do integrador (fonte única no sistema atual).
  // Isso evita conexões novas com token de instância divergente/inválido.
  let globalToken = null;
  try {
    globalToken = await getGlobalWapiToken();
  } catch (error) {
    logWarn('wapi.resolve_global_token_failed', {
      connection_id: connection?.id || null,
      error: error?.message || 'unknown_error',
    });
  }

  if (globalToken) {
    if (connection?.wapi_token && connection.wapi_token !== globalToken) {
      logWarn('wapi.token_mismatch_using_global', {
        connection_id: connection?.id || null,
      });
    }
    return globalToken;
  }

  if (connection?.wapi_token) return connection.wapi_token;

  return null;
}

/**
 * Detect provider from connection data
 */
export function detectProvider(connection) {
  const provider = String(connection?.provider || '').toLowerCase();

  // Direct Instance ID é sempre W-API no sistema atual
  if (connection?.instance_id) {
    return 'wapi';
  }

  if (provider === 'wapi' || provider === 'evolution') {
    return provider;
  }

  // Default to Evolution
  return 'evolution';
}

/**
 * Check connection status
 */
export async function checkStatus(connection) {
  const provider = detectProvider(connection);

  if (provider === 'wapi') {
    const resolvedToken = await resolveWapiToken(connection);
    return wapiProvider.checkStatus(connection.instance_id, resolvedToken);
  }

  // Evolution API
  try {
    const startedAt = Date.now();
    logInfo('evolution.status_check_started', {
      connection_id: connection.id,
      instance_name: connection.instance_name,
    });

    const response = await fetch(
      `${connection.api_url}/instance/connectionState/${connection.instance_name}`,
      {
        headers: { apikey: connection.api_key },
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logWarn('evolution.status_check_non_ok', {
        connection_id: connection.id,
        instance_name: connection.instance_name,
        status_code: response.status,
        duration_ms: Date.now() - startedAt,
        body_preview: String(text || '').slice(0, 300),
      });
      return { status: 'disconnected', error: `Failed to check status (HTTP ${response.status})` };
    }

    const text = await response.text().catch(() => '');
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      logError('evolution.status_check_parse_failed', e, {
        connection_id: connection.id,
        instance_name: connection.instance_name,
        duration_ms: Date.now() - startedAt,
        body_preview: String(text || '').slice(0, 500),
      });
      return { status: 'disconnected', error: 'Invalid JSON response' };
    }

    if (data.instance?.state === 'open') {
      logInfo('evolution.status_check_connected', {
        connection_id: connection.id,
        instance_name: connection.instance_name,
        duration_ms: Date.now() - startedAt,
        has_phone: Boolean(data.instance?.phoneNumber),
      });
      return {
        status: 'connected',
        phoneNumber: data.instance?.phoneNumber,
      };
    }

    logInfo('evolution.status_check_disconnected', {
      connection_id: connection.id,
      instance_name: connection.instance_name,
      duration_ms: Date.now() - startedAt,
    });
    return { status: 'disconnected' };
  } catch (error) {
    logError('evolution.status_check_exception', error, {
      connection_id: connection.id,
      instance_name: connection.instance_name,
    });
    return { status: 'disconnected', error: error.message };
  }
}

/**
 * Get QR Code
 */
export async function getQRCode(connection) {
  const provider = detectProvider(connection);

  if (provider === 'wapi') {
    const resolvedToken = await resolveWapiToken(connection);
    return wapiProvider.getQRCode(connection.instance_id, resolvedToken);
  }

  // Evolution API
  try {
    const response = await fetch(
      `${connection.api_url}/instance/connect/${connection.instance_name}`,
      {
        headers: { apikey: connection.api_key },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.base64 || data.qrcode?.base64 || null;
  } catch (error) {
    console.error('Evolution getQRCode error:', error);
    return null;
  }
}

/**
 * Disconnect/Logout
 */
export async function disconnect(connection) {
  const provider = detectProvider(connection);

  if (provider === 'wapi') {
    const resolvedToken = await resolveWapiToken(connection);
    return wapiProvider.disconnect(connection.instance_id, resolvedToken);
  }

  // Evolution API
  try {
    const response = await fetch(
      `${connection.api_url}/instance/logout/${connection.instance_name}`,
      {
        method: 'DELETE',
        headers: { apikey: connection.api_key },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Evolution disconnect error:', error);
    return false;
  }
}

/**
 * Send message (unified)
 */
export async function sendMessage(connection, phone, content, messageType, mediaUrl) {
  const provider = detectProvider(connection);
  const startedAt = Date.now();

  logInfo('whatsapp.send_message_started', {
    connection_id: connection.id,
    provider,
    message_type: messageType,
    has_media_url: Boolean(mediaUrl),
    has_content: Boolean(content),
    phone_preview: phone ? String(phone).substring(0, 15) : null,
  });

  if (provider === 'wapi') {
    try {
      const resolvedToken = await resolveWapiToken(connection);
      const result = await wapiProvider.sendMessage(
        connection.instance_id,
        resolvedToken,
        phone,
        content,
        messageType,
        mediaUrl
      );

      logInfo('whatsapp.send_message_wapi_result', {
        connection_id: connection.id,
        success: result.success,
        error: result.error || null,
        duration_ms: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      logError('whatsapp.send_message_wapi_exception', error, {
        connection_id: connection.id,
        duration_ms: Date.now() - startedAt,
      });
      return { success: false, error: error.message };
    }
  }

  // Evolution API
  try {
    let endpoint;
    let body;

    if (messageType === 'text') {
      endpoint = `/message/sendText/${connection.instance_name}`;
      body = {
        number: phone,
        text: content,
      };
    } else if (messageType === 'audio') {
      endpoint = `/message/sendWhatsAppAudio/${connection.instance_name}`;
      body = {
        number: phone,
        audio: mediaUrl,
        delay: 1200,
      };
    } else {
      // image, video, document
      endpoint = `/message/sendMedia/${connection.instance_name}`;
      body = {
        number: phone,
        mediatype: messageType,
        media: mediaUrl,
      };
      if (content) {
        body.caption = content;
      }
    }

    const response = await fetch(`${connection.api_url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: connection.api_key,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || 'Failed to send message',
      };
    }

    const result = await response.json();
    return { success: true, messageId: result.key?.id };
  } catch (error) {
    console.error('Evolution sendMessage error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if number is on WhatsApp
 */
export async function checkNumber(connection, phone) {
  const provider = detectProvider(connection);

  if (provider === 'wapi') {
    const resolvedToken = await resolveWapiToken(connection);
    return wapiProvider.checkNumber(connection.instance_id, resolvedToken, phone);
  }

  // Evolution API
  try {
    const response = await fetch(
      `${connection.api_url}/chat/whatsappNumbers/${connection.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: connection.api_key,
        },
        body: JSON.stringify({
          numbers: [phone],
        }),
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data?.[0]?.exists === true;
  } catch (error) {
    console.error('Evolution checkNumber error:', error);
    return false;
  }
}

/**
 * Send typing/composing presence indicator
 */
export async function sendPresenceComposing(connection, contactPhone) {
  const provider = detectProvider(connection);

  if (provider === 'wapi') {
    const resolvedToken = await resolveWapiToken(connection);
    return wapiProvider.sendPresenceComposing(connection.instance_id, resolvedToken, contactPhone);
  }

  // Evolution API
  try {
    const isGroup = contactPhone.includes('@g.us');
    const remoteJid = isGroup ? contactPhone : `${contactPhone.replace(/\D/g, '')}@s.whatsapp.net`;
    
    await fetch(
      `${connection.api_url}/chat/presence/${connection.instance_name}`,
      {
        method: 'POST',
        headers: {
          apikey: connection.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remoteJid,
          presence: 'composing',
        }),
      }
    );
  } catch (error) {
    logWarn('whatsapp_provider.presence_error', { error: error.message });
  }
}
