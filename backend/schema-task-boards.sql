-- =============================================
-- TASK BOARDS MODULE (Trello-style Kanban)
-- =============================================

-- Task Boards (Global per org or Personal per user)
CREATE TABLE IF NOT EXISTS task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_global BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Board Columns
CREATE TABLE IF NOT EXISTS task_board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  position INTEGER DEFAULT 0,
  is_done_column BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Cards
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
  status VARCHAR(20) DEFAULT 'open',
  source_module VARCHAR(50),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Card Checklists
CREATE TABLE IF NOT EXISTS task_card_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  position INTEGER DEFAULT 0,
  template_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Card Checklist Items
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
);

-- Task Card Attachments
CREATE TABLE IF NOT EXISTS task_card_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Card Comments
CREATE TABLE IF NOT EXISTS task_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Template Items
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_boards_org ON task_boards(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_boards_created_by ON task_boards(created_by);
CREATE INDEX IF NOT EXISTS idx_task_board_columns_board ON task_board_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_task_cards_board ON task_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_task_cards_column ON task_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_task_cards_assigned ON task_cards(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_cards_org ON task_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_cards_crm ON task_cards(crm_task_id);
CREATE INDEX IF NOT EXISTS idx_task_card_checklists_card ON task_card_checklists(card_id);
CREATE INDEX IF NOT EXISTS idx_task_card_checklist_items_checklist ON task_card_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_task_card_attachments_card ON task_card_attachments(card_id);
CREATE INDEX IF NOT EXISTS idx_task_card_comments_card ON task_card_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_org ON checklist_templates(organization_id);
