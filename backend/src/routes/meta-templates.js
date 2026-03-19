import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { buildComponentsWithExamples, validateTemplateInput } from '../lib/meta-template-utils.js';

const router = Router();
router.use(authenticate);

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';
const META_DUPLICATE_TEMPLATE_SUBCODE = 2388024;

async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role FROM organization_members om WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getMetaConnection(connectionId, orgId) {
  const result = await query(
    `SELECT * FROM connections WHERE id = $1 AND organization_id = $2 AND provider = 'meta'`,
    [connectionId, orgId]
  );
  return result.rows[0] || null;
}

// List templates from Meta API and sync to local cache
router.get('/:connectionId/templates', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const connection = await getMetaConnection(req.params.connectionId, org.organization_id);
    if (!connection) return res.status(404).json({ error: 'Conexão Meta não encontrada' });

    const { sync } = req.query;

    if (sync === 'true') {
      // Fetch from Meta API
      const response = await fetch(
        `${META_GRAPH_URL}/${connection.meta_waba_id}/message_templates?limit=250`,
        { headers: { Authorization: `Bearer ${connection.meta_token}` } }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: err.error?.message || `Erro Meta API (${response.status})`,
        });
      }

      const data = await response.json();
      const templates = data.data || [];

      // Upsert to local cache
      for (const t of templates) {
        await query(
          `INSERT INTO meta_message_templates 
             (connection_id, organization_id, meta_template_id, name, language, category, status, components, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (connection_id, meta_template_id) 
           DO UPDATE SET name = $4, language = $5, category = $6, status = $7, components = $8, synced_at = NOW(), updated_at = NOW()`,
          [
            connection.id,
            org.organization_id,
            t.id,
            t.name,
            t.language || 'pt_BR',
            t.category || 'UTILITY',
            t.status || 'PENDING',
            JSON.stringify(t.components || []),
          ]
        );
      }

      // Add unique constraint if missing (for upsert)
      try {
        await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_templates_conn_tid ON meta_message_templates(connection_id, meta_template_id)`);
      } catch (_) { /* ignore */ }
    }

    // Return from local cache
    const result = await query(
      `SELECT * FROM meta_message_templates WHERE connection_id = $1 ORDER BY name`,
      [connection.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List Meta templates error:', error);
    res.status(500).json({ error: 'Erro ao listar templates Meta' });
  }
});

// Create/submit template to Meta API
router.post('/:connectionId/templates', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const connection = await getMetaConnection(req.params.connectionId, org.organization_id);
    if (!connection) return res.status(404).json({ error: 'Conexão Meta não encontrada' });

    if (!connection.meta_token || !connection.meta_waba_id) {
      return res.status(400).json({ error: 'Conexão Meta inválida: token ou WABA ID ausente.' });
    }

    const { name, language, category, components } = req.body;
    const validation = validateTemplateInput({ name, language, category, components });

    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const cachedDuplicate = await query(
      `SELECT id, name, language, status
       FROM meta_message_templates
       WHERE connection_id = $1 AND LOWER(name) = LOWER($2) AND language = $3
       LIMIT 1`,
      [connection.id, validation.normalizedName, validation.normalizedLanguage]
    );

    if (cachedDuplicate.rows[0]) {
      return res.status(409).json({
        error: 'Já existe conteúdo em Portuguese (BR) para esse modelo. Você pode criar um novo modelo e tentar novamente.',
        code: 'META_TEMPLATE_DUPLICATE_LANGUAGE',
        details: {
          source: 'local_cache',
          existing_template: cachedDuplicate.rows[0],
        },
      });
    }

    const metaComponents = buildComponentsWithExamples(validation.normalizedComponents);

    // Submit to Meta API
    const response = await fetch(
      `${META_GRAPH_URL}/${connection.meta_waba_id}/message_templates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.meta_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: validation.normalizedName,
          language: validation.normalizedLanguage,
          category: validation.normalizedCategory,
          components: metaComponents,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const metaError = data.error || data;
      const metaErrorMessage = String(metaError?.error_user_msg || metaError?.message || '');
      const isDuplicateTemplate =
        Number(metaError?.error_subcode) === META_DUPLICATE_TEMPLATE_SUBCODE ||
        /já existe conteúdo/i.test(metaErrorMessage);

      if (isDuplicateTemplate) {
        return res.status(409).json({
          error: 'Já existe conteúdo nesse idioma para esse template. Altere nome ou idioma.',
          code: 'META_TEMPLATE_DUPLICATE_LANGUAGE',
          details: metaError,
        });
      }

      return res.status(response.status).json({
        error: metaError?.error_user_msg || metaError?.message || `Erro ao criar template (${response.status})`,
        details: metaError,
      });
    }

    // Save to local cache
    const result = await query(
      `INSERT INTO meta_message_templates 
         (connection_id, organization_id, meta_template_id, name, language, category, status, components, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        connection.id,
        org.organization_id,
        data.id,
        validation.normalizedName,
        validation.normalizedLanguage,
        validation.normalizedCategory,
        data.status || 'PENDING',
        JSON.stringify(metaComponents),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Meta template error:', error);
    res.status(500).json({ error: 'Erro ao criar template Meta' });
  }
});

// Delete template from Meta API
router.delete('/:connectionId/templates/:templateName', async (req, res) => {
  try {
    const org = await getUserOrganization(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const connection = await getMetaConnection(req.params.connectionId, org.organization_id);
    if (!connection) return res.status(404).json({ error: 'Conexão Meta não encontrada' });

    const { templateName } = req.params;

    // Delete from Meta API
    const response = await fetch(
      `${META_GRAPH_URL}/${connection.meta_waba_id}/message_templates?name=${encodeURIComponent(templateName)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${connection.meta_token}` },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `Erro ao deletar template (${response.status})`,
      });
    }

    // Remove from cache
    await query(
      `DELETE FROM meta_message_templates WHERE connection_id = $1 AND name = $2`,
      [connection.id, templateName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Meta template error:', error);
    res.status(500).json({ error: 'Erro ao deletar template Meta' });
  }
});

// Validate Meta token
router.post('/validate', async (req, res) => {
  try {
    const { token, waba_id } = req.body;
    if (!token || !waba_id) {
      return res.json({ valid: false, error: 'Token e WABA ID são obrigatórios' });
    }

    const response = await fetch(
      `${META_GRAPH_URL}/${waba_id}?fields=id,name,currency`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.json({
        valid: false,
        error: err.error?.message || `Token inválido (${response.status})`,
      });
    }

    const data = await response.json();
    res.json({ valid: true, account: data });
  } catch (error) {
    console.error('Validate Meta token error:', error);
    res.status(500).json({ valid: false, error: 'Erro ao validar token Meta' });
  }
});

export default router;
