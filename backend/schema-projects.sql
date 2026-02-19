-- Projects Module Schema
-- Sistema de Projetos vinculado ao CRM

-- Project stages (kanban columns - admin configurable)
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    position INTEGER DEFAULT 0,
    color VARCHAR(50) DEFAULT '#6366f1',
    is_final BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_stages_org ON project_stages(organization_id);

-- Project templates
CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_templates_org ON project_templates(organization_id);

-- Project template tasks
CREATE TABLE IF NOT EXISTS project_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES project_templates(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    duration_days INTEGER DEFAULT 1,
    depends_on_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_template_tasks_tpl ON project_template_tasks(template_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    deal_id UUID,
    stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_deal ON projects(deal_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_assigned ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_requested ON projects(requested_by);

-- Project attachments
CREATE TABLE IF NOT EXISTS project_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255),
    url TEXT NOT NULL,
    mimetype VARCHAR(100),
    size INTEGER,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_attachments_proj ON project_attachments(project_id);

-- Project notes (chat-like with replies)
CREATE TABLE IF NOT EXISTS project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES project_notes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_proj ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_parent ON project_notes(parent_id);

-- Project tasks (Gantt steps)
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    position INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    duration_days INTEGER DEFAULT 1,
    depends_on UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_proj ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
