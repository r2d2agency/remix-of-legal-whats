-- ==========================================
-- Excluded Senders for Group Secretary
-- Numbers that should be ignored (team members who follow up with clients)
-- ==========================================

ALTER TABLE group_secretary_config ADD COLUMN IF NOT EXISTS excluded_senders TEXT[] DEFAULT '{}';

COMMENT ON COLUMN group_secretary_config.excluded_senders IS 'Números de telefone da equipe que devem ser ignorados pela IA (ex: 5511999999999)';
