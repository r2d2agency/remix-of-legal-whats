import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { PdfSignaturePositioner } from '@/components/doc-signatures/PdfSignaturePositioner';
import { useDocSignatures, DocSigner, SignaturePosition } from '@/hooks/use-doc-signatures';
import { resolveMediaUrl } from '@/lib/media';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileSignature, Loader2, CheckCircle2, RefreshCw, MapPin, Download, ShieldCheck, Mail, KeyRound } from 'lucide-react';

export default function AssinarDocumento() {
  const { token } = useParams<{ token: string }>();
  // OTP verification state
  const [otpStep, setOtpStep] = useState<'idle' | 'sending' | 'verify' | 'verified'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDocTitle, setOtpDocTitle] = useState('');
  const [otpSignerName, setOtpSignerName] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [docDescription, setDocDescription] = useState('');

  const [signingData, setSigningData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [signedResult, setSignedResult] = useState<any>(null);
  const [cpfInput, setCpfInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [geolocation, setGeolocation] = useState<string | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [signaturePreviewTimestamp, setSignaturePreviewTimestamp] = useState<string | null>(null);

  const sigPadRef = useRef<SignatureCanvas>(null);
  const { getPublicSigningData, submitSignature, getPublicSignedPdfUrl, requestOtp, verifyOtp, loading: submitting } = useDocSignatures();

  useEffect(() => {
    if (token) handleRequestOtp();
  }, [token]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async () => {
    setOtpStep('sending');
    setOtpError(null);
    try {
      const data = await requestOtp(token!);
      if (data) {
        setMaskedEmail(data.masked_email);
        setOtpSignerName(data.signer_name);
        setOtpDocTitle(data.document_title);
        setDocDescription(data.document_description || '');
        setOrgName(data.org_name || '');
        setOrgLogoUrl(data.org_logo_url || '');
        setOtpStep('verify');
        setResendCooldown(60);
      }
    } catch (err: any) {
      setOtpError(err.message);
      setOtpStep('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { toast.error('Digite o código de 6 dígitos'); return; }
    try {
      const ok = await verifyOtp(token!, otpCode);
      if (ok) {
        setOtpStep('verified');
        toast.success('Identidade verificada!');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message);
      setOtpCode('');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError(null);
    try {
      await requestOtp(token!);
      toast.success('Novo código enviado!');
      setResendCooldown(60);
      setOtpCode('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      setLoadingGeo(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeolocation(`${pos.coords.latitude},${pos.coords.longitude}`); setLoadingGeo(false); },
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
      if (data.org_name) setOrgName(data.org_name);
      if (data.org_logo_url) setOrgLogoUrl(data.org_logo_url);
      if (data.document_description) setDocDescription(data.document_description);
    } catch (err: any) {
      // If require_otp, go back to OTP flow
      if (err.require_otp) {
        setOtpStep('idle');
        handleRequestOtp();
        return;
      }
      setError(err.message);
    }
    finally { setLoadingData(false); }
  };

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  const updateSignaturePreview = () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSignaturePreviewUrl(null);
      setSignaturePreviewTimestamp(null);
      return;
    }

    setSignaturePreviewUrl(sigPadRef.current.toDataURL('image/png'));
    setSignaturePreviewTimestamp(new Date().toISOString());
  };

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setSignaturePreviewUrl(null);
    setSignaturePreviewTimestamp(null);
  };

  const handleSubmit = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) { toast.error('Desenhe sua assinatura'); return; }
    if (!cpfInput || cpfInput.replace(/\D/g, '').length !== 11) { toast.error('CPF inválido'); return; }
    if (!fullName) { toast.error('Nome completo é obrigatório'); return; }

    try {
      const signatureImage = sigPadRef.current.toDataURL('image/png');
      const result = await submitSignature(token!, {
        signature_image: signatureImage,
        cpf: cpfInput,
        full_name: fullName,
        geolocation: geolocation || undefined,
      });

      const fallbackDownloadUrl = (!result?.download_url && !result?.signed_pdf_url)
        ? await getPublicSignedPdfUrl(token!)
        : null;
      const finalDownloadUrl = result?.download_url || result?.signed_pdf_url || fallbackDownloadUrl || null;

      setSignedResult({
        ...result,
        download_url: finalDownloadUrl,
        signed_pdf_url: finalDownloadUrl,
      });
      setSigned(true);
      toast.success('Documento assinado com sucesso!');
    } catch (err: any) { toast.error(err.message); }
  };

  const publicSignerPreview: DocSigner | null = signingData?.signer
    ? {
        id: signingData.signer.id,
        document_id: '',
        name: signingData.signer.name,
        email: signingData.signer.email,
        cpf: signingData.signer.cpf,
        role: signingData.signer.role || 'signer',
        sign_order: 1,
        status: 'pending',
        sign_token: '',
        created_at: new Date().toISOString(),
      }
    : null;

  const signerPositions: SignaturePosition[] = Array.isArray(signingData?.positions) ? signingData.positions : [];
  const previewPositions: SignaturePosition[] = signerPositions.length > 0
    ? signerPositions
    : (publicSignerPreview
      ? [{
          id: `preview-${publicSignerPreview.id}`,
          signer_id: publicSignerPreview.id,
          page: 1,
          x: 36,
          y: 40,
          width: 220,
          height: 72,
        }]
      : []);

  const previewSignatureBySigner = publicSignerPreview?.id && signaturePreviewUrl
    ? { [publicSignerPreview.id]: signaturePreviewUrl }
    : undefined;

  const previewAuditBySigner = publicSignerPreview?.id
    ? {
        [publicSignerPreview.id]: {
          name: fullName || publicSignerPreview.name,
          cpf: cpfInput || publicSignerPreview.cpf,
          geolocation: geolocation || undefined,
          signedAt: signaturePreviewTimestamp || new Date().toISOString(),
        },
      }
    : undefined;

  const signedDownloadUrl = resolveMediaUrl(signedResult?.download_url || signedResult?.signed_pdf_url);
  const originalDownloadUrl = resolveMediaUrl(signingData?.file_url);

  // OTP verification screen (before document is loaded)
  if (otpStep !== 'verified' && !signingData && !error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Org branding header */}
          {(orgLogoUrl || orgName) && (
            <div className="flex flex-col items-center gap-2 mb-2">
              {orgLogoUrl && (
                <img src={orgLogoUrl} alt={orgName || 'Logo'} className="h-12 max-w-[200px] object-contain" />
              )}
              {orgName && !orgLogoUrl && (
                <p className="text-lg font-semibold text-foreground">{orgName}</p>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Verificação de Identidade</CardTitle>
            </CardHeader>
            <CardContent>
              {otpStep === 'sending' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Enviando código de verificação para seu e-mail...</p>
                </div>
              )}

              {otpStep === 'idle' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Mail className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-center text-muted-foreground">
                    Para sua segurança, enviaremos um código de verificação para o e-mail cadastrado do signatário.
                  </p>
                  {otpDocTitle && (
                    <div className="text-left bg-muted/50 rounded-lg p-3 w-full space-y-1">
                      <p className="text-sm font-medium">📄 {otpDocTitle}</p>
                      {docDescription && <p className="text-xs text-muted-foreground">{docDescription}</p>}
                    </div>
                  )}
                  {otpError && (
                    <p className="text-sm text-destructive text-center">{otpError}</p>
                  )}
                  <Button onClick={handleRequestOtp} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Enviar Código por E-mail
                  </Button>
                </div>
              )}

              {otpStep === 'verify' && (
                <div className="space-y-5">
                  <div className="text-center space-y-2">
                    <p className="text-sm">
                      Olá <strong>{otpSignerName}</strong>, enviamos um código de 6 dígitos para:
                    </p>
                    <Badge variant="secondary" className="text-sm gap-1.5 px-3 py-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {maskedEmail}
                    </Badge>
                    {otpDocTitle && (
                      <div className="text-left bg-muted/50 rounded-lg p-3 w-full space-y-1 mt-2">
                        <p className="text-sm font-medium">📄 {otpDocTitle}</p>
                        {docDescription && <p className="text-xs text-muted-foreground">{docDescription}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <Label className="text-sm font-medium">Digite o código recebido no e-mail</Label>
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>

                    <Button onClick={handleVerifyOtp} disabled={submitting || otpCode.length !== 6} className="w-full gap-2">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Verificar Código
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || submitting}
                      className="text-xs"
                    >
                      {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-4">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                🔒 <strong>Por que estamos pedindo isso?</strong> Esta verificação garante que somente a pessoa autorizada tenha acesso ao documento para assinatura. O código é válido por 10 minutos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loadingData && otpStep === 'verified') {
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
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Documento Assinado!</h2>
            <p className="text-muted-foreground">
              Sua assinatura foi registrada com sucesso. Todos os dados foram capturados para validade jurídica.
            </p>
            <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg text-left">
              <p>📅 Data/Hora: {new Date().toLocaleString('pt-BR')}</p>
              {geolocation && <p>📍 Geolocalização: {geolocation}</p>}
              <p>🖥️ Navegador: {navigator.userAgent.slice(0, 60)}...</p>
            </div>

            {/* Download signed copy */}
            {signedDownloadUrl && (
              <Button onClick={() => window.open(signedDownloadUrl, '_blank')} className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" />
                Baixar Cópia do Documento Assinado
              </Button>
            )}
            {originalDownloadUrl && (
              <Button onClick={() => window.open(originalDownloadUrl, '_blank')} className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" />
                Baixar Documento Original
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Org branding + document info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt={orgName || 'Logo'} className="h-10 max-w-[160px] object-contain" />
              ) : (
                <FileSignature className="h-5 w-5 text-primary" />
              )}
              <div>
                <CardTitle className="text-lg">{signingData?.document_title || 'Assinatura de Documento'}</CardTitle>
                {orgName && <p className="text-xs text-muted-foreground">{orgName}</p>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {docDescription && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">{docDescription}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Olá <strong>{signingData?.signer?.name}</strong>, você foi convidado(a) a assinar este documento como{' '}
              <Badge variant="outline" className="text-xs">
                {signingData?.signer?.role === 'signer' ? 'Signatário' : signingData?.signer?.role === 'witness' ? 'Testemunha' : 'Aprovador'}
              </Badge>
            </p>
          </CardContent>
        </Card>

        {signingData?.file_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visualizar Documento e Área de Assinatura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PdfSignaturePositioner
                fileUrl={signingData.file_url}
                signers={publicSignerPreview ? [publicSignerPreview] : []}
                existingPositions={previewPositions}
                onSave={async () => {}}
                readOnly
                previewSignatureBySigner={previewSignatureBySigner}
                auditPreviewBySigner={previewAuditBySigner}
              />
              <p className="text-xs text-muted-foreground">
                A caixa destacada indica onde sua assinatura e os dados de auditoria serão aplicados no PDF final.
              </p>
            </CardContent>
          </Card>
        )}

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sua Assinatura</CardTitle>
              <Button variant="outline" size="sm" onClick={clearSignature} className="gap-1">
                <RefreshCw className="h-3 w-3" /> Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-primary/30 rounded-lg bg-white">
              <SignatureCanvas
                ref={sigPadRef}
                penColor="black"
                canvasProps={{ className: 'w-full h-[200px]', style: { width: '100%', height: '200px' } }}
                onEnd={updateSignaturePreview}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Desenhe sua assinatura no campo acima usando o mouse ou o dedo
            </p>
          </CardContent>
        </Card>

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

        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
          Assinar Documento
        </Button>
      </div>
    </div>
  );
}
