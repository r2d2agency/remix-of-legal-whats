// Unified WhatsApp Provider
// Routes requests to the correct provider (Evolution API or W-API)

import { query } from '../db.js';
import * as wapiProvider from './wapi-provider.js';
import * as uazapiProvider from './uazapi-provider.js';
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
  // Prioriza token da própria conexão (especialmente importante para instâncias
  // que exigem token de instância), com fallback para token global do integrador.
  if (connection?.wapi_token) {
    try {
      const globalToken = await getGlobalWapiToken();
      if (globalToken && globalToken !== connection.wapi_token) {
        logWarn('wapi.token_mismatch_using_connection', {
          connection_id: connection?.id || null,
        });
      }
    } catch (error) {
      logWarn('wapi.resolve_global_token_failed', {
        connection_id: connection?.id || null,
        error: error?.message || 'unknown_error',
      });
    }

    return connection.wapi_token;
  }

  try {
    return await getGlobalWapiToken();
  } catch (error) {
    logWarn('wapi.resolve_global_token_failed', {
      connection_id: connection?.id || null,
      error: error?.message || 'unknown_error',
    });
    return null;
  }
}

/**
 * Check Meta Cloud API connection status by validating the token
 */
async function checkMetaStatus(connection) {
  try {
    const token = connection.meta_token;
    const phoneNumberId = connection.meta_phone_number_id;

    if (!token || !phoneNumberId) {
      return {
        status: 'disconnected',
        error: 'Token ou Phone Number ID não configurados',
      };
    }

    // Validate token by calling the Graph API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        status: 'connected',
        phoneNumber: data.display_phone_number || connection.phone_number || null,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;

    // Token expired or invalid
    if (response.status === 401 || response.status === 190) {
      return {
        status: 'disconnected',
        error: `Token inválido ou expirado: ${errorMsg}`,
      };
    }

    return {
      status: 'disconnected',
      error: errorMsg,
    };
  } catch (error) {
    logError('meta.status_check_failed', error, {
      connection_id: connection?.id,
    });
    // If it's a network error, preserve current status
    if (connection.status === 'connected') {
      return { status: 'connected', phoneNumber: connection.phone_number, transient: true };
    }
    return { status: 'disconnected', error: error.message };
  }
}

/**
 * Detect provider from connection data
 */
export function detectProvider(connection) {
  const provider = String(connection?.provider || '').toLowerCase();

  // Meta Cloud API
  if (provider === 'meta') {
    return 'meta';
  }

  // UAZAPI
  if (provider === 'uazapi' || (connection?.uazapi_url && connection?.uazapi_token)) {
    return 'uazapi';
  }

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

  if (provider === 'meta') {
    return checkMetaStatus(connection);
  }

  if (provider === 'uazapi') {
    return uazapiProvider.checkStatus(connection.uazapi_url, connection.uazapi_token);
  }

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

  if (provider === 'meta') {
    // Meta Cloud API doesn't use QR codes
    return null;
  }

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

  if (provider === 'meta') {
    // Meta Cloud API: just mark as disconnected in DB
    await query('UPDATE connections SET status = $1, updated_at = NOW() WHERE id = $2', ['disconnected', connection.id]);
    return true;
  }

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

  if (provider === 'meta') {
    return sendMetaMessage(connection, phone, content, messageType, mediaUrl);
  }

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

  if (provider === 'meta') {
    // Meta Cloud API doesn't have a direct "check number" API
    // Return true by default; delivery will fail if number is invalid
    return true;
  }

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

/**
 * Send message via Meta Cloud API
 */
async function sendMetaMessage(connection, phone, content, messageType, mediaUrl) {
  try {
    const token = connection.meta_token;
    const phoneNumberId = connection.meta_phone_number_id;

    if (!token || !phoneNumberId) {
      return { success: false, error: 'Token ou Phone Number ID não configurados' };
    }

    // Normalize phone number (remove non-digits)
    const cleanPhone = String(phone).replace(/\D/g, '');

    let body;

    if (messageType === 'text') {
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: content },
      };
    } else if (messageType === 'image') {
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'image',
        image: { link: mediaUrl, ...(content ? { caption: content } : {}) },
      };
    } else if (messageType === 'audio') {
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'audio',
        audio: { link: mediaUrl },
      };
    } else if (messageType === 'video') {
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'video',
        video: { link: mediaUrl, ...(content ? { caption: content } : {}) },
      };
    } else if (messageType === 'document') {
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'document',
        document: { link: mediaUrl, ...(content ? { filename: content } : {}) },
      };
    } else {
      // Fallback to text
      body = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: content || '' },
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result?.error?.message || `HTTP ${response.status}`;
      logError('meta.send_message_failed', new Error(errorMsg), {
        connection_id: connection.id,
        status: response.status,
      });
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      messageId: result?.messages?.[0]?.id || null,
    };
  } catch (error) {
    logError('meta.send_message_exception', error, {
      connection_id: connection.id,
    });
    return { success: false, error: error.message };
  }
}
