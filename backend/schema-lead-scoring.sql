-- ============================================
-- LEAD SCORING MODULE
-- Sistema de pontuação automática de leads com IA
-- ============================================

-- Lead scoring configuration per organization
CREATE TABLE IF NOT EXISTS lead_scoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    
    -- Weight factors (0-100, total should be 100 for best results)
    weight_response_time INTEGER DEFAULT 20,        -- Tempo de resposta do lead
    weight_engagement INTEGER DEFAULT 25,           -- Engajamento (mensagens, interações)
    weight_profile_completeness INTEGER DEFAULT 15, -- Dados completos (email, empresa, etc)
    weight_deal_value INTEGER DEFAULT 20,           -- Valor da negociação
    weight_funnel_progress INTEGER DEFAULT 10,      -- Progresso no funil
    weight_recency INTEGER DEFAULT 10,              -- Atividade recente
    
    -- Thresholds
    hot_threshold INTEGER DEFAULT 70,    -- Score >= hot_threshold = HOT lead
    warm_threshold INTEGER DEFAULT 40,   -- Score >= warm_threshold = WARM lead
    -- Below warm_threshold = COLD lead
    
    -- Auto-update settings
    auto_update_on_message BOOLEAN DEFAULT true,
    auto_update_on_stage_change BOOLEAN DEFAULT true,
    recalculate_interval_hours INTEGER DEFAULT 24,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Lead scores per deal
CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    
    -- Overall score (0-100)
    score INTEGER DEFAULT 0,
    score_label VARCHAR(10) DEFAULT 'cold', -- 'hot', 'warm', 'cold'
    
    -- Individual scores breakdown (0-100 each)
    score_response_time INTEGER DEFAULT 0,
    score_engagement INTEGER DEFAULT 0,
    score_profile INTEGER DEFAULT 0,
    score_value INTEGER DEFAULT 0,
    score_funnel INTEGER DEFAULT 0,
    score_recency INTEGER DEFAULT 0,
    
    -- Metadata for scoring
    total_messages INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    last_contact_response_at TIMESTAMP WITH TIME ZONE,
    profile_fields_filled INTEGER DEFAULT 0,
    profile_fields_total INTEGER DEFAULT 10,
    funnel_stages_completed INTEGER DEFAULT 0,
    funnel_stages_total INTEGER DEFAULT 1,
    
    -- AI insights (optional)
    ai_summary TEXT,
    ai_recommended_action TEXT,
    ai_analyzed_at TIMESTAMP WITH TIME ZONE,
    
    -- Trend tracking
    previous_score INTEGER,
    score_trend VARCHAR(10), -- 'up', 'down', 'stable'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(deal_id)
);

-- Lead score history for trend analysis
CREATE TABLE IF NOT EXISTS lead_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    score_label VARCHAR(10),
    trigger_event VARCHAR(50), -- 'message_received', 'stage_changed', 'scheduled', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_scores_org ON lead_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_deal ON lead_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scores_label ON lead_scores(score_label);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_deal ON lead_score_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_created ON lead_score_history(created_at DESC);

-- Add lead_score column to crm_deals for quick access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_deals' AND column_name = 'lead_score'
    ) THEN
        ALTER TABLE crm_deals ADD COLUMN lead_score INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_deals' AND column_name = 'lead_score_label'
    ) THEN
        ALTER TABLE crm_deals ADD COLUMN lead_score_label VARCHAR(10) DEFAULT 'cold';
    END IF;
END $$;

-- Comments
COMMENT ON TABLE lead_scoring_config IS 'Configuration for lead scoring weights and thresholds per organization';
COMMENT ON TABLE lead_scores IS 'Detailed lead scores per deal with breakdown by factor';
COMMENT ON TABLE lead_score_history IS 'Historical score changes for trend analysis';
