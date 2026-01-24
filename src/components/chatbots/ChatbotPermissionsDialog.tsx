import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Shield, Users, Plug, Trash2, Plus, Loader2, UserPlus,
  Eye, Edit, Settings, Crown, Tag, X, Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Chatbot } from "@/hooks/use-chatbots";
import { api } from "@/lib/api";

interface ChatbotPermissionsDialogProps {
  open: boolean;
  chatbot: Chatbot | null;
  onClose: () => void;
}

interface Connection {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface ChatbotConnection {
  id: string;
  chatbot_id: string;
  connection_id: string;
  connection_name: string;
  connection_phone: string;
  connection_status?: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ChatbotPermission {
  id: string;
  chatbot_id: string;
  user_id: string;
  permission_level: 'view' | 'edit' | 'manage' | 'owner';
  user_name: string;
  user_email: string;
  org_role: string;
}

interface RoleSettings {
  id: string;
  chatbot_id: string;
  owner_can_manage: boolean;
  admin_can_manage: boolean;
  admin_can_edit: boolean;
  manager_can_view: boolean;
  manager_can_edit: boolean;
  agent_can_view: boolean;
}

const permissionLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  view: { label: 'Visualizar', icon: <Eye className="h-3 w-3" />, color: 'bg-blue-500/10 text-blue-500' },
  edit: { label: 'Editar', icon: <Edit className="h-3 w-3" />, color: 'bg-amber-500/10 text-amber-500' },
  manage: { label: 'Gerenciar', icon: <Settings className="h-3 w-3" />, color: 'bg-purple-500/10 text-purple-500' },
  owner: { label: 'Dono', icon: <Crown className="h-3 w-3" />, color: 'bg-green-500/10 text-green-500' },
};

export function ChatbotPermissionsDialog({ open, chatbot, onClose }: ChatbotPermissionsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [connections, setConnections] = useState<Connection[]>([]);
  const [chatbotConnections, setChatbotConnections] = useState<ChatbotConnection[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [permissions, setPermissions] = useState<ChatbotPermission[]>([]);
  const [roleSettings, setRoleSettings] = useState<RoleSettings | null>(null);
  const [chatbotAgents, setChatbotAgents] = useState<Array<{ user_id: string; is_default: boolean; user_name: string; user_email: string }>>([]);
  
  // Keywords state
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Selection state
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<string>('view');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    if (open && chatbot) {
      loadData();
    }
  }, [open, chatbot]);

  const loadData = async () => {
    if (!chatbot) return;
    
    setLoading(true);
    try {
      const [connsRes, chatbotConnsRes, usersRes, permsRes, roleRes, agentsRes] = await Promise.all([
        api<Connection[]>('/api/chatbots/org/connections', { auth: true }),
        api<ChatbotConnection[]>(`/api/chatbots/${chatbot.id}/connections`, { auth: true }),
        api<OrgUser[]>('/api/chatbots/org/users', { auth: true }),
        api<ChatbotPermission[]>(`/api/chatbots/${chatbot.id}/permissions`, { auth: true }),
        api<RoleSettings>(`/api/chatbots/${chatbot.id}/role-settings`, { auth: true }),
        api<Array<{ user_id: string; is_default: boolean; user_name: string; user_email: string }>>(`/api/chatbots/${chatbot.id}/agents`, { auth: true }),
      ]);
      
      setConnections(connsRes);
      setChatbotConnections(chatbotConnsRes);
      setSelectedConnections(chatbotConnsRes.map(c => c.connection_id));
      setOrgUsers(usersRes);
      setPermissions(permsRes);
      setRoleSettings(roleRes);
      setChatbotAgents(agentsRes);
      
      // Load keywords from chatbot
      setTriggerKeywords(chatbot.trigger_keywords || []);
      setTriggerEnabled(chatbot.trigger_enabled || false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnections = async () => {
    if (!chatbot) return;
    
    setSaving(true);
    try {
      await api(`/api/chatbots/${chatbot.id}/connections`, {
        method: 'PUT',
        body: { connection_ids: selectedConnections },
        auth: true,
      });
      toast.success('Conexões atualizadas!');
    } catch (error) {
      console.error('Erro ao salvar conexões:', error);
      toast.error('Erro ao salvar conexões');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPermission = async () => {
    if (!chatbot || !selectedUserId) {
      toast.error('Selecione um usuário');
      return;
    }
    
    try {
      const result = await api<ChatbotPermission>(`/api/chatbots/${chatbot.id}/permissions`, {
        method: 'POST',
        body: { user_id: selectedUserId, permission_level: selectedPermission },
        auth: true,
      });
      
      // Atualizar lista
      const user = orgUsers.find(u => u.id === selectedUserId);
      setPermissions(prev => {
        const existing = prev.findIndex(p => p.user_id === selectedUserId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...result, user_name: user?.name || '', user_email: user?.email || '', org_role: user?.role || '' };
          return updated;
        }
        return [...prev, { ...result, user_name: user?.name || '', user_email: user?.email || '', org_role: user?.role || '' }];
      });
      
      setSelectedUserId('');
      toast.success('Permissão adicionada!');
    } catch (error) {
      console.error('Erro ao adicionar permissão:', error);
      toast.error('Erro ao adicionar permissão');
    }
  };

  const handleRemovePermission = async (userId: string) => {
    if (!chatbot) return;
    
    try {
      await api(`/api/chatbots/${chatbot.id}/permissions/${userId}`, {
        method: 'DELETE',
        auth: true,
      });
      setPermissions(prev => prev.filter(p => p.user_id !== userId));
      toast.success('Permissão removida');
    } catch (error) {
      console.error('Erro ao remover permissão:', error);
      toast.error('Erro ao remover permissão');
    }
  };

  const handleUpdateRoleSetting = async (field: string, value: boolean) => {
    if (!chatbot) return;
    
    try {
      const result = await api<RoleSettings>(`/api/chatbots/${chatbot.id}/role-settings`, {
        method: 'PATCH',
        body: { [field]: value },
        auth: true,
      });
      setRoleSettings(result);
    } catch (error) {
      console.error('Erro ao atualizar config:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const toggleConnection = (connectionId: string) => {
    setSelectedConnections(prev => 
      prev.includes(connectionId)
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    );
  };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    if (triggerKeywords.includes(kw)) {
      toast.error('Palavra-chave já existe');
      return;
    }
    setTriggerKeywords(prev => [...prev, kw]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setTriggerKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleSaveKeywords = async () => {
    if (!chatbot) return;
    setSaving(true);
    try {
      await api(`/api/chatbots/${chatbot.id}/keywords`, {
        method: 'PATCH',
        body: { trigger_keywords: triggerKeywords, trigger_enabled: triggerEnabled },
        auth: true,
      });
      toast.success('Palavras-chave salvas!');
    } catch (error) {
      console.error('Erro ao salvar keywords:', error);
      toast.error('Erro ao salvar palavras-chave');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAgent = async () => {
    if (!chatbot || !selectedAgentId) return;
    
    try {
      const user = orgUsers.find(u => u.id === selectedAgentId);
      setChatbotAgents(prev => {
        if (prev.some(a => a.user_id === selectedAgentId)) return prev;
        return [...prev, { 
          user_id: selectedAgentId, 
          is_default: prev.length === 0,
          user_name: user?.name || '',
          user_email: user?.email || ''
        }];
      });
      setSelectedAgentId('');
    } catch (error) {
      toast.error('Erro ao adicionar atendente');
    }
  };

  const handleRemoveAgent = (userId: string) => {
    setChatbotAgents(prev => prev.filter(a => a.user_id !== userId));
  };

  const handleSaveAgents = async () => {
    if (!chatbot) return;
    setSaving(true);
    try {
      const defaultAgent = chatbotAgents.find(a => a.is_default);
      await api(`/api/chatbots/${chatbot.id}/agents`, {
        method: 'PUT',
        body: { 
          agents: chatbotAgents.map(a => ({ user_id: a.user_id, is_default: a.is_default })),
          default_agent_id: defaultAgent?.user_id || null
        },
        auth: true,
      });
      toast.success('Equipe de atendentes atualizada!');
    } catch (error) {
      console.error('Erro ao salvar atendentes:', error);
      toast.error('Erro ao salvar atendentes');
    } finally {
      setSaving(false);
    }
  };

  const setDefaultAgent = (userId: string) => {
    setChatbotAgents(prev => prev.map(a => ({
      ...a,
      is_default: a.user_id === userId
    })));
  };

  if (!chatbot) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissões - {chatbot.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="connections" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="connections" className="flex items-center gap-1">
                <Plug className="h-4 w-4" />
                Conexões
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Equipe
              </TabsTrigger>
              <TabsTrigger value="keywords" className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Gatilhos
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1">
                <UserPlus className="h-4 w-4" />
                Permissões
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Papéis
              </TabsTrigger>
            </TabsList>

            {/* Conexões */}
            <TabsContent value="connections" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Conexões do Chatbot</CardTitle>
                  <CardDescription>
                    Selecione em quais conexões WhatsApp este chatbot deve atuar
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {connections.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma conexão disponível
                        </p>
                      ) : (
                        connections.map((conn) => (
                          <div
                            key={conn.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedConnections.includes(conn.id)}
                                onCheckedChange={() => toggleConnection(conn.id)}
                              />
                              <div>
                                <p className="font-medium">{conn.name}</p>
                                <p className="text-sm text-muted-foreground">{conn.phone}</p>
                              </div>
                            </div>
                            <Badge variant={conn.status === 'connected' ? 'default' : 'secondary'}>
                              {conn.status === 'connected' ? 'Conectado' : conn.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  
                  <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedConnections.length} conexão(ões) selecionada(s)
                    </p>
                    <Button onClick={handleSaveConnections} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Salvar Conexões
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Equipe de Atendentes */}
            <TabsContent value="agents" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Equipe de Atendentes</CardTitle>
                  <CardDescription>
                    Atendentes que recebem transferências e podem atuar neste chatbot
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                  {/* Add agent */}
                  <div className="flex gap-2 mb-4">
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um atendente" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUsers
                          .filter(u => !chatbotAgents.some(a => a.user_id === u.id))
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddAgent} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      {chatbotAgents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum atendente configurado.
                          <br />
                          Adicione atendentes para receber transferências.
                        </p>
                      ) : (
                        chatbotAgents.map((agent) => (
                          <div
                            key={agent.user_id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">{agent.user_name}</p>
                                <p className="text-sm text-muted-foreground">{agent.user_email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant={agent.is_default ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDefaultAgent(agent.user_id)}
                              >
                                {agent.is_default ? (
                                  <>
                                    <Crown className="h-3 w-3 mr-1" />
                                    Padrão
                                  </>
                                ) : "Definir padrão"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoveAgent(agent.user_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <Button onClick={handleSaveAgents} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Salvar Equipe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Palavras-chave */}
            <TabsContent value="keywords" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gatilhos por Palavra-chave</CardTitle>
                  <CardDescription>
                    Configure palavras que iniciam este chatbot automaticamente (correspondência exata)
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                  {/* Toggle */}
                  <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-medium">Ativação automática</span>
                    </div>
                    <Switch
                      checked={triggerEnabled}
                      onCheckedChange={setTriggerEnabled}
                    />
                  </div>

                  {/* Add keyword */}
                  <div className="flex gap-2 mb-4">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                      placeholder="Digite uma palavra-chave..."
                      className="flex-1"
                    />
                    <Button onClick={handleAddKeyword} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="flex flex-wrap gap-2">
                      {triggerKeywords.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 w-full text-center">
                          Nenhuma palavra-chave configurada.
                          <br />
                          Ex: "menu", "ajuda", "oi"
                        </p>
                      ) : (
                        triggerKeywords.map((kw) => (
                          <Badge
                            key={kw}
                            variant="secondary"
                            className="px-3 py-1.5 text-sm"
                          >
                            <Tag className="h-3 w-3 mr-1" />
                            {kw}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-2 -mr-1 hover:bg-destructive/20"
                              onClick={() => handleRemoveKeyword(kw)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  
                  <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {triggerKeywords.length} palavra(s)-chave | {triggerEnabled ? 'Ativo' : 'Inativo'}
                    </p>
                    <Button onClick={handleSaveKeywords} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Salvar Gatilhos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usuários */}
            <TabsContent value="users" className="flex-1 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Permissões de Usuários</CardTitle>
                  <CardDescription>
                    Defina quais usuários têm acesso específico a este chatbot
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col">
                  {/* Add new permission */}
                  <div className="flex gap-2 mb-4">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgUsers
                          .filter(u => !permissions.some(p => p.user_id === u.id))
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedPermission} onValueChange={setSelectedPermission}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">Visualizar</SelectItem>
                        <SelectItem value="edit">Editar</SelectItem>
                        <SelectItem value="manage">Gerenciar</SelectItem>
                        <SelectItem value="owner">Dono</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddPermission} size="icon">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Permission list */}
                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      {permissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma permissão específica configurada.
                          <br />
                          As permissões por papel serão usadas.
                        </p>
                      ) : (
                        permissions.map((perm) => {
                          const levelInfo = permissionLabels[perm.permission_level];
                          return (
                            <div
                              key={perm.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium">{perm.user_name}</p>
                                  <p className="text-sm text-muted-foreground">{perm.user_email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {perm.org_role}
                                </Badge>
                                <Badge className={levelInfo.color}>
                                  {levelInfo.icon}
                                  <span className="ml-1">{levelInfo.label}</span>
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleRemovePermission(perm.user_id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Papéis */}
            <TabsContent value="roles" className="flex-1 overflow-hidden">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Permissões por Papel</CardTitle>
                  <CardDescription>
                    Configure o que cada papel pode fazer neste chatbot por padrão
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Owner */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <Label className="font-medium">Owner (Dono)</Label>
                      </div>
                      <div className="pl-6 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pode gerenciar</span>
                        <Switch
                          checked={roleSettings?.owner_can_manage ?? true}
                          onCheckedChange={(v) => handleUpdateRoleSetting('owner_can_manage', v)}
                        />
                      </div>
                    </div>

                    {/* Admin */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-purple-500" />
                        <Label className="font-medium">Admin</Label>
                      </div>
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pode gerenciar</span>
                          <Switch
                            checked={roleSettings?.admin_can_manage ?? true}
                            onCheckedChange={(v) => handleUpdateRoleSetting('admin_can_manage', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pode editar</span>
                          <Switch
                            checked={roleSettings?.admin_can_edit ?? true}
                            onCheckedChange={(v) => handleUpdateRoleSetting('admin_can_edit', v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Manager */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <Label className="font-medium">Manager (Supervisor)</Label>
                      </div>
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pode visualizar</span>
                          <Switch
                            checked={roleSettings?.manager_can_view ?? true}
                            onCheckedChange={(v) => handleUpdateRoleSetting('manager_can_view', v)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pode editar</span>
                          <Switch
                            checked={roleSettings?.manager_can_edit ?? false}
                            onCheckedChange={(v) => handleUpdateRoleSetting('manager_can_edit', v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Agent */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-500" />
                        <Label className="font-medium">Agent (Atendente)</Label>
                      </div>
                      <div className="pl-6 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pode visualizar</span>
                        <Switch
                          checked={roleSettings?.agent_can_view ?? false}
                          onCheckedChange={(v) => handleUpdateRoleSetting('agent_can_view', v)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
