import { useState, useCallback } from 'react';
import { API_URL, getAuthToken } from '@/lib/api';

export interface DocSignatureDocument {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  status: 'draft' | 'pending' | 'completed' | 'cancelled';
  created_by: string;
  creator_name?: string;
  signers_count: number;
  signed_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocSigner {
  id: string;
  document_id: string;
  name: string;
  email: string;
  cpf: string;
  role: string; // 'signer' | 'witness' | 'approver'
  sign_order: number;
  status: 'pending' | 'signed' | 'declined';
  signature_url?: string;
  signed_at?: string;
  sign_token: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: string;
  created_at: string;
}

export interface SignaturePosition {
  id: string;
  signer_id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AuditLog {
  id: string;
  document_id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
}

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePosition = (position: any): SignaturePosition => ({
  id: position.id,
  signer_id: position.signer_id,
  page: Math.max(1, Math.round(toNumber(position.page, 1))),
  x: toNumber(position.x, 0),
  y: toNumber(position.y, 0),
  width: Math.max(100, toNumber(position.width, 200)),
  height: Math.max(40, toNumber(position.height, 80)),
});

export function useDocSignatures() {
  const [loading, setLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  });

  const listDocuments = useCallback(async (): Promise<DocSignatureDocument[]> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Erro ao listar documentos');
      return res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const getDocument = useCallback(async (id: string): Promise<{ document: DocSignatureDocument; signers: DocSigner[]; positions: SignaturePosition[]; audit: AuditLog[] } | null> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${id}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar documento');
      const data = await res.json();
      return {
        ...data,
        positions: Array.isArray(data.positions) ? data.positions.map(normalizePosition) : [],
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const createDocument = useCallback(async (data: { title: string; description?: string; file_url: string }): Promise<DocSignatureDocument | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar documento');
      }
      return res.json();
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addSigner = useCallback(async (documentId: string, data: { name: string; email: string; cpf: string; role?: string; sign_order?: number }): Promise<DocSigner | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/signers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao adicionar signatário');
      }
      return res.json();
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSigner = useCallback(async (documentId: string, signerId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/signers/${signerId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const savePositions = useCallback(async (documentId: string, positions: { signer_id: string; page: number; x: number; y: number; width: number; height: number }[]): Promise<boolean> => {
    try {
      const normalizedPositions = positions.map((position) => ({
        signer_id: position.signer_id,
        page: Math.max(1, Math.round(toNumber(position.page, 1))),
        x: toNumber(position.x, 0),
        y: toNumber(position.y, 0),
        width: Math.max(100, toNumber(position.width, 200)),
        height: Math.max(40, toNumber(position.height, 80)),
      }));

      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/positions`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ positions: normalizedPositions })
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const sendForSignature = useCallback(async (documentId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/send`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar para assinatura');
      }
      return true;
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelDocument = useCallback(async (documentId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/cancel`, {
        method: 'POST',
        headers: getHeaders()
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Public signing endpoint (no auth required)
  const getPublicSigningData = useCallback(async (token: string): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/sign/${token}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody.require_otp) {
          const err: any = new Error(errBody.error || 'Verificação necessária');
          err.require_otp = true;
          throw err;
        }
        throw new Error(errBody.error || 'Link inválido ou expirado');
      }
      const data = await res.json();
      return {
        ...data,
        positions: Array.isArray(data.positions) ? data.positions.map(normalizePosition) : [],
      };
    } catch (err: any) {
      throw err;
    }
  }, []);

  const submitSignature = useCallback(async (token: string, data: {
    signature_image: string;
    cpf: string;
    full_name: string;
    geolocation?: string;
  }): Promise<{ signed_pdf_url?: string } | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao assinar');
      }
      return res.json();
    } catch (err: any) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadSignedPdf = useCallback(async (documentId: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/${documentId}/download`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Erro ao baixar PDF');
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  }, []);

  const requestOtp = useCallback(async (token: string): Promise<{ masked_email: string; signer_name: string; document_title: string; document_description?: string; org_name?: string; org_logo_url?: string } | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/sign/${token}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar código');
      }
      return res.json();
    } catch (err: any) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (token: string, code: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/doc-signatures/sign/${token}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Código inválido');
      }
      return true;
    } catch (err: any) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    listDocuments,
    getDocument,
    createDocument,
    addSigner,
    removeSigner,
    savePositions,
    sendForSignature,
    cancelDocument,
    getPublicSigningData,
    submitSignature,
    downloadSignedPdf,
    requestOtp,
    verifyOtp,
  };
}
