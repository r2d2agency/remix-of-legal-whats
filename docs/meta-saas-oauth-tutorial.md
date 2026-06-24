# Meta SaaS OAuth — Tutorial passo a passo

Este tutorial mostra **de ponta a ponta** como configurar o OAuth centralizado
da Meta na Gleego para que **qualquer cliente** clique em "Conectar com
Facebook" e libere automaticamente:

- Páginas do Facebook (Messenger)
- Contas Instagram Business
- Números WhatsApp Business (Embedded Signup)
- Formulários Lead Ads (cai direto no CRM)

Você (Gleego) faz **uma única vez**. Os clientes só clicam.

---

## 0. Pré-requisitos da Gleego

- Conta **Meta Business Manager** verificada (selo azul). Sem isso a Meta
  **não libera** permissões avançadas no App Review.
- Domínio **`gleego.com.br`** verificado dentro do Business Manager
  (Configurações do negócio → Segurança da marca → Domínios).
- Páginas públicas no domínio:
  - `https://whats.gleego.com.br/politica-privacidade`
  - `https://whats.gleego.com.br/termos-servico`
  - `https://whats.gleego.com.br/exclusao-dados` (a Meta exige callback
    de Data Deletion)
- Backend já no ar em `https://apiwhats.gleego.com.br` (EasyPanel).

---

## 1. Criar o App central no Meta for Developers

1. Acesse <https://developers.facebook.com/apps/> e clique em **Criar App**.
2. Caso de uso: **"Outro"** → Tipo de app: **"Business"**.
3. Nome do app: `Gleego SaaS`. Email de contato: `contato@gleego.com.br`.
4. Conta do **Business Manager**: selecione a conta verificada da Gleego.
5. Após criar, copie do painel superior:
   - **App ID** → vira `META_APP_ID`
   - **App Secret** (clique em "Mostrar") → vira `META_APP_SECRET`

---

## 2. Adicionar produtos ao App

No menu lateral **Adicionar produto**, ative todos:

| Produto | Para quê |
| --- | --- |
| Facebook Login for Business | Login do cliente + escolha de páginas |
| WhatsApp | Embedded Signup do WABA |
| Instagram Graph API | Mensagens IG Business |
| Messenger | Mensagens da Página |
| Webhooks | Receber `leadgen`, `messages`, etc. |

---

## 3. Configurar Facebook Login

Em **Facebook Login → Configurações**:

- **Valid OAuth Redirect URIs** (uma por linha):
  ```
  https://apiwhats.gleego.com.br/api/meta/oauth/callback
  https://blaster-whats-backend.isyhhh.easypanel.host/api/meta/oauth/callback
  ```
- **App Domains**:
  ```
  gleego.com.br
  apiwhats.gleego.com.br
  whats.gleego.com.br
  blaster-whats-backend.isyhhh.easypanel.host
  blaster-whats-frontend.isyhhh.easypanel.host
  ```
- **Login com JavaScript SDK**: desligado (usamos server-side).
- **Client OAuth Login** e **Web OAuth Login**: ligados.

Em **Configurações → Básico**:

- **Política de privacidade**: `https://whats.gleego.com.br/politica-privacidade`
- **Termos de serviço**: `https://whats.gleego.com.br/termos-servico`
- **URL de exclusão de dados do usuário**:
  `https://whats.gleego.com.br/exclusao-dados`
- **Ícone do app**: 1024×1024 PNG (logo da Gleego).
- **Categoria**: Business and Pages.

---

## 4. Configurar Embedded Signup do WhatsApp

Em **WhatsApp → Configuração**:

1. Crie uma **Configuration** (Embedded Signup) clicando em
   *Create configuration*.
2. Tipo: **Business** (cliente cria/usa o próprio WABA).
3. Permissões marcadas: `whatsapp_business_management`,
   `whatsapp_business_messaging`.
4. Após salvar, copie o **Configuration ID** → vira
   `META_CONFIG_ID_WHATSAPP`.

---

## 5. Configurar o Webhook único

Em **Webhooks**, escolha o objeto **"Página"** e:

- **Callback URL**: `https://apiwhats.gleego.com.br/api/meta/webhook`
- **Verify Token**: gere uma string aleatória forte (32+ chars). Exemplo:
  ```
  openssl rand -hex 32
  ```
  Esse valor vira `META_WEBHOOK_VERIFY_TOKEN`.
- Assine os campos:
  - `messages`
  - `messaging_postbacks`
  - `leadgen` ← obrigatório para Meta Lead Ads
  - `feed` (opcional, comentários)

Repita para os objetos **Instagram** (`messages`) e **WhatsApp Business
Account** (`messages`, `message_template_status_update`,
`account_update`).

O backend já tem a rota `GET /api/meta/webhook` que responde ao
`hub.challenge` automaticamente. Só clique em **Verificar e salvar**.

---

## 6. Submeter o App Review

No menu **App Review → Permissões e recursos**, peça aprovação para:

| Permissão | Para quê |
| --- | --- |
| `pages_show_list` | listar Páginas do cliente |
| `pages_messaging` | enviar/receber Messenger |
| `pages_manage_metadata` | assinar webhook por Página |
| `pages_read_engagement` | ler comentários/posts |
| `instagram_basic` | listar contas IG Business |
| `instagram_manage_messages` | enviar/receber IG Direct |
| `business_management` | descobrir WABAs e ativos |
| `whatsapp_business_management` | gerenciar WABA do cliente |
| `whatsapp_business_messaging` | enviar mensagens WhatsApp |
| `leads_retrieval` | **ler leads do Lead Ads** |

Para cada uma:

1. **Justificativa** (em inglês): explique que a Gleego é uma plataforma
   SaaS de atendimento e CRM, e que o cliente final autoriza acesso à
   sua própria conta para usar o produto.
2. **Vídeo de demonstração** (Loom ou MP4 hospedado): grave o fluxo
   exato — login do cliente fictício na Gleego → "Conectar com
   Facebook" → autoriza → vê página/IG/WABA listados → testa envio ou
   recebimento de mensagem. Para `leads_retrieval`, mostre um lead caindo
   no CRM.
3. **Passos para o revisor**: forneça login de teste
   (`reviewer@gleego.com.br` + senha) já dentro de uma org com algum
   formulário Lead Ads de exemplo.

Tempo médio de aprovação: 3 a 10 dias úteis. `leads_retrieval` costuma
ser o mais demorado.

---

## 7. Colocar o App em modo Live

Topo do painel: alterne **Development → Live**. A Meta só permite isso
depois de ao menos uma permissão básica aprovada e da política de
privacidade preenchida.

---

## 8. Configurar os secrets no EasyPanel (backend Gleego)

No serviço `apiwhats` do EasyPanel, aba **Environment**, adicione:

```env
META_APP_ID=000000000000000
META_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
META_WEBHOOK_VERIFY_TOKEN=<a string que você gerou no passo 5>
META_CONFIG_ID_WHATSAPP=000000000000000
META_GRAPH_VERSION=v21.0
```

Reinicie o serviço. Pronto — o webhook
`https://apiwhats.gleego.com.br/api/meta/webhook` passa a validar
assinatura `X-Hub-Signature-256` com `META_APP_SECRET` e a aceitar
eventos `leadgen` automaticamente.

> Os secrets ficam **apenas no backend**. O frontend Lovable nunca os
> recebe — ele só chama as rotas REST `/api/meta/...`.

---

## 9. Como funciona para o cliente

1. Cliente entra em **Configurações → Conexões → Meta** (ou no card
   "Conectar com Facebook" da página `/conectar-meta`).
2. Clica em **Conectar com Facebook**.
3. Backend gera URL assinada `https://www.facebook.com/v21.0/dialog/oauth?...`
   com `state` HMAC (organização + usuário + provider), `client_id` =
   `META_APP_ID` e `redirect_uri` =
   `https://apiwhats.gleego.com.br/api/meta/oauth/callback`.
4. Cliente autoriza na tela oficial da Meta.
5. Backend recebe `code`, troca por *long-lived token* (60 dias),
   descobre ativos:
   - Páginas: `GET /me/accounts`
   - IG: `GET /me/accounts?fields=instagram_business_account{id,name}`
   - WABA: `GET /me/businesses` → `/{biz}/owned_whatsapp_business_accounts`
     → `/{waba}/phone_numbers`
   - Formulários Lead Ads: `GET /{page_id}/leadgen_forms`
6. Salva em `meta_oauth_connections` + `meta_pages` (já existentes no
   schema). Os formulários Lead Ads aparecem em
   **Campanhas → Meta Lead Ads** prontos para configurar funil,
   responsável e abrir chat.

---

## 10. Renovação de token e manutenção

- **Long-lived user token** dura 60 dias. Um job no backend
  (`agent-modes-scheduler` ou novo `meta-token-refresh-scheduler`) deve
  rodar a cada 24h e renovar via:
  ```
  GET /oauth/access_token?
    grant_type=fb_exchange_token&
    client_id=META_APP_ID&
    client_secret=META_APP_SECRET&
    fb_exchange_token=<token atual>
  ```
- **Page tokens** (FB/IG) são *long-lived* e não expiram enquanto o
  user token estiver vivo e o cliente não revogar.
- **WABA tokens**: gerenciados via System User do cliente, criado
  durante o Embedded Signup. Não expiram.

Se um cliente revogar acesso no Facebook
(Configurações → Apps conectados → Gleego SaaS), a Meta envia
`deauthorize_callback`. O backend marca o `meta_oauth_connections` como
`revoked` e mostra um banner no painel pedindo para reconectar.

---

## 11. Checklist de produção

- [ ] App em **Live mode**
- [ ] Todas as permissões aprovadas (verifique App Review → Status)
- [ ] `META_*` setados no EasyPanel e serviço reiniciado
- [ ] Webhook verificado (status verde no painel Meta)
- [ ] Página de **Exclusão de Dados** respondendo HTTP 200 com formulário
- [ ] Vídeos do App Review arquivados (a Meta pode pedir re-review anual)
- [ ] Teste real: criar conta nova na Gleego → conectar Facebook →
      enviar mensagem teste → criar Lead Ads de teste no Ads Manager →
      ver lead caindo no CRM.

---

## 12. Erros comuns

| Sintoma | Causa | Correção |
| --- | --- | --- |
| `redirect_uri isn't allowed` | URL fora da whitelist | Adicione exatamente em Facebook Login → Settings |
| Webhook nunca verifica | `META_WEBHOOK_VERIFY_TOKEN` diferente | Igualar painel Meta ↔ EasyPanel e reiniciar |
| 401 na assinatura | `META_APP_SECRET` errado | Recopiar do painel Básico do App |
| `(#10) Application does not have permission` | App em Dev mode ou permissão não aprovada | Ir pra Live + concluir App Review |
| Lead chega mas não cria prospect | Formulário inativo na Gleego | Em **Campanhas → Meta Lead Ads → Formulários** marcar como Ativo |
| `Invalid OAuth access token` após 60 dias | Não rodou refresh | Ativar o scheduler de refresh (passo 10) |

---

## 13. Resumo das URLs para cadastrar no Meta

Copie e cole exatamente:

- **OAuth Redirect URIs**
  - `https://apiwhats.gleego.com.br/api/meta/oauth/callback`
  - `https://blaster-whats-backend.isyhhh.easypanel.host/api/meta/oauth/callback`
- **Webhook Callback**
  - `https://apiwhats.gleego.com.br/api/meta/webhook`
- **Privacy / Terms / Data Deletion**
  - `https://whats.gleego.com.br/politica-privacidade`
  - `https://whats.gleego.com.br/termos-servico`
  - `https://whats.gleego.com.br/exclusao-dados`
- **App Domains**: `gleego.com.br`, `apiwhats.gleego.com.br`,
  `whats.gleego.com.br`, `blaster-whats-backend.isyhhh.easypanel.host`,
  `blaster-whats-frontend.isyhhh.easypanel.host`

Com isso, qualquer cliente da Gleego conecta a própria conta Meta em 3
cliques, sem ver nada técnico.