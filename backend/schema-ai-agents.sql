-- Schema para Agentes de IA
-- Suporta múltiplos provedores (OpenAI, Gemini), RAG com knowledge base, e integração WhatsApp/CRM

-- Enum para provedor de IA dos agentes
DO $$ BEGIN
  CREATE TYPE agent_ai_provider AS ENUM ('openai', 'gemini');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de fonte de conhecimento
DO $$ BEGIN
  CREATE TYPE knowledge_source_type AS ENUM ('file', 'url', 'text');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para status de processamento
DO $$ BEGIN
  CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para capacidades do agente
DO $$ BEGIN
  CREATE TYPE agent_capability AS ENUM (
    'respond_messages',      -- Responder mensagens automaticamente
    'read_files',            -- Ler/processar arquivos enviados
    'schedule_meetings',     -- Agendar reuniões (Google Calendar)
    'create_deals',          -- Criar negociações no CRM
    'suggest_actions',       -- Sugerir próximos passos
    'generate_content',      -- Gerar emails/mensagens
    'summarize_history',     -- Resumir histórico
    'qualify_leads',         -- Qualificar leads
    'call_agent',            -- Chamar outro agente para consulta
    'transcribe_audio'       -- Transcrever e entender áudios
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Migration: Add new values to existing enum if needed
DO $$ BEGIN
  ALTER TYPE agent_capability ADD VALUE IF NOT EXISTS 'call_agent';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE agent_capability ADD VALUE IF NOT EXISTS 'transcribe_audio';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela principal de Agentes de IA
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Informações básicas
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Configuração do provedor de IA
  ai_provider agent_ai_provider NOT NULL DEFAULT 'openai',
  ai_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
  ai_api_key TEXT, -- Criptografada, pode ser null para usar chave da org
  
  -- Personalidade e comportamento
  system_prompt TEXT NOT NULL DEFAULT 'Você é um assistente virtual prestativo e profissional.',
  personality_traits JSONB DEFAULT '[]', -- ["amigável", "objetivo", "técnico"]
  language VARCHAR(10) DEFAULT 'pt-BR',
  
  -- Configurações de geração
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  context_window INTEGER DEFAULT 10, -- Quantas mensagens anteriores incluir
  
  -- Capacidades habilitadas
  capabilities agent_capability[] DEFAULT ARRAY['respond_messages']::agent_capability[],
  
  -- Mensagens padrão
  greeting_message TEXT,
  fallback_message TEXT DEFAULT 'Desculpe, não consegui entender. Pode reformular sua pergunta?',
  handoff_message TEXT DEFAULT 'Vou transferir você para um atendente humano.',
  
  -- Configurações de handoff
  handoff_keywords TEXT[] DEFAULT ARRAY['humano', 'atendente', 'pessoa'],
  auto_handoff_after_failures INTEGER DEFAULT 3,
  
  -- Takeover: quando humano responde, pausa IA por X segundos
  takeover_timeout_seconds INTEGER DEFAULT 300,
  
  -- Variáveis obrigatórias que a IA deve coletar antes de transferir
  required_variables JSONB DEFAULT '[]', -- [{"name":"nome","question":"Qual o seu nome?"}]
  
  -- Timeout de inatividade
  inactivity_timeout_minutes INTEGER DEFAULT 0, -- 0 = desabilitado
  inactivity_message TEXT DEFAULT 'Como não recebi sua resposta, vou encerrar nosso atendimento por aqui. Se precisar, é só me chamar novamente! 😊',
  
  -- Vinculações
  default_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  default_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Para handoff
  
  -- CRM - configurações de qualificação
  lead_scoring_criteria JSONB DEFAULT '{}',
  auto_create_deal_funnel_id UUID,
  auto_create_deal_stage_id UUID,
  
  -- Estatísticas
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  satisfaction_score DECIMAL(3,2),
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_organization ON ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON ai_agents(is_active);

-- Tabela de fontes de conhecimento (Knowledge Base)
CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  
  -- Tipo e identificação
  source_type knowledge_source_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Conteúdo original
  -- Para 'file': URL do arquivo no storage
  -- Para 'url': URL da página web
  -- Para 'text': O próprio texto
  source_content TEXT NOT NULL,
  
  -- Metadados
  file_type VARCHAR(50), -- pdf, docx, txt, etc
  file_size INTEGER, -- em bytes
  original_filename VARCHAR(255),
  
  -- Status de processamento
  status processing_status DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Estatísticas
  chunk_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Maior = mais relevante
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para knowledge_sources
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_agent ON ai_knowledge_sources(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_status ON ai_knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_active ON ai_knowledge_sources(is_active);

-- Tabela de chunks para RAG (vetorização futura)
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ai_knowledge_sources(id) ON DELETE CASCADE,
  
  -- Conteúdo do chunk
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  
  -- Metadados para contexto
  metadata JSONB DEFAULT '{}', -- página, seção, título, etc
  
  -- Embedding (para busca semântica futura)
  -- embedding VECTOR(1536), -- Descomentar quando usar pgvector
  
  -- Estatísticas
  token_count INTEGER,
  char_count INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para chunks
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_source ON ai_knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_index ON ai_knowledge_chunks(chunk_index);

-- Tabela de sessões de conversa com agente
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- Contexto
  contact_phone VARCHAR(50),
  contact_name VARCHAR(255),
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  context_variables JSONB DEFAULT '{}', -- Variáveis coletadas durante a conversa
  
  -- Qualificação de lead
  lead_score INTEGER,
  qualification_data JSONB DEFAULT '{}',
  
  -- Controle de handoff
  handoff_requested BOOLEAN DEFAULT false,
  handoff_at TIMESTAMP WITH TIME ZONE,
  handoff_to_user_id UUID REFERENCES users(id),
  handoff_reason TEXT,
  
  -- Estatísticas da sessão
  message_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Índices para sessions
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_agent ON ai_agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_conversation ON ai_agent_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_active ON ai_agent_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_phone ON ai_agent_sessions(contact_phone);

-- Tabela de mensagens trocadas com o agente
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_agent_sessions(id) ON DELETE CASCADE,
  
  -- Direção e tipo
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  
  -- Conteúdo
  content TEXT,
  
  -- Mídia (se aplicável)
  media_type VARCHAR(50),
  media_url TEXT,
  
  -- RAG - fontes utilizadas
  knowledge_sources_used UUID[], -- IDs das fontes consultadas
  context_chunks JSONB, -- Chunks utilizados para a resposta
  
  -- Tokens e custos
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  -- Tool calls (para agendamentos, criar deals, etc)
  tool_calls JSONB,
  tool_results JSONB,
  
  -- Feedback
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment TEXT,
  
  -- Metadata
  processing_time_ms INTEGER,
  model_used VARCHAR(100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_session ON ai_agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_role ON ai_agent_messages(role);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_created ON ai_agent_messages(created_at);

-- Tabela de prompts/templates reutilizáveis
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- sales, support, onboarding, etc
  
  -- Template com placeholders
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- ["nome_cliente", "produto", "valor"]
  
  -- Uso
  is_system BOOLEAN DEFAULT false, -- Templates do sistema vs usuário
  usage_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para templates
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_organization ON ai_prompt_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON ai_prompt_templates(category);

-- Tabela de vinculação agente ↔ conexão WhatsApp
CREATE TABLE IF NOT EXISTS ai_agent_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  
  -- Modo de operação para esta conexão
  mode VARCHAR(50) DEFAULT 'always', -- always, business_hours, keywords
  
  -- Keywords que ativam o agente
  trigger_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Horário comercial
  business_hours_start TIME DEFAULT '08:00',
  business_hours_end TIME DEFAULT '18:00',
  business_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Para múltiplos agentes na mesma conexão
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(agent_id, connection_id)
);

-- Índices para agent_connections
CREATE INDEX IF NOT EXISTS idx_ai_agent_connections_agent ON ai_agent_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_connections_connection ON ai_agent_connections(connection_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_connections_active ON ai_agent_connections(is_active);

-- Estatísticas agregadas por período
CREATE TABLE IF NOT EXISTS ai_agent_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Contadores
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  
  -- Qualidade
  handoff_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  
  -- CRM
  deals_created INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(agent_id, date)
);

-- Índices para stats
CREATE INDEX IF NOT EXISTS idx_ai_agent_stats_agent_date ON ai_agent_stats(agent_id, date);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_ai_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER trigger_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agent_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_knowledge_sources_updated_at ON ai_knowledge_sources;
CREATE TRIGGER trigger_ai_knowledge_sources_updated_at
  BEFORE UPDATE ON ai_knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agent_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_prompt_templates_updated_at ON ai_prompt_templates;
CREATE TRIGGER trigger_ai_prompt_templates_updated_at
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agent_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_agent_stats_updated_at ON ai_agent_stats;
CREATE TRIGGER trigger_ai_agent_stats_updated_at
  BEFORE UPDATE ON ai_agent_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agent_updated_at();

-- Comentários nas tabelas
COMMENT ON TABLE ai_agents IS 'Agentes de IA configuráveis com suporte a múltiplos provedores e capacidades';
COMMENT ON TABLE ai_knowledge_sources IS 'Fontes de conhecimento para RAG (arquivos, URLs, texto)';
COMMENT ON TABLE ai_knowledge_chunks IS 'Chunks de texto para busca semântica';
COMMENT ON TABLE ai_agent_sessions IS 'Sessões de conversa ativas com agentes';
COMMENT ON TABLE ai_agent_messages IS 'Histórico de mensagens trocadas com agentes';
COMMENT ON TABLE ai_prompt_templates IS 'Templates de prompts reutilizáveis';
COMMENT ON TABLE ai_agent_connections IS 'Vinculação de agentes a conexões WhatsApp';
COMMENT ON TABLE ai_agent_stats IS 'Estatísticas agregadas de uso dos agentes';
