-- ============================================
-- EXTERNAL FORMS / FLUXOS EXTERNOS MODULE
-- Capture leads via public forms with chat-like UI
-- ============================================

-- Form definitions table
CREATE TABLE IF NOT EXISTS external_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(20) DEFAULT '#6366f1',
  background_color VARCHAR(20) DEFAULT '#ffffff',
  text_color VARCHAR(20) DEFAULT '#1f2937',
  button_text VARCHAR(100) DEFAULT 'Enviar',
  welcome_message TEXT DEFAULT 'Olá! Vamos começar?',
  
  -- Post-submission config
  thank_you_message TEXT DEFAULT 'Obrigado pelo contato! Em breve entraremos em contato.',
  redirect_url TEXT,
  trigger_flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  
  -- Stats
  views_count INTEGER DEFAULT 0,
  submissions_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, slug)
);

-- Form fields (customizable per form)
CREATE TABLE IF NOT EXISTS external_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES external_forms(id) ON DELETE CASCADE,
  
  field_key VARCHAR(100) NOT NULL, -- internal name: name, phone, city, etc.
  field_label VARCHAR(255) NOT NULL, -- display label
  field_type VARCHAR(50) DEFAULT 'text', -- text, phone, email, select, textarea
  placeholder TEXT,
  is_required BOOLEAN DEFAULT false,
  validation_regex TEXT,
  options JSONB, -- for select fields: ["Option 1", "Option 2"]
  position INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(form_id, field_key)
);

-- Form submissions (leads captured)
CREATE TABLE IF NOT EXISTS external_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES external_forms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Core captured data
  data JSONB NOT NULL DEFAULT '{}',
  
  -- Extracted standard fields for easy querying
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  
  -- Tracking
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Integration status
  prospect_id UUID REFERENCES crm_prospects(id),
  contact_id UUID REFERENCES chat_contacts(id),
  flow_session_id UUID,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_forms_org ON external_forms(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_forms_slug ON external_forms(slug);
CREATE INDEX IF NOT EXISTS idx_external_forms_active ON external_forms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_external_form_fields_form ON external_form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_external_form_submissions_form ON external_form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_external_form_submissions_org ON external_form_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_form_submissions_phone ON external_form_submissions(phone);
CREATE INDEX IF NOT EXISTS idx_external_form_submissions_created ON external_form_submissions(created_at DESC);
