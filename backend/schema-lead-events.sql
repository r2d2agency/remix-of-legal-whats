-- ============================================
-- LEAD EVENTS — Event-driven CRM/WhatsApp bus
-- ============================================
-- Single source of truth: every change to a deal/lead state is
-- recorded as an event. Stage automations + flows REACT to events,
-- they don't change state directly.
--
-- Supported event types:
--   lead_created        — new lead/deal entered the funnel
--   stage_changed       — deal moved between stages
--   message_sent        — outbound msg sent (manual/flow/automation)
--   lead_replied        — inbound msg from contact
--   no_reply_timeout    — automation timed out waiting for reply
--   follow_up_sent      — follow-up flow triggered after wait window
-- ============================================

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  deal_id UUID,                       -- nullable: events may exist before a deal
  contact_phone VARCHAR(50),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,  -- arbitrary event data
  source VARCHAR(50),                 -- 'webhook' | 'crm' | 'flow' | 'scheduler' | 'chat'
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_org ON lead_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_deal ON lead_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_phone ON lead_events(contact_phone);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_pending ON lead_events(processed, created_at) WHERE processed = false;

-- ============================================
-- Funnel-level entry rules (route lead to a stage on creation)
-- e.g. capital_disponivel >= 60000 → "Primeiro Contato"
-- ============================================
ALTER TABLE crm_funnels
  ADD COLUMN IF NOT EXISTS entry_rules JSONB DEFAULT '[]'::jsonb;

-- entry_rules format:
-- [
--   { "field": "custom_fields.capital_disponivel", "operator": ">=", "value": 60000, "stage_id": "<uuid>" },
--   { "field": "custom_fields.capital_disponivel", "operator": "<",  "value": 60000, "stage_id": "<uuid>" }
-- ]
-- Evaluated top-to-bottom; first match wins. If none match, deal stays in default stage.

-- ============================================
-- Per-stage follow-up + timeout configuration
-- ============================================
ALTER TABLE crm_stage_automations
  ADD COLUMN IF NOT EXISTS follow_up_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS follow_up_flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timeout_hours INTEGER,
  ADD COLUMN IF NOT EXISTS next_stage_on_timeout UUID REFERENCES crm_stages(id) ON DELETE SET NULL;

-- Track whether the follow-up step already ran for a deal automation
ALTER TABLE crm_deal_automations
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_crm_deal_automations_followup
  ON crm_deal_automations(follow_up_due_at)
  WHERE follow_up_sent_at IS NULL AND status IN ('pending', 'flow_sent', 'waiting');
