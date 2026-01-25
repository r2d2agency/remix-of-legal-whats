-- Schema para sistema de Filas/Departamentos de Atendimento
-- Cada organização pode ter múltiplos departamentos
-- Cada usuário pode pertencer a múltiplos departamentos

-- Tabela de departamentos/filas
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Cor hex para identificação visual
  icon VARCHAR(50) DEFAULT 'users', -- Nome do ícone lucide
  
  is_active BOOLEAN DEFAULT true,
  
  -- Configurações de atendimento
  max_concurrent_chats INTEGER DEFAULT 5, -- Máximo de atendimentos simultâneos por agente
  auto_assign BOOLEAN DEFAULT false, -- Atribuição automática de chats
  
  -- Horário de funcionamento do departamento
  business_hours_enabled BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '08:00',
  business_hours_end TIME DEFAULT '18:00',
  business_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  
  -- Mensagens automáticas
  welcome_message TEXT, -- Mensagem ao entrar na fila
  offline_message TEXT, -- Mensagem fora do horário
  queue_message TEXT DEFAULT 'Você está na fila de espera. Em breve um atendente irá te atender.',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, name)
);

-- Índices para departments
CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

-- Tabela de membros do departamento (relação N:N entre users e departments)
CREATE TABLE IF NOT EXISTS department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Papel do usuário no departamento
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('supervisor', 'agent')),
  
  -- Status de disponibilidade
  is_available BOOLEAN DEFAULT true,
  current_chats INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(department_id, user_id)
);

-- Índices para department_members
CREATE INDEX IF NOT EXISTS idx_department_members_department ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_user ON department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_department_members_available ON department_members(is_available);

-- Adicionar coluna de departamento na tabela de conversas (se não existir)
DO $$ BEGIN
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
EXCEPTION
  WHEN undefined_table THEN null;
END $$;

-- Índice para buscar conversas por departamento
CREATE INDEX IF NOT EXISTS idx_conversations_department ON conversations(department_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_department_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_departments_updated_at ON departments;
CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_department_updated_at();

-- View para estatísticas de departamento
CREATE OR REPLACE VIEW department_stats AS
SELECT 
  d.id as department_id,
  d.name,
  d.organization_id,
  COUNT(DISTINCT dm.user_id) as total_members,
  COUNT(DISTINCT dm.user_id) FILTER (WHERE dm.is_available = true) as available_members,
  COALESCE(SUM(dm.current_chats), 0) as total_active_chats,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'pending') as pending_chats,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') as active_chats
FROM departments d
LEFT JOIN department_members dm ON d.id = dm.department_id
LEFT JOIN conversations c ON d.id = c.department_id AND c.status IN ('pending', 'active')
GROUP BY d.id, d.name, d.organization_id;
