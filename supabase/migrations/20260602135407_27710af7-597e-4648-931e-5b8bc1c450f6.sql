CREATE POLICY "No direct secretary config reads"
ON public.group_secretary_config
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "No direct secretary config inserts"
ON public.group_secretary_config
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct secretary config updates"
ON public.group_secretary_config
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct secretary config deletes"
ON public.group_secretary_config
FOR DELETE
TO authenticated
USING (false);