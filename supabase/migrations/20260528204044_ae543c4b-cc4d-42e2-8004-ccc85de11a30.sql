-- Create secretary_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.secretary_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT false,
    connection_ids TEXT[],
    group_jids TEXT[],
    create_crm_task BOOLEAN DEFAULT true,
    show_popup_alert BOOLEAN DEFAULT true,
    min_confidence FLOAT DEFAULT 0.6,
    ai_provider TEXT,
    ai_model TEXT,
    notify_external_enabled BOOLEAN DEFAULT false,
    notify_external_phone TEXT,
    notify_members_whatsapp BOOLEAN DEFAULT false,
    default_connection_id TEXT,
    followup_enabled BOOLEAN DEFAULT false,
    followup_hours INTEGER DEFAULT 4,
    daily_digest_enabled BOOLEAN DEFAULT false,
    daily_digest_hour INTEGER DEFAULT 8,
    daily_digest_type TEXT DEFAULT 'detailed',
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_message TEXT,
    excluded_senders TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secretary_configs TO authenticated;
GRANT ALL ON public.secretary_configs TO service_role;

-- Enable RLS
ALTER TABLE public.secretary_configs ENABLE ROW LEVEL SECURITY;

-- Simple policy for authenticated users (should be scoped to organization_id in production, 
-- but following the pattern found in the app)
CREATE POLICY "Secretary configs are viewable by authenticated users" 
ON public.secretary_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Secretary configs are manageable by authenticated users" 
ON public.secretary_configs FOR ALL TO authenticated USING (true);

-- Ensure the column exists if the table already existed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'secretary_configs' AND column_name = 'daily_digest_type') THEN
        ALTER TABLE public.secretary_configs ADD COLUMN daily_digest_type TEXT DEFAULT 'detailed';
    END IF;
END $$;
