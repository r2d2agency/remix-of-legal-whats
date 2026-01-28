import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import * as whatsappProvider from '../lib/whatsapp-provider.js';

const router = Router();

// Helper to send message
async function sendWhatsAppText(connection, phone, message) {
  try {
    const result = await whatsappProvider.sendMessage(connection, phone, message, 'text');
    return result?.success === true;
  } catch (error) {
    console.error('WhatsApp sendMessage error:', error);
    return false;
  }
}

// Replace message variables
function replaceVariables(template, payment, customer) {
  const dueDate = new Date(payment.due_date);
  const formattedDate = dueDate.toLocaleDateString('pt-BR');
  const formattedValue = Number(payment.value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  return template
    .replace(/\{\{nome\}\}/gi, customer.name || 'Cliente')
    .replace(/\{\{valor\}\}/gi, formattedValue)
    .replace(/\{\{vencimento\}\}/gi, formattedDate)
    .replace(/\{\{link\}\}/gi, payment.invoice_url || payment.payment_link || '')
    .replace(/\{\{boleto\}\}/gi, payment.bank_slip_url || '')
    .replace(/\{\{pix\}\}/gi, payment.pix_copy_paste || '')
    .replace(/\{\{descricao\}\}/gi, payment.description || '');
}

// ============================================
// GERAR FILA DO DIA
// ============================================

// GET /queue/:organizationId/batches - Lista todos os lotes
router.get('/batches/:organizationId', authenticate, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status, date } = req.query;

    let queryText = `
      SELECT 
        b.*,
        r.name as rule_name,
        r.trigger_type,
        r.message_template,
        c.name as connection_name,
        c.status as connection_status
      FROM billing_queue_batches b
      LEFT JOIN billing_notification_rules r ON r.id = b.rule_id
      LEFT JOIN connections c ON c.id = b.connection_id
      WHERE b.organization_id = $1
    `;
    const params = [organizationId];
    let idx = 2;

    if (status) {
      queryText += ` AND b.status = $${idx++}`;
      params.push(status);
    }

    if (date) {
      queryText += ` AND b.queue_date = $${idx++}`;
      params.push(date);
    }

    queryText += ` ORDER BY b.queue_date DESC, b.created_at DESC LIMIT 50`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Erro ao buscar lotes' });
  }
});

// GET /queue/:organizationId/batch/:batchId - Detalhes de um lote
router.get('/batch/:organizationId/:batchId', authenticate, async (req, res) => {
  try {
    const { organizationId, batchId } = req.params;

    const batchResult = await query(`
      SELECT 
        b.*,
        r.name as rule_name,
        r.trigger_type,
        r.message_template,
        c.name as connection_name,
        c.status as connection_status
      FROM billing_queue_batches b
      LEFT JOIN billing_notification_rules r ON r.id = b.rule_id
      LEFT JOIN connections c ON c.id = b.connection_id
      WHERE b.id = $1 AND b.organization_id = $2
    `, [batchId, organizationId]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lote não encontrado' });
    }

    const itemsResult = await query(`
      SELECT * FROM billing_queue_items
      WHERE batch_id = $1
      ORDER BY position ASC
    `, [batchId]);

    res.json({
      batch: batchResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({ error: 'Erro ao buscar lote' });
  }
});

// POST /queue/:organizationId/generate - Gerar fila do dia
router.post('/generate/:organizationId', authenticate, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { rule_id, date, name } = req.body;

    // Buscar a regra
    const ruleResult = await query(`
      SELECT r.*, c.id as connection_id, c.name as connection_name
      FROM billing_notification_rules r
      LEFT JOIN connections c ON c.id = r.connection_id
      WHERE r.id = $1 AND r.organization_id = $2
    `, [rule_id, organizationId]);

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Regra não encontrada' });
    }

    const rule = ruleResult.rows[0];
    const queueDate = date || new Date().toISOString().split('T')[0];

    // Buscar pagamentos elegíveis baseado no tipo de regra
    let paymentsQuery;
    let paymentsParams = [organizationId];

    const today = new Date(queueDate);

    if (rule.trigger_type === 'on_due') {
      // Vencimento hoje
      paymentsQuery = `
        SELECT 
          p.id as payment_id,
          p.customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          p.value as payment_value,
          p.due_date,
          p.description,
          p.invoice_url,
          p.payment_link,
          p.bank_slip_url
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status IN ('PENDING', 'OVERDUE')
          AND p.due_date = $2::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL
          AND c.phone != ''
        ORDER BY c.name
      `;
      paymentsParams.push(queueDate);
    } else if (rule.trigger_type === 'before_due') {
      // X dias antes do vencimento
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + rule.days_offset);
      
      paymentsQuery = `
        SELECT 
          p.id as payment_id,
          p.customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          p.value as payment_value,
          p.due_date,
          p.description,
          p.invoice_url,
          p.payment_link,
          p.bank_slip_url
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status = 'PENDING'
          AND p.due_date = $2::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL
          AND c.phone != ''
        ORDER BY c.name
      `;
      paymentsParams.push(targetDate.toISOString().split('T')[0]);
    } else if (rule.trigger_type === 'after_due') {
      // Vencidos entre X e Y dias
      const minDays = rule.days_offset || 1;
      const maxDays = rule.max_days_overdue || minDays;
      
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - maxDays);
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() - minDays);
      
      paymentsQuery = `
        SELECT 
          p.id as payment_id,
          p.customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          p.value as payment_value,
          p.due_date,
          p.description,
          p.invoice_url,
          p.payment_link,
          p.bank_slip_url
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status = 'OVERDUE'
          AND p.due_date BETWEEN $2::date AND $3::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL
          AND c.phone != ''
        ORDER BY p.due_date ASC, c.name
      `;
      paymentsParams.push(fromDate.toISOString().split('T')[0]);
      paymentsParams.push(toDate.toISOString().split('T')[0]);
    }

    const paymentsResult = await query(paymentsQuery, paymentsParams);
    const payments = paymentsResult.rows;

    if (payments.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Nenhum pagamento encontrado para esta regra/data',
        batch: null,
        items_count: 0
      });
    }

    // Calcular total
    const totalValue = payments.reduce((sum, p) => sum + Number(p.payment_value), 0);

    // Criar o lote
    const batchName = name || `${rule.name} - ${new Date(queueDate).toLocaleDateString('pt-BR')}`;
    
    const batchResult = await query(`
      INSERT INTO billing_queue_batches (
        organization_id, rule_id, connection_id, name, queue_date,
        total_items, total_value, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organizationId,
      rule_id,
      rule.connection_id,
      batchName,
      queueDate,
      payments.length,
      totalValue,
      req.user?.id || null
    ]);

    const batch = batchResult.rows[0];

    // Inserir itens na fila
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      await query(`
        INSERT INTO billing_queue_items (
          batch_id, organization_id, payment_id, customer_id,
          customer_name, customer_phone, payment_value, due_date, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        batch.id,
        organizationId,
        p.payment_id,
        p.customer_id,
        p.customer_name,
        p.customer_phone,
        p.payment_value,
        p.due_date,
        i + 1
      ]);
    }

    res.json({
      success: true,
      batch: {
        ...batch,
        rule_name: rule.name,
        connection_name: rule.connection_name
      },
      items_count: payments.length,
      total_value: totalValue
    });
  } catch (error) {
    console.error('Generate queue error:', error);
    res.status(500).json({ error: 'Erro ao gerar fila' });
  }
});

// POST /queue/:organizationId/schedule/:batchId - Agendar envio
router.post('/schedule/:organizationId/:batchId', authenticate, async (req, res) => {
  try {
    const { organizationId, batchId } = req.params;
    const { 
      start_time, 
      interval_mode = 'fixed', 
      interval_seconds = 240,
      interval_min_seconds,
      interval_max_seconds
    } = req.body;

    // Verificar lote
    const batchResult = await query(`
      SELECT * FROM billing_queue_batches
      WHERE id = $1 AND organization_id = $2
    `, [batchId, organizationId]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lote não encontrado' });
    }

    const batch = batchResult.rows[0];

    if (batch.status !== 'pending') {
      return res.status(400).json({ error: 'Este lote não pode ser agendado (status atual: ' + batch.status + ')' });
    }

    // Buscar itens
    const itemsResult = await query(`
      SELECT id, position FROM billing_queue_items
      WHERE batch_id = $1 ORDER BY position
    `, [batchId]);

    const items = itemsResult.rows;
    
    // Calcular horários de envio
    const [hours, minutes] = (start_time || '09:00').split(':').map(Number);
    const baseTime = new Date();
    baseTime.setHours(hours, minutes, 0, 0);

    let currentTime = new Date(baseTime);
    
    for (const item of items) {
      await query(`
        UPDATE billing_queue_items 
        SET scheduled_for = $1
        WHERE id = $2
      `, [currentTime.toISOString(), item.id]);

      // Calcular próximo intervalo
      let interval;
      if (interval_mode === 'random' && interval_min_seconds && interval_max_seconds) {
        interval = Math.floor(Math.random() * (interval_max_seconds - interval_min_seconds + 1)) + interval_min_seconds;
      } else {
        interval = interval_seconds;
      }
      
      currentTime = new Date(currentTime.getTime() + interval * 1000);
    }

    // Calcular tempo estimado de conclusão
    const endTime = new Date(currentTime);

    // Atualizar lote
    await query(`
      UPDATE billing_queue_batches
      SET 
        status = 'scheduled',
        start_time = $1,
        interval_mode = $2,
        interval_seconds = $3,
        interval_min_seconds = $4,
        interval_max_seconds = $5,
        next_send_at = $6
      WHERE id = $7
    `, [
      start_time,
      interval_mode,
      interval_seconds,
      interval_min_seconds,
      interval_max_seconds,
      baseTime.toISOString(),
      batchId
    ]);

    res.json({
      success: true,
      start_time,
      estimated_end_time: endTime.toISOString(),
      total_duration_minutes: Math.round((endTime.getTime() - baseTime.getTime()) / 60000)
    });
  } catch (error) {
    console.error('Schedule queue error:', error);
    res.status(500).json({ error: 'Erro ao agendar fila' });
  }
});

// POST /queue/:organizationId/start/:batchId - Iniciar envio imediato
router.post('/start/:organizationId/:batchId', authenticate, async (req, res) => {
  try {
    const { organizationId, batchId } = req.params;

    // Buscar lote com conexão
    const batchResult = await query(`
      SELECT 
        b.*,
        r.message_template,
        c.id as connection_id,
        c.name as connection_name,
        c.provider as connection_provider,
        c.api_url,
        c.api_key,
        c.instance_name,
        c.instance_id as connection_instance_id,
        c.wapi_token as connection_wapi_token,
        c.status as connection_status
      FROM billing_queue_batches b
      LEFT JOIN billing_notification_rules r ON r.id = b.rule_id
      LEFT JOIN connections c ON c.id = b.connection_id
      WHERE b.id = $1 AND b.organization_id = $2
    `, [batchId, organizationId]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lote não encontrado' });
    }

    const batch = batchResult.rows[0];

    if (!batch.connection_id) {
      return res.status(400).json({ error: 'Lote sem conexão WhatsApp configurada' });
    }

    // Montar objeto connection
    const connection = {
      id: batch.connection_id,
      provider: batch.connection_provider,
      api_url: batch.api_url,
      api_key: batch.api_key,
      instance_name: batch.instance_name,
      instance_id: batch.connection_instance_id,
      wapi_token: batch.connection_wapi_token
    };

    // Atualizar status do lote
    await query(`
      UPDATE billing_queue_batches
      SET status = 'running', started_at = NOW()
      WHERE id = $1
    `, [batchId]);

    // Buscar itens pendentes
    const itemsResult = await query(`
      SELECT 
        i.*,
        p.invoice_url,
        p.payment_link,
        p.bank_slip_url,
        p.description
      FROM billing_queue_items i
      JOIN asaas_payments p ON p.id = i.payment_id
      WHERE i.batch_id = $1 AND i.status = 'pending'
      ORDER BY i.position
    `, [batchId]);

    const items = itemsResult.rows;
    let sent = 0;
    let failed = 0;

    // Processar cada item
    for (const item of items) {
      try {
        // Marcar como enviando
        await query(`UPDATE billing_queue_items SET status = 'sending' WHERE id = $1`, [item.id]);

        // Preparar mensagem
        const message = replaceVariables(batch.message_template || '', {
          due_date: item.due_date,
          value: item.payment_value,
          invoice_url: item.invoice_url,
          payment_link: item.payment_link,
          bank_slip_url: item.bank_slip_url,
          description: item.description
        }, {
          name: item.customer_name
        });

        // Enviar
        const success = await sendWhatsAppText(connection, item.customer_phone, message);

        if (success) {
          await query(`
            UPDATE billing_queue_items 
            SET status = 'sent', sent_at = NOW()
            WHERE id = $1
          `, [item.id]);
          sent++;
        } else {
          await query(`
            UPDATE billing_queue_items 
            SET status = 'failed', error_message = 'Falha no envio'
            WHERE id = $1
          `, [item.id]);
          failed++;
        }

        // Atualizar contadores do lote
        await query(`
          UPDATE billing_queue_batches
          SET sent_count = sent_count + $1, failed_count = failed_count + $2
          WHERE id = $3
        `, [success ? 1 : 0, success ? 0 : 1, batchId]);

        // Delay entre mensagens (usar config do lote ou padrão 4 min)
        const delay = batch.interval_seconds || 240;
        if (items.indexOf(item) < items.length - 1) {
          await new Promise(r => setTimeout(r, delay * 1000));
        }
      } catch (itemError) {
        console.error(`Error sending item ${item.id}:`, itemError);
        await query(`
          UPDATE billing_queue_items 
          SET status = 'failed', error_message = $1
          WHERE id = $2
        `, [itemError.message, item.id]);
        failed++;
      }
    }

    // Finalizar lote
    await query(`
      UPDATE billing_queue_batches
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [batchId]);

    res.json({
      success: true,
      sent,
      failed,
      total: items.length
    });
  } catch (error) {
    console.error('Start queue error:', error);
    res.status(500).json({ error: 'Erro ao iniciar fila' });
  }
});

// POST /queue/:organizationId/cancel/:batchId - Cancelar lote
router.post('/cancel/:organizationId/:batchId', authenticate, async (req, res) => {
  try {
    const { organizationId, batchId } = req.params;

    const result = await query(`
      UPDATE billing_queue_batches
      SET status = 'cancelled'
      WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'scheduled')
      RETURNING *
    `, [batchId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Lote não pode ser cancelado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel queue error:', error);
    res.status(500).json({ error: 'Erro ao cancelar lote' });
  }
});

// DELETE /queue/:organizationId/batch/:batchId - Excluir lote
router.delete('/batch/:organizationId/:batchId', authenticate, async (req, res) => {
  try {
    const { organizationId, batchId } = req.params;

    await query(`DELETE FROM billing_queue_batches WHERE id = $1 AND organization_id = $2`, [batchId, organizationId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Erro ao excluir lote' });
  }
});

// GET /queue/:organizationId/preview - Preview de cobranças elegíveis
router.get('/preview/:organizationId', authenticate, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { rule_id, date } = req.query;

    if (!rule_id) {
      return res.status(400).json({ error: 'rule_id é obrigatório' });
    }

    // Buscar a regra
    const ruleResult = await query(`
      SELECT * FROM billing_notification_rules
      WHERE id = $1 AND organization_id = $2
    `, [rule_id, organizationId]);

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Regra não encontrada' });
    }

    const rule = ruleResult.rows[0];
    const queueDate = date || new Date().toISOString().split('T')[0];
    const today = new Date(queueDate);

    let paymentsQuery;
    let paymentsParams = [organizationId];

    if (rule.trigger_type === 'on_due') {
      paymentsQuery = `
        SELECT 
          p.id, c.name as customer_name, c.phone as customer_phone,
          p.value, p.due_date, p.status, p.description
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status IN ('PENDING', 'OVERDUE')
          AND p.due_date = $2::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL AND c.phone != ''
        ORDER BY c.name
        LIMIT 100
      `;
      paymentsParams.push(queueDate);
    } else if (rule.trigger_type === 'before_due') {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + rule.days_offset);
      
      paymentsQuery = `
        SELECT 
          p.id, c.name as customer_name, c.phone as customer_phone,
          p.value, p.due_date, p.status, p.description
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status = 'PENDING'
          AND p.due_date = $2::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL AND c.phone != ''
        ORDER BY c.name
        LIMIT 100
      `;
      paymentsParams.push(targetDate.toISOString().split('T')[0]);
    } else if (rule.trigger_type === 'after_due') {
      const minDays = rule.days_offset || 1;
      const maxDays = rule.max_days_overdue || minDays;
      
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - maxDays);
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() - minDays);
      
      paymentsQuery = `
        SELECT 
          p.id, c.name as customer_name, c.phone as customer_phone,
          p.value, p.due_date, p.status, p.description
        FROM asaas_payments p
        JOIN asaas_customers c ON c.id = p.customer_id
        WHERE p.organization_id = $1
          AND p.status = 'OVERDUE'
          AND p.due_date BETWEEN $2::date AND $3::date
          AND c.is_blacklisted = false
          AND c.billing_paused = false
          AND c.phone IS NOT NULL AND c.phone != ''
        ORDER BY p.due_date ASC, c.name
        LIMIT 100
      `;
      paymentsParams.push(fromDate.toISOString().split('T')[0]);
      paymentsParams.push(toDate.toISOString().split('T')[0]);
    }

    const result = await query(paymentsQuery, paymentsParams);
    const totalValue = result.rows.reduce((sum, p) => sum + Number(p.value), 0);

    res.json({
      rule,
      date: queueDate,
      payments: result.rows,
      total_count: result.rows.length,
      total_value: totalValue
    });
  } catch (error) {
    console.error('Preview queue error:', error);
    res.status(500).json({ error: 'Erro ao gerar preview' });
  }
});

export default router;
