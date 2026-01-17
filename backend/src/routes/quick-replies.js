import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get user's organization
async function getUserOrganization(userId) {
  const result = await query(
    `SELECT om.organization_id 
     FROM organization_members om 
     WHERE om.user_id = $1 
     LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.organization_id;
}

// ==========================================
// QUICK REPLIES
// ==========================================

// Get all quick replies for organization
router.get('/', authenticate, async (req, res) => {
  try {
    const orgId = await getUserOrganization(req.userId);
    
    if (!orgId) {
      return res.json([]);
    }

    const { category, search } = req.query;
    
    let sql = `
      SELECT qr.*, u.name as created_by_name
      FROM quick_replies qr
      LEFT JOIN users u ON u.id = qr.created_by
      WHERE qr.organization_id = $1
    `;
    
    const params = [orgId];
    let paramIndex = 2;

    if (category) {
      sql += ` AND qr.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (qr.title ILIKE $${paramIndex} OR qr.content ILIKE $${paramIndex} OR qr.shortcut ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY qr.title ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get quick replies error:', error);
    res.status(500).json({ error: 'Erro ao buscar respostas rápidas' });
  }
});

// Get categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const orgId = await getUserOrganization(req.userId);
    
    if (!orgId) {
      return res.json([]);
    }

    const result = await query(
      `SELECT DISTINCT category FROM quick_replies 
       WHERE organization_id = $1 AND category IS NOT NULL AND category != ''
       ORDER BY category`,
      [orgId]
    );
    
    res.json(result.rows.map(r => r.category));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Create quick reply
router.post('/', authenticate, async (req, res) => {
  try {
    const orgId = await getUserOrganization(req.userId);
    
    if (!orgId) {
      return res.status(400).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { title, content, shortcut, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    // Check for duplicate shortcut
    if (shortcut) {
      const existing = await query(
        `SELECT id FROM quick_replies WHERE organization_id = $1 AND shortcut = $2`,
        [orgId, shortcut]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Este atalho já está em uso' });
      }
    }

    const result = await query(
      `INSERT INTO quick_replies (organization_id, title, content, shortcut, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, title, content, shortcut || null, category || null, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create quick reply error:', error);
    res.status(500).json({ error: 'Erro ao criar resposta rápida' });
  }
});

// Update quick reply
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await getUserOrganization(req.userId);
    
    if (!orgId) {
      return res.status(400).json({ error: 'Usuário não pertence a uma organização' });
    }

    const { title, content, shortcut, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    // Check for duplicate shortcut (excluding current)
    if (shortcut) {
      const existing = await query(
        `SELECT id FROM quick_replies WHERE organization_id = $1 AND shortcut = $2 AND id != $3`,
        [orgId, shortcut, id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Este atalho já está em uso' });
      }
    }

    const result = await query(
      `UPDATE quick_replies 
       SET title = $1, content = $2, shortcut = $3, category = $4, updated_at = NOW()
       WHERE id = $5 AND organization_id = $6
       RETURNING *`,
      [title, content, shortcut || null, category || null, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resposta rápida não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update quick reply error:', error);
    res.status(500).json({ error: 'Erro ao atualizar resposta rápida' });
  }
});

// Delete quick reply
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await getUserOrganization(req.userId);
    
    if (!orgId) {
      return res.status(400).json({ error: 'Usuário não pertence a uma organização' });
    }

    const result = await query(
      `DELETE FROM quick_replies WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resposta rápida não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    res.status(500).json({ error: 'Erro ao excluir resposta rápida' });
  }
});

export default router;
