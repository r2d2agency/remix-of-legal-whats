-- Document Signatures Module Schema

-- Add has_doc_signatures to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_doc_signatures BOOLEAN DEFAULT false;

-- Main documents table
CREATE TABLE IF NOT EXISTS doc_signature_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    signed_file_url TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'cancelled')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    hash_sha256 VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signers for each document
CREATE TABLE IF NOT EXISTS doc_signature_signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    role VARCHAR(20) DEFAULT 'signer' CHECK (role IN ('signer', 'witness', 'approver')),
    sign_order INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined')),
    signature_url TEXT,
    signed_at TIMESTAMP WITH TIME ZONE,
    sign_token VARCHAR(128) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signature positions on PDF pages
CREATE TABLE IF NOT EXISTS doc_signature_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
    signer_id UUID REFERENCES doc_signature_signers(id) ON DELETE CASCADE NOT NULL,
    page INTEGER NOT NULL DEFAULT 1,
    x DECIMAL(10, 4) NOT NULL,
    y DECIMAL(10, 4) NOT NULL,
    width DECIMAL(10, 4) NOT NULL DEFAULT 200,
    height DECIMAL(10, 4) NOT NULL DEFAULT 80
);

-- Audit log for legal compliance
CREATE TABLE IF NOT EXISTS doc_signature_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES doc_signature_documents(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_sig_docs_org ON doc_signature_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_sig_docs_status ON doc_signature_documents(status);
CREATE INDEX IF NOT EXISTS idx_doc_sig_signers_doc ON doc_signature_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sig_signers_token ON doc_signature_signers(sign_token);
CREATE INDEX IF NOT EXISTS idx_doc_sig_audit_doc ON doc_signature_audit(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sig_positions_doc ON doc_signature_positions(document_id);
