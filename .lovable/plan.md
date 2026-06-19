## Objetivo

Implementar o **modelo SaaS Meta** (1 App Gleego central, clientes conectam via "Login com Facebook") em 3 frentes:

1. Documentação interna — passo a passo para a Gleego criar e publicar o App central no Meta.
2. UX cliente — substituir o passo a passo técnico atual nos diálogos por uma tela "Conexão simplificada (em desenvolvimento)" + prévia do fluxo final.
3. Backend — implementar OAuth Meta centralizado, troca/armazenamento de tokens e gerenciamento de Páginas/WABA por organização.

---

## 1. Passo a passo Gleego (documentação interna)

Criar arquivo `docs/meta-saas-setup.md` (visível só no repositório, não exposto na UI) com:

- Pré-requisitos: Business Manager Gleego verificado, domínio verificado, política de privacidade pública.
- Criar **um único App** tipo "Business" no Meta for Developers (conta Gleego).
- Adicionar produtos: **Facebook Login**, **WhatsApp Business**, **Instagram Graph API**, **Messenger**, **Webhooks**.
- Configurar OAuth redirect URI: `https://<dominio-gleego>/api/meta/oauth/callback`.
- Definir permissões a serem revisadas: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`, `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `instagram_basic`, `instagram_manage_messages`.
- Submeter **App Review** (uma vez) com vídeos demonstrando cada permissão.
- Habilitar **Embedded Signup do WhatsApp** (necessário para clientes conectarem WABA sem sair da Gleego).
- Configurar webhook único: `https://<dominio-gleego>/api/meta/webhook` com verify token vindo de secret.
- Após aprovação: colocar App em **Live mode**, salvar `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_CONFIG_ID_WHATSAPP` (Embedded Signup) como secrets na Lovable Cloud.

## 2. UX cliente — "Em desenvolvimento"

Atualizar os dois diálogos atuais para mostrar o fluxo **simplificado futuro**, marcado como "Em breve":

- `src/components/conexao/MetaApiHelpDialog.tsx`
- `src/components/conexao/InstagramMessengerHelpDialog.tsx`

Conteúdo novo:

- Badge no topo: "🚧 Conexão simplificada — em desenvolvimento".
- 3 passos curtos (preview do fluxo final):
  1. Clique em **Conectar com Facebook**.
  2. Selecione sua Página / conta Instagram / número WhatsApp Business.
  3. Pronto — sua conta está integrada à Gleego.
- Aviso: "Enquanto a conexão simplificada não é liberada, fale com o suporte Gleego para ativar manualmente sua conta."
- Remover todo o passo a passo técnico de criar App, System User, token permanente, etc.

## 3. Backend — App centralizado + OAuth + gerenciamento de páginas

### 3.1 Schema (migration)

Nova tabela `meta_oauth_connections`:

```text
id uuid pk
organization_id uuid not null
user_id uuid not null  -- quem autorizou
provider text not null check (provider in ('facebook','instagram','whatsapp'))
fb_user_id text         -- id Meta do usuário que autorizou
access_token text not null  -- long-lived user token
token_expires_at timestamptz
scopes text[]
created_at, updated_at
```

Nova tabela `meta_pages` (Páginas FB / contas IG / números WABA conectados):

```text
id uuid pk
organization_id uuid not null
oauth_connection_id uuid fk -> meta_oauth_connections
kind text check (kind in ('facebook_page','instagram_account','whatsapp_number'))
external_id text not null   -- page_id / ig_user_id / phone_number_id
external_name text
page_access_token text       -- token específico da página (FB/IG)
waba_id text                 -- só p/ whatsapp
phone_number text            -- só p/ whatsapp
status text default 'active'
metadata jsonb
created_at, updated_at
unique (organization_id, kind, external_id)
```

GRANTs + RLS escopados a `organization_id` do usuário; service_role total.

### 3.2 Secrets

Pedir via `add_secret`:
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_CONFIG_ID_WHATSAPP` (Embedded Signup)

### 3.3 Edge functions

- `meta-oauth-start`: gera URL de autorização (`https://www.facebook.com/v21.0/dialog/oauth?...`) com `state` assinado contendo `organization_id` + `user_id` + `provider`.
- `meta-oauth-callback`: troca `code` por token, faz `GET /me/accounts` (páginas FB) + `GET /me/accounts?fields=instagram_business_account` + `GET /<waba>/phone_numbers` quando aplicável. Persiste em `meta_oauth_connections` + `meta_pages`. Redireciona pra `/configuracoes/conexoes?meta=ok`.
- `meta-webhook`: handler único (GET verify + POST eventos). Roteia eventos pra organização certa via `meta_pages.external_id`.
- `meta-pages-sync`: re-busca páginas/IG/WABA do usuário autorizado quando ele clica "Sincronizar".

### 3.4 UI cliente final (depois do "em desenvolvimento" sair)

Nova página `src/pages/MetaConnect.tsx` (ou seção em Conexões):
- Botão "Conectar com Facebook" → chama `meta-oauth-start` → redirect.
- Após callback: lista de páginas/IG/WABA descobertos com checkbox "Ativar nesta conta Gleego".
- Botão "Sincronizar" → `meta-pages-sync`.
- Botão "Desconectar" → revoga token + soft-delete em `meta_pages`.

### 3.5 Integração com fluxos existentes

- Adapter no envio de mensagens: ao enviar via canal Meta, buscar `page_access_token` ou `waba_id`+`phone_number_id` da `meta_pages` ao invés do token manual atual.
- Webhook existente da Meta deve passar a aceitar payloads do App central (mesmo verify token), identificando organização via `meta_pages.external_id` (já memorizado: Meta Webhook Logic — 3-level fallback continua válido como fallback).

---

## Detalhes técnicos resumidos

- OAuth flow: Facebook Login for Business v21.0, `response_type=code`, troca server-side com `client_secret`.
- Tokens: armazenar long-lived user token (60d); renovar via job antes de expirar.
- Embedded Signup WhatsApp: usar `config_id=META_CONFIG_ID_WHATSAPP` no diálogo OAuth para o fluxo de WABA.
- Webhook único: `META_WEBHOOK_VERIFY_TOKEN` validado no GET; assinatura `X-Hub-Signature-256` validada no POST com `META_APP_SECRET`.

---

## Entregáveis nesta iteração

1. `docs/meta-saas-setup.md` (Gleego).
2. Atualização dos 2 diálogos para "Em desenvolvimento" com preview de 3 passos.
3. Migration `meta_oauth_connections` + `meta_pages` + GRANT + RLS.
4. Edge functions `meta-oauth-start`, `meta-oauth-callback`, `meta-webhook`, `meta-pages-sync`.
5. Página `MetaConnect` (oculta atrás de feature flag `META_SAAS_ENABLED=false` por padrão; só superadmin enxerga).
6. Pedido dos 4 secrets Meta.

Confirma que pode seguir com esse escopo? Se sim, eu já começo pelas etapas 1 + 2 (docs + UI "em desenvolvimento") e em seguida abro o pedido de secrets antes do backend.