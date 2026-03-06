import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

// Self-healing: create tables if not exist
(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS task_boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_global BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_board_columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#6B7280',
        position INTEGER DEFAULT 0,
        is_done_column BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
        column_id UUID NOT NULL REFERENCES task_board_columns(id),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        position INTEGER DEFAULT 0,
        assigned_to UUID REFERENCES users(id),
        created_by UUID NOT NULL REFERENCES users(id),
        due_date TIMESTAMPTZ,
        start_date TIMESTAMPTZ,
        priority VARCHAR(20) DEFAULT 'medium',
        cover_image_url TEXT,
        deal_id UUID,
        company_id UUID,
        contact_phone VARCHAR(50),
        contact_name VARCHAR(255),
        crm_task_id UUID,
        project_id UUID,
        status VARCHAR(20) DEFAULT 'open',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_card_checklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        position INTEGER DEFAULT 0,
        template_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_card_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_id UUID NOT NULL REFERENCES task_card_checklists(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        is_completed BOOLEAN DEFAULT false,
        position INTEGER DEFAULT 0,
        due_date TIMESTAMPTZ,
        assigned_to UUID REFERENCES users(id),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_card_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
        file_url TEXT NOT NULL,
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INTEGER,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS task_card_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS checklist_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS checklist_template_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_task_boards_org ON task_boards(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_board_columns_board ON task_board_columns(board_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_cards_board ON task_cards(board_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_cards_column ON task_cards(column_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_cards_assigned ON task_cards(assigned_to)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_cards_org ON task_cards(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_card_checklists_card ON task_card_checklists(card_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_card_checklist_items_checklist ON task_card_checklist_items(checklist_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_card_attachments_card ON task_card_attachments(card_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_card_comments_card ON task_card_comments(card_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_checklist_templates_org ON checklist_templates(organization_id)`);
    // Self-heal: add project_id column if missing
    try { await query(`ALTER TABLE task_cards ADD COLUMN IF NOT EXISTS project_id UUID`); } catch {}
    // Self-heal: add source_module column if missing
    try { await query(`ALTER TABLE task_cards ADD COLUMN IF NOT EXISTS source_module VARCHAR(50)`); } catch {}
    logInfo('[TaskBoards] Self-healing tables check complete');
  } catch (e) {
    logError('[TaskBoards] Self-healing error', e);
  }
})();

// Helper
async function getUserOrg(userId) {
  const result = await query(
    `SELECT om.organization_id, om.role FROM organization_members om WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

function canManage(role) {
  return ['owner', 'admin', 'manager'].includes(role);
}

// ========== BOARDS ==========

// Helper: get group member user IDs for a manager/supervisor
async function getGroupMemberIds(userId, orgId) {
  // Get groups where user is supervisor
  const groups = await query(
    `SELECT gm2.user_id FROM crm_user_group_members gm
     JOIN crm_user_group_members gm2 ON gm2.group_id = gm.group_id
     WHERE gm.user_id = $1 AND gm.is_supervisor = true`,
    [userId]
  );
  return groups.rows.map(r => r.user_id);
}

// List boards (global + personal + managed users' boards for managers, all for admins)
router.get('/boards', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    let boardFilter;
    let params;

    if (['owner', 'admin'].includes(org.role)) {
      // Admins see ALL boards in the org
      boardFilter = `b.organization_id = $1`;
      params = [org.organization_id];
    } else if (org.role === 'manager') {
      // Managers see global + own + group members' boards
      const memberIds = await getGroupMemberIds(req.userId, org.organization_id);
      const allIds = [...new Set([req.userId, ...memberIds])];
      const placeholders = allIds.map((_, i) => `$${i + 2}`).join(',');
      boardFilter = `b.organization_id = $1 AND (b.is_global = true OR b.created_by IN (${placeholders}))`;
      params = [org.organization_id, ...allIds];
    } else {
      // Regular users: global + own
      boardFilter = `b.organization_id = $1 AND (b.is_global = true OR b.created_by = $2)`;
      params = [org.organization_id, req.userId];
    }

    const result = await query(
      `SELECT b.*, u.name as creator_name,
              (SELECT COUNT(*) FROM task_cards tc WHERE tc.board_id = b.id) as card_count
       FROM task_boards b
       LEFT JOIN users u ON u.id = b.created_by
       WHERE ${boardFilter}
       ORDER BY b.is_global DESC, b.created_at ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    logError('[TaskBoards] List boards error', error);
    res.status(500).json({ error: error.message });
  }
});

// Create board
router.post('/boards', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const { name, is_global, columns } = req.body;

    // Only admins can create global boards
    if (is_global && !canManage(org.role)) {
      return res.status(403).json({ error: 'Sem permissão para criar quadro global' });
    }

    const result = await query(
      `INSERT INTO task_boards (organization_id, name, is_global, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [org.organization_id, name, is_global || false, req.userId]
    );

    const board = result.rows[0];

    // Create default columns if none provided
    const defaultCols = columns || [
      { name: 'A Fazer', color: '#6B7280', position: 0 },
      { name: 'Em Andamento', color: '#3B82F6', position: 1 },
      { name: 'Concluído', color: '#10B981', position: 2, is_done_column: true },
    ];

    for (const col of defaultCols) {
      await query(
        `INSERT INTO task_board_columns (board_id, name, color, position, is_done_column)
         VALUES ($1, $2, $3, $4, $5)`,
        [board.id, col.name, col.color || '#6B7280', col.position, col.is_done_column || false]
      );
    }

    res.json(board);
  } catch (error) {
    logError('[TaskBoards] Create board error', error);
    res.status(500).json({ error: error.message });
  }
});

// Update board
router.put('/boards/:id', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const { name } = req.body;
    const result = await query(
      `UPDATE task_boards SET name = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
         AND (is_global = false AND created_by = $4 OR $5 = true)
       RETURNING *`,
      [name, req.params.id, org.organization_id, req.userId, canManage(org.role)]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Quadro não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    logError('[TaskBoards] Update board error', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete board (not the default global)
router.delete('/boards/:id', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    // Check if it's the first global board (can't delete)
    const board = await query(
      `SELECT * FROM task_boards WHERE id = $1 AND organization_id = $2`,
      [req.params.id, org.organization_id]
    );
    if (!board.rows[0]) return res.status(404).json({ error: 'Quadro não encontrado' });

    const firstGlobal = await query(
      `SELECT id FROM task_boards WHERE organization_id = $1 AND is_global = true ORDER BY created_at ASC LIMIT 1`,
      [org.organization_id]
    );
    if (firstGlobal.rows[0]?.id === req.params.id) {
      return res.status(400).json({ error: 'Não é possível excluir o quadro global padrão' });
    }

    // Personal boards: only owner can delete. Global: only admin
    if (board.rows[0].is_global && !canManage(org.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (!board.rows[0].is_global && board.rows[0].created_by !== req.userId) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await query(`DELETE FROM task_boards WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logError('[TaskBoards] Delete board error', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== COLUMNS ==========

// List columns of a board
router.get('/boards/:boardId/columns', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM task_board_columns WHERE board_id = $1 ORDER BY position ASC`,
      [req.params.boardId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create column
router.post('/boards/:boardId/columns', async (req, res) => {
  try {
    const { name, color, is_done_column } = req.body;
    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_board_columns WHERE board_id = $1`,
      [req.params.boardId]
    );
    const result = await query(
      `INSERT INTO task_board_columns (board_id, name, color, position, is_done_column)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.boardId, name, color || '#6B7280', maxPos.rows[0].next_pos, is_done_column || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update column
router.put('/columns/:id', async (req, res) => {
  try {
    const { name, color, is_done_column } = req.body;
    const result = await query(
      `UPDATE task_board_columns SET name = COALESCE($1, name), color = COALESCE($2, color), is_done_column = COALESCE($3, is_done_column)
       WHERE id = $4 RETURNING *`,
      [name, color, is_done_column, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete column
router.delete('/columns/:id', async (req, res) => {
  try {
    // Move cards to first column of same board
    const col = await query(`SELECT * FROM task_board_columns WHERE id = $1`, [req.params.id]);
    if (!col.rows[0]) return res.status(404).json({ error: 'Coluna não encontrada' });

    const firstCol = await query(
      `SELECT id FROM task_board_columns WHERE board_id = $1 AND id != $2 ORDER BY position ASC LIMIT 1`,
      [col.rows[0].board_id, req.params.id]
    );
    if (firstCol.rows[0]) {
      await query(`UPDATE task_cards SET column_id = $1 WHERE column_id = $2`, [firstCol.rows[0].id, req.params.id]);
    }
    await query(`DELETE FROM task_board_columns WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder columns
router.put('/boards/:boardId/columns/reorder', async (req, res) => {
  try {
    const { column_ids } = req.body;
    for (let i = 0; i < column_ids.length; i++) {
      await query(`UPDATE task_board_columns SET position = $1 WHERE id = $2 AND board_id = $3`,
        [i, column_ids[i], req.params.boardId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CARDS ==========

// List cards of a board
router.get('/boards/:boardId/cards', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    // Check board access
    const board = await query(
      `SELECT * FROM task_boards WHERE id = $1 AND organization_id = $2`,
      [req.params.boardId, org.organization_id]
    );
    if (!board.rows[0]) return res.status(404).json({ error: 'Quadro não encontrado' });

    // Personal boards: admins can see all, managers can see group members', sellers only own
    if (!board.rows[0].is_global && board.rows[0].created_by !== req.userId) {
      if (['owner', 'admin'].includes(org.role)) {
        // admins can see all personal boards
      } else if (org.role === 'manager') {
        const memberIds = await getGroupMemberIds(req.userId, org.organization_id);
        if (!memberIds.includes(board.rows[0].created_by)) {
          return res.status(403).json({ error: 'Sem acesso a este quadro' });
        }
      } else {
        return res.status(403).json({ error: 'Sem acesso a este quadro' });
      }
    }

    const isManagerOrAdmin = canManage(org.role);
    const { filter_user, due_from, due_to } = req.query;

    let extraFilters = '';
    const params = [req.params.boardId];
    let paramIdx = 2;

    // Role-based filtering
    if (board.rows[0].is_global && !isManagerOrAdmin) {
      // Sellers on global boards: only see cards assigned to them or created by them
      extraFilters += ` AND (tc.assigned_to = $${paramIdx} OR tc.created_by = $${paramIdx})`;
      params.push(req.userId);
      paramIdx++;
    } else if (isManagerOrAdmin && filter_user && filter_user !== 'all') {
      // Admin/manager filtering by specific user (works on any board)
      extraFilters += ` AND (tc.assigned_to = $${paramIdx} OR tc.created_by = $${paramIdx})`;
      params.push(filter_user);
      paramIdx++;
    }

    // Date filters
    if (due_from) {
      extraFilters += ` AND tc.due_date >= $${paramIdx}`;
      params.push(due_from);
      paramIdx++;
    }
    if (due_to) {
      extraFilters += ` AND tc.due_date <= $${paramIdx}`;
      params.push(due_to);
      paramIdx++;
    }

    const result = await query(
      `SELECT tc.*, u.name as assigned_name, cu.name as creator_name,
              d.title as deal_title, comp.name as company_name,
              (SELECT COUNT(*) FROM task_card_checklists tcl WHERE tcl.card_id = tc.id) as checklist_count,
              (SELECT COUNT(*) FROM task_card_checklist_items tci 
               JOIN task_card_checklists tcl2 ON tcl2.id = tci.checklist_id 
               WHERE tcl2.card_id = tc.id) as checklist_total,
              (SELECT COUNT(*) FROM task_card_checklist_items tci2 
               JOIN task_card_checklists tcl3 ON tcl3.id = tci2.checklist_id 
               WHERE tcl3.card_id = tc.id AND tci2.is_completed = true) as checklist_done,
              (SELECT COUNT(*) FROM task_card_attachments tca WHERE tca.card_id = tc.id) as attachment_count,
              (SELECT COUNT(*) FROM task_card_comments tcc WHERE tcc.card_id = tc.id) as comment_count
       FROM task_cards tc
       LEFT JOIN users u ON u.id = tc.assigned_to
       LEFT JOIN users cu ON cu.id = tc.created_by
       LEFT JOIN crm_deals d ON d.id = tc.deal_id
       LEFT JOIN crm_companies comp ON comp.id = tc.company_id
       WHERE tc.board_id = $1 ${extraFilters}
       ORDER BY tc.column_id, tc.position ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    logError('[TaskBoards] List cards error', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single card detail
router.get('/cards/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT tc.*, u.name as assigned_name, cu.name as creator_name,
              d.title as deal_title, comp.name as company_name,
              p.title as project_title, ps.name as project_stage
       FROM task_cards tc
       LEFT JOIN users u ON u.id = tc.assigned_to
       LEFT JOIN users cu ON cu.id = tc.created_by
       LEFT JOIN crm_deals d ON d.id = tc.deal_id
       LEFT JOIN crm_companies comp ON comp.id = tc.company_id
       LEFT JOIN projects p ON p.id = tc.project_id
       LEFT JOIN project_stages ps ON ps.id = p.stage_id
       WHERE tc.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Card não encontrado' });

    // Get checklists with items
    const checklists = await query(
      `SELECT cl.*, json_agg(json_build_object(
         'id', cli.id, 'title', cli.title, 'is_completed', cli.is_completed,
         'position', cli.position, 'due_date', cli.due_date,
         'assigned_to', cli.assigned_to, 'completed_at', cli.completed_at
       ) ORDER BY cli.position) FILTER (WHERE cli.id IS NOT NULL) as items
       FROM task_card_checklists cl
       LEFT JOIN task_card_checklist_items cli ON cli.checklist_id = cl.id
       WHERE cl.card_id = $1
       GROUP BY cl.id
       ORDER BY cl.position`,
      [req.params.id]
    );

    // Get attachments
    const attachments = await query(
      `SELECT a.*, u.name as uploaded_by_name FROM task_card_attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.card_id = $1 ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    // Get comments
    const comments = await query(
      `SELECT c.*, u.name as user_name FROM task_card_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.card_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...result.rows[0],
      checklists: checklists.rows,
      attachments: attachments.rows,
      comments: comments.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create card
router.post('/cards', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const { board_id, column_id, title, description, assigned_to, due_date, start_date, priority, deal_id, company_id, contact_phone, contact_name, cover_image_url, source_module } = req.body;

    // Check board access
    const board = await query(`SELECT * FROM task_boards WHERE id = $1 AND organization_id = $2`, [board_id, org.organization_id]);
    if (!board.rows[0]) return res.status(404).json({ error: 'Quadro não encontrado' });

    // Personal boards: assignee is always the user
    const finalAssignee = board.rows[0].is_global ? (assigned_to || req.userId) : req.userId;

    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_cards WHERE column_id = $1`,
      [column_id]
    );

    const result = await query(
      `INSERT INTO task_cards (organization_id, board_id, column_id, title, description, position, assigned_to, created_by, due_date, start_date, priority, deal_id, company_id, contact_phone, contact_name, cover_image_url, source_module)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [org.organization_id, board_id, column_id, title, description, maxPos.rows[0].next_pos, finalAssignee, req.userId, due_date, start_date, priority || 'medium', deal_id, company_id, contact_phone, contact_name, cover_image_url, source_module || 'manual']
    );
    res.json(result.rows[0]);
  } catch (error) {
    logError('[TaskBoards] Create card error', error);
    res.status(500).json({ error: error.message });
  }
});

// Update card
router.put('/cards/:id', async (req, res) => {
  try {
    const { title, description, assigned_to, due_date, start_date, priority, cover_image_url, deal_id, company_id, contact_phone, contact_name, status, project_id } = req.body;

    const updates = [];
    const params = [];
    let paramIdx = 1;

    const fields = { title, description, assigned_to, due_date, start_date, priority, cover_image_url, deal_id, company_id, contact_phone, contact_name, status, project_id };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = $${paramIdx}`);
        params.push(val);
        paramIdx++;
      }
    }

    if (status === 'completed') {
      updates.push(`completed_at = NOW()`);
    } else if (status !== undefined) {
      updates.push(`completed_at = NULL`);
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
      `UPDATE task_cards SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move card (change column and/or position)
router.post('/cards/:id/move', async (req, res) => {
  try {
    const { column_id, position, board_id } = req.body;

    if (board_id) {
      // Moving to another board - get first column
      const firstCol = await query(
        `SELECT id FROM task_board_columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1`,
        [board_id]
      );
      if (!firstCol.rows[0]) return res.status(400).json({ error: 'Quadro destino sem colunas' });

      await query(
        `UPDATE task_cards SET board_id = $1, column_id = $2, position = 0, updated_at = NOW() WHERE id = $3`,
        [board_id, firstCol.rows[0].id, req.params.id]
      );
    } else if (column_id !== undefined) {
      const pos = position !== undefined ? position : 0;
      await query(
        `UPDATE task_cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3`,
        [column_id, pos, req.params.id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duplicate card
router.post('/cards/:id/duplicate', async (req, res) => {
  try {
    const { target_board_id } = req.body;
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    // Get original card
    const original = await query(`SELECT * FROM task_cards WHERE id = $1`, [req.params.id]);
    if (!original.rows[0]) return res.status(404).json({ error: 'Card não encontrado' });

    const card = original.rows[0];
    const boardId = target_board_id || card.board_id;

    // Get first column of target board
    const firstCol = await query(
      `SELECT id FROM task_board_columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1`,
      [boardId]
    );
    if (!firstCol.rows[0]) return res.status(400).json({ error: 'Quadro sem colunas' });

    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_cards WHERE column_id = $1`,
      [firstCol.rows[0].id]
    );

    const result = await query(
      `INSERT INTO task_cards (organization_id, board_id, column_id, title, description, position, assigned_to, created_by, due_date, start_date, priority, deal_id, company_id, contact_phone, contact_name, cover_image_url, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [card.organization_id, boardId, firstCol.rows[0].id, card.title + ' (cópia)', card.description, maxPos.rows[0].next_pos,
       card.assigned_to, req.userId, card.due_date, card.start_date, card.priority, card.deal_id, card.company_id,
       card.contact_phone, card.contact_name, card.cover_image_url, card.project_id]
    );

    // Duplicate checklists and items
    const checklists = await query(`SELECT * FROM task_card_checklists WHERE card_id = $1 ORDER BY position`, [card.id]);
    for (const cl of checklists.rows) {
      const newCl = await query(
        `INSERT INTO task_card_checklists (card_id, title, position, template_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [result.rows[0].id, cl.title, cl.position, cl.template_id]
      );
      const items = await query(`SELECT * FROM task_card_checklist_items WHERE checklist_id = $1 ORDER BY position`, [cl.id]);
      for (const item of items.rows) {
        await query(
          `INSERT INTO task_card_checklist_items (checklist_id, title, position, due_date) VALUES ($1, $2, $3, $4)`,
          [newCl.rows[0].id, item.title, item.position, item.due_date]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('[TaskBoards] Duplicate card error', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete card
router.delete('/cards/:id', async (req, res) => {
  try {
    await query(`DELETE FROM task_cards WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CHECKLISTS ==========

// Add checklist to card
router.post('/cards/:cardId/checklists', async (req, res) => {
  try {
    const { title, template_id } = req.body;
    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as p FROM task_card_checklists WHERE card_id = $1`,
      [req.params.cardId]
    );

    const result = await query(
      `INSERT INTO task_card_checklists (card_id, title, position, template_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.cardId, title, maxPos.rows[0].p, template_id]
    );

    // If from template, copy items
    if (template_id) {
      const templateItems = await query(
        `SELECT * FROM checklist_template_items WHERE template_id = $1 ORDER BY position`,
        [template_id]
      );
      for (const item of templateItems.rows) {
        await query(
          `INSERT INTO task_card_checklist_items (checklist_id, title, position)
           VALUES ($1, $2, $3)`,
          [result.rows[0].id, item.title, item.position]
        );
      }
    }

    // Return checklist with items
    const items = await query(
      `SELECT * FROM task_card_checklist_items WHERE checklist_id = $1 ORDER BY position`,
      [result.rows[0].id]
    );

    res.json({ ...result.rows[0], items: items.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete checklist
router.delete('/checklists/:id', async (req, res) => {
  try {
    await query(`DELETE FROM task_card_checklists WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add checklist item
router.post('/checklists/:checklistId/items', async (req, res) => {
  try {
    const { title } = req.body;
    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as p FROM task_card_checklist_items WHERE checklist_id = $1`,
      [req.params.checklistId]
    );
    const result = await query(
      `INSERT INTO task_card_checklist_items (checklist_id, title, position)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.checklistId, title, maxPos.rows[0].p]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle checklist item
router.put('/checklist-items/:id', async (req, res) => {
  try {
    const { is_completed, title, due_date } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (is_completed !== undefined) {
      updates.push(`is_completed = $${idx}`);
      params.push(is_completed);
      idx++;
      updates.push(is_completed ? `completed_at = NOW()` : `completed_at = NULL`);
    }
    if (title !== undefined) {
      updates.push(`title = $${idx}`);
      params.push(title);
      idx++;
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${idx}`);
      params.push(due_date);
      idx++;
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE task_card_checklist_items SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete checklist item
router.delete('/checklist-items/:id', async (req, res) => {
  try {
    await query(`DELETE FROM task_card_checklist_items WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ATTACHMENTS ==========

router.post('/cards/:cardId/attachments', async (req, res) => {
  try {
    const { file_url, file_name, file_type, file_size } = req.body;
    const result = await query(
      `INSERT INTO task_card_attachments (card_id, file_url, file_name, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.cardId, file_url, file_name, file_type, file_size, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/attachments/:id', async (req, res) => {
  try {
    await query(`DELETE FROM task_card_attachments WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMENTS ==========

router.post('/cards/:cardId/comments', async (req, res) => {
  try {
    const { content } = req.body;
    const result = await query(
      `INSERT INTO task_card_comments (card_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.cardId, req.userId, content]
    );
    const comment = await query(
      `SELECT c.*, u.name as user_name FROM task_card_comments c
       LEFT JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
      [result.rows[0].id]
    );
    res.json(comment.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/comments/:id', async (req, res) => {
  try {
    await query(`DELETE FROM task_card_comments WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CHECKLIST TEMPLATES ==========

router.get('/checklist-templates', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const result = await query(
      `SELECT ct.*, u.name as creator_name,
              json_agg(json_build_object('id', cti.id, 'title', cti.title, 'position', cti.position)
                ORDER BY cti.position) FILTER (WHERE cti.id IS NOT NULL) as items
       FROM checklist_templates ct
       LEFT JOIN users u ON u.id = ct.created_by
       LEFT JOIN checklist_template_items cti ON cti.template_id = ct.id
       WHERE ct.organization_id = $1
       GROUP BY ct.id, u.name
       ORDER BY ct.created_at DESC`,
      [org.organization_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/checklist-templates', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    const { name, items } = req.body;
    const result = await query(
      `INSERT INTO checklist_templates (organization_id, name, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [org.organization_id, name, req.userId]
    );

    if (items?.length) {
      for (let i = 0; i < items.length; i++) {
        await query(
          `INSERT INTO checklist_template_items (template_id, title, position)
           VALUES ($1, $2, $3)`,
          [result.rows[0].id, items[i].title, i]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/checklist-templates/:id', async (req, res) => {
  try {
    const { name, items } = req.body;
    await query(`UPDATE checklist_templates SET name = $1, updated_at = NOW() WHERE id = $2`, [name, req.params.id]);

    // Replace items
    if (items) {
      await query(`DELETE FROM checklist_template_items WHERE template_id = $1`, [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        await query(
          `INSERT INTO checklist_template_items (template_id, title, position)
           VALUES ($1, $2, $3)`,
          [req.params.id, items[i].title, i]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/checklist-templates/:id', async (req, res) => {
  try {
    await query(`DELETE FROM checklist_templates WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MIGRATE CRM TASKS ==========

router.post('/migrate-crm-tasks', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });
    if (!canManage(org.role)) return res.status(403).json({ error: 'Sem permissão' });

    // Get or create default global board
    let board = await query(
      `SELECT id FROM task_boards WHERE organization_id = $1 AND is_global = true ORDER BY created_at ASC LIMIT 1`,
      [org.organization_id]
    );

    if (!board.rows[0]) {
      // Create default global board
      const newBoard = await query(
        `INSERT INTO task_boards (organization_id, name, is_global, created_by)
         VALUES ($1, 'Tarefas Gerais', true, $2) RETURNING id`,
        [org.organization_id, req.userId]
      );
      board = { rows: [newBoard.rows[0]] };

      // Create default columns
      const cols = [
        { name: 'A Fazer', color: '#6B7280', position: 0 },
        { name: 'Em Andamento', color: '#3B82F6', position: 1 },
        { name: 'Concluído', color: '#10B981', position: 2, is_done: true },
      ];
      for (const c of cols) {
        await query(
          `INSERT INTO task_board_columns (board_id, name, color, position, is_done_column)
           VALUES ($1, $2, $3, $4, $5)`,
          [board.rows[0].id, c.name, c.color, c.position, c.is_done || false]
        );
      }
    }

    const boardId = board.rows[0].id;
    const columns = await query(
      `SELECT * FROM task_board_columns WHERE board_id = $1 ORDER BY position ASC`,
      [boardId]
    );

    if (!columns.rows.length) return res.status(400).json({ error: 'Quadro sem colunas' });

    const firstCol = columns.rows[0].id;
    const doneCol = columns.rows.find(c => c.is_done_column)?.id || columns.rows[columns.rows.length - 1].id;

    // Get existing CRM tasks not yet migrated
    const crmTasks = await query(
      `SELECT t.* FROM crm_tasks t
       WHERE t.organization_id = $1
         AND NOT EXISTS (SELECT 1 FROM task_cards tc WHERE tc.crm_task_id = t.id)
       ORDER BY t.created_at ASC`,
      [org.organization_id]
    );

    let migrated = 0;
    for (const task of crmTasks.rows) {
      const targetCol = task.status === 'completed' ? doneCol : firstCol;
      await query(
        `INSERT INTO task_cards (organization_id, board_id, column_id, title, description, assigned_to, created_by, due_date, priority, deal_id, company_id, crm_task_id, status, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [org.organization_id, boardId, targetCol, task.title, task.description, task.assigned_to, task.created_by || req.userId, task.due_date, task.priority || 'medium', task.deal_id, task.company_id, task.id, task.status || 'open', task.completed_at, task.created_at]
      );
      migrated++;
    }

    res.json({ success: true, migrated });
  } catch (error) {
    logError('[TaskBoards] Migrate CRM tasks error', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ENSURE DEFAULT BOARD ==========

router.post('/ensure-default-board', async (req, res) => {
  try {
    const org = await getUserOrg(req.userId);
    if (!org) return res.status(403).json({ error: 'Sem organização' });

    let board = await query(
      `SELECT * FROM task_boards WHERE organization_id = $1 AND is_global = true ORDER BY created_at ASC LIMIT 1`,
      [org.organization_id]
    );

    if (!board.rows[0]) {
      const newBoard = await query(
        `INSERT INTO task_boards (organization_id, name, is_global, created_by)
         VALUES ($1, 'Tarefas Gerais', true, $2) RETURNING *`,
        [org.organization_id, req.userId]
      );
      board = { rows: [newBoard.rows[0]] };

      const cols = [
        { name: 'A Fazer', color: '#6B7280', position: 0 },
        { name: 'Em Andamento', color: '#3B82F6', position: 1 },
        { name: 'Concluído', color: '#10B981', position: 2, is_done: true },
      ];
      for (const c of cols) {
        await query(
          `INSERT INTO task_board_columns (board_id, name, color, position, is_done_column)
           VALUES ($1, $2, $3, $4, $5)`,
          [board.rows[0].id, c.name, c.color, c.position, c.is_done || false]
        );
      }
    }

    res.json(board.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
