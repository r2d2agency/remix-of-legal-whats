import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { log, logError } from '../logger.js';

const router = Router();

// Ensure integration_settings column exists
(async () => {
  try {
    await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS integration_settings jsonb DEFAULT '{}'`);
  } catch (e) {
    // ignore if already exists
  }
  // Ensure source column on crm_deals
  try {
    await query(`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS source VARCHAR(255)`);
  } catch (_) {}
})();

// ============================================
// PUBLIC ENDPOINT - Receive leads from FormGleego (API key auth)
// ============================================
router.post('/receive', async (req, res) => {
  const sourceIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // Auth via API key (header or body)
    const apiKey = req.headers['x-api-key'] || req.body.apiKey || req.body.api_key;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key não fornecida. Envie via header X-Api-Key ou campo apiKey no body.' });
    }

    // Find organization by API key
    const orgResult = await query(
      `SELECT id, name, integration_settings FROM organizations 
       WHERE integration_settings->>'lead_gleego_api_key' = $1`,
      [apiKey]
    );

    if (orgResult.rows.length === 0) {
      return res.status(401).json({ error: 'API key inválida' });
    }

    const org = orgResult.rows[0];
    const settings = org.integration_settings || {};
    const payload = { ...req.body };
    // Remove apiKey from payload for clean logging
    delete payload.apiKey;
    delete payload.api_key;

    log(`[Lead Gleego] Received lead for org ${org.name}`, {
      orgId: org.id,
      payload: JSON.stringify(payload).slice(0, 500)
    });

    // Get CRM config from integration_settings
    const funnelId = settings.lead_gleego_funnel_id;
    const stageId = settings.lead_gleego_stage_id;
    const distributionWebhookId = settings.lead_gleego_webhook_id; // optional: reuse webhook distribution
    const defaultOwnerId = settings.lead_gleego_owner_id;

    // Extract lead data with common field names
    const mappedData = {
      name: payload.name || payload.full_name || payload.nome ||
            payload.firstName || payload.first_name ||
            `${payload.first_name || ''} ${payload.last_name || ''}`.trim() ||
            'Lead sem nome',
      email: payload.email || payload.email_address || payload.e_mail || '',
      phone: payload.phone || payload.telefone || payload.whatsapp ||
             payload.phone_number || payload.cellphone || payload.celular || '',
      company_name: payload.company || payload.empresa || payload.company_name || '',
      value: parseFloat(payload.value || payload.valor || '0') || 0,
      description: '',
      custom_fields: {}
    };

    // Apply field mapping if configured
    const fieldMapping = settings.lead_gleego_field_mapping || {};
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

    // Detect unmapped fields and notify
    const knownKeys = new Set([
      ...Object.keys(fieldMapping),
      'name', 'full_name', 'nome', 'firstName', 'first_name', 'last_name',
      'email', 'email_address', 'e_mail', 'phone', 'telefone', 'whatsapp',
      'phone_number', 'cellphone', 'celular', 'company', 'empresa', 'company_name',
      'apiKey', 'api_key', 'value', 'valor'
    ]);
    const unmappedFields = Object.keys(payload).filter(k => !knownKeys.has(k) && typeof payload[k] !== 'object');
    
    if (unmappedFields.length > 0) {
      log(`[Lead Gleego] Unmapped fields detected: ${unmappedFields.join(', ')}`, { orgId: org.id });
      // Notify org owner/admins about unmapped fields
      try {
        const admins = await query(
          `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role IN ('owner', 'admin')`,
          [org.id]
        );
        for (const admin of admins.rows) {
          await query(
            `INSERT INTO user_alerts (user_id, type, title, message, metadata) VALUES ($1, 'warning', $2, $3, $4)`,
            [
              admin.user_id,
              '⚠️ Campos não mapeados no FormGleego',
              `Os seguintes campos do formulário não estão mapeados: ${unmappedFields.join(', ')}. Configure o mapeamento nas configurações do Lead Gleego.`,
              JSON.stringify({ unmapped_fields: unmappedFields, source: 'form_gleego', sample_values: unmappedFields.reduce((acc, k) => { acc[k] = String(payload[k]).slice(0, 100); return acc; }, {}) })
            ]
          );
        }
      } catch (alertErr) {
        logError('[Lead Gleego] Error creating unmapped fields alert', alertErr);
      }
    }

    const cleanPhone = mappedData.phone.toString().replace(/\D/g, '');

    let dealId = null;
    let prospectId = null;
    let responseMessage = 'Lead recebido com sucesso';

    if (!funnelId || !stageId) {
      // No funnel configured → create as prospect
      const prospectResult = await query(
        `INSERT INTO crm_prospects (
           organization_id, name, email, phone, company_name, source, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, 'form_gleego', $6, $7)
         RETURNING id`,
        [
          org.id,
          mappedData.name,
          mappedData.email,
          cleanPhone,
          mappedData.company_name,
          buildDescription(mappedData, payload),
          defaultOwnerId
        ]
      );
      prospectId = prospectResult.rows[0].id;
      responseMessage = `Lead criado como prospect (configure funil/etapa para ir direto ao CRM): ${prospectId}`;
      log(`[Lead Gleego] Lead created as prospect (no funnel configured)`, { prospectId });
    } else {
      // ── Create deal in CRM ──

      // Find or create company
      let companyId = null;
      if (mappedData.company_name) {
        const companyResult = await query(
          `SELECT id FROM crm_companies WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [org.id, mappedData.company_name]
        );
        if (companyResult.rows.length > 0) {
          companyId = companyResult.rows[0].id;
        } else {
          const newCompany = await query(
            `INSERT INTO crm_companies (organization_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
            [org.id, mappedData.company_name, mappedData.email, cleanPhone]
          );
          companyId = newCompany.rows[0].id;
        }
      } else {
        const defaultCompany = await query(
          `SELECT id FROM crm_companies WHERE organization_id = $1 AND name = 'Sem empresa' LIMIT 1`,
          [org.id]
        );
        if (defaultCompany.rows.length > 0) {
          companyId = defaultCompany.rows[0].id;
        } else {
          const nc = await query(
            `INSERT INTO crm_companies (organization_id, name) VALUES ($1, 'Sem empresa') RETURNING id`,
            [org.id]
          );
          companyId = nc.rows[0].id;
        }
      }

      // Determine owner via round-robin distribution (reusing webhook distribution if configured)
      let assignedOwnerId = defaultOwnerId || null;
      let assignedUserName = null;

      if (distributionWebhookId) {
        const distributedUser = await getNextDistributedUser(distributionWebhookId);
        if (distributedUser) {
          assignedOwnerId = distributedUser.user_id;
          assignedUserName = distributedUser.user_name;
          log(`[Lead Gleego] Distributed to user ${assignedUserName}`, { userId: assignedOwnerId });
        }
      }

      // If no owner found, use first admin/owner of org
      if (!assignedOwnerId) {
        const ownerResult = await query(
          `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role IN ('owner', 'admin') LIMIT 1`,
          [org.id]
        );
        if (ownerResult.rows.length > 0) {
          assignedOwnerId = ownerResult.rows[0].user_id;
        }
      }

      const description = buildDescription(mappedData, payload);

      // Create deal
      const dealResult = await query(
        `INSERT INTO crm_deals (
           organization_id, funnel_id, stage_id, company_id,
           title, value, probability, status, description,
           owner_id, created_by, source
          ) VALUES ($1, $2, $3, $4, $5, $6, 10, 'open', $7, $8, $8, 'form_gleego')
         RETURNING id`,
        [
          org.id, funnelId, stageId, companyId,
          mappedData.name || 'Novo Lead',
          mappedData.value,
          description,
          assignedOwnerId
        ]
      );
      dealId = dealResult.rows[0].id;

      // Create/link contact
      if (cleanPhone) {
        let contactResult = await query(
          `SELECT c.id FROM contacts c
           JOIN contact_lists cl ON cl.id = c.list_id
           JOIN connections conn ON conn.id = cl.connection_id
           WHERE conn.organization_id = $1 AND c.phone = $2
           LIMIT 1`,
          [org.id, cleanPhone]
        );
        let contactId;
        if (contactResult.rows.length > 0) {
          contactId = contactResult.rows[0].id;
        } else {
          // Find or create contact list
          const connForList = await query(
            `SELECT id FROM connections WHERE organization_id = $1 AND status = 'connected' ORDER BY created_at ASC LIMIT 1`,
            [org.id]
          );
          let listId = null;
          if (connForList.rows.length > 0) {
            const listResult = await query(
              `SELECT id FROM contact_lists WHERE connection_id = $1 LIMIT 1`,
              [connForList.rows[0].id]
            );
            if (listResult.rows.length > 0) {
              listId = listResult.rows[0].id;
            } else {
              // Get owner user_id from organization
              const ownerResult = await query(
                `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'owner' LIMIT 1`,
                [org.id]
              );
              const ownerId = ownerResult.rows.length > 0 ? ownerResult.rows[0].user_id : null;
              const newList = await query(
                `INSERT INTO contact_lists (name, connection_id, user_id) VALUES ('Contatos Salvos', $1, $2) RETURNING id`,
                [connForList.rows[0].id, ownerId]
              );
              listId = newList.rows[0].id;
            }
          }
          const newContact = await query(
            `INSERT INTO contacts (list_id, name, phone, email, source) VALUES ($1, $2, $3, $4, 'FormGleego') RETURNING id`,
            [listId, mappedData.name, cleanPhone, mappedData.email]
          );
          contactId = newContact.rows[0].id;
        }

        await query(
          `INSERT INTO crm_deal_contacts (deal_id, contact_id, is_primary) VALUES ($1, $2, true) ON CONFLICT (deal_id, contact_id) DO NOTHING`,
          [dealId, contactId]
        );

        // ── Assign/create conversation in chat ──
        if (assignedOwnerId) {
          try {
            const convResult = await query(
              `SELECT c.id, c.connection_id FROM conversations c
               JOIN connections conn ON conn.id = c.connection_id
               WHERE conn.organization_id = $1
                 AND (c.contact_phone = $2 OR c.remote_jid LIKE $3)
               ORDER BY c.last_message_at DESC NULLS LAST`,
              [org.id, cleanPhone, `%${cleanPhone}%`]
            );

            if (convResult.rows.length > 0) {
              for (const conv of convResult.rows) {
                await query(
                  `UPDATE conversations SET assigned_to = $1, attendance_status = 'attending', updated_at = NOW() WHERE id = $2`,
                  [assignedOwnerId, conv.id]
                );
              }
              log(`[Lead Gleego] Assigned ${convResult.rows.length} conversation(s) to user ${assignedOwnerId}`);
            } else {
              // Create new conversation on first active connection
              const connResult = await query(
                `SELECT id FROM connections WHERE organization_id = $1 AND status = 'connected' ORDER BY created_at ASC LIMIT 1`,
                [org.id]
              );
              if (connResult.rows.length > 0) {
                const connectionId = connResult.rows[0].id;
                const jid = cleanPhone.startsWith('55') ? `${cleanPhone}@s.whatsapp.net` : `55${cleanPhone}@s.whatsapp.net`;
                await query(
                  `INSERT INTO conversations (connection_id, remote_jid, contact_name, contact_phone, assigned_to, attendance_status, last_message_at)
                   VALUES ($1, $2, $3, $4, $5, 'attending', NOW())
                   ON CONFLICT (connection_id, remote_jid) 
                   DO UPDATE SET assigned_to = $5, attendance_status = 'attending', updated_at = NOW()
                   RETURNING id`,
                  [connectionId, jid, mappedData.name, cleanPhone, assignedOwnerId]
                );
                log(`[Lead Gleego] Created/assigned conversation for ${cleanPhone}`);
              }
            }
          } catch (convErr) {
            logError('[Lead Gleego] Error assigning conversation', convErr);
          }
        }
      }

      // Deal history
      await query(
        `INSERT INTO crm_deal_history (deal_id, user_id, action, to_value) VALUES ($1, $2, 'created', 'Via FormGleego')`,
        [dealId, assignedOwnerId]
      );

      // Alert
      if (assignedOwnerId) {
        try {
          await query(
            `INSERT INTO user_alerts (user_id, type, title, message, metadata) VALUES ($1, 'new_lead', $2, $3, $4)`,
            [
              assignedOwnerId,
              '🎯 Novo Lead do FormGleego',
              `${mappedData.name || 'Novo lead'} foi atribuído a você via FormGleego`,
              JSON.stringify({ deal_id: dealId, source: 'form_gleego', lead_name: mappedData.name, lead_phone: cleanPhone })
            ]
          );
        } catch (alertErr) {
          logError('[Lead Gleego] Error creating alert', alertErr);
        }
      }

      responseMessage = `Lead criado no CRM: deal ${dealId}` + (assignedUserName ? ` (atribuído a ${assignedUserName})` : '');
    }

    // Log to lead_webhook_logs if webhook is linked (for audit)
    if (distributionWebhookId) {
      try {
        await query(
          `INSERT INTO lead_webhook_logs (webhook_id, request_body, response_status, response_message, deal_id, prospect_id, source_ip, user_agent)
           VALUES ($1, $2, 200, $3, $4, $5, $6, $7)`,
          [distributionWebhookId, JSON.stringify(payload), responseMessage, dealId, prospectId, sourceIp, userAgent]
        );
        // Update webhook stats
        await query(
          `UPDATE lead_webhooks SET total_leads = total_leads + 1, last_lead_at = NOW() WHERE id = $1`,
          [distributionWebhookId]
        );
      } catch (_) {}
    }

    log(`[Lead Gleego] Successfully processed lead`, { dealId, prospectId });

    const response = { success: true, message: responseMessage, deal_id: dealId, prospect_id: prospectId };
    if (unmappedFields.length > 0) {
      response.unmapped_fields = unmappedFields;
      response.warning = `${unmappedFields.length} campo(s) não mapeado(s): ${unmappedFields.join(', ')}`;
    }
    res.json(response);
  } catch (error) {
    logError('[Lead Gleego] Error processing lead', error);
    res.status(500).json({ error: 'Erro ao processar lead', details: error.message });
  }
});

// ============================================
// AUTHENTICATED ENDPOINTS
// ============================================
router.use(authenticate);

// GET integration settings for user's org
router.get('/settings', async (req, res) => {
  try {
    const orgResult = await query(
      `SELECT o.id, o.integration_settings
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 LIMIT 1`,
      [req.userId]
    );
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }
    const settings = orgResult.rows[0].integration_settings || {};
    // Mask API key for display
    if (settings.lead_gleego_api_key) {
      const key = settings.lead_gleego_api_key;
      settings.lead_gleego_api_key_masked = key.length > 8
        ? key.substring(0, 4) + '****' + key.substring(key.length - 4)
        : '****';
    }
    res.json(settings);
  } catch (err) {
    logError('Get lead-gleego settings error', err);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// PUT save API key (admin/owner only)
router.put('/settings', async (req, res) => {
  try {
    const { lead_gleego_api_key, lead_gleego_funnel_id, lead_gleego_stage_id, lead_gleego_webhook_id, lead_gleego_owner_id, lead_gleego_field_mapping } = req.body;

    const orgResult = await query(
      `SELECT om.role, o.id
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 LIMIT 1`,
      [req.userId]
    );
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    const { role, id: orgId } = orgResult.rows[0];
    if (!['owner', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Apenas admin/owner pode configurar integrações' });
    }

    // Build update object with only provided fields
    const updateObj = {};
    if (lead_gleego_api_key !== undefined) updateObj.lead_gleego_api_key = lead_gleego_api_key;
    if (lead_gleego_funnel_id !== undefined) updateObj.lead_gleego_funnel_id = lead_gleego_funnel_id;
    if (lead_gleego_stage_id !== undefined) updateObj.lead_gleego_stage_id = lead_gleego_stage_id;
    if (lead_gleego_webhook_id !== undefined) updateObj.lead_gleego_webhook_id = lead_gleego_webhook_id;
    if (lead_gleego_owner_id !== undefined) updateObj.lead_gleego_owner_id = lead_gleego_owner_id;
    if (lead_gleego_field_mapping !== undefined) updateObj.lead_gleego_field_mapping = lead_gleego_field_mapping;

    await query(
      `UPDATE organizations 
       SET integration_settings = COALESCE(integration_settings, '{}'::jsonb) || $1::jsonb, 
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updateObj), orgId]
    );

    log(`Lead Gleego settings updated for org ${orgId}`);
    res.json({ success: true });
  } catch (err) {
    logError('Save lead-gleego settings error', err);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// GET last payload received (for field mapping inspection)
router.get('/last-payload', async (req, res) => {
  try {
    const orgResult = await query(
      `SELECT o.id, o.integration_settings
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 LIMIT 1`,
      [req.userId]
    );
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    const settings = orgResult.rows[0].integration_settings || {};
    const webhookId = settings.lead_gleego_webhook_id;

    if (webhookId) {
      // Get last log from linked webhook
      const logResult = await query(
        `SELECT request_body, created_at FROM lead_webhook_logs WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [webhookId]
      );
      if (logResult.rows.length > 0) {
        return res.json({ payload: logResult.rows[0].request_body, received_at: logResult.rows[0].created_at });
      }
    }

    res.json({ payload: null, message: 'Nenhum lead recebido ainda' });
  } catch (err) {
    logError('Get last payload error', err);
    res.status(500).json({ error: 'Erro ao buscar último payload' });
  }
});

// SSO: gerar token no Lead Extractor e retornar URL de redirecionamento
router.get('/sso', async (req, res) => {
  try {
    const userId = req.userId;
    log(`Lead Gleego SSO attempt for user ${userId}`);

    // Buscar email e org settings
    const result = await query(
      `SELECT u.email, o.integration_settings
       FROM users u
       JOIN organization_members om ON om.user_id = u.id
       JOIN organizations o ON o.id = om.organization_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou sem organização' });
    }

    const email = result.rows[0].email;
    const settings = result.rows[0].integration_settings || {};
    const apiKey = settings.lead_gleego_api_key || process.env.GLEEGO_SSO_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'Chave de API do Lead Gleego não configurada. Peça ao administrador para configurar em Organizações > Configurações.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email do usuário não encontrado' });
    }

    log(`Lead Gleego SSO: calling external API for ${email}`);

    let response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      response = await fetch('https://backlead.gleego.com.br/api/auth/token-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, apiKey }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (fetchErr) {
      logError('Lead Gleego SSO fetch error (network)', fetchErr);
      const msg = fetchErr.name === 'AbortError'
        ? 'Timeout ao conectar ao servidor Lead Gleego (15s)'
        : 'Não foi possível conectar ao servidor Lead Gleego. Verifique sua conexão.';
      return res.status(502).json({ error: msg });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      logError('Lead Gleego SSO response parse error', parseErr);
      return res.status(502).json({ error: 'Resposta inválida do servidor Lead Gleego' });
    }

    if (data.token) {
      const redirectUrl = `https://lead.gleego.com.br/login?token=${data.token}`;
      log(`Lead Gleego SSO success for ${email}`);
      return res.json({ url: redirectUrl });
    } else {
      logError('Lead Gleego SSO failed', { email, status: response.status, response: data });
      return res.status(400).json({ error: data.error || 'Usuário não encontrado no Lead Extractor. Verifique se o email está cadastrado.' });
    }
  } catch (err) {
    logError('Lead Gleego SSO unexpected error', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar no Lead Gleego: ' + (err.message || 'erro desconhecido') });
  }
});

// ── Helpers ──

async function getNextDistributedUser(webhookId) {
  try {
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

    if (membersResult.rows.length === 0) return null;

    const webhookResult = await query(
      `SELECT distribution_last_index FROM lead_webhooks WHERE id = $1`,
      [webhookId]
    );

    const lastIndex = webhookResult.rows[0]?.distribution_last_index || 0;
    const nextIndex = (lastIndex + 1) % membersResult.rows.length;
    const selectedUser = membersResult.rows[nextIndex];

    await query(
      `UPDATE lead_webhook_distribution SET leads_today = leads_today + 1, last_lead_at = NOW() WHERE webhook_id = $1 AND user_id = $2`,
      [webhookId, selectedUser.user_id]
    );
    await query(
      `UPDATE lead_webhooks SET distribution_last_index = $1 WHERE id = $2`,
      [nextIndex, webhookId]
    );

    return selectedUser;
  } catch (error) {
    logError('[Lead Gleego] Error getting distributed user', error);
    return null;
  }
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function buildDescription(mappedData, rawPayload) {
  const lines = [];
  lines.push(`📥 Lead recebido via FormGleego`);
  lines.push(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
  lines.push('');
  if (mappedData.name) lines.push(`👤 Nome: ${mappedData.name}`);
  if (mappedData.email) lines.push(`📧 Email: ${mappedData.email}`);
  if (mappedData.phone) lines.push(`📱 Telefone: ${mappedData.phone}`);
  if (mappedData.company_name) lines.push(`🏢 Empresa: ${mappedData.company_name}`);

  if (Object.keys(mappedData.custom_fields || {}).length > 0) {
    lines.push('');
    lines.push('📋 Campos adicionais:');
    for (const [key, value] of Object.entries(mappedData.custom_fields)) {
      lines.push(`  • ${key}: ${value}`);
    }
  }

  const mappedKeys = new Set(['name', 'full_name', 'nome', 'firstName', 'first_name', 'last_name',
    'email', 'email_address', 'e_mail', 'phone', 'telefone', 'whatsapp', 'phone_number',
    'cellphone', 'celular', 'company', 'empresa', 'company_name', 'apiKey', 'api_key', 'value', 'valor']);

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
