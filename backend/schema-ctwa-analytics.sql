-- ============================================
-- CLICK-TO-WHATSAPP ADS ANALYTICS
-- Rastreamento de origem e conversão de leads
-- ============================================

-- Campanhas de anúncio (fonte de leads)
CREATE TABLE IF NOT EXISTS ctwa_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identificação
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL DEFAULT 'meta',  -- 'meta', 'google', 'tiktok', 'other'
    campaign_id VARCHAR(255),                       -- ID externo da campanha
    ad_set_id VARCHAR(255),
    ad_id VARCHAR(255),
    
    -- UTM Parameters (para tracking)
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    
    -- Tracking code (código único para links)
    tracking_code VARCHAR(50) UNIQUE,
    
    -- Custo (para cálculo de ROI)
    total_spend DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'BRL',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads rastreados (cada lead que chega via anúncio)
CREATE TABLE IF NOT EXISTS ctwa_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES ctwa_campaigns(id) ON DELETE SET NULL,
    
    -- Contato
    phone VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    deal_id UUID,  -- Se converteu para negociação
    
    -- Origem
    source_platform VARCHAR(50),
    referrer_url TEXT,
    landing_page TEXT,
    
    -- UTM capturado
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    
    -- Tracking
    tracking_code VARCHAR(50),
    entry_message TEXT,  -- Primeira mensagem do lead
    
    -- Conversão
    status VARCHAR(30) DEFAULT 'new',  -- 'new', 'engaged', 'qualified', 'converted', 'lost'
    converted_at TIMESTAMP WITH TIME ZONE,
    conversion_value DECIMAL(12,2),
    
    -- Atribuição
    first_response_at TIMESTAMP WITH TIME ZONE,
    response_time_seconds INTEGER,  -- Tempo até primeira resposta
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Eventos de lead (timeline de ações)
CREATE TABLE IF NOT EXISTS ctwa_lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES ctwa_leads(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL,  -- 'message_received', 'message_sent', 'qualified', 'deal_created', 'converted'
    event_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ctwa_campaigns_org ON ctwa_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_ctwa_campaigns_tracking ON ctwa_campaigns(tracking_code);
CREATE INDEX IF NOT EXISTS idx_ctwa_leads_org ON ctwa_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_ctwa_leads_campaign ON ctwa_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ctwa_leads_phone ON ctwa_leads(phone);
CREATE INDEX IF NOT EXISTS idx_ctwa_leads_status ON ctwa_leads(status);
CREATE INDEX IF NOT EXISTS idx_ctwa_leads_created ON ctwa_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_ctwa_events_lead ON ctwa_lead_events(lead_id);

-- Comments
COMMENT ON TABLE ctwa_campaigns IS 'Campanhas de Click-to-WhatsApp Ads para rastreamento';
COMMENT ON TABLE ctwa_leads IS 'Leads capturados via anúncios com atribuição de campanha';
COMMENT ON TABLE ctwa_lead_events IS 'Timeline de eventos para cada lead';
