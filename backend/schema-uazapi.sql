-- Schema para suporte ao provedor UAZAPI
-- https://docs.uazapi.com/
-- UAZAPI usa: header `token` para instâncias e `admintoken` para administração
-- A URL é configurável (ex: https://meusubdominio.uazapi.com)

-- Adicionar colunas para uazapi na tabela connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'uazapi_url'
  ) THEN
    ALTER TABLE connections ADD COLUMN uazapi_url TEXT;
    COMMENT ON COLUMN connections.uazapi_url IS 'URL base da UAZAPI (ex: https://sub.uazapi.com)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'uazapi_token'
  ) THEN
    ALTER TABLE connections ADD COLUMN uazapi_token TEXT;
    COMMENT ON COLUMN connections.uazapi_token IS 'Token específico da instância UAZAPI';
  END IF;
END $$;

-- Atualizar constraint de provider para aceitar 'uazapi'
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_provider_chk') THEN
    ALTER TABLE connections DROP CONSTRAINT connections_provider_chk;
  END IF;

  ALTER TABLE connections
  ADD CONSTRAINT connections_provider_chk
  CHECK (provider IN ('evolution', 'wapi', 'meta', 'uazapi'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Atualizar constraint de campos requeridos (uazapi precisa url + token)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connections_provider_required_fields_chk') THEN
    ALTER TABLE connections DROP CONSTRAINT connections_provider_required_fields_chk;
  END IF;

  ALTER TABLE connections
  ADD CONSTRAINT connections_provider_required_fields_chk
  CHECK (
    (provider = 'wapi' AND wapi_token IS NOT NULL)
    OR
    (provider = 'evolution' AND api_url IS NOT NULL AND api_key IS NOT NULL AND instance_name IS NOT NULL)
    OR
    (provider = 'meta')
    OR
    (provider = 'uazapi' AND uazapi_url IS NOT NULL AND uazapi_token IS NOT NULL)
  );
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_connections_uazapi_token ON connections(uazapi_token) WHERE uazapi_token IS NOT NULL;

-- Inserir chaves padrão em system_settings se não existirem
INSERT INTO system_settings (key, value)
VALUES ('uazapi_url', ''), ('uazapi_admintoken', '')
ON CONFLICT (key) DO NOTHING;
