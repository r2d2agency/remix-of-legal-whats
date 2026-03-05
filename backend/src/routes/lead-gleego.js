import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { log, logError } from '../logger.js';

const router = Router();
router.use(authenticate);

// Ensure integration_settings column exists
(async () => {
  try {
    await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS integration_settings jsonb DEFAULT '{}'`);
  } catch (e) {
    // ignore if already exists
  }
})();

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
    const { lead_gleego_api_key } = req.body;

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

    await query(
      `UPDATE organizations 
       SET integration_settings = COALESCE(integration_settings, '{}'::jsonb) || $1::jsonb, 
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ lead_gleego_api_key }), orgId]
    );

    log(`Lead Gleego API key updated for org ${orgId}`);
    res.json({ success: true });
  } catch (err) {
    logError('Save lead-gleego settings error', err);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
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

    // Solicitar token ao Lead Extractor (server-side)
    let response;
    try {
      response = await fetch('https://api.gleego.com.br/api/auth/token-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, apiKey }),
      });
    } catch (fetchErr) {
      logError('Lead Gleego SSO fetch error (network)', fetchErr);
      return res.status(502).json({ error: 'Não foi possível conectar ao servidor Lead Gleego. Verifique sua conexão.' });
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

export default router;
