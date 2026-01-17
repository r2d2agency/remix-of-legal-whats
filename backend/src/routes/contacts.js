import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List user contact lists
router.get('/lists', async (req, res) => {
  try {
    const result = await query(
      `SELECT cl.*, COUNT(c.id) as contact_count
       FROM contact_lists cl
       LEFT JOIN contacts c ON c.list_id = cl.id
       WHERE cl.user_id = $1
       GROUP BY cl.id
       ORDER BY cl.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List contact lists error:', error);
    res.status(500).json({ error: 'Erro ao listar listas de contatos' });
  }
});

// Create contact list
router.post('/lists', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = await query(
      'INSERT INTO contact_lists (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.userId, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create contact list error:', error);
    res.status(500).json({ error: 'Erro ao criar lista de contatos' });
  }
});

// Delete contact list
router.delete('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM contact_lists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact list error:', error);
    res.status(500).json({ error: 'Erro ao deletar lista' });
  }
});

// List contacts from a list
router.get('/lists/:listId/contacts', async (req, res) => {
  try {
    const { listId } = req.params;

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const result = await query(
      'SELECT * FROM contacts WHERE list_id = $1 ORDER BY name ASC',
      [listId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Erro ao listar contatos' });
  }
});

// Add contact to list
router.post('/lists/:listId/contacts', async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, phone, is_whatsapp } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    }

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const result = await query(
      'INSERT INTO contacts (list_id, name, phone, is_whatsapp) VALUES ($1, $2, $3, $4) RETURNING *',
      [listId, name, phone, typeof is_whatsapp === 'boolean' ? is_whatsapp : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Erro ao adicionar contato' });
  }
});

// Bulk import contacts
router.post('/lists/:listId/import', async (req, res) => {
  try {
    const { listId } = req.params;
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Lista de contatos inválida' });
    }

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const normalized = contacts.map((c) => ({
      name: String(c?.name || '').trim(),
      phone: String(c?.phone || '').trim(),
      is_whatsapp: typeof c?.is_whatsapp === 'boolean' ? c.is_whatsapp : null,
    })).filter((c) => c.name && c.phone);

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'Lista de contatos inválida' });
    }

    // Insert contacts in batch
    const values = normalized.map((c, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
    const params = [listId, ...normalized.flatMap((c) => [c.name, c.phone, c.is_whatsapp])];

    await query(
      `INSERT INTO contacts (list_id, name, phone, is_whatsapp) VALUES ${values}`,
      params
    );

    res.json({ success: true, imported: normalized.length });
  } catch (error) {
    console.error('Import contacts error:', error);
    res.status(500).json({ error: 'Erro ao importar contatos' });
  }
});

// Update contact (name/phone/whatsapp status)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, is_whatsapp } = req.body;

    const sets = [];
    const params = [];
    let idx = 1;

    if (typeof name === 'string') {
      sets.push(`name = $${idx++}`);
      params.push(name);
    }

    if (typeof phone === 'string') {
      sets.push(`phone = $${idx++}`);
      params.push(phone);
    }

    if (typeof is_whatsapp === 'boolean') {
      sets.push(`is_whatsapp = $${idx++}`);
      params.push(is_whatsapp);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    params.push(id);
    params.push(req.userId);

    const result = await query(
      `UPDATE contacts
       SET ${sets.join(', ')}
       WHERE id = $${idx} AND list_id IN (
         SELECT id FROM contact_lists WHERE user_id = $${idx + 1}
       )
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Erro ao atualizar contato' });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify contact belongs to user's list
    const result = await query(
      `DELETE FROM contacts 
       WHERE id = $1 AND list_id IN (
         SELECT id FROM contact_lists WHERE user_id = $2
       ) RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Erro ao deletar contato' });
  }
});

export default router;
