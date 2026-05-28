-- Schema para Análise de Vendas e SEO
-- Rastreamento de origem baseado em frases específicas

CREATE TABLE IF NOT EXISTS sales_seo_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- Ex: Site Principal, Landing Page Black Friday
    phrase TEXT NOT NULL, -- Frase exata: "Olá, vim através do site!"
    connection_ids UUID[] DEFAULT '{}', -- Conexões monitoradas (vazio = todas)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads rastreados por este módulo
CREATE TABLE IF NOT EXISTS sales_seo_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tracker_id UUID REFERENCES sales_seo_trackers(id) ON DELETE SET NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    
    phone VARCHAR(50) NOT NULL,
    entry_message TEXT,
    
    -- Status de evolução (calculado via IA ou manual)
    -- 1: Apenas primeira mensagem
    -- 2: Houve diálogo
    -- 3: Venda realizada
    -- 4: Perda/Churn
    evolution_status INTEGER DEFAULT 1,
    ia_analysis TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_seo_trackers_org ON sales_seo_trackers(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_tracker ON sales_seo_leads(tracker_id);
CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_conv ON sales_seo_leads(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sales_seo_leads_created ON sales_seo_leads(created_at);
