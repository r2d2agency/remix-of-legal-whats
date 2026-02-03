import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

// Helper: Get user's organization
async function getUserOrg(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role 
     FROM organization_members om 
     WHERE om.user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

// Helper: Check if user can manage (admin/owner/manager)
function canManage(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}

// ============================================
// PUBLIC WEBHOOK ENDPOINT (no auth required)
// ============================================

router.post('/receive/:token', async (req, res) => {
  const { token } = req.params;
  const sourceIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // Find webhook by token
    const webhookResult = await query(
      `SELECT w.*, o.name as org_name
       FROM lead_webhooks w
       JOIN organizations o ON o.id = w.organization_id
       WHERE w.webhook_token = $1 AND w.is_active = true`,
      [token]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado ou inativo' });
    }

    const webhook = webhookResult.rows[0];
    const payload = req.body;

    // Log the incoming request
    logInfo(`[Lead Webhook] Received lead for webhook ${webhook.name}`, { 
      webhookId: webhook.id,
      payload: JSON.stringify(payload).slice(0, 500)
    });

    // Apply field mapping
    const fieldMapping = webhook.field_mapping || {};
    const mappedData = {
      name: '',
      email: '',
      phone: '',
      company_name: '',
      value: webhook.default_value || 0,
      description: '',
      custom_fields: {}
    };

    // Extract data using field mapping
    for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
      const value = getNestedValue(payload, sourceField);
      if (value !== undefined && value !== null) {
        if (targetField === 'custom_fields') {
          mappedData.custom_fields[sourceField] = value;
        } else if (targetField in mappedData) {
          mappedData[targetField] = value;
        }
      }
    }

    // Fallback: try common field names if mapping doesn't provide required fields
    if (!mappedData.name) {
      mappedData.name = payload.name || payload.full_name || payload.nome || 
                        payload.firstName || payload.first_name ||
                        `${payload.first_name || ''} ${payload.last_name || ''}`.trim() ||
                        'Lead sem nome';
    }
    if (!mappedData.email) {
      mappedData.email = payload.email || payload.email_address || payload.e_mail || '';
    }
    if (!mappedData.phone) {
      mappedData.phone = payload.phone || payload.telefone || payload.whatsapp || 
                         payload.phone_number || payload.cellphone || payload.celular || '';
    }
    if (!mappedData.company_name) {
      mappedData.company_name = payload.company || payload.empresa || payload.company_name || '';
    }

    // Clean phone number
    const cleanPhone = mappedData.phone.toString().replace(/\D/g, '');

    let dealId = null;
    let prospectId = null;
    let responseMessage = 'Lead recebido com sucesso';

    // Create deal if funnel and stage are configured
    if (webhook.funnel_id && webhook.stage_id) {
      // Ensure company exists or use default
      let companyId = null;
      
      if (mappedData.company_name) {
        // Try to find existing company
        const companyResult = await query(
          `SELECT id FROM crm_companies 
           WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
           LIMIT 1`,
          [webhook.organization_id, mappedData.company_name]
        );
        
        if (companyResult.rows.length > 0) {
          companyId = companyResult.rows[0].id;
        } else {
          // Create new company
          const newCompany = await query(
            `INSERT INTO crm_companies (organization_id, name, email, phone, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [webhook.organization_id, mappedData.company_name, mappedData.email, cleanPhone, webhook.created_by]
          );
          companyId = newCompany.rows[0].id;
        }
      } else {
        // Use default company
        const defaultCompany = await query(
          `SELECT id FROM crm_companies 
           WHERE organization_id = $1 AND name = 'Sem empresa'
           LIMIT 1`,
          [webhook.organization_id]
        );
        
        if (defaultCompany.rows.length > 0) {
          companyId = defaultCompany.rows[0].id;
        } else {
          const newDefault = await query(
            `INSERT INTO crm_companies (organization_id, name, created_by)
             VALUES ($1, 'Sem empresa', $2)
             RETURNING id`,
            [webhook.organization_id, webhook.created_by]
          );
          companyId = newDefault.rows[0].id;
        }
      }

      // Build description
      const description = buildDescription(mappedData, payload, webhook.name);

      // Determine owner - use distribution if enabled, otherwise default owner
      let assignedOwnerId = webhook.owner_id || webhook.created_by;
      let assignedUserName = null;

      if (webhook.distribution_enabled) {
        const distributedUser = await getNextDistributedUser(webhook.id);
        if (distributedUser) {
          assignedOwnerId = distributedUser.user_id;
          assignedUserName = distributedUser.user_name;
          logInfo(`[Lead Webhook] Distributed to user ${assignedUserName}`, { 
            webhookId: webhook.id, 
            userId: assignedOwnerId 
          });
        }
      }

      // Create deal
      const dealResult = await query(
        `INSERT INTO crm_deals (
           organization_id, funnel_id, stage_id, company_id,
           title, value, probability, status, description,
           owner_id, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10)
         RETURNING id`,
        [
          webhook.organization_id,
          webhook.funnel_id,
          webhook.stage_id,
          companyId,
          `Lead: ${mappedData.name}`,
          mappedData.value || 0,
          webhook.default_probability || 10,
          description,
          assignedOwnerId,
          webhook.created_by
        ]
      );
      
      dealId = dealResult.rows[0].id;

      // Create contact if phone provided
      if (cleanPhone) {
        // Check if contact exists
        let contactResult = await query(
          `SELECT id FROM contacts 
           WHERE organization_id = $1 AND phone = $2
           LIMIT 1`,
          [webhook.organization_id, cleanPhone]
        );

        let contactId;
        if (contactResult.rows.length > 0) {
          contactId = contactResult.rows[0].id;
        } else {
          // Create contact
          const newContact = await query(
            `INSERT INTO contacts (organization_id, name, phone, email, source)
             VALUES ($1, $2, $3, $4, 'webhook')
             RETURNING id`,
            [webhook.organization_id, mappedData.name, cleanPhone, mappedData.email]
          );
          contactId = newContact.rows[0].id;
        }

        // Link contact to deal
        await query(
          `INSERT INTO crm_deal_contacts (deal_id, contact_id, is_primary)
           VALUES ($1, $2, true)
           ON CONFLICT (deal_id, contact_id) DO NOTHING`,
          [dealId, contactId]
        );
      }

      // Log deal creation
      await query(
        `INSERT INTO crm_deal_history (deal_id, user_id, action, to_value)
         VALUES ($1, $2, 'created', $3)`,
        [dealId, webhook.owner_id || webhook.created_by, `Via webhook: ${webhook.name}`]
      );

      responseMessage = `Lead criado como negociação: ${dealId}`;
    } else {
      // Create as prospect if no funnel configured
      const prospectResult = await query(
        `INSERT INTO crm_prospects (
           organization_id, name, email, phone, company_name, source, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          webhook.organization_id,
          mappedData.name,
          mappedData.email,
          cleanPhone,
          mappedData.company_name,
          `Webhook: ${webhook.name}`,
          buildDescription(mappedData, payload, webhook.name),
          webhook.created_by
        ]
      );
      prospectId = prospectResult.rows[0].id;
      responseMessage = `Lead criado como prospect: ${prospectId}`;
    }

    // Update webhook stats
    await query(
      `UPDATE lead_webhooks 
       SET total_leads = total_leads + 1, last_lead_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [webhook.id]
    );

    // Log the request
    await query(
      `INSERT INTO lead_webhook_logs (webhook_id, request_body, response_status, response_message, deal_id, prospect_id, source_ip, user_agent)
       VALUES ($1, $2, 200, $3, $4, $5, $6, $7)`,
      [webhook.id, JSON.stringify(payload), responseMessage, dealId, prospectId, sourceIp, userAgent]
    );

    logInfo(`[Lead Webhook] Successfully processed lead`, { 
      webhookId: webhook.id, 
      dealId, 
      prospectId 
    });

    res.json({ 
      success: true, 
      message: responseMessage,
      deal_id: dealId,
      prospect_id: prospectId
    });

  } catch (error) {
    logError('[Lead Webhook] Error processing lead', error);

    // Try to log the error
    try {
      const webhookResult = await query(
        `SELECT id FROM lead_webhooks WHERE webhook_token = $1`,
        [token]
      );
      if (webhookResult.rows[0]) {
        await query(
          `INSERT INTO lead_webhook_logs (webhook_id, request_body, response_status, response_message, source_ip, user_agent)
           VALUES ($1, $2, 500, $3, $4, $5)`,
          [webhookResult.rows[0].id, JSON.stringify(req.body), error.message, sourceIp, userAgent]
        );
      }
    } catch (logErr) {
      // Ignore log errors
    }

    res.status(500).json({ error: 'Erro ao processar lead', details: error.message });
  }
});

// ============================================
// AUTHENTICATED ENDPOINTS
// ============================================

router.use(authenticate);

// List webhooks
router.get('/', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const result = await query(
      `SELECT w.*, 
         f.name as funnel_name,
         s.name as stage_name,
         u.name as owner_name,
         cb.name as created_by_name
       FROM lead_webhooks w
       LEFT JOIN crm_funnels f ON f.id = w.funnel_id
       LEFT JOIN crm_stages s ON s.id = w.stage_id
       LEFT JOIN users u ON u.id = w.owner_id
       LEFT JOIN users cb ON cb.id = w.created_by
       WHERE w.organization_id = $1
       ORDER BY w.created_at DESC`,
      [org.organization_id]
    );

    res.json(result.rows);
  } catch (error) {
    logError('Error listing webhooks', error);
    res.status(500).json({ error: error.message });
  }
});

// Create webhook
router.post('/', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { 
      name, 
      description, 
      funnel_id, 
      stage_id, 
      owner_id, 
      field_mapping,
      default_value,
      default_probability 
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    // Generate unique token
    const webhookToken = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO lead_webhooks (
         organization_id, name, description, webhook_token,
         funnel_id, stage_id, owner_id, field_mapping,
         default_value, default_probability, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        org.organization_id,
        name,
        description,
        webhookToken,
        funnel_id || null,
        stage_id || null,
        owner_id || null,
        JSON.stringify(field_mapping || {}),
        default_value || 0,
        default_probability || 10,
        req.userId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error creating webhook', error);
    res.status(500).json({ error: error.message });
  }
});

// Update webhook
router.put('/:id', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { id } = req.params;
    const { 
      name, 
      description, 
      is_active,
      funnel_id, 
      stage_id, 
      owner_id, 
      field_mapping,
      default_value,
      default_probability 
    } = req.body;

    const result = await query(
      `UPDATE lead_webhooks SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         is_active = COALESCE($3, is_active),
         funnel_id = $4,
         stage_id = $5,
         owner_id = $6,
         field_mapping = COALESCE($7, field_mapping),
         default_value = COALESCE($8, default_value),
         default_probability = COALESCE($9, default_probability),
         updated_at = NOW()
       WHERE id = $10 AND organization_id = $11
       RETURNING *`,
      [
        name,
        description,
        is_active,
        funnel_id || null,
        stage_id || null,
        owner_id || null,
        field_mapping ? JSON.stringify(field_mapping) : null,
        default_value,
        default_probability,
        id,
        org.organization_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error updating webhook', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await query(
      `DELETE FROM lead_webhooks WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, org.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('Error deleting webhook', error);
    res.status(500).json({ error: error.message });
  }
});

// Get webhook logs
router.get('/:id/logs', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Verify webhook belongs to org
    const webhookCheck = await query(
      `SELECT id FROM lead_webhooks WHERE id = $1 AND organization_id = $2`,
      [id, org.organization_id]
    );

    if (webhookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    const result = await query(
      `SELECT * FROM lead_webhook_logs 
       WHERE webhook_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [id, limit]
    );

    res.json(result.rows);
  } catch (error) {
    logError('Error getting webhook logs', error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate webhook token
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const newToken = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `UPDATE lead_webhooks 
       SET webhook_token = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [newToken, req.params.id, org.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error regenerating token', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DISTRIBUTION ENDPOINTS
// ============================================

// Get distribution members for a webhook
router.get('/:id/distribution', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'No organization' });

    const { id } = req.params;

    // Verify webhook belongs to org
    const webhookCheck = await query(
      `SELECT id, distribution_enabled FROM lead_webhooks WHERE id = $1 AND organization_id = $2`,
      [id, org.organization_id]
    );

    if (webhookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    const result = await query(
      `SELECT d.*, u.name as user_name, u.email as user_email
       FROM lead_webhook_distribution d
       JOIN users u ON u.id = d.user_id
       WHERE d.webhook_id = $1
       ORDER BY u.name`,
      [id]
    );

    res.json({
      distribution_enabled: webhookCheck.rows[0].distribution_enabled,
      members: result.rows
    });
  } catch (error) {
    logError('Error getting distribution members', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle distribution for a webhook
router.patch('/:id/distribution/toggle', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { id } = req.params;
    const { enabled } = req.body;

    const result = await query(
      `UPDATE lead_webhooks 
       SET distribution_enabled = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING id, distribution_enabled`,
      [enabled, id, org.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error toggling distribution', error);
    res.status(500).json({ error: error.message });
  }
});

// Add user to distribution
router.post('/:id/distribution/members', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { id } = req.params;
    const { user_id, max_leads_per_day } = req.body;

    // Verify webhook belongs to org
    const webhookCheck = await query(
      `SELECT id FROM lead_webhooks WHERE id = $1 AND organization_id = $2`,
      [id, org.organization_id]
    );

    if (webhookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    // Verify user belongs to org
    const userCheck = await query(
      `SELECT user_id FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
      [user_id, org.organization_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Usuário não pertence à organização' });
    }

    const result = await query(
      `INSERT INTO lead_webhook_distribution (webhook_id, user_id, max_leads_per_day)
       VALUES ($1, $2, $3)
       ON CONFLICT (webhook_id, user_id) DO UPDATE SET 
         is_active = true,
         max_leads_per_day = COALESCE($3, lead_webhook_distribution.max_leads_per_day)
       RETURNING *`,
      [id, user_id, max_leads_per_day || null]
    );

    // Get user info
    const userInfo = await query('SELECT name, email FROM users WHERE id = $1', [user_id]);

    res.json({
      ...result.rows[0],
      user_name: userInfo.rows[0]?.name,
      user_email: userInfo.rows[0]?.email
    });
  } catch (error) {
    logError('Error adding distribution member', error);
    res.status(500).json({ error: error.message });
  }
});

// Update distribution member
router.patch('/:id/distribution/members/:userId', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { id, userId } = req.params;
    const { is_active, max_leads_per_day } = req.body;

    const result = await query(
      `UPDATE lead_webhook_distribution SET
         is_active = COALESCE($1, is_active),
         max_leads_per_day = $2
       WHERE webhook_id = $3 AND user_id = $4
       RETURNING *`,
      [is_active, max_leads_per_day, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error updating distribution member', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove user from distribution
router.delete('/:id/distribution/members/:userId', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org || !canManage(org.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { id, userId } = req.params;

    const result = await query(
      `DELETE FROM lead_webhook_distribution 
       WHERE webhook_id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('Error removing distribution member', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get next user for round-robin distribution
async function getNextDistributedUser(webhookId) {
  try {
    // Get active members who haven't exceeded daily limit
    const membersResult = await query(
      `SELECT d.*, u.name as user_name, u.email as user_email
       FROM lead_webhook_distribution d
       JOIN users u ON u.id = d.user_id
       WHERE d.webhook_id = $1
         AND d.is_active = true
         AND (d.max_leads_per_day IS NULL OR d.leads_today < d.max_leads_per_day)
       ORDER BY d.last_lead_at ASC NULLS FIRST`,
      [webhookId]
    );

    if (membersResult.rows.length === 0) {
      return null;
    }

    // Get current index
    const webhookResult = await query(
      `SELECT distribution_last_index FROM lead_webhooks WHERE id = $1`,
      [webhookId]
    );

    const lastIndex = webhookResult.rows[0]?.distribution_last_index || 0;
    const nextIndex = (lastIndex + 1) % membersResult.rows.length;
    const selectedUser = membersResult.rows[nextIndex];

    // Update counters
    await query(
      `UPDATE lead_webhook_distribution 
       SET leads_today = leads_today + 1, last_lead_at = NOW()
       WHERE webhook_id = $1 AND user_id = $2`,
      [webhookId, selectedUser.user_id]
    );

    // Update webhook index
    await query(
      `UPDATE lead_webhooks SET distribution_last_index = $1 WHERE id = $2`,
      [nextIndex, webhookId]
    );

    return selectedUser;
  } catch (error) {
    logError('Error getting next distributed user', error);
    return null;
  }
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function buildDescription(mappedData, rawPayload, webhookName) {
  const lines = [];
  
  lines.push(`📥 Lead recebido via webhook: ${webhookName}`);
  lines.push(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
  lines.push('');
  
  if (mappedData.name) lines.push(`👤 Nome: ${mappedData.name}`);
  if (mappedData.email) lines.push(`📧 Email: ${mappedData.email}`);
  if (mappedData.phone) lines.push(`📱 Telefone: ${mappedData.phone}`);
  if (mappedData.company_name) lines.push(`🏢 Empresa: ${mappedData.company_name}`);
  
  // Add custom fields
  if (Object.keys(mappedData.custom_fields).length > 0) {
    lines.push('');
    lines.push('📋 Campos adicionais:');
    for (const [key, value] of Object.entries(mappedData.custom_fields)) {
      lines.push(`  • ${key}: ${value}`);
    }
  }

  // Add raw payload summary for unmapped fields
  const mappedKeys = new Set(['name', 'full_name', 'nome', 'firstName', 'first_name', 'last_name',
    'email', 'email_address', 'e_mail', 'phone', 'telefone', 'whatsapp', 'phone_number', 
    'cellphone', 'celular', 'company', 'empresa', 'company_name']);
  
  const extraFields = Object.entries(rawPayload)
    .filter(([key]) => !mappedKeys.has(key) && typeof rawPayload[key] !== 'object')
    .slice(0, 10);

  if (extraFields.length > 0) {
    lines.push('');
    lines.push('📝 Outros dados:');
    for (const [key, value] of extraFields) {
      lines.push(`  • ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

export default router;
