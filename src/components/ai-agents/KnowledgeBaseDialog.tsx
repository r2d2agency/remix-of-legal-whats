import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Database, FileText, Globe, Type, Plus, Trash2, 
  RefreshCw, Upload, Loader2, CheckCircle, XCircle, Clock,
  ExternalLink
} from 'lucide-react';
import { useAIAgents, AIAgent, KnowledgeSource } from '@/hooks/use-ai-agents';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface KnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AIAgent | null;
}

type AddMode = 'file' | 'url' | 'text';

export function KnowledgeBaseDialog({ open, onOpenChange, agent }: KnowledgeBaseDialogProps) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [deleteSource, setDeleteSource] = useState<KnowledgeSource | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_content: '',
    priority: 0,
  });
  const [saving, setSaving] = useState(false);

  const { 
    getKnowledgeSources, 
    addKnowledgeSource, 
    deleteKnowledgeSource, 
    reprocessKnowledgeSource 
  } = useAIAgents();

  useEffect(() => {
    if (open && agent) {
      loadSources();
    }
  }, [open, agent]);

  const loadSources = async () => {
    if (!agent) return;
    setLoading(true);
    const data = await getKnowledgeSources(agent.id);
    setSources(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!agent || !addMode) return;

    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.source_content.trim()) {
      toast.error('Conteúdo é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const result = await addKnowledgeSource(agent.id, {
        source_type: addMode,
        name: formData.name,
        description: formData.description,
        source_content: formData.source_content,
        priority: formData.priority,
      });

      if (result) {
        setSources(prev => [result, ...prev]);
        toast.success('Fonte adicionada');
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent || !deleteSource) return;

    const success = await deleteKnowledgeSource(agent.id, deleteSource.id);
    if (success) {
      setSources(prev => prev.filter(s => s.id !== deleteSource.id));
      toast.success('Fonte removida');
    }
    setDeleteSource(null);
  };

  const handleReprocess = async (source: KnowledgeSource) => {
    if (!agent) return;

    const success = await reprocessKnowledgeSource(agent.id, source.id);
    if (success) {
      setSources(prev => prev.map(s => 
        s.id === source.id ? { ...s, status: 'pending' } : s
      ));
      toast.success('Reprocessamento iniciado');
    }
  };

  const resetForm = () => {
    setAddMode(null);
    setFormData({
      name: '',
      description: '',
      source_content: '',
      priority: 0,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Processado
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="h-4 w-4" />;
      case 'url':
        return <Globe className="h-4 w-4" />;
      case 'text':
        return <Type className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (!agent) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Base de Conhecimento
            </DialogTitle>
            <DialogDescription>
              Gerencie as fontes de informação do agente "{agent.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-4">
            {/* Add Buttons */}
            {!addMode && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setAddMode('file')}
                >
                  <FileText className="h-6 w-6" />
                  <span>Arquivo</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setAddMode('url')}
                >
                  <Globe className="h-6 w-6" />
                  <span>URL/Site</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setAddMode('text')}
                >
                  <Type className="h-6 w-6" />
                  <span>Texto</span>
                </Button>
              </div>
            )}

            {/* Add Form */}
            {addMode && (
              <div className="border rounded-lg p-4 mb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    {getTypeIcon(addMode)}
                    {addMode === 'file' && 'Adicionar Arquivo'}
                    {addMode === 'url' && 'Adicionar URL'}
                    {addMode === 'text' && 'Adicionar Texto'}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Ex: Manual do Produto"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Descrição opcional..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {addMode === 'file' && (
                    <div className="grid gap-2">
                      <Label>URL do Arquivo *</Label>
                      <Input
                        placeholder="https://exemplo.com/arquivo.pdf"
                        value={formData.source_content}
                        onChange={(e) => setFormData(prev => ({ ...prev, source_content: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Suporta PDF, DOCX, TXT. Faça upload em um storage e cole a URL aqui.
                      </p>
                    </div>
                  )}

                  {addMode === 'url' && (
                    <div className="grid gap-2">
                      <Label>URL da Página *</Label>
                      <Input
                        placeholder="https://exemplo.com/pagina"
                        value={formData.source_content}
                        onChange={(e) => setFormData(prev => ({ ...prev, source_content: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        O conteúdo da página será extraído e processado automaticamente.
                      </p>
                    </div>
                  )}

                  {addMode === 'text' && (
                    <div className="grid gap-2">
                      <Label>Conteúdo *</Label>
                      <Textarea
                        placeholder="Cole aqui o texto que o agente deve conhecer..."
                        value={formData.source_content}
                        onChange={(e) => setFormData(prev => ({ ...prev, source_content: e.target.value }))}
                        rows={6}
                      />
                    </div>
                  )}

                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adicionando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Fonte
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Sources List */}
            <ScrollArea className="h-[350px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-1">Nenhuma fonte adicionada</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione arquivos, URLs ou textos para o agente usar como referência
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        {getTypeIcon(source.source_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{source.name}</h4>
                          {getStatusBadge(source.status)}
                        </div>
                        {source.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {source.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {source.source_type === 'file' && source.file_size && (
                            <span>{formatBytes(source.file_size)}</span>
                          )}
                          {source.source_type === 'url' && (
                            <a
                              href={source.source_content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Abrir URL
                            </a>
                          )}
                          {source.chunk_count > 0 && (
                            <span>{source.chunk_count} chunks</span>
                          )}
                          {source.total_tokens > 0 && (
                            <span>{source.total_tokens.toLocaleString()} tokens</span>
                          )}
                        </div>
                        {source.error_message && (
                          <p className="text-xs text-destructive mt-2">
                            {source.error_message}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReprocess(source)}
                          disabled={source.status === 'processing'}
                        >
                          <RefreshCw className={`h-4 w-4 ${source.status === 'processing' ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteSource(source)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSource} onOpenChange={() => setDeleteSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{deleteSource?.name}"? 
              O agente não terá mais acesso a essas informações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
