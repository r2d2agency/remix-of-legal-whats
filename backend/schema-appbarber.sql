-- ============================================
-- APPBARBER INTEGRATION - AI Agent External API
-- ============================================

-- Add AppBarber integration columns to ai_agents table
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS appbarber_api_key TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS appbarber_establishment_code VARCHAR(50);

COMMENT ON COLUMN ai_agents.appbarber_api_key IS 'API Key do AppBarber para integração de agendamento';
COMMENT ON COLUMN ai_agents.appbarber_establishment_code IS 'Código do estabelecimento no AppBarber';

-- Add appbarber capability to enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'appbarber' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'agent_capability')) THEN
    ALTER TYPE agent_capability ADD VALUE IF NOT EXISTS 'appbarber';
  END IF;
EXCEPTION WHEN others THEN
  -- Type may not exist, ignore
  NULL;
END $$;
