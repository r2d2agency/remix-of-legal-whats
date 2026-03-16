import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuickReplies, QuickReply, CreateQuickReplyData } from "@/hooks/use-quick-replies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MessageSquareText,
  Loader2,
  Hash,
  Tag,
  Copy,
  RefreshCw,
} from "lucide-react";

export default function RespostasRapidas() {
  const { getQuickReplies, getCategories, createQuickReply, updateQuickReply, deleteQuickReply, loading } = useQuickReplies();

  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [deletingReply, setDeletingReply] = useState<QuickReply | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formShortcut, setFormShortcut] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [repliesData, categoriesData] = await Promise.all([
      getQuickReplies(),
      getCategories(),
    ]);
    setReplies(repliesData);
    setCategories(categoriesData);
  };

  const openNew = () => {
    setEditingReply(null);
    setFormTitle("");
    setFormContent("");
    setFormShortcut("");
    setFormCategory("");
    setDialogOpen(true);
  };

  const openEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormTitle(reply.title);
    setFormContent(reply.content);
    setFormShortcut(reply.shortcut || "");
    setFormCategory(reply.category || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    setSaving(true);
    const data: CreateQuickReplyData = {
      title: formTitle.trim(),
      content: formContent.trim(),
      shortcut: formShortcut.trim() || undefined,
      category: formCategory.trim() || undefined,
    };

    let result: QuickReply | null;
    if (editingReply) {
      result = await updateQuickReply(editingReply.id, data);
    } else {
      result = await createQuickReply(data);
    }
    setSaving(false);

    if (result) {
      toast.success(editingReply ? "Resposta atualizada!" : "Resposta criada!");
      setDialogOpen(false);
      loadData();
    } else {
      toast.error("Erro ao salvar resposta");
    }
  };

  const handleDelete = async () => {
    if (!deletingReply) return;
    const ok = await deleteQuickReply(deletingReply.id);
    if (ok) {
      toast.success("Resposta excluída!");
      setDeleteDialogOpen(false);
      setDeletingReply(null);
      loadData();
    } else {
      toast.error("Erro ao excluir");
    }
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado!");
  };

  // Filtering
  const filtered = replies.filter((r) => {
    const matchSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      (r.shortcut && r.shortcut.toLowerCase().includes(search.toLowerCase()));
    const matchCategory =
      filterCategory === "all" || r.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <MainLayout>
      <div className="space-y-6 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquareText className="h-6 w-6 text-primary" />
              Respostas Rápidas
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas respostas pré-definidas para uso no chat com /atalho
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Resposta
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquareText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{replies.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Tag className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Categorias</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Hash className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {replies.filter((r) => r.shortcut).length}
                </p>
                <p className="text-xs text-muted-foreground">Com Atalho</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">Exibidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, conteúdo ou atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading && replies.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageSquareText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma resposta rápida encontrada</p>
            <p className="text-sm mt-1">Crie sua primeira resposta clicando em "Nova Resposta"</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((reply) => (
              <Card
                key={reply.id}
                className="border-border/50 hover:border-primary/30 transition-colors group"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground text-sm truncate">
                        {reply.title}
                      </h3>
                      {reply.shortcut && (
                        <Badge variant="secondary" className="text-[10px] mt-1 gap-1">
                          <Hash className="h-2.5 w-2.5" />
                          /{reply.shortcut}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyContent(reply.content)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(reply)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          setDeletingReply(reply);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {reply.content}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                    {reply.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {reply.category}
                      </Badge>
                    )}
                    {reply.created_by_name && (
                      <span>por {reply.created_by_name}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Saudação inicial"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Atalho (usado com /)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
                <Input
                  placeholder="saudacao"
                  value={formShortcut}
                  onChange={(e) => setFormShortcut(e.target.value.replace(/\s/g, ""))}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite /{formShortcut || "atalho"} no chat para usar esta resposta
              </p>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                placeholder="Ex: Vendas, Suporte, Geral"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea
                placeholder="Digite o conteúdo da resposta... Use {nome} para inserir o nome do contato automaticamente."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code> = nome do contato
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingReply ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              A resposta "<strong>{deletingReply?.title}</strong>" será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
