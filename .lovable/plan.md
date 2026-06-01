O Supervisor IA foi projetado para monitorar automaticamente a sua operação comercial, mas para isso ele precisa saber **quem** monitorar e **quais dados** analisar. Atualmente, essa configuração é feita de forma centralizada para manter a consistência do sistema.

Aqui está o plano para ajustar o que você solicitou:

### 1. Configuração de Vendedores (Quem monitorar)
O Supervisor IA monitora automaticamente todos os membros da sua organização que possuem o papel de **Agente**, **Gerente** ou **Supervisor IA**.
- Vou adicionar um atalho direto na aba "Configurar Vendedores" do Supervisor IA que leva você para a tela de **CRM > Organizações**, onde você pode:
    - Alterar o papel dos usuários.
    - Atribuir quais conexões de WhatsApp cada vendedor atende.
- O Supervisor só analisa vendedores que tenham pelo menos uma conexão atribuída.

### 2. Configuração de Funis (O que monitorar)
O Supervisor IA analisa todos os funis ativos do seu CRM.
- Vou adicionar uma nova seção na aba de **Configurações/SLA** para permitir que você selecione quais Funis específicos o Supervisor deve ignorar ou focar.
- Vou garantir que o Supervisor considere atividades registradas no Kanban (como ligações ou reuniões) para zerar os prazos de SLA, e não apenas mensagens de WhatsApp.

### 3. Melhorias na Interface do Supervisor IA
- Adição de filtros por **Funil** no Dashboard principal.
- Melhoria no guia de "Primeiros Passos" para deixar claro onde cada configuração reside.

### Detalhes Técnicos
- **Frontend:** Atualização do componente `SupervisorIA.tsx` para incluir seletores de funis e links de navegação para gestão de membros.
- **Backend:** Atualização das rotas em `backend/src/routes/supervisor.js` para suportar filtros de funis e persistir essas preferências em `supervisor_settings`.
- **Banco de Dados:** Criação de migração para adicionar a coluna `monitored_funnels` na tabela `supervisor_settings`.
