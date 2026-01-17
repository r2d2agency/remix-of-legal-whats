-- Quick Replies (Respostas Rápidas)
-- Mensagens pré-salvas para inserção rápida no chat

CREATE TABLE quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quick_replies_org ON quick_replies(organization_id);
CREATE INDEX idx_quick_replies_shortcut ON quick_replies(shortcut);
CREATE INDEX idx_quick_replies_category ON quick_replies(category);
