-- Schema para Fila de Cobrança com Agendamento
-- Permite criar filas manuais, programar envios e monitorar execução

-- ============================================
-- FILA DE COBRANÇA
-- ============================================

CREATE TABLE IF NOT EXISTS billing_queue_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
    
    -- Configuração do lote
    name VARCHAR(255) NOT NULL,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, running, completed, cancelled
    
    -- Configuração de envio
    start_time TIME, -- horário de início (ex: 09:00)
    interval_mode VARCHAR(20) DEFAULT 'fixed', -- fixed, random
    interval_seconds INTEGER DEFAULT 240, -- 4 minutos padrão
    interval_min_seconds INTEGER, -- para modo random
    interval_max_seconds INTEGER, -- para modo random
    
    -- Estatísticas
    total_items INTEGER DEFAULT 0,
    total_value DECIMAL(10,2) DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Controle de execução
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_send_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_batches_org ON billing_queue_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_batches_date ON billing_queue_batches(queue_date);
CREATE INDEX IF NOT EXISTS idx_billing_batches_status ON billing_queue_batches(status);

-- Itens individuais da fila
CREATE TABLE IF NOT EXISTS billing_queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES billing_queue_batches(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    
    -- Referências
    payment_id UUID REFERENCES asaas_payments(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES asaas_customers(id) ON DELETE CASCADE NOT NULL,
    
    -- Dados da cobrança (snapshot)
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    payment_value DECIMAL(10,2),
    due_date DATE,
    
    -- Status do envio
    status VARCHAR(50) DEFAULT 'pending', -- pending, sending, sent, failed, skipped
    error_message TEXT,
    
    -- Controle
    position INTEGER, -- ordem na fila
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_items_batch ON billing_queue_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_status ON billing_queue_items(status);
CREATE INDEX IF NOT EXISTS idx_queue_items_scheduled ON billing_queue_items(scheduled_for) WHERE status = 'pending';
