import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFlows, Flow, FlowCategory } from '@/hooks/use-flows';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  GitBranch, Plus, Pencil, Trash2, Copy, 
  Tag, Loader2, Clock, Layers, Play, Search, 
  CheckCircle, Hash, ChevronDown, Activity,
  FolderOpen, Users, X
} from 'lucide-react';
import { FlowEditorFullscreen } from '@/components/flows/FlowEditorFullscreen';
import { FlowExecutionLogs } from '@/components/flows/FlowExecutionLogs';
import { api } from '@/lib/api';

export default function Fluxos() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [categories, setCategories] = useState<FlowCategory[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [flowMembers, setFlowMembers] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_enabled: false,
    trigger_keywords: '',
    trigger_match_mode: 'exact' as 'exact' | 'contains' | 'starts_with',
    category_id: '' as string
  });
  const [logsExpanded, setLogsExpanded] = useState(false);

  const { user } = useAuth();
  const { loading, error, getFlows, createFlow, updateFlow, deleteFlow, toggleFlow, duplicateFlow, getCategories, createCategory, deleteCategory, getFlowMembers, saveFlowMembers } = useFlows();

  const isAdmin = user?.role && ['owner', 'admin', 'manager'].includes(user.role);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingFlows(true);
    const [flowsData, catsData] = await Promise.all([getFlows(), getCategories()]);
    setFlows(flowsData);
    setCategories(catsData);
    setLoadingFlows(false);
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', trigger_enabled: false,
      trigger_keywords: '', trigger_match_mode: 'exact', category_id: ''
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) { toast.error('Nome é obrigatório'); return; }
    const keywords = formData.trigger_keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    const result = await createFlow({
      name: formData.name, description: formData.description || null,
      trigger_enabled: formData.trigger_enabled, trigger_keywords: keywords,
      trigger_match_mode: formData.trigger_match_mode,
      category_id: formData.category_id || null
    });
    if (result) {
      toast.success('Fluxo criado!');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } else if (error) { toast.error(error); }
  };

  const handleEdit = async () => {
    if (!selectedFlow) return;
    const keywords = formData.trigger_keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    const result = await updateFlow(selectedFlow.id, {
      name: formData.name, description: formData.description || null,
      trigger_enabled: formData.trigger_enabled, trigger_keywords: keywords,
      trigger_match_mode: formData.trigger_match_mode,
      category_id: formData.category_id || null
    });
    if (result) {
      toast.success('Fluxo atualizado!');
      setEditDialogOpen(false);
      loadData();
    } else if (error) { toast.error(error); }
  };

  const handleOpenEdit = (flow: Flow) => {
    setSelectedFlow(flow);
    setFormData({
      name: flow.name, description: flow.description || '',
      trigger_enabled: flow.trigger_enabled,
      trigger_keywords: flow.trigger_keywords?.join(', ') || '',
      trigger_match_mode: flow.trigger_match_mode,
      category_id: flow.category_id || ''
    });
    setEditDialogOpen(true);
  };

  const handleOpenEditor = (flow: Flow) => { setSelectedFlow(flow); setEditorOpen(true); };

  const handleToggle = async (flow: Flow) => {
    const result = await toggleFlow(flow.id);
    if (result) {
      setFlows(prev => prev.map(f => f.id === flow.id ? result : f));
      toast.success(result.is_active ? 'Fluxo ativado' : 'Fluxo desativado');
    }
  };

  const handleDuplicate = async (flow: Flow) => {
    const result = await duplicateFlow(flow.id);
    if (result) { toast.success('Fluxo duplicado!'); loadData(); }
    else if (error) { toast.error(error); }
  };

  const handleDelete = async (flow: Flow) => {
    const success = await deleteFlow(flow.id);
    if (success) { toast.success('Fluxo deletado'); loadData(); }
    else if (error) { toast.error(error); }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const result = await createCategory({ name: newCategoryName, color: newCategoryColor });
    if (result) {
      toast.success('Categoria criada!');
      setNewCategoryName('');
      setCategories(prev => [...prev, result]);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const success = await deleteCategory(id);
    if (success) {
      toast.success('Categoria removida');
      setCategories(prev => prev.filter(c => c.id !== id));
      if (selectedCategory === id) setSelectedCategory('all');
    }
  };

  const handleOpenMembers = async (flow: Flow) => {
    setSelectedFlow(flow);
    setMembersDialogOpen(true);
    try {
      const [members, orgMembersRes] = await Promise.all([
        getFlowMembers(flow.id),
        api<{ id: string; name: string; email: string }[]>('/api/chatbots/org/users', { auth: true })
      ]);
      setFlowMembers(members.map(m => m.user_id));
      setOrgMembers(orgMembersRes);
    } catch (e) { console.error(e); }
  };

  const handleSaveMembers = async () => {
    if (!selectedFlow) return;
    const success = await saveFlowMembers(selectedFlow.id, flowMembers);
    if (success) { toast.success('Membros salvos!'); setMembersDialogOpen(false); loadData(); }
    else toast.error('Erro ao salvar membros');
  };

  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const matchesSearch = !searchQuery || 
        flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.trigger_keywords?.some(k => k.includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === 'all' || 
        (selectedCategory === 'none' ? !flow.category_id : flow.category_id === selectedCategory);
      return matchesSearch && matchesCat;
    });
  }, [flows, searchQuery, selectedCategory]);

  const groupedFlows = useMemo(() => {
    const groups: Record<string, { name: string; color: string; flows: Flow[] }> = {};
    for (const flow of filteredFlows) {
      const key = flow.category_id || '__none__';
      if (!groups[key]) {
        groups[key] = {
          name: flow.category_name || 'Sem categoria',
          color: flow.category_color || '#6b7280',
          flows: []
        };
      }
      groups[key].flows.push(flow);
    }
    return groups;
  }, [filteredFlows]);

  const matchModeLabels = { exact: 'Exato', contains: 'Contém', starts_with: 'Começa com' };

  const categorySelectField = (
    <div className="space-y-2">
      <Label>Categoria</Label>
      <Select value={formData.category_id} onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v === '_none_' ? '' : v }))}>
        <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_none_">Sem categoria</SelectItem>
          {categories.map(c => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <GitBranch className="h-8 w-8 text-primary" />
              Fluxos
            </h1>
            <p className="text-muted-foreground">Crie fluxos visuais de automação para seus chatbots</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar fluxos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-64" />
            </div>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Categorias
                </Button>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Novo Fluxo</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Fluxo</DialogTitle>
                      <DialogDescription>Configure as informações básicas do fluxo</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input placeholder="Ex: Atendimento inicial" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea placeholder="Descreva o objetivo do fluxo..." value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                      </div>
                      {categorySelectField}
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2"><Tag className="h-4 w-4" />Ativar por Palavra-chave</Label>
                            <p className="text-xs text-muted-foreground">Inicia o fluxo quando o cliente digitar uma palavra</p>
                          </div>
                          <Switch checked={formData.trigger_enabled} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, trigger_enabled: checked }))} />
                        </div>
                        {formData.trigger_enabled && (
                          <>
                            <div className="space-y-2">
                              <Label>Palavras-chave (separadas por vírgula)</Label>
                              <Input placeholder="oi, olá, menu, ajuda" value={formData.trigger_keywords} onChange={(e) => setFormData(prev => ({ ...prev, trigger_keywords: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Tipo de correspondência</Label>
                              <Select value={formData.trigger_match_mode} onValueChange={(v: any) => setFormData(prev => ({ ...prev, trigger_match_mode: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="exact">Exato</SelectItem>
                                  <SelectItem value="contains">Contém</SelectItem>
                                  <SelectItem value="starts_with">Começa com</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>Cancelar</Button>
                      <Button onClick={handleCreate} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar Fluxo
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={selectedCategory === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedCategory('all')}>Todos</Badge>
            <Badge variant={selectedCategory === 'none' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedCategory('none')}>Sem categoria</Badge>
            {categories.map(c => (
              <Badge key={c.id} variant={selectedCategory === c.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedCategory(c.id)}>
                <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: c.color }} />
                {c.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{flows.length}</p><p className="text-sm text-muted-foreground">Total de Fluxos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold">{flows.filter(f => f.is_active).length}</p><p className="text-sm text-muted-foreground">Ativos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-purple-500/10"><Tag className="h-5 w-5 text-purple-500" /></div><div><p className="text-2xl font-bold">{flows.filter(f => f.trigger_enabled).length}</p><p className="text-sm text-muted-foreground">Com Gatilho</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-orange-500/10"><Clock className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">{flows.filter(f => f.is_draft).length}</p><p className="text-sm text-muted-foreground">Rascunhos</p></div></div></CardContent></Card>
        </div>

        {/* Execution Logs */}
        <Collapsible open={logsExpanded} onOpenChange={setLogsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2"><Activity className="h-4 w-4" />Logs de Execução</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${logsExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4"><FlowExecutionLogs /></CollapsibleContent>
        </Collapsible>

        {/* Flows grouped by category */}
        {loadingFlows ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredFlows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <GitBranch className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">{searchQuery ? 'Nenhum fluxo encontrado' : 'Nenhum fluxo criado'}</h3>
              <p className="text-muted-foreground mb-4">{searchQuery ? 'Tente buscar com outros termos' : 'Crie seu primeiro fluxo visual para automatizar atendimentos'}</p>
              {!searchQuery && isAdmin && (
                <Button onClick={() => setCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Criar Primeiro Fluxo</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedFlows).map(([key, group]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" style={{ color: group.color }} />
                <h2 className="font-semibold text-lg">{group.name}</h2>
                <Badge variant="secondary" className="text-xs">{group.flows.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.flows.map((flow) => (
                  <Card key={flow.id} className="group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${flow.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                            <GitBranch className={`h-5 w-5 ${flow.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{flow.name}</CardTitle>
                            {flow.description && <CardDescription className="line-clamp-1">{flow.description}</CardDescription>}
                          </div>
                        </div>
                        <Switch checked={flow.is_active} onCheckedChange={() => handleToggle(flow)} disabled={!isAdmin} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {flow.is_draft && <Badge variant="secondary" className="text-xs">Rascunho</Badge>}
                        {flow.trigger_enabled && (
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                            <Tag className="h-3 w-3 mr-1" />Gatilho
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs"><Hash className="h-3 w-3 mr-1" />{flow.node_count || 0} nós</Badge>
                        <Badge variant="outline" className="text-xs">v{flow.version}</Badge>
                        {flow.member_ids && flow.member_ids.length > 0 && (
                          <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{flow.member_ids.length}</Badge>
                        )}
                      </div>
                      {flow.trigger_enabled && flow.trigger_keywords?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Palavras-chave ({matchModeLabels[flow.trigger_match_mode]}):</p>
                          <div className="flex flex-wrap gap-1">
                            {flow.trigger_keywords.slice(0, 5).map((keyword, i) => <Badge key={i} variant="secondary" className="text-xs">{keyword}</Badge>)}
                            {flow.trigger_keywords.length > 5 && <Badge variant="secondary" className="text-xs">+{flow.trigger_keywords.length - 5}</Badge>}
                          </div>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-2 pt-2">
                          <Button className="flex-1" onClick={() => handleOpenEditor(flow)}>
                            <Play className="h-4 w-4 mr-2" />Editar Fluxo
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleOpenEdit(flow)} title="Configurações"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => handleOpenMembers(flow)} title="Membros"><Users className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => handleDuplicate(flow)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar fluxo?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita. O fluxo "{flow.name}" será permanentemente removido.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(flow)} className="bg-destructive hover:bg-destructive/90">Deletar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {new Date(flow.updated_at).toLocaleDateString('pt-BR')}
                        {flow.last_edited_by_name && ` por ${flow.last_edited_by_name}`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Fluxo</DialogTitle><DialogDescription>Atualize as configurações do fluxo</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} /></div>
            {categorySelectField}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><Tag className="h-4 w-4" />Ativar por Palavra-chave</Label>
                  <p className="text-xs text-muted-foreground">Inicia o fluxo quando o cliente digitar uma palavra</p>
                </div>
                <Switch checked={formData.trigger_enabled} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, trigger_enabled: checked }))} />
              </div>
              {formData.trigger_enabled && (
                <>
                  <div className="space-y-2"><Label>Palavras-chave</Label><Input placeholder="oi, olá, menu" value={formData.trigger_keywords} onChange={(e) => setFormData(prev => ({ ...prev, trigger_keywords: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Tipo de correspondência</Label>
                    <Select value={formData.trigger_match_mode} onValueChange={(v: any) => setFormData(prev => ({ ...prev, trigger_match_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact">Exato</SelectItem>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="starts_with">Começa com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerenciar Categorias</DialogTitle><DialogDescription>Organize seus fluxos em categorias</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="Nome da categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-1" />
              <input type="color" value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary" className="text-xs">{flows.filter(f => f.category_id === c.id).length} fluxos</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membros do Fluxo</DialogTitle>
            <DialogDescription>
              Defina quem pode ver e usar o fluxo "{selectedFlow?.name}".
              Se nenhum membro for selecionado, todos terão acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {orgMembers.map(m => (
                <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flowMembers.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) setFlowMembers(prev => [...prev, m.id]);
                      else setFlowMembers(prev => prev.filter(id => id !== m.id));
                    }}
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMembers}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow Editor Fullscreen */}
      {selectedFlow && (
        <FlowEditorFullscreen
          open={editorOpen}
          flow={selectedFlow}
          onClose={() => { setEditorOpen(false); setSelectedFlow(null); loadData(); }}
        />
      )}
    </MainLayout>
  );
}
