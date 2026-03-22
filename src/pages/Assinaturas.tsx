import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileUploadInput } from '@/components/ui/file-upload-input';
import { useDocSignatures, DocSignatureDocument, DocSigner, AuditLog, SignaturePosition } from '@/hooks/use-doc-signatures';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileSignature, Plus, Loader2, Eye, Send, Copy, Trash2,
  UserPlus, FileText, Clock, CheckCircle2, XCircle, Shield, Download, Link2, Users
} from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: FileText },
  pending: { label: 'Aguardando', variant: 'default', icon: Clock },
  completed: { label: 'Concluído', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
};

export default function Assinaturas() {
  const [documents, setDocuments] = useState<DocSignatureDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addSignerOpen, setAddSignerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocSignatureDocument | null>(null);
  const [signers, setSigners] = useState<DocSigner[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [positions, setPositions] = useState<SignaturePosition[]>([]);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');

  // Add signer form
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [signerRole, setSignerRole] = useState('signer');

  const { listDocuments, getDocument, createDocument, addSigner, removeSigner, sendForSignature, cancelDocument, loading: actionLoading } = useDocSignatures();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const docs = await listDocuments();
    setDocuments(docs);
    setLoading(false);
  };

  const loadDocumentDetail = async (docId: string) => {
    const data = await getDocument(docId);
    if (data) {
      setSelectedDoc(data.document);
      setSigners(data.signers);
      setAuditLogs(data.audit);
      setPositions(data.positions);
      setDetailOpen(true);
    }
  };

  const handleCreate = async () => {
    if (!newTitle || !newFileUrl) {
      toast.error('Título e arquivo são obrigatórios');
      return;
    }
    try {
      await createDocument({ title: newTitle, description: newDescription, file_url: newFileUrl });
      toast.success('Documento criado com sucesso!');
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewFileUrl('');
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddSigner = async () => {
    if (!selectedDoc) return;
    if (!signerName || !signerEmail || !signerCpf) {
      toast.error('Nome, email e CPF são obrigatórios');
      return;
    }
    try {
      await addSigner(selectedDoc.id, { name: signerName, email: signerEmail, cpf: signerCpf, role: signerRole });
      toast.success('Signatário adicionado!');
      setAddSignerOpen(false);
      setSignerName('');
      setSignerEmail('');
      setSignerCpf('');
      setSignerRole('signer');
      loadDocumentDetail(selectedDoc.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveSigner = async (signerId: string) => {
    if (!selectedDoc) return;
    const ok = await removeSigner(selectedDoc.id, signerId);
    if (ok) {
      toast.success('Signatário removido');
      loadDocumentDetail(selectedDoc.id);
    }
  };

  const handleSend = async () => {
    if (!selectedDoc) return;
    try {
      await sendForSignature(selectedDoc.id);
      toast.success('Documento enviado para assinatura!');
      loadDocumentDetail(selectedDoc.id);
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancel = async () => {
    if (!selectedDoc) return;
    const ok = await cancelDocument(selectedDoc.id);
    if (ok) {
      toast.success('Documento cancelado');
      setDetailOpen(false);
      loadDocuments();
    }
  };

  const getSigningLink = (signer: DocSigner) => {
    return `${window.location.origin}/assinar/${signer.sign_token}`;
  };

  const copySigningLink = (signer: DocSigner) => {
    navigator.clipboard.writeText(getSigningLink(signer));
    toast.success('Link copiado!');
  };

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" />
              Assinaturas de Documentos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Envie documentos para assinatura digital com validade jurídica
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Documento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: documents.length, icon: FileText, color: 'text-foreground' },
            { label: 'Aguardando', value: documents.filter(d => d.status === 'pending').length, icon: Clock, color: 'text-amber-500' },
            { label: 'Concluídos', value: documents.filter(d => d.status === 'completed').length, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Rascunhos', value: documents.filter(d => d.status === 'draft').length, icon: FileText, color: 'text-muted-foreground' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documents List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum documento cadastrado</p>
                <p className="text-sm">Clique em "Novo Documento" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signatários</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => {
                    const status = statusConfig[doc.status] || statusConfig.draft;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={doc.id} className="cursor-pointer" onClick={() => loadDocumentDetail(doc.id)}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{doc.title}</div>
                            {doc.creator_name && <div className="text-xs text-muted-foreground">por {doc.creator_name}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{doc.signed_count}/{doc.signers_count}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadDocumentDetail(doc.id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Document Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Documento para Assinatura</DialogTitle>
              <DialogDescription>Carregue um documento PDF para enviar para assinatura digital.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input placeholder="Ex: Contrato de Locação" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Descrição opcional do documento" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Arquivo PDF *</Label>
                <FileUploadInput
                  value={newFileUrl}
                  onChange={setNewFileUrl}
                  accept=".pdf,application/pdf"
                  placeholder="Faça upload do PDF"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Documento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedDoc && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 text-primary" />
                    {selectedDoc.title}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedDoc.description || 'Sem descrição'}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="signers" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="signers" className="gap-1"><Users className="h-3 w-3" /> Signatários</TabsTrigger>
                    <TabsTrigger value="links" className="gap-1"><Link2 className="h-3 w-3" /> Links</TabsTrigger>
                    <TabsTrigger value="audit" className="gap-1"><Shield className="h-3 w-3" /> Auditoria</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signers" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{signers.length} signatário(s)</p>
                      {selectedDoc.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => setAddSignerOpen(true)} className="gap-1">
                          <UserPlus className="h-3 w-3" />
                          Adicionar
                        </Button>
                      )}
                    </div>
                    {signers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">Nenhum signatário adicionado</p>
                    ) : (
                      <div className="space-y-2">
                        {signers.map((signer) => (
                          <div key={signer.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="font-medium">{signer.name}</p>
                              <p className="text-xs text-muted-foreground">{signer.email} • CPF: {signer.cpf}</p>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">{signer.role === 'signer' ? 'Signatário' : signer.role === 'witness' ? 'Testemunha' : 'Aprovador'}</Badge>
                                <Badge variant={signer.status === 'signed' ? 'default' : signer.status === 'declined' ? 'destructive' : 'secondary'} className="text-xs">
                                  {signer.status === 'signed' ? 'Assinado' : signer.status === 'declined' ? 'Recusado' : 'Pendente'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {selectedDoc.status === 'pending' && signer.status === 'pending' && (
                                <Button variant="ghost" size="icon" onClick={() => copySigningLink(signer)} title="Copiar link">
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                              {selectedDoc.status === 'draft' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover signatário?</AlertDialogTitle>
                                      <AlertDialogDescription>Remover {signer.name} do documento.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRemoveSigner(signer.id)}>Remover</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="links" className="space-y-4">
                    {selectedDoc.status !== 'pending' ? (
                      <p className="text-center text-muted-foreground py-6">
                        Links de assinatura ficam disponíveis após enviar o documento
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {signers.filter(s => s.status === 'pending').map((signer) => (
                          <div key={signer.id} className="p-3 rounded-lg border space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{signer.name}</p>
                              <Button size="sm" variant="outline" onClick={() => copySigningLink(signer)} className="gap-1">
                                <Copy className="h-3 w-3" />
                                Copiar Link
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground break-all font-mono bg-muted p-2 rounded">
                              {getSigningLink(signer)}
                            </p>
                          </div>
                        ))}
                        {signers.filter(s => s.status === 'pending').length === 0 && (
                          <p className="text-center text-muted-foreground py-4">Todos os signatários já assinaram</p>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-2">
                    {auditLogs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6">Sem registros de auditoria</p>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="p-3 rounded-lg border text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{log.action.replace(/_/g, ' ').toUpperCase()}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">
                              {log.actor_name} ({log.actor_email})
                            </p>
                            {log.ip_address && <p className="text-xs text-muted-foreground">IP: {log.ip_address}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between pt-4 border-t mt-4">
                  <div>
                    {selectedDoc.status === 'pending' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">Cancelar Documento</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar documento?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">Cancelar Documento</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedDoc.status === 'draft' && signers.length > 0 && (
                      <Button onClick={handleSend} className="gap-1" disabled={actionLoading}>
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar para Assinatura
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Signer Dialog */}
        <Dialog open={addSignerOpen} onOpenChange={setAddSignerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Signatário</DialogTitle>
              <DialogDescription>Dados do signatário para validade jurídica.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input placeholder="João da Silva" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" placeholder="joao@email.com" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input placeholder="000.000.000-00" value={signerCpf} onChange={(e) => setSignerCpf(formatCpf(e.target.value))} maxLength={14} />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={signerRole} onValueChange={setSignerRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signer">Signatário</SelectItem>
                    <SelectItem value="witness">Testemunha</SelectItem>
                    <SelectItem value="approver">Aprovador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddSignerOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddSigner} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
