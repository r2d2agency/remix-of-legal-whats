## Objetivo

Permitir que cada cliente conecte sua Página do Facebook e seus **Formulários Lead Ads (Lead Gen Forms)** à Gleego, e que cada lead preenchido cai automaticamente no CRM (prospect criado, atribuído ao funil/responsável, com origem rastreada).

Isso reaproveita a infraestrutura **Meta SaaS** já planejada (App central Gleego + OAuth + `meta_oauth_connections` + `meta_pages` + webhook único). Lead Ads é apenas mais um "produto" dentro do mesmo App.

---

## Como funciona o Lead Ads na Meta (resumo)

1. Anúncio no Facebook/Instagram com formulário instantâneo.
2. Usuário preenche → Meta dispara webhook `leadgen` para o App, contendo `leadgen_id`, `form_id`, `page_id`, `ad_id`, `created_time`.
3. App faz `GET /{leadgen_id}?access_token={page_token}` e recebe os campos preenchidos.
4. App associa ao cliente certo (via `page_id`) e grava no CRM.

Pré-requisitos no App central da Gleego:
- Permissões: `leads_retrieval`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `business_management`.
- App Review com vídeo demonstrando o fluxo de Lead Ads.
- Webhook `page` com campo `leadgen` assinado.

---

## Fluxo do cliente (UX final)

```text
Configurações → Integrações → Meta Lead Ads
 ├─ [Conectar com Facebook]  (mesmo OAuth do Meta SaaS)
 ├─ Lista de Páginas conectadas
 │   └─ por Página: lista de formulários (toggle "ativo")
 │       └─ por formulário: mapeamento + funil/responsável/tags
 └─ Aba "Leads recebidos" (log + reprocessar)
```

Por formulário o cliente define:
- **Funil/etapa CRM** de destino (`crm_funnels` + primeira etapa).
- **Responsável** (round-robin, fixo, ou regra de distribuição já existente).
- **Mapeamento de campos**: cada campo do form Meta → campo CRM (`full_name`→`name`, `phone_number`→`phone`, `email`→`email`, custom → `custom_fields` JSONB).
- **Tags automáticas** + **origem** (`utm_source=facebook_lead_ads`, `ad_id`, `form_id`).
- **Disparar fluxo** opcional (chatbot/nurturing) ao criar o prospect.

---

## Backend (rotas no EasyPanel — mesmo padrão do Meta SaaS já documentado)

Reusa `meta_oauth_connections` + `meta_pages` (kind=`facebook_page` já cobre). Novas tabelas:

```sql
CREATE TABLE meta_lead_forms (
  id uuid PK,
  organization_id uuid NOT NULL,
  meta_page_id uuid REFERENCES meta_pages(id) ON DELETE CASCADE,
  form_id text NOT NULL,            -- id do form na Meta
  form_name text,
  is_active boolean DEFAULT true,
  funnel_id uuid REFERENCES crm_funnels(id),
  stage_id uuid,
  assignee_user_id uuid,
  distribution_rule_id uuid,        -- opcional: lead-distribution existente
  trigger_flow_id uuid,
  field_mapping jsonb DEFAULT '{}', -- { "phone_number":"phone", ... }
  default_tags text[] DEFAULT '{}',
  created_at timestamptz, updated_at timestamptz,
  UNIQUE (meta_page_id, form_id)
);

CREATE TABLE meta_lead_events (
  id uuid PK,
  organization_id uuid NOT NULL,
  meta_lead_form_id uuid REFERENCES meta_lead_forms(id),
  leadgen_id text NOT NULL UNIQUE,
  ad_id text, adset_id text, campaign_id text,
  raw_payload jsonb NOT NULL,
  prospect_id uuid REFERENCES crm_prospects(id),
  status text DEFAULT 'received',   -- received | processed | failed
  error text,
  received_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
```

GRANTs + RLS por `organization_id` (já é o padrão do projeto).

### Rotas

| Método | Caminho | Função |
|---|---|---|
| GET  | `/api/meta/lead-ads/pages` | lista `meta_pages` (kind=facebook_page) da org |
| POST | `/api/meta/lead-ads/pages/:id/sync-forms` | `GET /{page_id}/leadgen_forms` → upsert em `meta_lead_forms` |
| PUT  | `/api/meta/lead-ads/forms/:id` | configurar mapeamento, funil, responsável, tags, fluxo |
| POST | `/api/meta/lead-ads/forms/:id/test` | busca último leadgen e roda pipeline (dry-run opcional) |
| GET  | `/api/meta/lead-ads/events` | log paginado de `meta_lead_events` |
| POST | `/api/meta/lead-ads/events/:id/reprocess` | reexecuta criação de prospect |

### Webhook (já existe `/api/meta/webhook`)

Adicionar handler para `entry[].changes[].field === 'leadgen'`:

1. Validar `X-Hub-Signature-256` com `META_APP_SECRET`.
2. Extrair `leadgen_id`, `form_id`, `page_id`, `ad_id`, `created_time`.
3. Achar `meta_pages` por `external_id=page_id` → org.
4. Achar `meta_lead_forms` por (page, form_id); se inativo ou inexistente → grava evento `status=ignored` e retorna 200.
5. `GET https://graph.facebook.com/v21.0/{leadgen_id}?access_token={page_access_token}` → array `field_data`.
6. Aplica `field_mapping`, cria `crm_prospects` (telefone via regra dos últimos 9 dígitos já memorizada), grava `lead_source='facebook_lead_ads'` + `ad_id/form_id` em `custom_fields`.
7. Atribui responsável (`distribution_rule_id` se houver, senão `assignee_user_id`).
8. Se `trigger_flow_id` setado, dispara fluxo (mesma rota usada pelo `external-forms`).
9. Atualiza `meta_lead_events.status='processed'` + `prospect_id`.
10. Em qualquer erro: `status='failed'`, `error=...`, e fica disponível para reprocessar.

Resiliência (memorizada no projeto): `AbortController` 10–15s, retry 2–3x, timeout no `fetch`.

---

## Frontend (Lovable)

Novas telas / componentes:

- `src/pages/MetaLeadAds.tsx` — listagem de páginas conectadas + drill-down nos formulários.
- `src/components/meta-lead-ads/LeadFormConfigDialog.tsx` — mapeamento de campos, escolha de funil/etapa, responsável, tags, fluxo, toggle ativo.
- `src/components/meta-lead-ads/LeadEventsTable.tsx` — log de leads recebidos com botões "Ver payload", "Reprocessar", link para o prospect criado.
- Entrada no menu Configurações → Integrações (e atalho em CRM → "Origens").

Reaproveita o botão **"Conectar com Facebook"** que será criado na fase 2 do plano Meta SaaS — não duplicar OAuth.

Feature flag `META_LEAD_ADS_ENABLED` (default `false`) até o App Review aprovar `leads_retrieval`.

---

## Dependências / ordem de entrega

1. **Meta SaaS fase backend** (OAuth + `meta_pages` + webhook único) — pré-requisito.
2. App Review da Gleego incluindo `leads_retrieval` no escopo.
3. Migration `meta_lead_forms` + `meta_lead_events` + GRANT/RLS.
4. Webhook `leadgen` handler no backend EasyPanel.
5. Rotas REST + UI cliente.
6. Modo "teste" usando `GET /{page_id}/leads?limit=1` para validar mapeamento antes de virar a chave.

---

## Pontos para você confirmar antes de eu codar

1. Roda em cima do **mesmo App Meta central** do plano Meta SaaS (recomendado) ou quer um App separado só para Lead Ads?
2. Distribuição de leads usa a **regra de Lead Distribution** já existente do projeto, ou prefere começo simples (1 responsável fixo por formulário)?
3. Quer que cada lead, além de virar prospect no CRM, também **abra conversa no Chat** automaticamente (via conexão WhatsApp escolhida), igual ao `external-forms`?
4. Posso seguir já com etapas 3–5 (migration + webhook + UI) usando feature flag, mesmo antes da `leads_retrieval` ser aprovada no App Review?
