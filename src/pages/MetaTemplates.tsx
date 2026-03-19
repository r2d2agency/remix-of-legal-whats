import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, RefreshCw, Loader2, FileText, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, MessageSquare, BookTemplate, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { META_TEMPLATE_SEGMENTS, MetaTemplatePreset } from "@/components/meta-templates/meta-template-presets";
interface MetaConnection {
  id: string;
  name: string;
  provider: string;
  meta_waba_id?: string;
  status: string;
}

interface MetaTemplate {
  id: string;
  connection_id: string;
  meta_template_id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  synced_at: string;
}

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  APPROVED: { label: "Aprovado", icon: CheckCircle, color: "text-green-500" },
  PENDING: { label: "Pendente", icon: Clock, color: "text-yellow-500" },
  REJECTED: { label: "Rejeitado", icon: XCircle, color: "text-destructive" },
  PAUSED: { label: "Pausado", icon: AlertTriangle, color: "text-orange-500" },
};

const CATEGORIES = [
  { value: "UTILITY", label: "Utilitário" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Autenticação" },
];

const normalizeTemplateName = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const MetaTemplates = () => {
  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newLanguage, setNewLanguage] = useState("pt_BR");
  const [newCategory, setNewCategory] = useState("UTILITY");
  const [newHeaderText, setNewHeaderText] = useState("");
  const [newBodyText, setNewBodyText] = useState("");
  const [newFooterText, setNewFooterText] = useState("");
  const [creating, setCreating] = useState(false);

  const applyPreset = (preset: MetaTemplatePreset) => {
    setNewName(preset.name);
    setNewBodyText(preset.bodyText);
    setNewHeaderText(preset.headerText || "");
    setNewFooterText(preset.footerText || "");
    setNewCategory(preset.category);
    setNewLanguage(preset.language);
    setPresetDialogOpen(false);
    setCreateDialogOpen(true);
    toast.success(`Modelo "${preset.displayName}" carregado. Edite e envie para aprovação.`);
  };

  useEffect(() => {
    loadMetaConnections();
  }, []);

  useEffect(() => {
    if (selectedConnectionId) {
      loadTemplates(false);
    }
  }, [selectedConnectionId]);

  const loadMetaConnections = async () => {
    try {
      const all = await api<MetaConnection[]>("/api/connections?scope=organization");
      const metaConns = all.filter((c) => c.provider === "meta");
      setConnections(metaConns);
      if (metaConns.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(metaConns[0].id);
      }
    } catch {
      toast.error("Erro ao carregar conexões Meta");
    }
  };

  const loadTemplates = async (sync: boolean) => {
    if (!selectedConnectionId) return;
    if (sync) setSyncing(true);
    else setLoading(true);
    try {
      const data = await api<MetaTemplate[]>(
        `/api/meta/${selectedConnectionId}/templates${sync ? "?sync=true" : ""}`
      );
      setTemplates(data);
      if (sync) toast.success(`${data.length} templates sincronizados`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar templates");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newBodyText.trim()) {
      toast.error("Nome e corpo da mensagem são obrigatórios");
      return;
    }

    const normalizedName = normalizeTemplateName(newName);
    const hasLocalDuplicate = templates.some(
      (template) =>
        normalizeTemplateName(template.name) === normalizedName &&
        String(template.language || "").toLowerCase() === String(newLanguage || "").toLowerCase()
    );

    if (hasLocalDuplicate) {
      toast.error("Já existe template com esse nome e idioma. Use outro nome (ex: boas_vindas_v2).");
      return;
    }

    const components: any[] = [];
    if (newHeaderText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: newHeaderText });
    }
    components.push({ type: "BODY", text: newBodyText });
    if (newFooterText.trim()) {
      components.push({ type: "FOOTER", text: newFooterText });
    }

    setCreating(true);
    try {
      await api(`/api/meta/${selectedConnectionId}/templates`, {
        method: "POST",
        body: { name: normalizedName, language: newLanguage, category: newCategory, components },
      });
      toast.success("Template enviado para aprovação da Meta!");
      setCreateDialogOpen(false);
      resetCreateForm();
      loadTemplates(true);
    } catch (err: any) {
      const detailedMessage =
        err?.response?.error ||
        err?.details?.error_user_msg ||
        err?.details?.message ||
        err?.details?.error_data?.details ||
        err?.message ||
        "Erro ao criar template";

      const isDuplicateTemplate =
        /META_TEMPLATE_DUPLICATE_LANGUAGE/i.test(String(detailedMessage)) ||
        /já existe conteúdo/i.test(String(detailedMessage)) ||
        /template com esse nome e idioma/i.test(String(detailedMessage));

      if (isDuplicateTemplate) {
        toast.error("Esse nome já existe no idioma selecionado. Renomeie (ex: boas_vindas_v2) e tente novamente.");
        await loadTemplates(true);
      } else {
        toast.error(String(detailedMessage));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (template: MetaTemplate) => {
    try {
      await api(`/api/meta/${selectedConnectionId}/templates/${template.name}`, {
        method: "DELETE",
      });
      toast.success("Template deletado");
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar template");
    }
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewHeaderText("");
    setNewBodyText("");
    setNewFooterText("");
    setNewLanguage("pt_BR");
    setNewCategory("UTILITY");
  };

  const getBodyText = (components: any[]) => {
    const body = components?.find((c: any) => c.type === "BODY");
    return body?.text || "";
  };

  if (connections.length === 0 && !loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma conexão Meta API</h2>
          <p className="text-muted-foreground max-w-md">
            Para gerenciar templates de mensagem, primeiro crie uma conexão Meta API na página de Conexões.
          </p>
          <Button variant="gradient" className="mt-4" onClick={() => window.location.href = "/conexao"}>
            Ir para Conexões
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates Meta</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seus templates de mensagem aprovados pela Meta
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connections.length > 1 && (
              <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => loadTemplates(true)} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Sincronizar</span>
            </Button>
            <Button variant="gradient" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-1">Novo Template</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum template encontrado</p>
              <p className="text-sm text-muted-foreground">Clique em "Sincronizar" para buscar da Meta ou crie um novo</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const statusInfo = STATUS_MAP[template.status] || STATUS_MAP.PENDING;
              const StatusIcon = statusInfo.icon;
              return (
                <Card key={template.id} className="animate-fade-in">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{template.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{template.language}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                          </Badge>
                        </CardDescription>
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusInfo.label}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {getBodyText(template.components) || "Sem conteúdo"}
                    </p>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Template Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Template de Mensagem</DialogTitle>
              <DialogDescription>
                O template será enviado para aprovação da Meta. Use variáveis como {`{{1}}`}, {`{{2}}`} no corpo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input
                  placeholder="ex: confirmacao_pedido"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                />
                <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e underline</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={newLanguage} onValueChange={setNewLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt_BR">Português (BR)</SelectItem>
                      <SelectItem value="en_US">Inglês (US)</SelectItem>
                      <SelectItem value="es">Espanhol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cabeçalho (opcional)</Label>
                <Input
                  placeholder="Texto do cabeçalho"
                  value={newHeaderText}
                  onChange={(e) => setNewHeaderText(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Corpo da Mensagem *</Label>
                <Textarea
                  placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado!"
                  value={newBodyText}
                  onChange={(e) => setNewBodyText(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Rodapé (opcional)</Label>
                <Input
                  placeholder="Texto do rodapé"
                  value={newFooterText}
                  onChange={(e) => setNewFooterText(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Enviar para Aprovação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default MetaTemplates;
