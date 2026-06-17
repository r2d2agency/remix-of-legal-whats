# Disparo de Template Meta em Campanhas

Hoje as campanhas só aceitam **Mensagens** (texto/mídia salvos em "Mensagens") ou **Fluxo**. Para conexões **Meta Cloud API**, o WhatsApp exige envio via **Template aprovado** quando a janela de 24h está fechada — então campanha para lista precisa virar disparo de template.

## O que vou fazer

### 1. Banco (auto-heal no boot)
Adicionar 3 colunas em `campaigns` via `ALTER TABLE IF NOT EXISTS`:
- `meta_template_id UUID` → referência ao `meta_message_templates.id`
- `meta_template_name TEXT`
- `meta_template_language TEXT`
- `meta_template_params JSONB` → mapeamento `{ "{{1}}": "{name}", "{{2}}": "..." }` aceitando variáveis dinâmicas do contato (`{name}`, `{phone}`, `{email}`).

### 2. Backend — `POST /api/campaigns`
- Aceitar novo campo `meta_template_id` (alternativa a `message_id`/`flow_id`).
- Validar que a conexão escolhida é `provider = 'meta'` quando há template.
- Pré-alocar `campaign_messages` normalmente (1 por contato), gravando `meta_template_id`/params no JSONB do campaign.

### 3. Backend — `campaign-scheduler.js`
- No SELECT trazer também `c.meta_template_id`, `c.meta_template_name`, `c.meta_template_language`, `c.meta_template_params`.
- Novo branch (antes do "Regular message-based"): se `meta_template_id` existir, chamar Meta Graph API `/{phone_number_id}/messages` com `type: 'template'` (mesma lógica do `chat.js` `send-template`), substituindo variáveis `{name}/{phone}/{email}` por contato. Extrair helper compartilhado em `backend/src/lib/meta-template-send.js` para reusar.
- Inserir o envio em `messages` (igual ao chat) para histórico.

### 4. Frontend — `Campanhas.tsx`
Na tela de criar campanha adicionar 3º modo além de "Mensagem" / "Fluxo": **"Template Meta"**.
- Aparece apenas quando a conexão selecionada é `provider = 'meta'`.
- Lista templates `APPROVED` da conexão (`GET /api/meta/:connectionId/templates`).
- Preview do body + inputs para cada `{{n}}` aceitando texto fixo ou variável (`{name}`, `{phone}`).
- Envia `meta_template_id`, `meta_template_name`, `meta_template_language`, `meta_template_params` no POST.

### 5. UI de listagem
Mostrar badge "Template: <nome>" na linha da campanha quando for desse tipo.

## Não faz parte deste passo
- Editor de novos templates dentro do modal (continua na página Meta Templates).
- Botões interativos / mídia em header de template (só BODY parametrizado nessa primeira versão; header/footer/buttons aprovados são enviados como estão).

Posso seguir e implementar?
