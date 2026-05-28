Criação do módulo "Análise de Vendas e SEO" para rastrear a origem de conversas no WhatsApp baseadas em frases de entrada específicas (ex: "Olá, vim através do site!"). O módulo incluirá mapeamento de conexões, relatórios de horários/dias e análise de evolução de conversas (vendas, churn, upsell) com auxílio de IA.

### Alterações no Backend

1. **Banco de Dados**:
   - Criar tabela `sales_seo_trackers` para configurar os mapeamentos (frase-origem, conexões, nome da origem).
   - Adicionar colunas ou tabela de eventos para capturar metadados de origem quando uma conversa começa com a frase monitorada.

2. **Webhooks e Processamento**:
   - Atualizar os handlers de webhook (UAZAPI, Evolution, etc.) para verificar se a primeira mensagem de uma conversa corresponde a um rastreador ativo.
   - Registrar automaticamente a origem na conversa ou em uma tabela de rastreamento.

3. **Novas Rotas**:
   - `GET /api/sales-seo/trackers`: Listar configuradores.
   - `POST /api/sales-seo/trackers`: Criar novo rastreador (frase, conexões).
   - `GET /api/sales-seo/analytics`: Relatório consolidado (leads por dia/hora, taxa de evolução).
   - `POST /api/sales-seo/analyze-ia`: Endpoint para disparar análise de IA sobre o funil de conversas rastreadas.

### Alterações no Frontend

1. **Nova Página**: `src/pages/SalesSEOAnalytics.tsx`.
   - Dashboard com filtros por período e conexão.
   - Gráficos de "Leads por Origem" e "Distribuição Horária" (confronto com Google Analytics).
   - Lista de conversas rastreadas com status de "Evolução" (Parada, Em Andamento, Venda, Churn).

2. **Gerenciamento de Rastreadores**: Interface para cadastrar as frases e selecionar quais números de WhatsApp devem monitorar essa frase.

3. **Integração com IA**: Botão para gerar insights automáticos sobre as conversas (ex: "Quantas evoluíram para venda?").

### Detalhes Técnicos (para desenvolvedores)

- A detecção será feita no `persistIncomingMessage` (ou equivalente no backend) comparando o conteúdo exato (trim/lowercase) da primeira mensagem do contato.
- A análise de evolução usará os logs de mensagens da conversa enviando um resumo para a API de IA configurada (Prompt customizado para SEO/Vendas).
- Adição do link no `Sidebar.tsx` na seção "CRM" com o nome "Análise de Vendas e SEO".

**Arquivos que serão criados/modificados:**
- `backend/schema-sales-seo.sql` (novo)
- `backend/src/routes/sales-seo.js` (novo)
- `backend/src/index.js` (registrar rota)
- `src/pages/SalesSEOAnalytics.tsx` (novo)
- `src/hooks/use-sales-seo.ts` (novo)
- `src/components/layout/Sidebar.tsx` (adicionar menu)
- `backend/src/routes/uazapi.js` e `backend/src/routes/evolution.js` (hook de detecção)
