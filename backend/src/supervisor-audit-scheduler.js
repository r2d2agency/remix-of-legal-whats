import { query } from './db.js';
import { logInfo, logError } from './logger.js';

export async function executeDailyAudit() {
  logInfo('[Supervisor] Starting daily audit...');
  try {
    // Get all open deals
    const deals = await query(`
      SELECT d.*, s.new_lead_sla_minutes, s.no_followup_sla_hours, s.no_response_sla_days
      FROM crm_deals d
      JOIN supervisor_settings s ON s.organization_id = d.organization_id
      WHERE d.status = 'open'
    `);

    for (const deal of deals.rows) {
      const findings = [];
      
      // 1. Check No Approach
      if (!deal.first_seller_message_at) {
        const diffMin = (new Date() - new Date(deal.created_at)) / 60000;
        if (diffMin > (deal.new_lead_sla_minutes || 30)) {
          findings.push({
            status: 'sem_abordagem',
            reason: `Lead entrou em ${new Date(deal.created_at).toLocaleString()} e não recebeu abordagem.`,
            action: 'Entrar em contato imediatamente.',
            urgency: 'high'
          });
        }
      }

      // 2. Check No Follow-up
      if (deal.next_followup_at && new Date(deal.next_followup_at) < new Date()) {
        findings.push({
          status: 'followup_atrasado',
          reason: `Follow-up agendado para ${new Date(deal.next_followup_at).toLocaleString()} está atrasado.`,
          action: 'Realizar follow-up agora.',
          urgency: 'medium'
        });
      }

      // 3. Check No Response from Seller (Lead waiting)
      if (deal.last_customer_message_at && deal.last_seller_message_at && 
          new Date(deal.last_customer_message_at) > new Date(deal.last_seller_message_at)) {
        findings.push({
          status: 'aguardando_retorno',
          reason: `Cliente respondeu em ${new Date(deal.last_customer_message_at).toLocaleString()} e aguarda retorno.`,
          action: 'Responder ao cliente.',
          urgency: 'high'
        });
      }

      // Record findings
      for (const finding of findings) {
        await query(
          `INSERT INTO supervisor_audits (
            organization_id, deal_id, owner_id, status_found, reason, suggested_action, urgency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [deal.organization_id, deal.id, deal.owner_id, finding.status, finding.reason, finding.action, finding.urgency]
        );
      }
    }

    logInfo(`[Supervisor] Daily audit complete. Processed ${deals.rows.length} deals.`);
  } catch (error) {
    logError('[Supervisor] Daily audit failed', error);
  }
}
