-- Internal Notes (Anotações Internas)
-- Notas visíveis apenas para a equipe, não enviadas ao cliente

CREATE TABLE conversation_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversation_notes_conv ON conversation_notes(conversation_id);
CREATE INDEX idx_conversation_notes_user ON conversation_notes(user_id);
CREATE INDEX idx_conversation_notes_created ON conversation_notes(created_at DESC);
