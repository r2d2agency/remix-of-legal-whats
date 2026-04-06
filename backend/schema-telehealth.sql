-- Telehealth / Teleatendimento module tables

CREATE TABLE IF NOT EXISTS telehealth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title VARCHAR(500),
  reason TEXT,
  notes TEXT,
  contact_id UUID,
  contact_name VARCHAR(255),
  deal_id UUID,
  deal_title VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','recording','processing','transcribing','organizing','completed','error')),
  audio_url TEXT,
  audio_size BIGINT,
  audio_duration INTEGER, -- seconds
  audio_mime VARCHAR(100),
  transcript TEXT,
  structured_content JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  consent_given BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  audio_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_org ON telehealth_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_status ON telehealth_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_created ON telehealth_sessions(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telehealth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telehealth_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telehealth_audit_session ON telehealth_audit_logs(session_id);
