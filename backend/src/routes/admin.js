import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Middleware to check superadmin
const requireSuperadmin = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT is_superadmin FROM users WHERE id = $1`,
      [req.userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].is_superadmin) {
      return res.status(403).json({ error: 'Acesso negado. Requer superadmin.' });
    }
    
    next();
  } catch (error) {
    console.error('Superadmin check error:', error);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};

// Check if current user is superadmin
router.get('/check', async (req, res) => {
  try {
    const result = await query(
      `SELECT is_superadmin FROM users WHERE id = $1`,
      [req.userId]
    );
    
    res.json({ isSuperadmin: result.rows[0]?.is_superadmin || false });
  } catch (error) {
    console.error('Check superadmin error:', error);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
});

// List all users (superadmin only)
router.get('/users', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, is_superadmin, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Set user superadmin status
router.patch('/users/:id/superadmin', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_superadmin } = req.body;

    // Can't remove own superadmin
    if (id === req.userId && !is_superadmin) {
      return res.status(400).json({ error: 'Não é possível remover seu próprio acesso superadmin' });
    }

    const result = await query(
      `UPDATE users SET is_superadmin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, is_superadmin`,
      [is_superadmin, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set superadmin error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// List all organizations (superadmin only)
router.get('/organizations', requireSuperadmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
       FROM organizations o
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ error: 'Erro ao listar organizações' });
  }
});

// Create organization (superadmin only)
router.post('/organizations', requireSuperadmin, async (req, res) => {
  try {
    const { name, slug, logo_url, owner_email } = req.body;

    if (!name || !slug || !owner_email) {
      return res.status(400).json({ error: 'Nome, slug e email do proprietário são obrigatórios' });
    }

    // Find owner user
    const userResult = await query(
      `SELECT id FROM users WHERE email = $1`,
      [owner_email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário proprietário não encontrado' });
    }

    const ownerId = userResult.rows[0].id;

    // Create organization
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, logo_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, slug, logo_url || null]
    );

    const org = orgResult.rows[0];

    // Add owner
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, ownerId]
    );

    res.status(201).json({ ...org, member_count: 1 });
  } catch (error) {
    console.error('Create organization error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Slug já está em uso' });
    }
    res.status(500).json({ error: 'Erro ao criar organização' });
  }
});

// Update organization (superadmin only)
router.patch('/organizations/:id', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo_url } = req.body;

    const result = await query(
      `UPDATE organizations 
       SET name = COALESCE($1, name),
           logo_url = COALESCE($2, logo_url),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name, logo_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Erro ao atualizar organização' });
  }
});

// Delete organization (superadmin only)
router.delete('/organizations/:id', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM organizations WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Erro ao deletar organização' });
  }
});

export default router;