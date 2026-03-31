import 'dotenv/config'; // Preload — side-effect import, loads .env BEFORE other modules

import express from 'express';
import cors from 'cors';
import path from 'path';
import cron from 'node-cron';
import crypto from 'crypto';
import authRoutes from './routes/auth.js';
import connectionsRoutes from './routes/connections.js';
import messagesRoutes from './routes/messages.js';
import contactsRoutes from './routes/contacts.js';
import campaignsRoutes from './routes/campaigns.js';
import organizationsRoutes from './routes/organizations.js';
import asaasRoutes from './routes/asaas.js';
import adminRoutes from './routes/admin.js';
import uploadsRoutes from './routes/uploads.js';
import notificationsRoutes from './routes/notifications.js';
import evolutionRoutes from './routes/evolution.js';
import wapiRoutes from './routes/wapi.js';
import chatRoutes from './routes/chat.js';
import quickRepliesRoutes from './routes/quick-replies.js';
import chatbotsRoutes from './routes/chatbots.js';
import departmentsRoutes from './routes/departments.js';
import flowsRoutes from './routes/flows.js';
import crmRoutes from './routes/crm.js';
import crmAutomationRoutes from './routes/crm-automation.js';
import emailRoutes from './routes/email.js';
import googleCalendarRoutes from './routes/google-calendar.js';
import billingQueueRoutes from './routes/billing-queue.js';
import transcribeRoutes from './routes/transcribe.js';
import aiAgentsRoutes from './routes/ai-agents.js';
import externalFormsRoutes from './routes/external-forms.js';
import leadDistributionRoutes from './routes/lead-distribution.js';
import leadWebhooksRoutes from './routes/lead-webhooks.js';
import leadScoringRoutes from './routes/lead-scoring.js';
import conversationSummaryRoutes from './routes/conversation-summary.js';
import nurturingRoutes from './routes/nurturing.js';
import ctwaAnalyticsRoutes from './routes/ctwa-analytics.js';
import groupSecretaryRoutes from './routes/group-secretary.js';
import ghostRoutes from './routes/ghost.js';
import projectsRoutes from './routes/projects.js';
import pushRoutes from './routes/push.js';
import taskBoardsRoutes from './routes/task-boards.js';
import leadGleegoRoutes from './routes/lead-gleego.js';
import globalAgentsRoutes from './routes/global-agents.js';
import metaTemplatesRoutes from './routes/meta-templates.js';
import docSignaturesRoutes from './routes/doc-signatures.js';
import { initDatabase } from './init-db.js';
import { executeNotifications } from './scheduler.js';
import { executeCampaignMessages } from './campaign-scheduler.js';
import { executeScheduledMessages } from './scheduled-messages.js';
import { syncTodaysDueBoletos, checkPaymentStatusUpdates } from './asaas-auto-sync.js';
import { executeCRMAutomations } from './crm-automation-scheduler.js';
import { processEmailQueue } from './email-scheduler.js';
import { executeNurturing } from './nurturing-scheduler.js';
import { executeTaskReminders } from './task-reminder-scheduler.js';
import { executeSecretaryFollowups } from './secretary-followup-scheduler.js';
import { executeSecretaryDigest } from './secretary-digest-scheduler.js';
import { checkInactivityTimeouts } from './lib/ai-agent-processor.js';
import { requestContext } from './request-context.js';
import { log, logError } from './logger.js';

// dotenv already loaded via 'dotenv/config' import at top

const app = express();
const PORT = process.env.PORT || 3001;

// Add CORS headers to EVERY response (must be absolute first)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// CORS configuration - belt and suspenders
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request-scoped context + correlation id for structured logs
app.use((req, res, next) => {
  const startedAt = Date.now();
  const rawHeader = req.headers['x-request-id'];
  const incomingRequestId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const requestId = (incomingRequestId && String(incomingRequestId).trim()) || crypto.randomUUID();

  requestContext.run(
    {
      request_id: requestId,
      http_method: req.method,
      http_path: req.originalUrl,
    },
    () => {
      req.requestId = requestId;
      res.setHeader('X-Request-Id', requestId);

      log('info', 'http.request', {
        http_method: req.method,
        http_path: req.originalUrl,
      });

      res.on('finish', () => {
        log('info', 'http.response', {
          http_method: req.method,
          http_path: req.originalUrl,
          status_code: res.statusCode,
          duration_ms: Date.now() - startedAt,
        });
      });

      next();
    }
  );
});

// Serve uploaded files statically with CORS headers
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // Set correct MIME types for audio/video
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ogg') {
      res.setHeader('Content-Type', 'audio/ogg');
    } else if (ext === '.mp3') {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (ext === '.m4a') {
      res.setHeader('Content-Type', 'audio/mp4');
    } else if (ext === '.wav') {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (ext === '.aac') {
      res.setHeader('Content-Type', 'audio/aac');
    } else if (ext === '.mp4') {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (ext === '.webm') {
      // Many voice notes are stored as .webm; prefer audio/webm for broad compatibility
      res.setHeader('Content-Type', 'audio/webm');
    }
  }
}));


// ===========================
// Meta Cloud API Webhook (public - no auth)
// ===========================
import { query as dbQuery } from './db.js';

// GET: Meta webhook verification (hub.verify_token challenge)
app.get('/api/meta/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe' || !token) {
    return res.sendStatus(403);
  }

  try {
    // Find a Meta connection with this verify token
    const result = await dbQuery(
      `SELECT id FROM connections WHERE provider = 'meta' AND meta_webhook_verify_token = $1 LIMIT 1`,
      [token]
    );
    if (result.rows.length === 0) {
      console.log('[Meta Webhook] Verify token not found:', token);
      return res.sendStatus(403);
    }
    console.log('[Meta Webhook] Verification successful for connection:', result.rows[0].id);
    return res.status(200).send(challenge);
  } catch (err) {
    console.error('[Meta Webhook] Verification error:', err.message);
    return res.sendStatus(500);
  }
});

// In-memory buffer for Meta webhook debug (last 50 events)
const metaWebhookLog = [];
const MAX_META_LOG = 50;

function logMetaEvent(type, data) {
  metaWebhookLog.unshift({ type, data, timestamp: new Date().toISOString() });
  if (metaWebhookLog.length > MAX_META_LOG) metaWebhookLog.length = MAX_META_LOG;
}

// GET: Meta webhook debug log
app.get('/api/meta/webhook-log', async (req, res) => {
  res.json({ events: metaWebhookLog });
});

// POST: Meta webhook incoming messages
app.post('/api/meta/webhook', async (req, res) => {
  // Always respond 200 immediately to Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    
    logMetaEvent('received', {
      object: body?.object,
      entry_count: body?.entry?.length,
      entry_ids: body?.entry?.map(e => e.id),
      has_messages: body?.entry?.some(e => e.changes?.some(c => c.value?.messages?.length > 0)),
      has_statuses: body?.entry?.some(e => e.changes?.some(c => c.value?.statuses?.length > 0)),
      raw_fields: body?.entry?.flatMap(e => (e.changes || []).map(c => c.field)),
    });

    // Detailed logging for debugging
    console.log('[Meta Webhook] Received payload:', JSON.stringify({
      object: body?.object,
      entry_count: body?.entry?.length,
      entry_ids: body?.entry?.map(e => e.id),
    }));

    if (!body?.object || body.object !== 'whatsapp_business_account') {
      logMetaEvent('ignored', { reason: 'not_whatsapp_business_account', object: body?.object });
      console.log('[Meta Webhook] Ignored: object is not whatsapp_business_account:', body?.object);
      return;
    }

    for (const entry of (body.entry || [])) {
      const wabaId = entry.id; // This is the WABA ID from Meta
      
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        const displayPhone = value.metadata?.display_phone_number;
        
        console.log('[Meta Webhook] Processing change:', JSON.stringify({
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          display_phone: displayPhone,
          messages_count: value.messages?.length || 0,
          statuses_count: value.statuses?.length || 0,
          contacts: value.contacts?.map(c => ({ name: c.profile?.name, wa_id: c.wa_id })),
        }));

        if (!phoneNumberId) {
          console.log('[Meta Webhook] No phone_number_id in metadata, skipping');
          continue;
        }

        // Find the connection - try by phone_number_id first, then fallback to waba_id
        let connResult = await dbQuery(
          `SELECT * FROM connections WHERE provider = 'meta' AND meta_phone_number_id = $1 LIMIT 1`,
          [phoneNumberId]
        );
        
        // Fallback: match by WABA ID if phone_number_id doesn't match
        if (connResult.rows.length === 0 && wabaId) {
          console.log('[Meta Webhook] No match by phone_number_id, trying waba_id:', wabaId);
          connResult = await dbQuery(
            `SELECT * FROM connections WHERE provider = 'meta' AND meta_waba_id = $1 LIMIT 1`,
            [wabaId]
          );
          
          // Auto-update the phone_number_id if we found by waba_id
          if (connResult.rows.length > 0) {
            console.log('[Meta Webhook] Found by waba_id! Auto-updating meta_phone_number_id from', connResult.rows[0].meta_phone_number_id, 'to', phoneNumberId);
            await dbQuery(
              `UPDATE connections SET meta_phone_number_id = $1 WHERE id = $2`,
              [phoneNumberId, connResult.rows[0].id]
            );
          }
        }

        // Last resort: if only one meta connection exists, use it
        if (connResult.rows.length === 0) {
          console.log('[Meta Webhook] No match by phone_number_id or waba_id, trying single meta connection fallback');
          connResult = await dbQuery(
            `SELECT * FROM connections WHERE provider = 'meta' LIMIT 2`
          );
          if (connResult.rows.length === 1) {
            console.log('[Meta Webhook] Single meta connection found, auto-updating phone_number_id and waba_id');
            await dbQuery(
              `UPDATE connections SET meta_phone_number_id = $1, meta_waba_id = COALESCE(meta_waba_id, $2) WHERE id = $3`,
              [phoneNumberId, wabaId, connResult.rows[0].id]
            );
          } else {
            logMetaEvent('connection_not_found', { phone_number_id: phoneNumberId, waba_id: wabaId, meta_connections_count: connResult.rows.length });
            console.log('[Meta Webhook] Cannot determine connection. Found', connResult.rows.length, 'meta connections. phone_number_id:', phoneNumberId, 'waba_id:', wabaId);
            continue;
          }
        }

        const connection = connResult.rows[0];

        // Process incoming messages
        for (const message of (value.messages || [])) {
          try {
            const from = message.from; // sender phone
            const msgType = message.type;
            let content = '';
            let mediaUrl = null;
            let effectiveType = msgType;

            switch (msgType) {
              case 'text':
                content = message.text?.body || '';
                break;
              case 'image':
                content = message.image?.caption || '[Imagem]';
                mediaUrl = message.image?.id;
                break;
              case 'video':
                content = message.video?.caption || '[Vídeo]';
                mediaUrl = message.video?.id;
                break;
              case 'audio':
                content = '[Áudio]';
                mediaUrl = message.audio?.id;
                break;
              case 'document':
                content = message.document?.caption || message.document?.filename || '[Documento]';
                mediaUrl = message.document?.id;
                break;
              case 'sticker':
                content = '[Sticker]';
                mediaUrl = message.sticker?.id;
                break;
              case 'location':
                content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
                break;
              case 'contacts':
                content = `[Contato: ${message.contacts?.[0]?.name?.formatted_name || ''}]`;
                break;
              case 'reaction':
                content = message.reaction?.emoji || '👍';
                break;
              case 'interactive':
                // Replies to template buttons / list messages
                content = message.interactive?.button_reply?.title
                  || message.interactive?.list_reply?.title
                  || message.interactive?.list_reply?.description
                  || message.interactive?.nfm_reply?.body
                  || JSON.stringify(message.interactive || {});
                effectiveType = 'text';
                break;
              case 'button':
                // Quick-reply button responses
                content = message.button?.text || message.button?.payload || '[Botão]';
                effectiveType = 'text';
                break;
              case 'order':
                content = `[Pedido: ${message.order?.product_items?.length || 0} itens]`;
                break;
              default:
                content = `[${msgType}]`;
            }

            // Download media if needed
            let finalMediaUrl = null;
            let mediaMimetype = null;
            if (mediaUrl && connection.meta_token) {
              try {
                const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaUrl}`, {
                  headers: { Authorization: `Bearer ${connection.meta_token}` }
                });
                if (mediaInfoRes.ok) {
                  const mediaInfo = await mediaInfoRes.json();
                  finalMediaUrl = mediaInfo.url; // Temporary URL from Meta
                  mediaMimetype = mediaInfo.mime_type || null;
                }
              } catch (mediaErr) {
                console.error('[Meta Webhook] Media download error:', mediaErr.message);
              }
            }

            // Normalize phone
            const normalizedPhone = from.replace(/\D/g, '');
            const contactName = value.contacts?.[0]?.profile?.name || normalizedPhone;
            const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

            // Find or create conversation (using conversations table with contact_phone/remote_jid)
            let convResult = await dbQuery(
              `SELECT id FROM conversations 
               WHERE connection_id = $1 AND (contact_phone = $2 OR remote_jid = $3)
               LIMIT 1`,
              [connection.id, normalizedPhone, remoteJid]
            );

            if (convResult.rows.length === 0) {
              convResult = await dbQuery(
                `INSERT INTO conversations 
                  (connection_id, remote_jid, contact_phone, contact_name, is_archived, unread_count, attendance_status, created_at, updated_at, last_message_at)
                 VALUES ($1, $2, $3, $4, false, 0, 'waiting', NOW(), NOW(), NOW())
                 RETURNING id`,
                [connection.id, remoteJid, normalizedPhone, contactName]
              );
            }
            const conversationId = convResult.rows[0].id;

            // Save message to chat_messages (matching the schema used by the chat system)
            const messageId = message.id || `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await dbQuery(
              `INSERT INTO chat_messages 
                (conversation_id, message_id, from_me, content, message_type, media_url, media_mimetype, sender_name, sender_phone, status, timestamp)
               VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, 'received', NOW())
               ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id NOT LIKE 'temp_%' DO NOTHING`,
              [conversationId, messageId, content, effectiveType, finalMediaUrl, mediaMimetype, contactName, normalizedPhone]
            );

            // Update conversation
            await dbQuery(
              `UPDATE conversations SET last_message_at = NOW(), unread_count = unread_count + 1, updated_at = NOW(), 
               contact_name = COALESCE(NULLIF(contact_name, ''), $2)
               WHERE id = $1`,
              [conversationId, contactName]
            );

            // If conversation was finished, reopen to waiting
            await dbQuery(
              `UPDATE conversations SET attendance_status = 'waiting' 
               WHERE id = $1 AND attendance_status = 'finished'`,
              [conversationId]
            );

            logMetaEvent('message_saved', { type: msgType, effectiveType, from: normalizedPhone, conversationId, messageId });
            console.log(`[Meta Webhook] Message saved: ${msgType} (as ${effectiveType}) from ${normalizedPhone} in conversation ${conversationId}`);
          } catch (msgErr) {
            logMetaEvent('message_error', { error: msgErr.message, from: message?.from });
            console.error('[Meta Webhook] Error processing message:', msgErr.message);
          }
        }

        // Process status updates
        for (const status of (value.statuses || [])) {
          try {
            const wamid = status.id;
            const statusValue = status.status; // sent, delivered, read, failed
            
            if (statusValue === 'read') {
              await dbQuery(
                `UPDATE chat_messages SET status = 'read' WHERE message_id = $1 AND status != 'read'`,
                [wamid]
              );
            } else if (statusValue === 'delivered') {
              await dbQuery(
                `UPDATE chat_messages SET status = 'delivered' WHERE message_id = $1 AND status = 'sent'`,
                [wamid]
              );
            } else if (statusValue === 'sent') {
              await dbQuery(
                `UPDATE chat_messages SET status = 'sent' WHERE message_id = $1 AND status = 'pending'`,
                [wamid]
              );
            } else if (statusValue === 'failed') {
              await dbQuery(
                `UPDATE chat_messages SET status = 'failed' WHERE message_id = $1`,
                [wamid]
              );
            }
          } catch (statusErr) {
            console.error('[Meta Webhook] Error processing status:', statusErr.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Meta Webhook] General error:', error.message);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/asaas', asaasRoutes);
app.use('/api/admin', adminRoutes);
// Mount admin routes also at /api/public for public endpoints (pre-register, branding)
app.use('/api/public', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/evolution', evolutionRoutes);
app.use('/api/wapi', wapiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/quick-replies', quickRepliesRoutes);
app.use('/api/chatbots', chatbotsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/flows', flowsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/crm/automation', crmAutomationRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/billing-queue', billingQueueRoutes);
app.use('/api/transcribe-audio', transcribeRoutes);
app.use('/api/ai-agents', aiAgentsRoutes);
app.use('/api/external-forms', externalFormsRoutes);
app.use('/api/lead-distribution', leadDistributionRoutes);
app.use('/api/lead-webhooks', leadWebhooksRoutes);
app.use('/api/lead-scoring', leadScoringRoutes);
app.use('/api/conversation-summary', conversationSummaryRoutes);
app.use('/api/nurturing', nurturingRoutes);
app.use('/api/ctwa', ctwaAnalyticsRoutes);
app.use('/api/group-secretary', groupSecretaryRoutes);
app.use('/api/ghost', ghostRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/task-boards', taskBoardsRoutes);
app.use('/api/lead-gleego', leadGleegoRoutes);
app.use('/api/global-agents', globalAgentsRoutes);
app.use('/api/meta', metaTemplatesRoutes);
app.use('/api/doc-signatures', docSignaturesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint to check Google Calendar env vars
app.get('/api/debug/google-config', (req, res) => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  res.json({
    GOOGLE_CLIENT_ID: clientId ? `${clientId.substring(0, 15)}...` : 'NOT SET',
    GOOGLE_REDIRECT_URI: redirectUri || 'NOT SET (will use localhost fallback)',
    FRONTEND_URL: frontendUrl || 'NOT SET (will use localhost fallback)',
  });
});

// Global error handler with CORS headers
app.use((err, req, res, next) => {
  logError('http.unhandled_error', err, {
    status_code: err?.status || 500,
  });
  
  // Ensure CORS headers are set even on errors
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.requestId || null,
  });
});

// Initialize database and start server
initDatabase().then((ok) => {
  if (!ok) {
    console.error('🛑 Server not started because database initialization failed (critical step).');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Whatsale API running on port ${PORT}`);

    // Schedule billing notifications - runs every hour to check rules with matching send_time
    // Each rule has its own send_time, the scheduler only executes rules matching current hour
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ [CRON] Hourly notification check triggered at', new Date().toISOString());
      try {
        await executeNotifications();
      } catch (error) {
        console.error('⏰ [CRON] Error executing notifications:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // Schedule campaign messages - runs every 30 seconds to check for pending messages
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await executeCampaignMessages();
      } catch (error) {
        console.error('📤 [CRON] Error executing campaign messages:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // Schedule message sender - runs every minute to check for due scheduled messages
    cron.schedule('* * * * *', async () => {
      try {
        await executeScheduledMessages();
      } catch (error) {
        console.error('📅 [CRON] Error executing scheduled messages:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // ============================================
    // ASAAS AUTO-SYNC JOBS
    // ============================================

    // 02:00 AM - Sync today's due boletos from Asaas
    // This ensures all boletos that are due TODAY are in the local DB
    // before the notification rules run
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 [CRON] 2AM Asaas auto-sync triggered at', new Date().toISOString());
      try {
        await syncTodaysDueBoletos();
      } catch (error) {
        console.error('🌙 [CRON] Error in 2AM Asaas sync:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // 08:00 AM - Check payment status updates
    // This verifies if any PENDING/OVERDUE payments have been paid
    // and updates their status (catches missed webhooks)
    cron.schedule('0 8 * * *', async () => {
      console.log('☀️ [CRON] 8AM Asaas status check triggered at', new Date().toISOString());
      try {
        await checkPaymentStatusUpdates();
      } catch (error) {
        console.error('☀️ [CRON] Error in 8AM status check:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // ============================================
    // CRM FUNNEL AUTOMATION
    // ============================================

    // Schedule CRM automations - runs every 2 minutes to process flows and timeouts
    cron.schedule('*/2 * * * *', async () => {
      try {
        await executeCRMAutomations();
      } catch (error) {
        console.error('🤖 [CRON] Error executing CRM automations:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // ============================================
    // EMAIL QUEUE PROCESSOR
    // ============================================

    // Schedule email queue processing - runs every minute
    cron.schedule('* * * * *', async () => {
      try {
        await processEmailQueue();
      } catch (error) {
        console.error('📧 [CRON] Error processing email queue:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // ============================================
    // NURTURING SEQUENCES SCHEDULER
    // ============================================

    // Schedule nurturing sequences - runs every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      try {
        await executeNurturing();
      } catch (error) {
        console.error('🔄 [CRON] Error executing nurturing sequences:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // Schedule task reminders - runs every minute to check for due reminders
    cron.schedule('* * * * *', async () => {
      try {
        await executeTaskReminders();
      } catch (error) {
        console.error('⏰ [CRON] Error executing task reminders:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // Secretary follow-up - checks every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        await executeSecretaryFollowups();
      } catch (error) {
        console.error('📌 [CRON] Error executing secretary follow-ups:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    // Secretary daily digest - checks every hour (matches digest_hour config)
    cron.schedule('0 * * * *', async () => {
      try {
        await executeSecretaryDigest();
      } catch (error) {
        console.error('📊 [CRON] Error executing secretary digest:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });

    console.log('⏰ Notification scheduler started - checks every hour (timezone: America/Sao_Paulo)');
    console.log('📤 Campaign scheduler started - checks every 30 seconds');
    console.log('📅 Scheduled messages started - checks every minute');
    console.log('🌙 Asaas auto-sync started - runs at 2:00 AM daily');
    console.log('☀️ Asaas status check started - runs at 8:00 AM daily');
    console.log('🤖 CRM automation started - checks every 2 minutes');
    console.log('📧 Email queue processor started - checks every minute');
    console.log('🔄 Nurturing sequences started - checks every 2 minutes');
    console.log('⏰ Task reminders started - checks every minute');
    console.log('📌 Secretary follow-up started - checks every 30 minutes');
    console.log('📊 Secretary daily digest started - checks every hour');

    // AI Agent inactivity timeout - checks every minute
    cron.schedule('* * * * *', async () => {
      try {
        await checkInactivityTimeouts();
      } catch (error) {
        console.error('🤖 AI inactivity check error:', error.message);
      }
    });
    console.log('🤖 AI agent inactivity checker started - checks every minute');
  });
});
