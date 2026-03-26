import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, FileText, User, Clock, MapPin, Globe, Monitor, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface VerificationData {
  document: {
    id: string;
    title: string;
    description?: string;
    status: string;
    hash_sha256?: string;
    created_at: string;
    org_name?: string;
  };
  signers: Array<{
    name: string;
    cpf_masked: string;
    role: string;
    status: string;
    signed_at?: string;
    ip_address?: string;
    geolocation?: string;
  }>;
  audit: Array<{
    action: string;
    actor_name?: string;
    actor_email?: string;
    ip_address?: string;
    geolocation?: string;
    created_at: string;
  }>;
}

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'secondary', icon: FileText },
  pending: { label: 'Pendente', color: 'outline', icon: Clock },
  completed: { label: 'Concluído', color: 'default', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'destructive', icon: XCircle },
  signed: { label: 'Assinado', color: 'default', icon: CheckCircle2 },
};

const actionLabels: Record<string, string> = {
  document_created: 'Documento criado',
  signer_added: 'Signatário adicionado',
  document_sent: 'Enviado para assinatura',
  otp_requested: 'Código OTP solicitado',
  otp_verified: 'Código OTP verificado',
  signing_link_opened: 'Link de assinatura aberto',
  signing_link_accessed: 'Link de assinatura acessado',
  document_accessed: 'Documento acessado',
  document_signed: 'Documento assinado',
  signature_submitted: 'Assinatura submetida',
  terms_accepted: 'Termos aceitos pelo signatário',
  signed_pdf_downloaded: 'PDF assinado baixado',
  document_cancelled: 'Documento cancelado',
  positions_saved: 'Posições de assinatura salvas',
};

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return d;
  }
};

const maskCpf = (cpf: string) => cpf;

export default function VerificarDocumento() {
  const { documentId } = useParams<{ documentId: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!documentId) return;
    fetch(`${API_URL}/api/doc-signatures/verify/${documentId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Documento não encontrado');
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Documento não encontrado</h2>
            <p className="text-sm text-muted-foreground">{error || 'O documento solicitado não existe ou foi removido.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doc = data.document;
  const statusInfo = statusMap[doc.status] || statusMap.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Verificação de Autenticidade</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Este documento foi assinado eletronicamente com validade jurídica.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Documento:</span>
                <p className="font-medium">{doc.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusIcon className="h-4 w-4" />
                  <Badge variant={statusInfo.color as any}>{statusInfo.label}</Badge>
                </div>
              </div>
              {doc.org_name && (
                <div>
                  <span className="text-muted-foreground">Organização:</span>
                  <p className="font-medium">{doc.org_name}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Criado em:</span>
                <p className="font-medium">{formatDate(doc.created_at)}</p>
              </div>
            </div>
            {doc.hash_sha256 && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Hash SHA-256:</span>
                <p className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">{doc.hash_sha256}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic">
              Validade jurídica conforme MP 2.200-2/2001 (Art. 10, §2º) e Lei 14.063/2020.
            </p>
          </CardContent>
        </Card>

        {/* Signers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Signatários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.signers.map((signer, i) => {
              const sStatus = statusMap[signer.status] || statusMap.pending;
              const SIcon = sStatus.icon;
              return (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{signer.name}</p>
                      <p className="text-xs text-muted-foreground">CPF: {maskCpf(signer.cpf_masked)}</p>
                    </div>
                    <Badge variant={sStatus.color as any} className="flex items-center gap-1">
                      <SIcon className="h-3 w-3" /> {sStatus.label}
                    </Badge>
                  </div>
                  {signer.signed_at && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(signer.signed_at)}</span>
                      {signer.ip_address && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> IP: {signer.ip_address}</span>}
                      {signer.geolocation && <span className="flex items-center gap-1 col-span-full"><MapPin className="h-3 w-3" /> {signer.geolocation}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Trilha de Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.audit.map((entry, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    {i < data.audit.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="font-medium text-xs">{actionLabels[entry.action] || entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor_name && <span>{entry.actor_name} • </span>}
                      {formatDate(entry.created_at)}
                    </p>
                    {entry.ip_address && (
                      <p className="text-xs text-muted-foreground">IP: {entry.ip_address}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ID: {documentId}
        </p>
      </div>
    </div>
  );
}
