-- Permission Templates
-- Allows creating custom permission profiles that can be assigned to users
-- Each template defines which pages/modules the user can access

CREATE TABLE IF NOT EXISTS permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6366f1',
  -- JSONB with page keys mapped to boolean
  -- e.g. { "chat": true, "crm_negociacoes": true, "crm_empresas": false, ... }
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_templates_org ON permission_templates(organization_id);

-- Add permission_template_id to organization_members
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS permission_template_id UUID REFERENCES permission_templates(id) ON DELETE SET NULL;
