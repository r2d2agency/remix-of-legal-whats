# Agentes IA — Copiloto & Auto-Resposta

Vou expandir o módulo de Agentes IA com **duas categorias** novas, mantendo os agentes existentes funcionando.

## 1. Banco de dados (backend/schema-ai-agents-v2.sql)

Adicionar coluna `agent_type` em `ai_agents`: `'copilot' | 'autoreply' | 'standard'` (default `standard` para não quebrar existentes).

**Nova tabela `ai_agent_actions`** (para Copiloto):
- `id`, `agent_id`, `name`, `icon`, `prompt`, `order_index`
- Máx. 4 ações por agente (validado no backend)

**Nova tabela `ai_agent_autoreply_config`**:
- `agent_id`, `is_active`, `paused_until`
- `filter_mode`: `'all' | 'include' | 'exclude'`
- `included_tags[]`, `excluded_tags[]`
- `included_contact_ids[]`, `excluded_contact_ids[]`
- `included_groups[]`, `excluded_groups[]`
- `schedule_windows JSONB` (ex: `[{days:[1,2,3,4,5], start:"18:00", end:"08:00"}]`)
- `schedule_enabled BOOLEAN`

## 2. Templates prontos (seed)

Copiloto: **Resumir conversa**, **Sugerir resposta**, **Próximo passo**, **Tratar objeção**.
Auto-Resposta: **Secretária (em reunião)**, **Fora do expediente**, **Em viagem**.
Usuário pode duplicar e customizar nome/prompt/ícone das 4 ações.

## 3. Backend (Node.js)

**`backend/src/routes/ai-agents.js`** — estender:
- `GET/POST/PUT /api/ai-agents/:id/actions` — CRUD das 4 ações
- `POST /api/ai-agents/:id/run-action` — executa ação no contexto de uma conversa, retorna sugestão
- `GET/PUT /api/ai-agents/:id/autoreply` — config de auto-resposta
- `POST /api/ai-agents/:id/autoreply/toggle` — ativa/desativa com `duration_minutes` opcional

**`backend/src/lib/autoreply-matcher.js`** (novo) — dado uma mensagem recebida, retorna o agente auto-reply que deve responder (avalia tags, contato, grupo, janela horária).

**`backend/src/lib/whatsapp-provider.js`** — no handler de mensagem recebida, antes de qualquer fluxo, chamar `autoreply-matcher`. Se casar, chamar IA, enviar resposta, registrar log e parar.

**`backend/src/autoreply-scheduler.js`** (novo, cron 1min) — desativa auto-replies expirados (`paused_until`) e ativa/desativa por `schedule_windows`.

## 4. Frontend

**`src/pages/AgentesIA.tsx`** — adicionar tabs: `Padrão | Copiloto | Auto-Resposta`. Cada tipo mostra editor próprio.

**`src/components/ai-agents/CopilotActionsEditor.tsx`** (novo) — lista até 4 ações (ícone Lucide, nome, prompt), drag pra reordenar, botões "Adicionar template" (Resumir/Sugerir/etc).

**`src/components/ai-agents/AutoReplyConfigEditor.tsx`** (novo) — filtros (modo, tags, contatos, grupos via combobox), agendamento (janelas semanais), toggle global ativar + duração.

**`src/components/chat/CopilotPanel.tsx`** (novo) — painel lateral no Chat (botão IA já existe). Lista agentes Copiloto disponíveis, ao escolher mostra 4 botões de ação. Click → chama backend com últimas N mensagens → mostra sugestão com botão "Usar resposta" (preenche composer) e "Copiar".

**`src/components/chat/AutoReplyStatusBadge.tsx`** (novo) — quando auto-reply ativo na conexão, mostra badge no header do chat ("🤖 Secretária ativa até 15:00") com botão pausar.

## 5. Permissões & Planos

- Adicionar feature flags `ai_copilot` e `ai_autoreply` em `pricing-plans` (Business+).
- Adicionar páginas/módulos no sistema de permissões existente.

## Detalhes técnicos

- IA: usa configuração global existente (Gemini 1.5 Flash padrão), aproveitando `ai-caller.js`.
- Auto-reply respeita `AI Safety Interlock` (não responde se humano acabou de digitar).
- Logs em `ai_agent_logs` (nova tabela leve) para auditar respostas automáticas.
- Toda operação respeita `organization_id` e `connection_members`.

## Fora do escopo (avise se quiser)

- Pagar por uso de IA (já existe sistema de quota global).
- Treinar agente em base de conhecimento específica por agente (já existe RAG genérico, posso conectar depois).
- Multi-idioma das respostas (usa idioma da conversa por padrão).