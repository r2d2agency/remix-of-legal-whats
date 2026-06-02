DROP POLICY IF EXISTS "Secretary configs are manageable by authenticated users" ON public.group_secretary_config;
DROP POLICY IF EXISTS "Secretary configs are viewable by authenticated users" ON public.group_secretary_config;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.group_secretary_config FROM authenticated;
REVOKE ALL ON public.group_secretary_config FROM anon;