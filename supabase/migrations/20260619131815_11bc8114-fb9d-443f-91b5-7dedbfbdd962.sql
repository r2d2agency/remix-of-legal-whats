-- Meta SaaS centralized OAuth: store user-level tokens and discovered assets per organization.

CREATE TABLE public.meta_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('facebook','instagram','whatsapp')),
  fb_user_id text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  scopes text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_oauth_connections TO authenticated;
GRANT ALL ON public.meta_oauth_connections TO service_role;
ALTER TABLE public.meta_oauth_connections ENABLE ROW LEVEL SECURITY;

-- Users can read their own org's oauth connection rows; mutations are done server-side via service_role.
CREATE POLICY "meta_oauth_connections_select_own_org"
  ON public.meta_oauth_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.meta_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  oauth_connection_id uuid REFERENCES public.meta_oauth_connections(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('facebook_page','instagram_account','whatsapp_number')),
  external_id text NOT NULL,
  external_name text,
  page_access_token text,
  waba_id text,
  phone_number text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, external_id)
);

CREATE INDEX meta_pages_external_id_idx ON public.meta_pages (kind, external_id);
CREATE INDEX meta_pages_org_idx ON public.meta_pages (organization_id);

GRANT SELECT ON public.meta_pages TO authenticated;
GRANT ALL ON public.meta_pages TO service_role;
ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_pages_select_own_org"
  ON public.meta_pages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_oauth_connections c
      WHERE c.id = meta_pages.oauth_connection_id
        AND c.user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.meta_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_oauth_connections_updated
  BEFORE UPDATE ON public.meta_oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.meta_set_updated_at();

CREATE TRIGGER trg_meta_pages_updated
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW EXECUTE FUNCTION public.meta_set_updated_at();