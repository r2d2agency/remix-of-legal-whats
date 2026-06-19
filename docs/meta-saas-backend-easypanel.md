# Meta SaaS — Rotas no backend EasyPanel

O frontend Lovable só renderiza as telas. Toda a lógica OAuth/Webhook roda no
seu backend hospedado no EasyPanel (`apiwhats.gleego.com.br` /
`blaster-whats-backend.isyhhh.easypanel.host`). Implemente as rotas abaixo lá.

## Secrets no backend

```
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...        # string aleatória forte
META_CONFIG_ID_WHATSAPP=...          # Embedded Signup config id
META_GRAPH_VERSION=v21.0
```

## Tabelas (Postgres do EasyPanel)

```sql
CREATE TABLE IF NOT EXISTS meta_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('facebook','instagram','whatsapp')),
  fb_user_id text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  scopes text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  oauth_connection_id uuid REFERENCES meta_oauth_connections(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('facebook_page','instagram_account','whatsapp_number')),
  external_id text NOT NULL,
  external_name text,
  page_access_token text,
  waba_id text,
  phone_number text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, external_id)
);
```

## Rotas chamadas pelo frontend

### Cliente — `/conectar-meta`

| Método | Caminho | Body | Resposta |
| --- | --- | --- | --- |
| POST | `/api/meta/oauth/start` | `{ provider, organization_id, redirect_uri }` | `{ url }` (Facebook OAuth dialog) |
| GET  | `/api/meta/oauth/callback?code=&state=` | — | HTML que redireciona para `/configuracoes/conexoes?meta=ok` |

### Admin — `/admin/meta-saas` (somente superadmin)

| Método | Caminho | Body | Resposta |
| --- | --- | --- | --- |
| GET  | `/api/meta/admin/status` | — | `{ configured, app_id_configured, app_secret_configured, webhook_verify_token_configured, whatsapp_config_id_configured, connections_count, pages_count }` |
| GET  | `/api/meta/admin/connections` | — | `{ connections: [...], pages: [...], organizations: { [id]: { id, name, slug } } }` |
| POST | `/api/meta/admin/revoke` | `{ connection_id }` | `{ success }` (revoga token na Meta + apaga linha) |
| POST | `/api/meta/admin/sync` | `{ connection_id }` | `{ success }` (re-busca páginas/IG/WABA) |

### Webhook único da Meta (apontado no App)

```
URL:        https://apiwhats.gleego.com.br/api/meta/webhook
Verify:     META_WEBHOOK_VERIFY_TOKEN
Assinatura: validar X-Hub-Signature-256 com META_APP_SECRET
```

GET com `hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` →
responder `200` com `hub.challenge`. POST → identificar org via
`meta_pages.external_id` (page_id / phone_number_id / ig_user_id) e rotear
para o pipeline de mensagens já existente.

## Fluxo OAuth (resumo)

1. Frontend chama `POST /api/meta/oauth/start` com JWT do usuário.
2. Backend valida superadmin/membro da org, gera `state` assinado (HMAC com
   `META_APP_SECRET`) contendo `{ organization_id, user_id, provider, redirect_uri, ts }`
   e monta a URL `https://www.facebook.com/v21.0/dialog/oauth?...` com os
   scopes corretos por provider (e `config_id=META_CONFIG_ID_WHATSAPP` para
   WhatsApp).
3. Usuário autoriza na Meta e é redirecionado para
   `/api/meta/oauth/callback?code=...&state=...`.
4. Backend valida `state`, troca `code` por short-lived token, troca por
   long-lived (`grant_type=fb_exchange_token`), salva em
   `meta_oauth_connections` e descobre ativos:
   - Facebook/Messenger: `GET /me/accounts`
   - Instagram: `GET /me/accounts?fields=instagram_business_account{...}`
   - WhatsApp: `GET /me/businesses` → `/{biz_id}/owned_whatsapp_business_accounts` → `/{waba_id}/phone_numbers`
5. Upsert em `meta_pages` (chave única `organization_id,kind,external_id`).
6. HTML de sucesso redireciona o usuário de volta à plataforma.

## Permissão admin

`/api/meta/admin/*` deve exigir `is_superadmin = true` no JWT (mesmo padrão
das outras rotas `/api/admin/*` do projeto). Retornar `403` para qualquer
outro usuário.

## URLs para cadastrar no Meta for Developers

- **Valid OAuth Redirect URIs**
  - `https://apiwhats.gleego.com.br/api/meta/oauth/callback`
  - `https://blaster-whats-backend.isyhhh.easypanel.host/api/meta/oauth/callback`
- **Webhook Callback URL**
  - `https://apiwhats.gleego.com.br/api/meta/webhook`
- **App Domains**
  - `gleego.com.br`, `apiwhats.gleego.com.br`, `whats.gleego.com.br`,
    `blaster-whats-backend.isyhhh.easypanel.host`,
    `blaster-whats-frontend.isyhhh.easypanel.host`
- **Privacy / Terms / Data Deletion**
  - `https://whats.gleego.com.br/politica-privacidade`
  - `https://whats.gleego.com.br/termos-servico`
  - `https://whats.gleego.com.br/exclusao-dados`