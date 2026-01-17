import { query } from './db.js';

// Translation map for common Evolution API errors
const errorTranslations = {
  'not a whatsapp number': 'Número não é WhatsApp',
  'number not on whatsapp': 'Número não é WhatsApp',
  'not on whatsapp': 'Número não é WhatsApp',
  'connection closed': 'Conexão fechada',
  'disconnected': 'Desconectado',
  'instance not connected': 'Instância desconectada',
  'instance not found': 'Instância não encontrada',
  'invalid number': 'Número inválido',
  'number is invalid': 'Número inválido',
  'timeout': 'Tempo esgotado',
  'rate limit': 'Limite de envios excedido',
  'blocked': 'Número bloqueado',
  'chat not found': 'Chat não encontrado',
  'media not found': 'Mídia não encontrada',
  'unauthorized': 'Não autorizado',
  'forbidden': 'Acesso negado',
};

function translateError(error) {
  if (!error) return 'Erro desconhecido';
  const lowerError = error.toLowerCase();
  for (const [key, translation] of Object.entries(errorTranslations)) {
    if (lowerError.includes(key)) {
      return translation;
    }
  }
  return error;
}

// Replace variables in message content
function replaceVariables(text, contact) {
  if (!text) return text;
  
  return text
    .replace(/\{\{nome\}\}/gi, contact.name || '')
    .replace(/\{\{telefone\}\}/gi, contact.phone || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{empresa\}\}/gi, contact.company || '')
    .replace(/\{\{cargo\}\}/gi, contact.position || '')
    .replace(/\{\{observacao\}\}/gi, contact.notes || '')
    .replace(/\{\{obs\}\}/gi, contact.notes || '');
}

// Helper to send message via Evolution API
async function sendEvolutionMessage(connection, phone, messageItems, contact) {
  const results = [];
  
  for (const item of messageItems) {
    try {
      let endpoint;
      let body;
      const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

      // Replace variables in content
      const processedContent = replaceVariables(item.content, contact);

      if (item.type === 'text') {
        endpoint = `/message/sendText/${connection.instance_name}`;
        body = {
          number: remoteJid,
          text: processedContent,
        };
      } else if (item.type === 'image') {
        endpoint = `/message/sendMedia/${connection.instance_name}`;
        body = {
          number: remoteJid,
          mediatype: 'image',
          media: item.media_url,
          caption: processedContent || undefined,
        };
      } else if (item.type === 'video') {
        endpoint = `/message/sendMedia/${connection.instance_name}`;
        body = {
          number: remoteJid,
          mediatype: 'video',
          media: item.media_url,
          caption: processedContent || undefined,
        };
      } else if (item.type === 'audio') {
        endpoint = `/message/sendWhatsAppAudio/${connection.instance_name}`;
        body = {
          number: remoteJid,
          audio: item.media_url,
          delay: 1200,
        };
      } else if (item.type === 'document') {
        endpoint = `/message/sendMedia/${connection.instance_name}`;
        body = {
          number: remoteJid,
          mediatype: 'document',
          media: item.media_url,
          caption: processedContent || undefined,
          fileName: item.file_name || 'documento',
        };
      } else {
        // Default to text
        endpoint = `/message/sendText/${connection.instance_name}`;
        body = {
          number: remoteJid,
          text: processedContent || '',
        };
      }

      console.log(`  Sending ${item.type} to ${phone}:`, { endpoint, mediaUrl: item.media_url });

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
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      results.push({ success: true, item });
      
      // Small delay between items of same message
      if (messageItems.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error('Evolution API error for item:', error);
      results.push({ success: false, item, error: error.message });
    }
  }

  // Message is successful if at least the first item was sent
  const firstResult = results[0];
  return {
    success: firstResult?.success || false,
    error: firstResult?.error,
    results,
  };
}

// Execute pending campaign messages
export async function executeCampaignMessages() {
  const stats = {
    processed: 0,
    sent: 0,
    failed: 0,
    campaignsStarted: 0,
  };

  try {
    // First, auto-start campaigns that have pending messages with scheduled_at <= NOW()
    // and campaign status is 'pending' (scheduled but not started)
    const campaignsToStart = await query(`
      SELECT DISTINCT c.id, c.name
      FROM campaigns c
      JOIN campaign_messages cm ON cm.campaign_id = c.id
      WHERE c.status = 'pending'
        AND cm.status = 'pending'
        AND cm.scheduled_at <= NOW()
    `);

    if (campaignsToStart.rows.length > 0) {
      for (const campaign of campaignsToStart.rows) {
        await query(
          `UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1`,
          [campaign.id]
        );
        stats.campaignsStarted++;
        console.log(`📤 [CAMPAIGN] Auto-started campaign: ${campaign.name}`);
      }
    }

    // Get pending messages that should be sent now (scheduled_at <= now)
    // Include contact data for variable replacement
    const pendingMessages = await query(`
      SELECT 
        cm.id,
        cm.campaign_id,
        cm.contact_id,
        cm.phone,
        cm.message_id,
        cm.scheduled_at,
        c.status as campaign_status,
        c.connection_id,
        conn.api_url,
        conn.api_key,
        conn.instance_name,
        conn.status as connection_status,
        mt.items as message_items,
        co.name as contact_name,
        co.email as contact_email,
        co.company as contact_company,
        co.position as contact_position,
        co.notes as contact_notes
      FROM campaign_messages cm
      JOIN campaigns c ON c.id = cm.campaign_id
      JOIN connections conn ON conn.id = c.connection_id
      LEFT JOIN message_templates mt ON mt.id = cm.message_id
      LEFT JOIN contacts co ON co.id = cm.contact_id
      WHERE cm.status = 'pending'
        AND c.status = 'running'
        AND conn.status = 'connected'
        AND cm.scheduled_at <= NOW()
      ORDER BY cm.scheduled_at ASC
      LIMIT 50
    `);

    if (pendingMessages.rows.length === 0) {
      if (stats.campaignsStarted > 0) {
        console.log(`📤 [CAMPAIGN] ${stats.campaignsStarted} campaign(s) started, processing on next cycle.`);
      }
      return stats;
    }

    console.log(`📤 [CAMPAIGN] Found ${pendingMessages.rows.length} messages to process.`);

    for (const msg of pendingMessages.rows) {
      stats.processed++;

      try {
        // Get message items
        const messageItems = msg.message_items || [];
        
        if (messageItems.length === 0) {
          // Mark as failed - no content
          await query(
            `UPDATE campaign_messages 
             SET status = 'failed', error_message = 'Mensagem sem conteúdo', sent_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );
          stats.failed++;
          console.log(`  ✗ [${msg.phone}] Mensagem sem conteúdo`);
          continue;
        }

        // Build connection object
        const connection = {
          api_url: msg.api_url,
          api_key: msg.api_key,
          instance_name: msg.instance_name,
        };

        // Build contact object for variable replacement
        const contact = {
          name: msg.contact_name || '',
          phone: msg.phone || '',
          email: msg.contact_email || '',
          company: msg.contact_company || '',
          position: msg.contact_position || '',
          notes: msg.contact_notes || '',
        };

        // Send message
        const result = await sendEvolutionMessage(connection, msg.phone, messageItems, contact);

        if (result.success) {
          await query(
            `UPDATE campaign_messages 
             SET status = 'sent', sent_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );
          stats.sent++;
          console.log(`  ✓ [${msg.phone}] Mensagem enviada (${messageItems.length} item(s))`);

          // Update campaign sent_count
          await query(
            `UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
            [msg.campaign_id]
          );
        } else {
          const translatedError = translateError(result.error);
          await query(
            `UPDATE campaign_messages 
             SET status = 'failed', error_message = $1, sent_at = NOW()
             WHERE id = $2`,
            [translatedError, msg.id]
          );
          stats.failed++;
          console.log(`  ✗ [${msg.phone}] ${translatedError}`);

          // Update campaign failed_count
          await query(
            `UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
            [msg.campaign_id]
          );
        }
      } catch (error) {
        console.error(`  ✗ [${msg.phone}] Error:`, error);
        const translatedError = translateError(error.message);
        
        await query(
          `UPDATE campaign_messages 
           SET status = 'failed', error_message = $1, sent_at = NOW()
           WHERE id = $2`,
          [translatedError, msg.id]
        );
        stats.failed++;

        await query(
          `UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
          [msg.campaign_id]
        );
      }
    }

    // Check if any campaigns are now complete
    await query(`
      UPDATE campaigns 
      SET status = 'completed', updated_at = NOW()
      WHERE status = 'running'
        AND id IN (
          SELECT campaign_id 
          FROM campaign_messages 
          GROUP BY campaign_id 
          HAVING COUNT(*) FILTER (WHERE status = 'pending') = 0
        )
    `);

    console.log(`📤 [CAMPAIGN] Execution complete:`, stats);
    return stats;
  } catch (error) {
    console.error('📤 [CAMPAIGN] Execution error:', error);
    throw error;
  }
}
