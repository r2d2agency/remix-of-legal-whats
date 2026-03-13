import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import * as wapiProvider from '../lib/wapi-provider.js';

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
      name 
    } = req.body;

    const org = await getUserOrganization(req.userId);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da conexão é obrigatório' });
    }

    // For W-API: get token from org if not provided
    let resolvedToken = wapi_token || null;
    if (provider === 'wapi' && !resolvedToken) {
      // Fetch global W-API token from system_settings (configured by superadmin)
      const settingResult = await query(
        `SELECT value FROM system_settings WHERE key = 'wapi_token'`
      );
      resolvedToken = settingResult.rows[0]?.value || null;
    }

    // Validate based on provider
    if (provider === 'wapi') {
      if (!resolvedToken) {
        return res.status(400).json({ error: 'Token W-API não configurado. Peça ao administrador para configurar o token no painel Superadmin.' });
      }
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
        // Usa token retornado pela própria instância quando disponível; fallback para o token global.
        finalToken = created.token || resolvedToken;
        console.log('[W-API] Auto-created instance:', finalInstanceId, 'name:', instanceName);
      } catch (createError) {
        console.error('[W-API] Failed to create instance:', createError);
        return res.status(400).json({ error: `Erro ao criar instância W-API: ${createError.message}` });
      }
    }

    const result = await query(
      `INSERT INTO connections (user_id, organization_id, provider, api_url, api_key, instance_name, instance_id, wapi_token, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.userId, 
        org?.organization_id || null, 
        provider,
        api_url || null, 
        api_key || null, 
        instance_name || null,
        finalInstanceId,
        finalToken,
        name.trim()
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
    res.status(500).json({ error: 'Erro ao criar conexão' });
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
      show_groups
    } = req.body;

    const org = await getUserOrganization(req.userId);

    // Allow update if user owns the connection OR belongs to same organization
    let whereClause = 'id = $10 AND user_id = $11';
    let params = [provider, api_url, api_key, instance_name, instance_id, wapi_token, name, status, show_groups, id, req.userId];

    if (org) {
      whereClause = 'id = $10 AND organization_id = $11';
      params = [provider, api_url, api_key, instance_name, instance_id, wapi_token, name, status, show_groups, id, org.organization_id];
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
      // Migrate all conversations from a specific source connection to the target
      // Also migrate conversations with NULL connection_id (orphaned from deleted connections)
      migrateResult = await query(`
        UPDATE conversations SET connection_id = $1, updated_at = NOW()
        WHERE (connection_id = $2 OR connection_id IS NULL)
          AND id != ALL(COALESCE((SELECT array_agg(id) FROM conversations WHERE connection_id = $1), ARRAY[]::uuid[]))
        RETURNING id, contact_name, contact_phone
      `, [id, from]);

      // Also update chat_messages connection_id
      if (migrateResult.rowCount > 0) {
        const migratedIds = migrateResult.rows.map(r => r.id);
        await query(`UPDATE chat_messages SET connection_id = $1 WHERE conversation_id = ANY($2)`, [id, migratedIds]);
        
        // Also update chat_contacts
        await query(`UPDATE chat_contacts SET connection_id = $1 WHERE connection_id = $2`, [id, from]);
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
        await query(`UPDATE chat_messages SET connection_id = $1 WHERE conversation_id = ANY($2)`, [id, migratedIds]);
      }

      console.log(`[Connections] Manual migration: ${migrateResult.rowCount} conversations migrated to ${id}`);
    }

    res.json({ success: true, migrated: migrateResult.rowCount, conversations: migrateResult.rows });
  } catch (error) {
    console.error('Migrate conversations error:', error);
    res.status(500).json({ error: 'Erro ao migrar conversas' });
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

export default router;

