import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import * as wapiProvider from '../lib/wapi-provider.js';
import * as uazapiProvider from '../lib/uazapi-provider.js';

const router = Router();
router.use(authenticate);

// Helper to get user's organization
async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role 
     FROM organization_members om 
     WHERE om.user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function hasTable(tableName) {
  const result = await query(`SELECT to_regclass($1) AS table_ref`, [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_ref);
}

async function hasColumn(tableName, columnName) {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists_column`,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists_column);
}

// List connections (owner sees all; others only assigned via connection_members)
router.get('/', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    const { scope } = req.query; // scope=organization returns all org connections

    const connQuery = `SELECT c.*, u.name as created_by_name,
       CASE 
          WHEN c.provider = 'meta' THEN 'meta'
          WHEN c.provider = 'uazapi' OR c.uazapi_url IS NOT NULL OR c.uazapi_token IS NOT NULL THEN 'uazapi'
          WHEN c.provider = 'wapi' THEN 'wapi'
          WHEN c.instance_id IS NOT NULL THEN 'wapi'
          WHEN c.provider IS NOT NULL THEN c.provider 
          ELSE 'evolution'
        END as provider
       FROM connections c
       LEFT JOIN users u ON c.user_id = u.id`;

    let result;

    if (scope === 'organization' && org) {
      // Return all connections in the organization (for transfer dialogs)
      result = await query(
        `${connQuery} WHERE c.organization_id = $1 ORDER BY c.created_at DESC`,
        [org.organization_id]
      );
    } else if (org && ['owner', 'admin', 'manager'].includes(org.role)) {
      result = await query(
        `${connQuery} WHERE c.organization_id = $1 ORDER BY c.created_at DESC`,
        [org.organization_id]
      );
    } else {
      // Default: only connections assigned via connection_members
      const specificResult = await query(
        `SELECT DISTINCT cm.connection_id FROM connection_members cm WHERE cm.user_id = $1`,
        [req.userId]
      );
      const connIds = specificResult.rows.map(r => r.connection_id);

      if (connIds.length === 0) {
        return res.json([]);
      }

      result = await query(
        `${connQuery} WHERE c.id = ANY($1) ORDER BY c.created_at DESC`,
        [connIds]
      );
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('List connections error:', error);
    res.status(500).json({ error: 'Erro ao listar conexões' });
  }
});

// Validate W-API token
router.post('/validate-wapi', async (req, res) => {
  try {
    const { token } = req.body;
    
    // Get token from body or from system_settings
    let resolvedToken = token;
    if (!resolvedToken) {
      const settingResult = await query(`SELECT value FROM system_settings WHERE key = 'wapi_token'`);
      resolvedToken = settingResult.rows[0]?.value || null;
    }

    if (!resolvedToken) {
      return res.json({ valid: false, error: 'Token W-API não configurado. Configure no painel Superadmin.' });
    }

    // Try integrator endpoint first (most common token type), then instance endpoints
    const validateEndpoints = [
      'https://api.w-api.app/v1/integrator/instances?pageSize=1&page=1',
      'https://api.w-api.app/v1/instance/status?instanceId=test',
    ];

    let lastStatus = null;
    let lastBody = '';

    for (const url of validateEndpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resolvedToken}`,
          },
        });

        const bodyText = await response.text().catch(() => '');
        lastStatus = response.status;
        lastBody = bodyText;

        if (response.status === 401 || response.status === 403) {
          return res.json({ valid: false, error: 'Token inválido ou expirado' });
        }

        if (response.ok) {
          return res.json({ valid: true, message: 'Token W-API válido!' });
        }

        // 404/405: try next endpoint
      } catch (fetchError) {
        lastBody = fetchError.message || '';
      }
    }

    // If we got HTML back, provide a cleaner error
    const cleanBody = String(lastBody || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
    return res.json({
      valid: false,
      error: `Não foi possível validar token na W-API (status: ${lastStatus || 'sem resposta'}). ${cleanBody}`,
    });
  } catch (error) {
    console.error('Validate W-API token error:', error);
    res.status(500).json({ valid: false, error: 'Erro ao validar token' });
  }
});

// Create connection
router.post('/', async (req, res) => {
  try {
    const { 
      provider = 'wapi', 
      api_url, 
      api_key, 
      instance_name, 
      instance_id,
      wapi_token,
      name,
      meta_token,
      meta_phone_number_id,
      meta_waba_id,
      uazapi_url,
      uazapi_token,
    } = req.body;

    const org = await getUserOrganization(req.userId);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da conexão é obrigatório' });
    }

    // For W-API: get token from org if not provided
    let resolvedToken = wapi_token || null;
    if (provider === 'wapi' && !resolvedToken) {
      const settingResult = await query(
        `SELECT value FROM system_settings WHERE key = 'wapi_token'`
      );
      resolvedToken = settingResult.rows[0]?.value || null;
    }

    // For UAZAPI: resolve config global se não passado
    let resolvedUazapiUrl = uazapi_url || null;
    let resolvedUazapiToken = uazapi_token || null;
    if (provider === 'uazapi') {
      if (!resolvedUazapiUrl) {
        const r = await query(`SELECT value FROM system_settings WHERE key = 'uazapi_url'`);
        resolvedUazapiUrl = r.rows[0]?.value || null;
      }
    }

    // Validate based on provider
    if (provider === 'meta') {
      if (!meta_token || !meta_phone_number_id || !meta_waba_id) {
        return res.status(400).json({ error: 'Token, Phone Number ID e WABA ID são obrigatórios para conexão Meta' });
      }
    } else if (provider === 'wapi') {
      if (!resolvedToken) {
        return res.status(400).json({ error: 'Token W-API não configurado. Peça ao administrador para configurar o token no painel Superadmin.' });
      }
    } else if (provider === 'uazapi') {
      if (!resolvedUazapiUrl) {
        return res.status(400).json({ error: 'URL UAZAPI não configurada. Configure no painel Superadmin.' });
      }
      // Token da instância pode ser criado automaticamente abaixo
    } else {
      if (!api_url || !api_key || !instance_name) {
        return res.status(400).json({ error: 'URL, API Key e nome da instância são obrigatórios' });
      }
    }

    // Check plan limits
    if (org) {
      const limitsResult = await query(
        `SELECT p.max_connections, 
                (SELECT COUNT(*) FROM connections WHERE organization_id = $1) as current_count
         FROM organizations o
         LEFT JOIN plans p ON p.id = o.plan_id
         WHERE o.id = $1`,
        [org.organization_id]
      );
      const limits = limitsResult.rows[0];
      if (limits && limits.max_connections && Number(limits.current_count) >= Number(limits.max_connections)) {
        return res.status(400).json({ error: `Limite de conexões atingido (${limits.max_connections}). Upgrade seu plano para adicionar mais.` });
      }
    }

    let finalInstanceId = instance_id || null;
    let finalToken = resolvedToken;

    // Auto-create W-API instance with name orgSlug-connectionShortId
    if (provider === 'wapi' && !instance_id) {
      try {
        // Get org slug for instance naming
        let orgSlug = 'inst';
        if (org) {
          const orgData = await query(`SELECT slug FROM organizations WHERE id = $1`, [org.organization_id]);
          orgSlug = orgData.rows[0]?.slug || 'inst';
        }
        const shortId = Date.now().toString(36);
        const instanceName = `${orgSlug}-${shortId}`;

        const created = await wapiProvider.createInstance(resolvedToken, instanceName);
        finalInstanceId = created.instanceId;
        finalToken = created.token || resolvedToken;
        console.log('[W-API] Auto-created instance:', finalInstanceId, 'name:', instanceName);
      } catch (createError) {
        console.error('[W-API] Failed to create instance:', createError);
        return res.status(400).json({ error: `Erro ao criar instância W-API: ${createError.message}` });
      }
    }

    // Auto-create UAZAPI instance se token não foi fornecido
    if (provider === 'uazapi' && !resolvedUazapiToken) {
      try {
        const adminTokenRes = await query(`SELECT value FROM system_settings WHERE key = 'uazapi_admintoken'`);
        const adminToken = adminTokenRes.rows[0]?.value;
        if (!adminToken) {
          return res.status(400).json({ error: 'Admintoken UAZAPI não configurado no painel Superadmin' });
        }
        let orgSlug = 'inst';
        if (org) {
          const orgData = await query(`SELECT slug FROM organizations WHERE id = $1`, [org.organization_id]);
          orgSlug = orgData.rows[0]?.slug || 'inst';
        }
        const shortId = Date.now().toString(36);
        const instanceName = `${orgSlug}-${shortId}`;

        const uazapiProvider = await import('../lib/uazapi-provider.js');
        const created = await uazapiProvider.createInstance(resolvedUazapiUrl, adminToken, instanceName);
        resolvedUazapiToken = created.token;
        finalInstanceId = created.instanceId || created.token; // usa id ou token como instance_id
        console.log('[UAZAPI] Auto-created instance:', finalInstanceId);
      } catch (createError) {
        console.error('[UAZAPI] Failed to create instance:', createError);
        return res.status(400).json({ error: `Erro ao criar instância UAZAPI: ${createError.message}` });
      }
    }

    // Generate webhook verify token for Meta connections
    const metaWebhookVerifyToken = provider === 'meta' ? crypto.randomBytes(16).toString('hex') : null;

    const result = await query(
      `INSERT INTO connections (user_id, organization_id, provider, api_url, api_key, instance_name, instance_id, wapi_token, name, meta_token, meta_phone_number_id, meta_waba_id, meta_webhook_verify_token, uazapi_url, uazapi_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        req.userId, 
        org?.organization_id || null, 
        provider,
        api_url || null, 
        api_key || null, 
        instance_name || null,
        finalInstanceId,
        finalToken,
        name.trim(),
        meta_token || null,
        meta_phone_number_id || null,
        meta_waba_id || null,
        metaWebhookVerifyToken,
        provider === 'uazapi' ? resolvedUazapiUrl : null,
        provider === 'uazapi' ? resolvedUazapiToken : null,
      ]
    );

    const connection = result.rows[0];

    // Auto-add creator to connection_members with full permissions
    try {
      await query(
        `INSERT INTO connection_members (connection_id, user_id, permissions)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [connection.id, req.userId, JSON.stringify(['view', 'send', 'manage'])]
      );
      console.log('[Connections] Auto-added creator to connection_members:', req.userId);
    } catch (memberError) {
      console.error('[Connections] Failed to auto-add creator to connection_members:', memberError);
    }

    // Auto-configure webhooks for W-API connections
    if (provider === 'wapi' && finalInstanceId) {
      try {
        const webhookResult = await wapiProvider.configureWebhooks(finalInstanceId, finalToken);
        console.log('[W-API] Webhook configuration result:', webhookResult);
        connection.webhooks_configured = webhookResult.success;
        connection.webhooks_count = webhookResult.configured;
      } catch (webhookError) {
        console.error('[W-API] Failed to configure webhooks:', webhookError);
        connection.webhooks_configured = false;
      }
    }

    // Migrate orphaned conversations from deleted connections in the same org
    if (org?.organization_id) {
      try {
        // Find conversations whose connection_id no longer exists in the connections table
        // but belonged to a connection from the same organization
        const migrateResult = await query(`
          UPDATE conversations 
          SET connection_id = $1 
          WHERE connection_id NOT IN (SELECT id FROM connections)
            AND connection_id IN (
              SELECT DISTINCT conv.connection_id 
              FROM conversations conv
              WHERE conv.connection_id NOT IN (SELECT id FROM connections)
            )
          RETURNING id
        `, [connection.id]);
        
        if (migrateResult.rowCount > 0) {
          console.log(`[Connections] Migrated ${migrateResult.rowCount} orphaned conversations to new connection ${connection.id}`);
        }
      } catch (migrateError) {
        console.error('[Connections] Failed to migrate orphaned conversations:', migrateError);
      }
    }

    res.status(201).json(connection);
  } catch (error) {
    console.error('Create connection error:', error);
    const detail = error.detail || error.message || 'Erro desconhecido';
    const constraint = error.constraint || null;
    const hint = error.hint || null;
    console.error('Create connection DB detail:', { detail, constraint, hint, code: error.code, table: error.table, column: error.column });
    res.status(500).json({ 
      error: `Erro ao criar conexão: ${detail}`,
      constraint,
      hint,
      code: error.code,
    });
  }
});

// Update connection
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      provider,
      api_url, 
      api_key, 
      instance_name, 
      instance_id,
      wapi_token,
      name, 
      status,
      show_groups,
      meta_token,
      meta_phone_number_id,
      meta_waba_id
    } = req.body;

    const org = await getUserOrganization(req.userId);

    // Allow update if user owns the connection OR belongs to same organization
    let whereClause = 'id = $13 AND user_id = $14';
    let params = [provider, api_url, api_key, instance_name, instance_id, wapi_token, name, status, show_groups, meta_token, meta_phone_number_id, meta_waba_id, id, req.userId];

    if (org) {
      whereClause = 'id = $13 AND organization_id = $14';
      params = [provider, api_url, api_key, instance_name, instance_id, wapi_token, name, status, show_groups, meta_token, meta_phone_number_id, meta_waba_id, id, org.organization_id];
    }

    const result = await query(
      `UPDATE connections 
       SET provider = COALESCE($1, provider),
           api_url = COALESCE($2, api_url),
           api_key = COALESCE($3, api_key),
           instance_name = COALESCE($4, instance_name),
           instance_id = COALESCE($5, instance_id),
           wapi_token = COALESCE($6, wapi_token),
           name = COALESCE($7, name),
           status = COALESCE($8, status),
           show_groups = COALESCE($9, show_groups),
           meta_token = COALESCE($10, meta_token),
           meta_phone_number_id = COALESCE($11, meta_phone_number_id),
           meta_waba_id = COALESCE($12, meta_waba_id),
           updated_at = NOW()
       WHERE ${whereClause}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({ error: 'Erro ao atualizar conexão' });
  }
});

// Meta: Generate/regenerate webhook verify token and mark as connected
router.post('/:id/meta-connect', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrganization(req.userId);

    // Verify connection belongs to org and is meta provider
    const connResult = await query(
      `SELECT * FROM connections WHERE id = $1 AND organization_id = $2 AND provider = 'meta'`,
      [id, org?.organization_id]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão Meta não encontrada' });
    }

    const connection = connResult.rows[0];

    // Validate that Meta credentials are present
    if (!connection.meta_token || !connection.meta_phone_number_id || !connection.meta_waba_id) {
      return res.status(400).json({ error: 'Credenciais Meta incompletas (token, phone_number_id ou waba_id ausente)' });
    }

    // Validate token against Meta API
    const metaResp = await fetch(
      `https://graph.facebook.com/v21.0/${connection.meta_waba_id}?fields=id,name`,
      { headers: { Authorization: `Bearer ${connection.meta_token}` } }
    );

    if (!metaResp.ok) {
      const err = await metaResp.json().catch(() => ({}));
      return res.status(400).json({
        error: err.error?.message || `Token Meta inválido (${metaResp.status})`,
      });
    }

    // Generate or regenerate verify token
    const verifyToken = crypto.randomBytes(16).toString('hex');

    const result = await query(
      `UPDATE connections 
       SET meta_webhook_verify_token = $1, status = 'connected', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [verifyToken, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Meta connect error:', error);
    res.status(500).json({ error: 'Erro ao conectar Meta' });
  }
});

// Delete connection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const org = await getUserOrganization(req.userId);

    // Allow delete if user owns the connection OR belongs to same organization (with permission)
    let whereClause = 'id = $1 AND user_id = $2';
    let params = [id, req.userId];

    if (org && ['owner', 'admin', 'manager'].includes(org.role)) {
      whereClause = 'id = $1 AND organization_id = $2';
      params = [id, org.organization_id];
    }

    // Get connection details before deleting (to delete W-API instance)
    const connResult = await query(
      `SELECT * FROM connections WHERE ${whereClause}`,
      params
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Delete W-API instance remotely if applicable
    const connProvider = connection.provider || (connection.instance_id ? 'wapi' : 'evolution');
    if (connProvider === 'wapi' && connection.instance_id) {
      try {
        await wapiProvider.deleteInstance(connection.instance_id, connection.wapi_token);
        console.log('[W-API] Instance deleted remotely:', connection.instance_id);
      } catch (deleteError) {
        console.error('[W-API] Failed to delete instance remotely:', deleteError);
        // Continue with local deletion even if remote fails
      }
    }

    // Nullify connection_id on conversations, contact_lists, and chat_contacts to preserve data
    await query(`UPDATE conversations SET connection_id = NULL WHERE connection_id = $1`, [id]);
    await query(`UPDATE contact_lists SET connection_id = NULL WHERE connection_id = $1`, [id]);
    await query(`UPDATE chat_contacts SET connection_id = NULL WHERE connection_id = $1`, [id]);

    await query(`DELETE FROM connections WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Erro ao deletar conexão' });
  }
});

// Migrate orphaned conversations to a specific connection
// Also supports migrating from a specific source connection via ?from=<connection_id>
router.post('/:id/migrate-conversations', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { from } = req.query; // optional: source connection_id to migrate FROM
    const org = await getUserOrganization(req.userId);
    const connResult = await query(`SELECT id, organization_id FROM connections WHERE id = $1`, [id]);
    if (connResult.rows.length === 0) return res.status(404).json({ error: 'Conexão não encontrada' });
    const connection = connResult.rows[0];
    if (org && connection.organization_id !== org.organization_id) return res.status(403).json({ error: 'Sem permissão' });

    let migrateResult;

    if (from) {
      // Migra todas as conversas da conexão de origem (e órfãs da MESMA organização)
      // para a conexão de destino. Resolve duplicatas (mesmo remote_jid já existir no destino,
      // ou múltiplas órfãs com o mesmo jid) re-apontando mensagens e removendo a duplicata.

      // 1) Conjunto de conversas candidatas a migrar (origem + órfãs da mesma org)
      //    Filtramos órfãs por organization_id para evitar pegar conversas de outras orgs.
      const candidatesQ = await query(`
        SELECT id, remote_jid
        FROM conversations
        WHERE remote_jid IS NOT NULL
          AND (
            connection_id = $1
            OR (connection_id IS NULL AND organization_id = $2)
          )
      `, [from, connection.organization_id]);

      const candidates = candidatesQ.rows;

      // 2) Para cada candidata, verificar se já existe no destino com o mesmo remote_jid
      //    Se existir: mover mensagens, deletar a duplicata.
      //    Caso contrário: atualizar connection_id para o destino.
      //    Também deduplicar entre as próprias candidatas (várias órfãs do mesmo jid).
      const seenJid = new Map(); // remote_jid -> kept conversation id

      // Pré-carrega conversas existentes no destino para evitar N queries
      const existingQ = await query(
        `SELECT id, remote_jid FROM conversations WHERE connection_id = $1`,
        [id]
      );
      for (const row of existingQ.rows) {
        if (row.remote_jid) seenJid.set(row.remote_jid, row.id);
      }

      const migratedRows = [];

      for (const cand of candidates) {
        const jid = cand.remote_jid;
        const existingId = seenJid.get(jid);

        if (existingId && existingId !== cand.id) {
          // Já existe no destino (ou já foi promovida outra órfã com o mesmo jid)
          // Move mensagens para a conversa existente e remove a duplicata.
          try {
            await query(
              `UPDATE chat_messages SET conversation_id = $1 WHERE conversation_id = $2`,
              [existingId, cand.id]
            );
          } catch (e) {
            console.warn('[migrate] failed moving messages', cand.id, '->', existingId, e.message);
          }
          try {
            await query(`DELETE FROM conversations WHERE id = $1`, [cand.id]);
          } catch (e) {
            console.warn('[migrate] failed deleting duplicate', cand.id, e.message);
          }
        } else {
          // Promove a conversa para o destino
          try {
            const upd = await query(
              `UPDATE conversations
                 SET connection_id = $1, updated_at = NOW()
               WHERE id = $2
               RETURNING id, contact_name, contact_phone`,
              [id, cand.id]
            );
            if (upd.rows[0]) {
              migratedRows.push(upd.rows[0]);
              seenJid.set(jid, cand.id);
            }
          } catch (e) {
            // Em caso de race/colisão UNIQUE, tenta tratar como duplicata
            console.warn('[migrate] update failed, treating as duplicate', cand.id, e.message);
            try {
              const dest = await query(
                `SELECT id FROM conversations WHERE connection_id = $1 AND remote_jid = $2 LIMIT 1`,
                [id, jid]
              );
              if (dest.rows[0]) {
                await query(
                  `UPDATE chat_messages SET conversation_id = $1 WHERE conversation_id = $2`,
                  [dest.rows[0].id, cand.id]
                );
                await query(`DELETE FROM conversations WHERE id = $1`, [cand.id]);
                seenJid.set(jid, dest.rows[0].id);
              }
            } catch (e2) {
              console.error('[migrate] failed fallback for', cand.id, e2.message);
            }
          }
        }
      }

      migrateResult = { rowCount: migratedRows.length, rows: migratedRows };

      // Also update chat_messages connection_id when this legacy column exists
      if (migrateResult.rowCount > 0) {
        const migratedIds = migrateResult.rows.map(r => r.id);
        const chatMessagesHasConnectionId = await hasColumn('chat_messages', 'connection_id');

        if (chatMessagesHasConnectionId) {
          await query(`UPDATE chat_messages SET connection_id = $1 WHERE conversation_id = ANY($2)`, [id, migratedIds]);
        }

        const chatContactsTableExists = await hasTable('chat_contacts');
        if (chatContactsTableExists) {
          // chat_contacts pode ter UNIQUE(connection_id, remote_jid). Migra um a um,
          // consolidando duplicatas: se o destino já existe, deleta o de origem.
          try {
            const ccCols = await query(`
              SELECT column_name FROM information_schema.columns
              WHERE table_name = 'chat_contacts'
            `);
            const hasRemoteJid = ccCols.rows.some(r => r.column_name === 'remote_jid');
            if (hasRemoteJid) {
              const srcContacts = await query(
                `SELECT id, remote_jid FROM chat_contacts WHERE connection_id = $1`,
                [from]
              );
              for (const c of srcContacts.rows) {
                try {
                  await query(
                    `UPDATE chat_contacts SET connection_id = $1 WHERE id = $2`,
                    [id, c.id]
                  );
                } catch (ccErr) {
                  // colisão UNIQUE: já existe no destino, deleta o duplicado da origem
                  console.warn('[migrate] chat_contacts collision, deleting source', c.id, ccErr.message);
                  try {
                    await query(`DELETE FROM chat_contacts WHERE id = $1`, [c.id]);
                  } catch (delErr) {
                    console.warn('[migrate] failed deleting duplicate chat_contact', c.id, delErr.message);
                  }
                }
              }
            } else {
              await query(`UPDATE chat_contacts SET connection_id = $1 WHERE connection_id = $2`, [id, from]);
            }
          } catch (ccErr) {
            console.warn('[migrate] chat_contacts migration warning:', ccErr.message);
          }
        }
      }

      console.log(`[Connections] Bulk migration from ${from}: ${migrateResult.rowCount} conversations migrated to ${id}`);
    } else {
      // Original behavior: migrate only orphaned conversations
      migrateResult = await query(`
        UPDATE conversations SET connection_id = $1, updated_at = NOW()
        WHERE connection_id NOT IN (SELECT id FROM connections)
        RETURNING id, contact_name, contact_phone
      `, [id]);

      if (migrateResult.rowCount > 0) {
        const migratedIds = migrateResult.rows.map(r => r.id);
        const chatMessagesHasConnectionId = await hasColumn('chat_messages', 'connection_id');

        if (chatMessagesHasConnectionId) {
          await query(`UPDATE chat_messages SET connection_id = $1 WHERE conversation_id = ANY($2)`, [id, migratedIds]);
        }
      }

      console.log(`[Connections] Manual migration: ${migrateResult.rowCount} conversations migrated to ${id}`);
    }

    res.json({ success: true, migrated: migrateResult.rowCount, conversations: migrateResult.rows });
  } catch (error) {
    console.error('Migrate conversations error:', error, error?.stack);
    res.status(500).json({
      error: 'Erro ao migrar conversas',
      detail: error?.message || String(error),
      code: error?.code,
    });
  }
});

// Import chat history from a previous Gleego export (JSON file)
// Body: { connection: {...}, conversations: [...], messages: [...], chat_contacts?: [...] }
router.post('/:id/import-history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    // Accept multiple legacy formats: { conversations, messages } OR
    // arrays nested in { data: { ... } } / { chats, messages } / array of chats with embedded messages.
    let importedConversations = [];
    let importedMessages = [];

    const root = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    if (Array.isArray(root.conversations)) importedConversations = root.conversations;
    else if (Array.isArray(root.chats)) importedConversations = root.chats;
    else if (Array.isArray(root)) importedConversations = root;

    if (Array.isArray(root.messages)) {
      importedMessages = root.messages;
    } else {
      // Pull messages embedded inside each conversation
      for (const c of importedConversations) {
        const embedded = c.messages || c.chat_messages || c.history;
        if (Array.isArray(embedded)) {
          for (const m of embedded) {
            importedMessages.push({
              ...m,
              conversation_id: m.conversation_id || c.id || c.conversation_id || c.remote_jid,
              remote_jid: m.remote_jid || c.remote_jid || c.jid || c.chatId,
            });
          }
        }
      }
    }

    if (importedConversations.length === 0 && importedMessages.length === 0) {
      return res.status(400).json({ error: 'Arquivo de exportação inválido (sem conversas ou mensagens).' });
    }

    const org = await getUserOrganization(req.userId);
    const connResult = await query(`SELECT id, organization_id FROM connections WHERE id = $1`, [id]);
    if (connResult.rows.length === 0) return res.status(404).json({ error: 'Conexão de destino não encontrada' });
    const targetConnection = connResult.rows[0];
    if (org && targetConnection.organization_id !== org.organization_id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    // Normalize a conversation entry from possibly different schemas
    const normConv = (c) => ({
      old_id: c.id || c.conversation_id || c.remote_jid || c.jid || c.chatId || null,
      remote_jid: c.remote_jid || c.jid || c.chatId || c.chat_id || c.phone || null,
      contact_name: c.contact_name || c.name || c.pushName || c.push_name || null,
      contact_phone: c.contact_phone || c.phone || c.number || null,
      last_message_at: c.last_message_at || c.lastMessageAt || c.updated_at || null,
      unread_count: c.unread_count || c.unread || 0,
      is_archived: c.is_archived || c.archived || false,
      created_at: c.created_at || c.createdAt || null,
      updated_at: c.updated_at || c.updatedAt || null,
      is_pinned: c.is_pinned || c.pinned || false,
      is_group: c.is_group || c.isGroup || (typeof (c.remote_jid || c.jid) === 'string' && (c.remote_jid || c.jid).includes('@g.us')) || false,
      group_name: c.group_name || c.groupName || null,
      attendance_status: c.attendance_status || 'finished',
    });

    // Map old conversation_id (or remote_jid) -> new conversation_id
    const convIdMap = new Map();
    const convByJid = new Map();
    let createdConvs = 0;
    let mergedConvs = 0;

    const ensureConversation = async (c) => {
      if (!c.remote_jid) return null;
      if (convByJid.has(c.remote_jid)) return convByJid.get(c.remote_jid);
      // Try to find an existing conversation in target connection by remote_jid
      const existing = await query(
        `SELECT id FROM conversations WHERE connection_id = $1 AND remote_jid = $2 LIMIT 1`,
        [id, c.remote_jid]
      );

      let newId;
      if (existing.rows.length > 0) {
        newId = existing.rows[0].id;
        mergedConvs++;
      } else {
        const ins = await query(
          `INSERT INTO conversations (
             connection_id, remote_jid, contact_name, contact_phone,
             last_message_at, unread_count, is_archived,
             created_at, updated_at, is_pinned, is_group, group_name,
             attendance_status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            id,
            c.remote_jid,
            c.contact_name || null,
            c.contact_phone || null,
            c.last_message_at || null,
            c.unread_count || 0,
            c.is_archived || false,
            c.created_at || new Date().toISOString(),
            c.updated_at || new Date().toISOString(),
            c.is_pinned || false,
            c.is_group || false,
            c.group_name || null,
            c.attendance_status || 'finished',
          ]
        );
        newId = ins.rows[0].id;
        createdConvs++;
      }
      convByJid.set(c.remote_jid, newId);
      if (c.old_id) convIdMap.set(c.old_id, newId);
      return newId;
    };

    for (const raw of importedConversations) {
      const c = normConv(raw);
      await ensureConversation(c);
    }

    // Insert messages in batches, skipping duplicates by (conversation_id, message_id)
    let insertedMsgs = 0;
    let skippedMsgs = 0;
    for (const m of importedMessages) {
      // Resolve target conversation: by old conv id, then by jid
      let newConvId = m.conversation_id ? convIdMap.get(m.conversation_id) : null;
      const jid = m.remote_jid || m.jid || m.chatId || m.from || m.to || null;
      if (!newConvId && jid) {
        newConvId = await ensureConversation(normConv({
          remote_jid: jid,
          contact_name: m.contact_name || m.pushName || null,
          contact_phone: m.contact_phone || null,
        }));
      }
      if (!newConvId) { skippedMsgs++; continue; }

      const messageId = String(m.message_id || m.id || m.key?.id || "").trim() || null;
      if (messageId) {
          const dup = await query(
            `SELECT 1 FROM chat_messages WHERE conversation_id = $1 AND message_id = $2 LIMIT 1`,
            [newConvId, messageId]
          );
          if (dup.rows.length > 0) { skippedMsgs++; continue; }
      }

      const fromMe = m.from_me ?? m.fromMe ?? m.key?.fromMe ?? m.from_me === true;
      const content = m.content ?? m.text ?? m.body ?? m.message ?? null;
      const messageType = m.message_type || m.type || 'text';
      // Handle timestamp in seconds (WhatsApp format) or milliseconds/ISO
      let ts = m.timestamp || m.created_at || m.messageTimestamp || m.time || m.date || new Date().toISOString();
      if (typeof ts === 'number' && ts < 10000000000) {
        ts = new Date(ts * 1000).toISOString();
      }

      try {
          const sql = `
            INSERT INTO chat_messages (
              conversation_id, message_id, from_me, content, message_type,
              media_url, media_mimetype, quoted_message_id, status,
              timestamp, created_at, sender_name, sender_phone
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `;
          const values = [
            newConvId,
            messageId,
            !!fromMe,
            typeof content === 'string' ? content : (content ? JSON.stringify(content) : null),
            messageType,
            m.media_url || m.mediaUrl || m.url || null,
            m.media_mimetype || m.mimetype || m.mimeType || null,
            m.quoted_message_id || m.quotedMsgId || null,
            m.status || (fromMe ? 'sent' : 'received'),
            ts,
            m.created_at || ts,
            m.sender_name || m.pushName || m.senderName || null,
            m.sender_phone || m.senderPhone || m.sender || null,
          ];
          await query(sql, values);
          insertedMsgs++;
      } catch (err) {
          skippedMsgs++;
      }
    }

    console.log(`[Connections] Import history into ${id}: ${createdConvs} created, ${mergedConvs} merged, ${insertedMsgs} messages inserted, ${skippedMsgs} skipped`);

    res.json({
      success: true,
      conversations_created: createdConvs,
      conversations_merged: mergedConvs,
      messages_inserted: insertedMsgs,
      messages_skipped: skippedMsgs,
      conversations_total: importedConversations.length,
      messages_total: importedMessages.length,
    });
  } catch (error) {
    console.error('Import history error:', error);
    res.status(500).json({ error: error?.message || 'Erro ao importar histórico' });
  }
});

// Reconfigure webhooks for W-API connection
router.post('/:id/configure-webhooks', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrganization(req.userId);

    // Get connection
    let whereClause = 'id = $1 AND user_id = $2';
    let params = [id, req.userId];

    if (org) {
      whereClause = 'id = $1 AND organization_id = $2';
      params = [id, org.organization_id];
    }

    const connResult = await query(
      `SELECT * FROM connections WHERE ${whereClause}`,
      params
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    const provider =
      connection.provider ||
      (connection.instance_id && connection.wapi_token ? 'wapi' : 'evolution');

    if (provider !== 'wapi') {
      return res.status(400).json({ error: 'Esta funcionalidade é apenas para conexões W-API' });
    }

    if (!connection.instance_id || !connection.wapi_token) {
      return res.status(400).json({ error: 'Instance ID e Token não configurados' });
    }

    // Configure webhooks
    const result = await wapiProvider.configureWebhooks(connection.instance_id, connection.wapi_token);

    // Backfill provider for older rows
    if (connection.provider !== 'wapi') {
      await query('UPDATE connections SET provider = $1, updated_at = NOW() WHERE id = $2', ['wapi', id]);
    }

    res.json({
      success: result.success,
      message: result.success 
        ? `${result.configured}/${result.total} webhooks configurados com sucesso` 
        : 'Falha ao configurar webhooks',
      details: result.results,
    });
  } catch (error) {
    console.error('Configure webhooks error:', error);
    res.status(500).json({ error: 'Erro ao configurar webhooks' });
  }
});

router.post('/:id/configure-uazapi-webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrganization(req.userId);

    let whereClause = 'id = $1 AND user_id = $2';
    let params = [id, req.userId];

    if (org) {
      whereClause = 'id = $1 AND organization_id = $2';
      params = [id, org.organization_id];
    }

    const connResult = await query(`SELECT * FROM connections WHERE ${whereClause}`, params);
    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];
    if (connection.provider !== 'uazapi') {
      return res.status(400).json({ error: 'Esta funcionalidade é apenas para conexões UAZAPI' });
    }

    if (!connection.uazapi_url || !connection.uazapi_token) {
      return res.status(400).json({ error: 'URL ou token da UAZAPI não configurados' });
    }

    const webhookBaseUrl = String(process.env.WEBHOOK_BASE_URL || process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
    const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/api/uazapi/webhook` : null;

    if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) {
      return res.status(400).json({ error: 'WEBHOOK_BASE_URL/API_BASE_URL não configurado com URL pública válida' });
    }

    const result = await uazapiProvider.configureWebhook(connection.uazapi_url, connection.uazapi_token, webhookUrl, ['messages', 'status', 'connection']);

    res.json({
      success: result.success,
      webhookUrl,
      details: result.data || null,
      message: result.success ? 'Webhook UAZAPI configurado com sucesso' : 'Falha ao configurar webhook UAZAPI',
    });
  } catch (error) {
    console.error('Configure UAZAPI webhook error:', error);
    res.status(500).json({ error: 'Erro ao configurar webhook UAZAPI' });
  }
});

// Diagnose webhook configuration for W-API connection
router.get('/:id/webhook-config', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrganization(req.userId);

    let whereClause = 'id = $1 AND user_id = $2';
    let params = [id, req.userId];

    if (org) {
      whereClause = 'id = $1 AND organization_id = $2';
      params = [id, org.organization_id];
    }

    const connResult = await query(
      `SELECT * FROM connections WHERE ${whereClause}`,
      params
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];
    const provider =
      connection.provider ||
      (connection.instance_id && connection.wapi_token ? 'wapi' : 'evolution');

    if (provider !== 'wapi') {
      return res.status(400).json({ error: 'Apenas para conexões W-API' });
    }

    if (!connection.instance_id || !connection.wapi_token) {
      return res.status(400).json({ error: 'Instance ID e Token não configurados' });
    }

    const config = await wapiProvider.getWebhookConfig(connection.instance_id, connection.wapi_token);
    res.json({ instance_id: connection.instance_id, webhooks: config });
  } catch (error) {
    console.error('Webhook config check error:', error);
    res.status(500).json({ error: 'Erro ao verificar configuração de webhooks' });
  }
});

// ============================================================
// AI AGENTS ASSIGNED TO A CONNECTION (always-on selector)
// Returns regular agents (ai_agent_connections) + global agent activations
// ============================================================
router.get('/:id/ai-agents', async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) return res.status(403).json({ error: 'Sem organização' });

    const connCheck = await query(
      `SELECT id FROM connections WHERE id = $1 AND organization_id = $2`,
      [req.params.id, userOrg.organization_id]
    );
    if (connCheck.rows.length === 0) return res.status(404).json({ error: 'Conexão não encontrada' });

    let regular = [];
    try {
      const r = await query(`
        SELECT ac.id as link_id, ac.mode, ac.is_active, a.id as agent_id, a.name, a.is_active as agent_active,
               'regular' as kind
        FROM ai_agent_connections ac
        JOIN ai_agents a ON a.id = ac.agent_id
        WHERE ac.connection_id = $1 AND a.organization_id = $2
        ORDER BY ac.priority DESC
      `, [req.params.id, userOrg.organization_id]);
      regular = r.rows;
    } catch { /* table may not exist */ }

    let globals = [];
    try {
      const g = await query(`
        SELECT act.id as link_id, act.schedule_mode as mode, act.is_active,
               ga.id as agent_id, ga.name, ga.is_active as agent_active,
               'global' as kind
        FROM global_agent_activations act
        JOIN global_ai_agents ga ON ga.id = act.global_agent_id
        WHERE act.connection_id = $1 AND act.organization_id = $2
        ORDER BY act.created_at ASC
      `, [req.params.id, userOrg.organization_id]);
      globals = g.rows;
    } catch { /* table may not exist */ }

    res.json([...regular, ...globals]);
  } catch (err) {
    console.error('connection ai-agents list error:', err);
    res.status(500).json({ error: 'Erro ao listar agentes da conexão' });
  }
});

router.get('/:id/ai-agents/available', async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) return res.status(403).json({ error: 'Sem organização' });

    let regular = [];
    try {
      const r = await query(
        `SELECT id, name, 'regular' as kind FROM ai_agents 
         WHERE organization_id = $1 AND is_active = true ORDER BY name`,
        [userOrg.organization_id]
      );
      regular = r.rows;
    } catch { /* ignore */ }

    let globals = [];
    try {
      const g = await query(`
        SELECT ga.id, ga.name, 'global' as kind 
        FROM global_ai_agents ga
        JOIN global_agent_org_assignments gaa ON gaa.global_agent_id = ga.id
        WHERE gaa.organization_id = $1 AND ga.is_active = true
        ORDER BY ga.name
      `, [userOrg.organization_id]);
      globals = g.rows;
    } catch { /* ignore */ }

    res.json([...regular, ...globals]);
  } catch (err) {
    console.error('available ai-agents error:', err);
    res.status(500).json({ error: 'Erro ao listar agentes disponíveis' });
  }
});

router.post('/:id/ai-agents', async (req, res) => {
  try {
    const userOrg = await getUserOrganization(req.userId);
    if (!userOrg) return res.status(403).json({ error: 'Sem organização' });

    const { agent_id, kind } = req.body || {};
    if (!agent_id || !['regular', 'global'].includes(kind)) {
      return res.status(400).json({ error: 'agent_id e kind (regular|global) são obrigatórios' });
    }

    const connCheck = await query(
      `SELECT id FROM connections WHERE id = $1 AND organization_id = $2`,
      [req.params.id, userOrg.organization_id]
    );
    if (connCheck.rows.length === 0) return res.status(404).json({ error: 'Conexão não encontrada' });

    if (kind === 'regular') {
      const result = await query(`
        INSERT INTO ai_agent_connections (agent_id, connection_id, mode, priority, is_active)
        VALUES ($1, $2, 'always', 10, true)
        ON CONFLICT (agent_id, connection_id) DO UPDATE SET 
          mode = 'always', is_active = true, priority = 10
        RETURNING id
      `, [agent_id, req.params.id]);
      return res.status(201).json({ link_id: result.rows[0].id, kind: 'regular' });
    } else {
      const result = await query(`
        INSERT INTO global_agent_activations (
          global_agent_id, organization_id, connection_id, is_active, schedule_mode, activated_by
        ) VALUES ($1, $2, $3, true, 'always', $4)
        ON CONFLICT (global_agent_id, connection_id) DO UPDATE SET 
          is_active = true, schedule_mode = 'always'
        RETURNING id
      `, [agent_id, userOrg.organization_id, req.params.id, req.userId]);
      return res.status(201).json({ link_id: result.rows[0].id, kind: 'global' });
    }
  } catch (err) {
    console.error('assign agent to connection error:', err);
    res.status(500).json({ error: 'Erro ao atribuir agente', details: err.message });
  }
});

router.delete('/:id/ai-agents/:linkId', async (req, res) => {
  try {
    const { kind } = req.query;
    if (kind === 'regular') {
      await query(`DELETE FROM ai_agent_connections WHERE id = $1 AND connection_id = $2`,
        [req.params.linkId, req.params.id]);
    } else {
      await query(`DELETE FROM global_agent_activations WHERE id = $1 AND connection_id = $2`,
        [req.params.linkId, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('remove agent from connection error:', err);
    res.status(500).json({ error: 'Erro ao remover agente' });
  }
});


router.post('/:id/sync-uazapi-contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await getUserOrganization(req.userId);

    const connResult = await query(
      `SELECT * FROM connections WHERE id = $1 AND (organization_id = $2 OR user_id = $3)`,
      [id, org?.organization_id, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];
    if (connection.provider !== 'uazapi' && !connection.uazapi_token) {
      return res.status(400).json({ error: 'Conexão não é do tipo UAZAPI' });
    }

    // 1. Busca contatos da UAZAPI
    const uazResult = await uazapiProvider.listContacts(connection.uazapi_url, connection.uazapi_token, { limit: 2000 });
    if (!uazResult.success) {
      return res.status(400).json({ error: uazResult.error || 'Erro ao buscar contatos na UAZAPI' });
    }

    // 2. Garante que existe uma lista de contatos para esta conexão
    let listId;
    const listResult = await query(
      `SELECT id FROM contact_lists WHERE connection_id = $1 AND name = 'Contatos Sincronizados' LIMIT 1`,
      [connection.id]
    );

    if (listResult.rows.length === 0) {
      const newList = await query(
        `INSERT INTO contact_lists (user_id, name, connection_id) VALUES ($1, 'Contatos Sincronizados', $2) RETURNING id`,
        [req.userId, connection.id]
      );
      listId = newList.rows[0].id;
    } else {
      listId = listResult.rows[0].id;
    }

    // 3. Insere/Atualiza contatos na tabela de contatos do sistema
    let imported = 0;
    for (const contact of uazResult.contacts) {
      try {
        await query(
          `INSERT INTO contacts (list_id, name, phone, is_whatsapp)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (list_id, phone) DO UPDATE SET name = EXCLUDED.name`,
          [listId, contact.name, contact.phone]
        );
        imported++;
      } catch (err) {
        console.error('Error syncing UAZAPI contact:', err.message);
      }
    }

    res.json({ success: true, count: imported, message: `${imported} contatos sincronizados com sucesso` });
  } catch (error) {
    console.error('Sync UAZAPI contacts error:', error);
    res.status(500).json({ error: 'Erro ao sincronizar contatos' });
  }
});


export default router;
export default router;
