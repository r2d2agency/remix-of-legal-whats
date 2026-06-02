import { query } from './db.js';
import * as whatsappProvider from './lib/whatsapp-provider.js';
import { generateGroupsNarrativeSummary } from './lib/group-secretary.js';

/**
 * Secretary Daily Digest Scheduler
 * Sends a daily summary of detections to the configured external number
 */
export async function executeSecretaryDigest({ organizationId = null, force = false } = {}) {
  try {
    const now = new Date();
    let configResult;
    if (force && organizationId) {
      configResult = await query(
        `SELECT * FROM group_secretary_config WHERE organization_id = $1`,
        [organizationId]
      );
    } else {
      const saoPauloTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(now);
      const currentHour = parseInt(saoPauloTime.find(p => p.type === 'hour').value);
      const currentMinute = parseInt(saoPauloTime.find(p => p.type === 'minute').value);
      configResult = await query(`
        SELECT * FROM group_secretary_config 
        WHERE is_active = true 
          AND daily_digest_enabled = true
          AND daily_digest_hour = $1
          AND COALESCE(daily_digest_minute, 0) = $2
          AND (notify_external_phone IS NOT NULL OR notify_members_whatsapp = true)
      `, [currentHour, currentMinute]);
    }

    if (configResult.rows.length === 0) {
      return { sent: 0, reason: 'no_config' };
    }

    let sentCount = 0;
    let lastError = null;

    for (const config of configResult.rows) {
      try {
        // Get yesterday's detections
        const logsResult = await query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN matched_user_id IS NOT NULL THEN 1 END) as matched,
            COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
            COUNT(CASE WHEN sentiment IN ('negative', 'urgent_negative') THEN 1 END) as negative_sentiment
          FROM group_secretary_logs 
          WHERE organization_id = $1 
            AND created_at >= NOW() - INTERVAL '24 hours'
        `, [config.organization_id]);

        const stats = logsResult.rows[0];
        if (parseInt(stats.total) === 0 && !force) continue;

        // Get pending tasks from secretary
        const pendingResult = await query(`
          SELECT COUNT(*) as pending
          FROM crm_tasks 
          WHERE organization_id = $1 
            AND source = 'group_secretary' 
            AND status = 'pending'
        `, [config.organization_id]);

        const pending = parseInt(pendingResult.rows[0]?.pending || 0);

        // Get top members by requests
        const topMembersResult = await query(`
          SELECT matched_user_name, COUNT(*) as count
          FROM group_secretary_logs 
          WHERE organization_id = $1 
            AND created_at >= NOW() - INTERVAL '24 hours'
            AND matched_user_name IS NOT NULL
          GROUP BY matched_user_name
          ORDER BY count DESC
          LIMIT 5
        `, [config.organization_id]);

        const topMembers = topMembersResult.rows
          .map(r => `  • ${r.matched_user_name}: ${r.count} solicitações`)
          .join('\n');

        const headerMessage = `📊 *Resumo Diário - Secretária IA*\n` +
          `📅 ${now.toLocaleDateString('pt-BR')}\n\n` +
          `📌 *Detecções (24h):* ${stats.total}\n` +
          `✅ *Com responsável:* ${stats.matched}\n` +
          `🔴 *Urgentes:* ${stats.urgent}\n` +
          `🟠 *Alta prioridade:* ${stats.high_priority}\n` +
          `😠 *Sentimento negativo:* ${stats.negative_sentiment}\n` +
          `⏳ *Tarefas pendentes:* ${pending}\n` +
          (topMembers ? `\n👥 *Mais demandados:*\n${topMembers}` : '');

        // Generate full narrative summary per group (AI)
        let narrativeSection = '';
        try {
          const narrative = await generateGroupsNarrativeSummary({
            organizationId: config.organization_id,
            hours: 24,
            maxGroups: 8,
          });
          if (narrative?.groups && narrative.groups.length > 0) {
            narrativeSection = '\n\n━━━━━━━━━━━━━━━━━━\n📝 *Resumo Detalhado por Grupo*\n━━━━━━━━━━━━━━━━━━';
            for (const g of narrative.groups) {
              let block = `\n\n*📍 ${g.groupName}*`;
              block += `\n_${g.messageCount} mensagens • ${g.participants.length} participantes_\n`;
              if (g.summary) block += `\n${g.summary}`;
              if (g.key_points?.length) {
                block += `\n\n*Pontos-chave:*\n` + g.key_points.map(p => `• ${p}`).join('\n');
              }
              if (g.decisions?.length) {
                block += `\n\n*Decisões:*\n` + g.decisions.map(d => `✅ ${d}`).join('\n');
              }
              if (g.action_items?.length) {
                block += `\n\n*Ações:*\n` + g.action_items.map(a => {
                  const resp = a.responsible ? ` — _${a.responsible}_` : '';
                  const dl = a.deadline ? ` (${a.deadline})` : '';
                  return `🎯 ${a.task}${resp}${dl}`;
                }).join('\n');
              }
              if (g.highlights?.length) {
                block += `\n\n*Destaques:*\n` + g.highlights.map(h => `💬 ${h}`).join('\n');
              }
              narrativeSection += block;
            }
          } else if (narrative?.error === 'no_ai_config') {
            narrativeSection = '\n\n_⚠️ Configure a IA da organização para receber o resumo narrativo dos grupos._';
          }
        } catch (narrErr) {
          console.error('📊 [DIGEST] Narrative error:', narrErr.message);
        }

        const fullMessage = headerMessage + narrativeSection + `\n\n_Acesse o sistema para mais detalhes._`;

        // Send to external phone
        if (config.notify_external_phone) {
          const connection = await getDigestConnection(config);
          if (connection) {
            const phone = config.notify_external_phone.replace(/\D/g, '');
            if (phone) {
              // WhatsApp limit ~4096 chars; split into chunks if needed
              const chunks = splitMessage(fullMessage, 3500);
              for (let i = 0; i < chunks.length; i++) {
                const part = chunks.length > 1 ? `*[Parte ${i + 1}/${chunks.length}]*\n\n${chunks[i]}` : chunks[i];
                await whatsappProvider.sendMessage(connection, phone, part, 'text', null);
                if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1500));
              }
              console.log(`📊 [DIGEST] Sent daily digest to ${phone} for org ${config.organization_id}`);
              sentCount++;
            }
          } else {
            lastError = 'no_connected_connection';
          }
        } else {
          lastError = 'no_external_phone';
        }
      } catch (orgErr) {
        console.error(`📊 [DIGEST] Error for org ${config.organization_id}:`, orgErr.message);
        lastError = orgErr.message;
      }
    }
    return { sent: sentCount, error: lastError };
  } catch (error) {
    console.error('📊 [DIGEST] Error:', error);
    return { sent: 0, error: error.message };
  }
}

async function getDigestConnection(config) {
  try {
    if (config.default_connection_id) {
      const result = await query(
        `SELECT * FROM connections WHERE id = $1 AND status = 'connected'`,
        [config.default_connection_id]
      );
      if (result.rows.length > 0) return result.rows[0];
    }
    const result = await query(
      `SELECT * FROM connections WHERE organization_id = $1 AND status = 'connected' ORDER BY created_at ASC LIMIT 1`,
      [config.organization_id]
    );
    return result.rows[0] || null;
  } catch { return null; }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const paragraphs = text.split('\n');
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n' + p).length > maxLen && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + '\n' + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
