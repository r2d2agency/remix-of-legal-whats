import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDocSignatures } from '@/hooks/use-doc-signatures';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileSignature, Loader2, CheckCircle2, RefreshCw, MapPin } from 'lucide-react';

export default function AssinarDocumento() {
  const { token } = useParams<{ token: string }>();
  const [signingData, setSigningData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [geolocation, setGeolocation] = useState<string | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const sigPadRef = useRef<SignatureCanvas>(null);
  const { getPublicSigningData, submitSignature, loading: submitting } = useDocSignatures();

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  useEffect(() => {
    // Try to get geolocation
    if (navigator.geolocation) {
      setLoadingGeo(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeolocation(`${pos.coords.latitude},${pos.coords.longitude}`);
          setLoadingGeo(false);
        },
        () => setLoadingGeo(false),
        { timeout: 10000 }
      );
    }
  }, []);

  const loadData = async () => {
    try {
      const data = await getPublicSigningData(token!);
      setSigningData(data);
      setFullName(data.signer.name);
      setCpfInput(data.signer.cpf);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast.error('Desenhe sua assinatura');
      return;
    }
    if (!cpfInput || cpfInput.replace(/\D/g, '').length !== 11) {
      toast.error('CPF inválido');
      return;
    }
    if (!fullName) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    try {
      const signatureImage = sigPadRef.current.toDataURL('image/png');
      await submitSignature(token!, {
        signature_image: signatureImage,
        cpf: cpfInput,
        full_name: fullName,
        geolocation: geolocation || undefined,
      });
      setSigned(true);
      toast.success('Documento assinado com sucesso!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileSignature className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Documento Assinado!</h2>
            <p className="text-muted-foreground mb-4">
              Sua assinatura foi registrada com sucesso. Todos os dados foram capturados para validade jurídica.
            </p>
            <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
              <p>📅 Data/Hora: {new Date().toLocaleString('pt-BR')}</p>
              {geolocation && <p>📍 Geolocalização: {geolocation}</p>}
              <p>🖥️ Navegador: {navigator.userAgent.slice(0, 60)}...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Assinatura de Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{signingData?.document_title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Olá <strong>{signingData?.signer?.name}</strong>, você foi convidado(a) a assinar este documento como{' '}
              <Badge variant="outline" className="text-xs">
                {signingData?.signer?.role === 'signer' ? 'Signatário' : signingData?.signer?.role === 'witness' ? 'Testemunha' : 'Aprovador'}
              </Badge>
            </p>
          </CardContent>
        </Card>

        {/* Document Preview */}
        {signingData?.file_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visualizar Documento</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                src={signingData.file_url}
                className="w-full h-[500px] border rounded-lg"
                title="Documento PDF"
              />
            </CardContent>
          </Card>
        )}

        {/* Signer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Signatário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={cpfInput} onChange={(e) => setCpfInput(formatCpf(e.target.value))} maxLength={14} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {loadingGeo ? 'Obtendo localização...' : geolocation ? `Localização: ${geolocation}` : 'Localização não disponível'}
            </div>
          </CardContent>
        </Card>

        {/* Signature Pad */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sua Assinatura</CardTitle>
              <Button variant="outline" size="sm" onClick={clearSignature} className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-primary/30 rounded-lg bg-white">
              <SignatureCanvas
                ref={sigPadRef}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-[200px]',
                  style: { width: '100%', height: '200px' }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Desenhe sua assinatura no campo acima usando o mouse ou o dedo
            </p>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              ⚖️ <strong>Aviso Legal:</strong> Ao assinar este documento, você declara que leu e concorda com o conteúdo.
              Esta assinatura digital tem validade jurídica conforme a Medida Provisória nº 2.200-2/2001
              e o Código Civil Brasileiro (Art. 107 e Art. 219). Serão registrados: seu IP, geolocalização,
              data/hora, CPF e assinatura digital para fins de auditoria e comprovação.
            </p>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
          Assinar Documento
        </Button>
      </div>
    </div>
  );
}
