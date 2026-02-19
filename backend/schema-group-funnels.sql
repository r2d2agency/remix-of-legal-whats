-- Vinculação de Funis a Grupos de Usuários CRM
-- Permite controlar quais kanbans cada grupo pode acessar

CREATE TABLE IF NOT EXISTS crm_group_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES crm_user_groups(id) ON DELETE CASCADE NOT NULL,
    funnel_id UUID REFERENCES crm_funnels(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, funnel_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_group_funnels_group ON crm_group_funnels(group_id);
CREATE INDEX IF NOT EXISTS idx_crm_group_funnels_funnel ON crm_group_funnels(funnel_id);
