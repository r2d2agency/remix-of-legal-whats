-- If group_secretary_config doesn't exist but secretary_configs does, rename it or create it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'group_secretary_config') AND EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'secretary_configs') THEN
        ALTER TABLE secretary_configs RENAME TO group_secretary_config;
    END IF;
END $$;

-- Now ensure the table exists
CREATE TABLE IF NOT EXISTS group_secretary_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    connection_ids UUID[] DEFAULT NULL,
    group_jids TEXT[] DEFAULT NULL,
    ai_provider VARCHAR(20),
    ai_model VARCHAR(100),
    ai_api_key TEXT,
    create_crm_task BOOLEAN DEFAULT true,
    show_popup_alert BOOLEAN DEFAULT true,
    min_confidence DECIMAL(3,2) DEFAULT 0.6,
    notify_external_enabled BOOLEAN DEFAULT false,
    notify_external_phone VARCHAR(50),
    notify_members_whatsapp BOOLEAN DEFAULT false,
    default_connection_id UUID,
    followup_enabled BOOLEAN DEFAULT false,
    followup_hours INTEGER DEFAULT 4,
    daily_digest_enabled BOOLEAN DEFAULT false,
    daily_digest_hour INTEGER DEFAULT 8,
    daily_digest_type TEXT DEFAULT 'detailed',
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_message TEXT,
    excluded_senders TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add daily_digest_minute column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_secretary_config' AND column_name = 'daily_digest_minute') THEN
        ALTER TABLE group_secretary_config ADD COLUMN daily_digest_minute INTEGER DEFAULT 0;
    END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_secretary_config TO authenticated;
GRANT ALL ON public.group_secretary_config TO service_role;
