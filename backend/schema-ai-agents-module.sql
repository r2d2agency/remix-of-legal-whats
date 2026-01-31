-- ============================================
-- AI AGENTS MODULE - Plan Integration
-- ============================================
-- Run this migration to add has_ai_agents column to plans table

-- Add has_ai_agents column to plans table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plans' AND column_name = 'has_ai_agents'
    ) THEN
        ALTER TABLE plans ADD COLUMN has_ai_agents BOOLEAN DEFAULT true;
        RAISE NOTICE 'Column has_ai_agents added to plans table';
    END IF;
END $$;

-- Update existing plans to have ai_agents enabled by default
UPDATE plans SET has_ai_agents = true WHERE has_ai_agents IS NULL;

-- Update organizations modules_enabled to include ai_agents
UPDATE organizations 
SET modules_enabled = modules_enabled || '{"ai_agents": true}'::jsonb
WHERE modules_enabled IS NOT NULL 
  AND NOT (modules_enabled ? 'ai_agents');

-- Comment for documentation
COMMENT ON COLUMN plans.has_ai_agents IS 'Whether this plan includes AI Agents feature';
