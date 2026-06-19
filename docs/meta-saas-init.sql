-- =====================================================================
-- Meta SaaS — schema idempotente (rodar a cada boot do backend EasyPanel)
-- Seguro: usa apenas IF NOT EXISTS. Nunca derruba dados nem quebra rotas existentes.
-- =====================================================================

-- 1) Conexões OAuth (1 linha por autorização user x org x provider)
CREATE TABLE IF NOT EXISTS meta_oauth_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL,
  user_id           uuid NOT NULL,
  provider          text NOT NULL CHECK (provider IN ('facebook','instagram','whatsapp')),
  fb_user_id        text,
  access_token      text NOT NULL,
  token_expires_at  timestamptz,
  scopes            text[] DEFAULT '{}'::text[],
  metadata          jsonb  DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_oauth_org      ON meta_oauth_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_user     ON meta_oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_provider ON meta_oauth_connections(provider);

-- 2) Ativos descobertos (página FB, conta IG, número WABA)
CREATE TABLE IF NOT EXISTS meta_pages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  oauth_connection_id uuid REFERENCES meta_oauth_connections(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('facebook_page','instagram_account','whatsapp_number')),
  external_id         text NOT NULL,
  external_name       text,
  page_access_token   text,
  waba_id             text,
  phone_number        text,
  status              text NOT NULL DEFAULT 'active',
  metadata            jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Constraint única (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meta_pages_org_kind_ext_uniq'
  ) THEN
    ALTER TABLE meta_pages
      ADD CONSTRAINT meta_pages_org_kind_ext_uniq
      UNIQUE (organization_id, kind, external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meta_pages_org    ON meta_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_conn   ON meta_pages(oauth_connection_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_kind   ON meta_pages(kind);
CREATE INDEX IF NOT EXISTS idx_meta_pages_extid  ON meta_pages(external_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_status ON meta_pages(status);

-- 3) Self-healing: adiciona colunas que possam estar faltando em instalações antigas
ALTER TABLE meta_oauth_connections ADD COLUMN IF NOT EXISTS scopes           text[] DEFAULT '{}'::text[];
ALTER TABLE meta_oauth_connections ADD COLUMN IF NOT EXISTS metadata         jsonb  DEFAULT '{}'::jsonb;
ALTER TABLE meta_oauth_connections ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE meta_oauth_connections ADD COLUMN IF NOT EXISTS fb_user_id       text;

ALTER TABLE meta_pages ADD COLUMN IF NOT EXISTS page_access_token text;
ALTER TABLE meta_pages ADD COLUMN IF NOT EXISTS waba_id           text;
ALTER TABLE meta_pages ADD COLUMN IF NOT EXISTS phone_number      text;
ALTER TABLE meta_pages ADD COLUMN IF NOT EXISTS metadata          jsonb DEFAULT '{}'::jsonb;
ALTER TABLE meta_pages ADD COLUMN IF NOT EXISTS status            text  DEFAULT 'active';

-- 4) Trigger updated_at (reaproveita função existente se já existir no projeto)
CREATE OR REPLACE FUNCTION meta_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meta_oauth_updated_at') THEN
    CREATE TRIGGER trg_meta_oauth_updated_at
      BEFORE UPDATE ON meta_oauth_connections
      FOR EACH ROW EXECUTE FUNCTION meta_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meta_pages_updated_at') THEN
    CREATE TRIGGER trg_meta_pages_updated_at
      BEFORE UPDATE ON meta_pages
      FOR EACH ROW EXECUTE FUNCTION meta_set_updated_at();
  END IF;
END $$;

-- =====================================================================
-- FIM. Pode rodar quantas vezes quiser — não duplica nada, não derruba
-- tabelas/colunas existentes e não toca em nenhuma rota Meta API antiga.
-- =====================================================================