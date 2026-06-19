# Configuração do App Meta centralizado (Gleego) — Modelo SaaS

Este guia é **interno**. Não deve ser exposto na UI dos clientes. Descreve
como a Gleego cria e mantém **um único** App no Meta for Developers que será
usado por todos os clientes da plataforma (modelo SaaS), de modo que cada
cliente apenas faça "Login com Facebook" para conectar sua Página, conta
Instagram Business e/ou número WhatsApp Business.

---

## 1. Pré-requisitos da Gleego

- Conta no [Meta Business Manager](https://business.facebook.com) da Gleego, **verificada**.
- **Domínio verificado** no Business Manager (o domínio onde roda a plataforma).
- **Política de Privacidade pública** em URL fixa (ex.: `https://gleego.app/privacidade`).
- **Termos de Serviço públicos** em URL fixa.
- URL de exclusão de dados (Data Deletion) pública.

## 2. Criar o App único

1. Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Criar App**.
2. Tipo: **Negócios (Business)**.
3. Nome: `Gleego Platform` (ou similar). Vincule ao Business Manager da Gleego.
4. Em **Configurações → Básico** preencha:
   - Política de Privacidade, Termos, URL de exclusão de dados.
   - Domínios do app: `gleego.app` (e subdomínios em uso).
   - Categoria: Empresas e Páginas.

## 3. Adicionar produtos

No painel do App, em **Adicionar Produto**, configure todos:

- **Facebook Login for Business**
- **WhatsApp Business** (Cloud API + Embedded Signup)
- **Instagram Graph API / Instagram Messaging**
- **Messenger**
- **Webhooks**

## 4. Facebook Login for Business — Configuração OAuth

- **Valid OAuth Redirect URIs**:
  - `https://<DOMINIO>/api/meta/oauth/callback`
  - `https://<PROJECT_REF>.functions.supabase.co/meta-oauth-callback`
- **Login with the JavaScript SDK**: desabilitado (usaremos server-side).
- **Client OAuth Login**: habilitado.
- **Web OAuth Login**: habilitado.

## 5. Embedded Signup do WhatsApp

1. Em **WhatsApp → Embedded Signup**, crie uma **Configuração de Embedded Signup**.
2. Selecione o fluxo "Onboard new businesses".
3. Anote o **Configuration ID** gerado → será salvo como secret `META_CONFIG_ID_WHATSAPP`.

## 6. Permissões a submeter no App Review

Submeter **uma única vez**:

- `whatsapp_business_management`
- `whatsapp_business_messaging`
- `business_management`
- `pages_show_list`
- `pages_messaging`
- `pages_manage_metadata`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_manage_messages`

Para cada permissão, gravar vídeo curto demonstrando o uso real na plataforma
Gleego (login com Facebook → seleção de página/IG/WABA → envio e recebimento
de mensagem) e anexar descrição clara do caso de uso.

## 7. Webhook único

- URL: `https://<DOMINIO>/api/meta/webhook` (ou `https://<PROJECT_REF>.functions.supabase.co/meta-webhook`).
- **Verify Token**: gere uma string aleatória forte → secret `META_WEBHOOK_VERIFY_TOKEN`.
- Assinaturas (subscriptions) por produto:
  - **WhatsApp**: `messages`, `message_template_status_update`, `messaging_handovers`, `account_update`.
  - **Messenger (Page)**: `messages`, `messaging_postbacks`, `message_reactions`, `message_deliveries`, `message_reads`.
  - **Instagram**: `messages`, `messaging_postbacks`, `message_reactions`.
- Validar `X-Hub-Signature-256` em todos os POSTs usando o `META_APP_SECRET`.

## 8. Colocar em Live e salvar secrets

1. Após aprovação do App Review, alternar o App para **Live**.
2. Copiar **App ID** e **App Secret** em **Configurações → Básico**.
3. Salvar como secrets na Lovable Cloud (Settings → Secrets):
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_WEBHOOK_VERIFY_TOKEN`
   - `META_CONFIG_ID_WHATSAPP`

## 9. Manutenção

- **Renovação de tokens**: long-lived user tokens expiram em ~60 dias. Job
  agendado deve renovar antes da expiração via `GET /oauth/access_token?grant_type=fb_exchange_token`.
- **Page/IG tokens**: derivados do user token via `GET /me/accounts` —
  re-buscar sempre que o user token for renovado.
- **Monitorar App Dashboard → Alerts**: avisos de quebra de permissão ou
  rate-limit aparecem aqui.
- **Business Verification**: refazer anualmente quando solicitada.

## 10. Fluxo final visto pelo cliente

1. Cliente entra em **Conexões → Nova conexão → Meta**.
2. Clica em **Conectar com Facebook**.
3. É redirecionado ao diálogo OAuth da Meta com permissões pré-aprovadas.
4. Seleciona Páginas / Instagram / WhatsApp Business que quer conectar.
5. Volta à Gleego com as contas já provisionadas — pronto para enviar e
   receber mensagens.

Nenhuma criação de App, System User ou token manual é exigida do cliente.