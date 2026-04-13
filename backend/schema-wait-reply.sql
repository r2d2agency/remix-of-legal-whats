-- Add wait_reply columns to flow_sessions
ALTER TABLE flow_sessions ADD COLUMN IF NOT EXISTS wait_reply_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE flow_sessions ADD COLUMN IF NOT EXISTS wait_reply_variable TEXT DEFAULT NULL;

-- Index for the scheduler to efficiently find expired sessions
CREATE INDEX IF NOT EXISTS idx_flow_sessions_wait_reply ON flow_sessions (wait_reply_expires_at) WHERE is_active = true AND wait_reply_expires_at IS NOT NULL;
