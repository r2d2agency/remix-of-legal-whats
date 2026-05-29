import { query } from '../db.js';
import * as whatsappProvider from './whatsapp-provider.js';
import * as wapiProvider from './wapi-provider.js';
import * as uazapiProvider from './uazapi-provider.js';

/**
 * Checks if current time is within business hours
 */
function isWithinBusinessHours(start, end, days) {
  if (!start || !end || !days || !Array.isArray(days)) return true;

  // Use America/Sao_Paulo as default timezone
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  if (!days.includes(currentDay)) return false;

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;
  const currentTime = currentH * 60 + currentM;
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Handles auto-replies for a connection
 */
export async function handleAutoReplies(connection, remoteJid, messageContent) {
  try {
    // 1. Skip if message is from me or is a group
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@temp.g.us') || remoteJid.includes('-')) return;


    // 2. Out of Office Check (Priority)
    if (connection.out_of_office_message_enabled && connection.out_of_office_message) {
      const withinHours = isWithinBusinessHours(
        connection.business_hours_start,
        connection.business_hours_end,
        connection.business_days
      );
      
      if (!withinHours) {
        console.log(`[AutoReply] Sending out of office message to ${remoteJid}`);
        await sendAutoReply(connection, remoteJid, connection.out_of_office_message);
        return; // Don't send away message if we already sent out of office
      }
    }

    // 3. Away Message Check
    if (connection.away_message_enabled && connection.away_message) {
      console.log(`[AutoReply] Sending away message to ${remoteJid}`);
      await sendAutoReply(connection, remoteJid, connection.away_message);
    }
  } catch (error) {
    console.error('[AutoReply] Error handling auto-replies:', error.message);
  }
}

async function sendAutoReply(connection, remoteJid, text) {
  const provider = connection.provider || 'evolution';
  
  try {
    if (provider === 'evolution') {
      await whatsappProvider.sendMessage(connection, remoteJid, text);
    } else if (provider === 'wapi') {
      await wapiProvider.sendMessage(connection.instance_id, connection.wapi_token, remoteJid, text);
    } else if (provider === 'uazapi') {
      await uazapiProvider.sendMessage(connection.uazapi_url, connection.uazapi_token, remoteJid, { text });
    } else if (provider === 'meta') {
      // If there is a meta provider, use it. Otherwise, use fetch directly.
      const metaToken = connection.meta_token;
      const phoneId = connection.meta_phone_number_id;
      if (metaToken && phoneId) {
        await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', ''),
            type: 'text',
            text: { body: text },
          }),
        });
      }
    }
  } catch (error) {
    console.error(`[AutoReply] Failed to send ${provider} message:`, error.message);
  }
}
