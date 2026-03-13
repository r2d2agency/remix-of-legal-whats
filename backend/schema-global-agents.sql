-- ============================================
-- GLOBAL AI AGENTS - Superadmin-managed agents for client organizations
-- ============================================

-- Global agents created by superadmin
CREATE TABLE IF NOT EXISTS global_ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  
  -- AI Configuration
  ai_provider VARCHAR(20) NOT NULL DEFAULT 'openai',
  ai_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
  ai_api_key TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'Você é um assistente virtual profissional.',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  context_window INTEGER DEFAULT 20,
  
  -- Structured fields the client can customize (JSON schema)
  -- e.g. [{ "key": "company_name", "label": "Nome da Empresa", "type": "text", "required": true }]
  custom_fields JSONB DEFAULT '[]'::jsonb,
  
  -- Capabilities
  capabilities TEXT[] DEFAULT ARRAY['respond_messages']::TEXT[],
  
  -- Handoff config
  handoff_message TEXT DEFAULT 'Vou transferir você para um atendente humano. Aguarde um momento.',
  handoff_keywords TEXT[] DEFAULT ARRAY['humano', 'atendente', 'pessoa']::TEXT[],
  
  -- Greeting
  greeting_message TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which organizations can use which global agents
CREATE TABLE IF NOT EXISTS global_agent_org_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_agent_id UUID NOT NULL REFERENCES global_ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(global_agent_id, organization_id)
);

-- Client activations of global agents on their connections
CREATE TABLE IF NOT EXISTS global_agent_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_agent_id UUID NOT NULL REFERENCES global_ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  
  -- Client-customized prompt fields (filled from custom_fields schema)
  -- e.g. { "company_name": "Acme Corp", "products": "Software" }
  custom_field_values JSONB DEFAULT '{}'::jsonb,
  
  -- Client-customized prompt additions
  prompt_additions TEXT,
  
  -- Flexible schedule: array of time windows
  -- e.g. [
  --   { "days": [1,2,3,4,5], "start": "00:00", "end": "07:00" },
  --   { "days": [1,2,3,4,5], "start": "17:30", "end": "23:59" },
  --   { "days": [6], "start": "08:00", "end": "18:00" },
  --   { "days": [0], "start": "00:00", "end": "23:59" }
  -- ]
  schedule_windows JSONB DEFAULT '[]'::jsonb,
  
  -- Schedule mode: 'always' | 'scheduled' | 'manual'
  schedule_mode VARCHAR(20) DEFAULT 'manual',
  
  activated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(global_agent_id, connection_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_global_agent_org_assignments_org ON global_agent_org_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_global_agent_org_assignments_agent ON global_agent_org_assignments(global_agent_id);
CREATE INDEX IF NOT EXISTS idx_global_agent_activations_org ON global_agent_activations(organization_id);
CREATE INDEX IF NOT EXISTS idx_global_agent_activations_conn ON global_agent_activations(connection_id);
CREATE INDEX IF NOT EXISTS idx_global_agent_activations_active ON global_agent_activations(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_global_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_global_ai_agents_updated ON global_ai_agents;
CREATE TRIGGER trigger_global_ai_agents_updated
  BEFORE UPDATE ON global_ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_global_agent_updated_at();

DROP TRIGGER IF EXISTS trigger_global_agent_activations_updated ON global_agent_activations;
CREATE TRIGGER trigger_global_agent_activations_updated
  BEFORE UPDATE ON global_agent_activations
  FOR EACH ROW EXECUTE FUNCTION update_global_agent_updated_at();
