import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List user message templates
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

// Get single message template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM message_templates WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagem' });
  }
});

// Create message template
router.post('/', async (req, res) => {
  try {
    const { name, items } = req.body;

    if (!name || !items) {
      return res.status(400).json({ error: 'Nome e itens são obrigatórios' });
    }

    const result = await query(
      `INSERT INTO message_templates (user_id, name, items)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, name, JSON.stringify(items)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
});

// Update message template
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, items } = req.body;

    const result = await query(
      `UPDATE message_templates 
       SET name = COALESCE($1, name),
           items = COALESCE($2, items),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, items ? JSON.stringify(items) : null, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Erro ao atualizar mensagem' });
  }
});

// Delete message template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM message_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
});

export default router;
