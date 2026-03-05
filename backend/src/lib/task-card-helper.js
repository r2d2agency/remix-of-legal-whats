/**
 * Shared helper to create task cards in the Global board's first column.
 * Used by Group Secretary, CRM, AI Agents, and other modules.
 */
import { query } from '../db.js';
import { logInfo, logError } from '../logger.js';

/**
 * Create a task card in the first column of the organization's first global board.
 * If no global board exists, one is created automatically.
 * 
 * @param {Object} params
 * @param {string} params.organizationId - Organization UUID
 * @param {string} params.createdBy - User UUID who creates the card
 * @param {string} params.assignedTo - User UUID to assign to (defaults to createdBy)
 * @param {string} params.title - Card title
 * @param {string} [params.description] - Card description
 * @param {string} [params.priority] - 'low' | 'medium' | 'high' | 'urgent'
 * @param {string} [params.dueDate] - ISO date string
 * @param {string} [params.startDate] - ISO date string
 * @param {string} [params.sourceModule] - Module that created the card (e.g. 'group_secretary', 'crm', 'ai_agent')
 * @param {string} [params.dealId] - CRM deal UUID
 * @param {string} [params.companyId] - CRM company UUID
 * @param {string} [params.contactPhone] - Contact phone
 * @param {string} [params.contactName] - Contact name
 * @param {string} [params.crmTaskId] - CRM task UUID reference
 * @param {string} [params.projectId] - Project UUID
 * @returns {Promise<Object|null>} Created card or null
 */
export async function createTaskCardInGlobalBoard({
  organizationId,
  createdBy,
  assignedTo,
  title,
  description,
  priority = 'medium',
  dueDate,
  startDate,
  sourceModule,
  dealId,
  companyId,
  contactPhone,
  contactName,
  crmTaskId,
  projectId,
}) {
  try {
    // 1. Find or create the first global board
    let board = await query(
      `SELECT id FROM task_boards WHERE organization_id = $1 AND is_global = true ORDER BY created_at ASC LIMIT 1`,
      [organizationId]
    );

    let boardId;
    if (board.rows.length === 0) {
      // Create a default global board
      const newBoard = await query(
        `INSERT INTO task_boards (organization_id, name, is_global, created_by)
         VALUES ($1, 'Quadro Global', true, $2) RETURNING id`,
        [organizationId, createdBy]
      );
      boardId = newBoard.rows[0].id;

      // Create default columns
      await query(
        `INSERT INTO task_board_columns (board_id, name, color, position, is_done_column) VALUES
         ($1, 'A Fazer', '#6B7280', 0, false),
         ($1, 'Em Andamento', '#3B82F6', 1, false),
         ($1, 'Concluído', '#10B981', 2, true)`,
        [boardId]
      );
      logInfo('[TaskCardHelper]', `Created default global board for org ${organizationId}`);
    } else {
      boardId = board.rows[0].id;
    }

    // 2. Get the first column (lowest position)
    const firstCol = await query(
      `SELECT id FROM task_board_columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1`,
      [boardId]
    );
    if (!firstCol.rows[0]) {
      logError('[TaskCardHelper]', new Error('Global board has no columns'));
      return null;
    }
    const columnId = firstCol.rows[0].id;

    // 3. Get next position
    const maxPos = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_cards WHERE column_id = $1`,
      [columnId]
    );

    // 4. Insert card
    const result = await query(
      `INSERT INTO task_cards (organization_id, board_id, column_id, title, description, position, assigned_to, created_by, due_date, start_date, priority, source_module, deal_id, company_id, contact_phone, contact_name, crm_task_id, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        organizationId, boardId, columnId, title, description || null,
        maxPos.rows[0].next_pos, assignedTo || createdBy, createdBy,
        dueDate || null, startDate || null, priority || 'medium',
        sourceModule || null, dealId || null, companyId || null,
        contactPhone || null, contactName || null, crmTaskId || null, projectId || null,
      ]
    );

    logInfo('[TaskCardHelper]', `Created card "${title}" in global board (source: ${sourceModule || 'manual'})`);
    return result.rows[0];
  } catch (error) {
    logError('[TaskCardHelper] createTaskCardInGlobalBoard error', error);
    return null;
  }
}

/**
 * Source module display labels
 */
export const SOURCE_MODULE_LABELS = {
  group_secretary: 'Secretária IA',
  crm: 'CRM',
  ai_agent: 'Agente IA',
  chatbot: 'Chatbot',
  flow: 'Fluxo',
  manual: 'Manual',
  migration: 'Migração',
};
