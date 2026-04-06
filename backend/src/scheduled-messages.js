import { query } from './db.js';
import * as whatsappProvider from './lib/whatsapp-provider.js';

// Send message via unified WhatsApp provider
async function sendWhatsAppMessage(connection, phone, content, messageType, mediaUrl) {
  return whatsappProvider.sendMessage(connection, phone, content, messageType, mediaUrl);
}

// Main function to execute scheduled messages
export async function executeScheduledMessages() {
  console.log('📅 [CRON] Checking scheduled messages...');
  
  const stats = {
    processed: 0,
    sent: 0,
    failed: 0,
  };

  try {
    // Get all pending scheduled messages that are due
    // For W-API, accept connections with instance_id/wapi_token even if status not 'connected'
    const pendingMessages = await query(`
      SELECT 
        sm.*,
        conv.remote_jid,
        conn.provider,
        conn.api_url,
        conn.api_key,
        conn.instance_name,
        conn.instance_id,
        conn.wapi_token,
        conn.status as connection_status
      FROM scheduled_messages sm
      JOIN conversations conv ON conv.id = sm.conversation_id
      JOIN connections conn ON conn.id = sm.connection_id
      WHERE sm.status = 'pending'
        AND sm.scheduled_at <= NOW()
      ORDER BY sm.scheduled_at ASC
      LIMIT 50
    `);

    if (pendingMessages.rows.length === 0) {
      console.log('📅 [CRON] No scheduled messages to send');
      return stats;
    }

    console.log(`📅 [CRON] Found ${pendingMessages.rows.length} scheduled messages to send`);

    for (const msg of pendingMessages.rows) {
      stats.processed++;

      // Check if connection is still active
      // For W-API, accept if has instance_id and wapi_token
      const provider = whatsappProvider.detectProvider(msg);
      const isConnected = msg.connection_status === 'connected' || 
        (provider === 'wapi' && msg.instance_id && msg.wapi_token);

      if (!isConnected) {
        console.log(`  ⚠ Connection not active for message ${msg.id}, marking as failed`);
        await query(
          `UPDATE scheduled_messages 
           SET status = 'failed', error_message = 'Conexão não está ativa', updated_at = NOW() 
           WHERE id = $1`,
          [msg.id]
        );
        stats.failed++;
        continue;
      }

      // Send the message using unified provider
      const connection = {
        provider: msg.provider,
        api_url: msg.api_url,
        api_key: msg.api_key,
        instance_name: msg.instance_name,
        instance_id: msg.instance_id,
        wapi_token: msg.wapi_token,
      };

      // Check if we need to send text separately from media
      const shouldSendSeparate = msg.send_text_separate && msg.media_url && msg.content;

      if (shouldSendSeparate) {
        // Step 1: Send media without caption
        const mediaResult = await sendWhatsAppMessage(
          connection,
          msg.remote_jid,
          null, // no caption
          msg.message_type,
          msg.media_url
        );

        if (!mediaResult.success) {
          await query(
            `UPDATE scheduled_messages 
             SET status = 'failed', error_message = $1, updated_at = NOW() 
             WHERE id = $2`,
            [mediaResult.error || 'Falha ao enviar mídia', msg.id]
          );
          stats.failed++;
          console.log(`  ✗ Failed to send scheduled media ${msg.id}: ${mediaResult.error}`);
          continue;
        }

        // Save media message to chat_messages
        await query(
          `INSERT INTO chat_messages 
            (conversation_id, message_id, from_me, sender_id, content, message_type, media_url, media_mimetype, status, timestamp)
           VALUES ($1, $2, true, $3, NULL, $4, $5, $6, 'sent', NOW())`,
          [
            msg.conversation_id,
            mediaResult.messageId || null,
            msg.sender_id,
            msg.message_type,
            msg.media_url,
            msg.media_mimetype,
          ]
        );

        // Small delay between the two messages
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 2: Send text as separate message
        const textResult = await sendWhatsAppMessage(
          connection,
          msg.remote_jid,
          msg.content,
          'text',
          null
        );

        if (!textResult.success) {
          console.log(`  ⚠ Media sent but text failed for ${msg.id}: ${textResult.error}`);
          // Still mark as sent since media went through, but note the error
        }

        // Save text message to chat_messages
        if (textResult.success) {
          await query(
            `INSERT INTO chat_messages 
              (conversation_id, message_id, from_me, sender_id, content, message_type, status, timestamp)
             VALUES ($1, $2, true, $3, $4, 'text', 'sent', NOW())`,
            [
              msg.conversation_id,
              textResult.messageId || null,
              msg.sender_id,
              msg.content,
            ]
          );
        }

        // Update scheduled message as sent
        await query(
          `UPDATE scheduled_messages 
           SET status = 'sent', sent_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [msg.id]
        );

      } else {
        // Standard: send as single message (media with caption or text only)
        var result = await sendWhatsAppMessage(
          connection,
          msg.remote_jid,
          msg.content,
          msg.message_type,
          msg.media_url
        );

        if (!result.success) {
          await query(
            `UPDATE scheduled_messages 
             SET status = 'failed', error_message = $1, updated_at = NOW() 
             WHERE id = $2`,
            [result.error || 'Unknown error', msg.id]
          );
          stats.failed++;
          console.log(`  ✗ Failed to send scheduled message ${msg.id}: ${result.error}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Update scheduled message as sent
        await query(
          `UPDATE scheduled_messages 
           SET status = 'sent', sent_at = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [msg.id]
        );

        // Save message to chat_messages
        await query(
          `INSERT INTO chat_messages 
            (conversation_id, message_id, from_me, sender_id, content, message_type, media_url, media_mimetype, status, timestamp)
           VALUES ($1, $2, true, $3, $4, $5, $6, $7, 'sent', NOW())`,
          [
            msg.conversation_id,
            result.messageId || null,
            msg.sender_id,
            msg.content,
            msg.message_type,
            msg.media_url,
            msg.media_mimetype,
          ]
        );
      }

      // Update conversation last_message_at
      await query(
        `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [msg.conversation_id]
      );

      // Create alert for user about sent scheduled message
      const convInfo = await query(
        `SELECT contact_name, contact_phone FROM conversations WHERE id = $1`,
        [msg.conversation_id]
      );
      const contactName = convInfo.rows[0]?.contact_name || convInfo.rows[0]?.contact_phone || 'Contato';
      
      await query(
        `INSERT INTO user_alerts (user_id, type, title, message, metadata)
         VALUES ($1, 'scheduled_message_sent', $2, $3, $4)`,
        [
          msg.sender_id,
          '📅 Mensagem agendada enviada',
          `Mensagem enviada para ${contactName}`,
          JSON.stringify({
            conversation_id: msg.conversation_id,
            scheduled_message_id: msg.id,
            message_preview: msg.content?.substring(0, 100),
          })
        ]
      );

      stats.sent++;
      console.log(`  ✓ Sent scheduled message ${msg.id}`);

      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`📅 [CRON] Scheduled messages execution complete:`, stats);
    return stats;
  } catch (error) {
    console.error('📅 [CRON] Scheduled messages execution error:', error);
    throw error;
  }
}
