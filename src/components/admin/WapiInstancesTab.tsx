import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Trash2, Wifi, WifiOff, Globe, Plus, Search, Building2, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { API_URL, getAuthToken } from '@/lib/api';

interface LocalInfo {
  connectionName?: string;
  phoneNumber?: string;
  orgId?: string;
  orgName?: string;
  orgSlug?: string;
  ownerName?: string;
  ownerEmail?: string;
}

interface WapiInstance {
  instanceId?: string;
  id?: string;
  instanceName?: string;
  name?: string;
  status?: string;
  connected?: boolean;
  phoneNumber?: string;
  phone?: string;
  createdAt?: string;
  local?: LocalInfo | null;
  [key: string]: any;
}

interface WebhookInfo {
  type: string;
  ok: boolean;
  status?: number;
  data?: any;
  error?: string;
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const WEBHOOK_TYPES = ['received', 'delivery', 'message-status', 'connected', 'disconnected', 'chat-presence'] as const;

export function WapiInstancesTab() {
  const [instances, setInstances] = useState<WapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [statusCache, setStatusCache] = useState<Record<string, { status: string; phone?: string }>>({});

  // Webhook management
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);
  const [webhookData, setWebhookData] = useState<Record<string, WebhookInfo[]>>({});
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});
  const [configuringWebhooks, setConfiguringWebhooks] = useState<Record<string, boolean>>({});
  const [webhookUrlInput, setWebhookUrlInput] = useState('');

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [rejectCalls, setRejectCalls] = useState(true);
  const [callMessage, setCallMessage] = useState('Não estamos disponíveis no momento.');
  const [creating, setCreating] = useState(false);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances?pageSize=100&page=1`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao listar instâncias');
      }
      const data = await response.json();
      const list = data?.instances || (Array.isArray(data) ? data : data?.data || []);
      setInstances(list);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  const getInstanceId = (inst: WapiInstance) => inst.instanceId || inst.id || '';
  const getInstanceName = (inst: WapiInstance) => inst.instanceName || inst.name || getInstanceId(inst);

  // Unique orgs for filter
  const uniqueOrgs = Array.from(
    new Map(
      instances
        .filter(i => i.local?.orgName)
        .map(i => [i.local!.orgId!, { id: i.local!.orgId!, name: i.local!.orgName! }])
    ).values()
  );

  // Filter instances
  const filtered = instances.filter(inst => {
    const id = getInstanceId(inst);
    const name = getInstanceName(inst);
    const org = inst.local?.orgName || '';
    const owner = inst.local?.ownerName || inst.local?.ownerEmail || '';
    const phone = inst.local?.phoneNumber || inst.phoneNumber || inst.phone || '';
    const search = searchFilter.toLowerCase();

    const matchesSearch = !search || 
      name.toLowerCase().includes(search) ||
      id.toLowerCase().includes(search) ||
      org.toLowerCase().includes(search) ||
      owner.toLowerCase().includes(search) ||
      phone.includes(search);

    const matchesOrg = orgFilter === 'all' || 
      (orgFilter === 'unlinked' ? !inst.local : inst.local?.orgId === orgFilter);

    return matchesSearch && matchesOrg;
  });

  const checkInstanceStatus = async (inst: WapiInstance) => {
    const id = getInstanceId(inst);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}/status`, {
        headers: getHeaders()
      });
      const data = await response.json();
      const candidates = [data?.data, data?.data?.data, data?.data?.result, data?.data?.instance].filter(Boolean);
      let connected = false;
      let phone = '';
      for (const c of candidates) {
        if (c?.connected === true || c?.isConnected === true ||
            ['connected', 'open', 'online'].includes(String(c?.status || c?.state || '').toLowerCase())) {
          connected = true;
        }
        phone = phone || c?.phoneNumber || c?.phone || c?.number || '';
      }
      setStatusCache(prev => ({ ...prev, [id]: { status: connected ? 'connected' : 'disconnected', phone } }));
    } catch {
      setStatusCache(prev => ({ ...prev, [id]: { status: 'error' } }));
    }
  };

  const deleteInstance = async (inst: WapiInstance) => {
    const id = getInstanceId(inst);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: getHeaders()
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao deletar');
      }
      toast.success('Instância deletada');
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadWebhooks = async (instanceId: string) => {
    setWebhookLoading(prev => ({ ...prev, [instanceId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks`, {
        headers: getHeaders()
      });
      const data = await response.json();
      setWebhookData(prev => ({ ...prev, [instanceId]: data?.webhooks || [] }));
    } catch {
      toast.error('Erro ao carregar webhooks');
    } finally {
      setWebhookLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const toggleExpand = (instanceId: string) => {
    if (expandedInstance === instanceId) {
      setExpandedInstance(null);
    } else {
      setExpandedInstance(instanceId);
      if (!webhookData[instanceId]) {
        loadWebhooks(instanceId);
      }
    }
  };

  const configureAllWebhooks = async (instanceId: string) => {
    if (!webhookUrlInput) {
      toast.error('Informe a URL do webhook');
      return;
    }
    setConfiguringWebhooks(prev => ({ ...prev, [instanceId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ webhookUrl: webhookUrlInput })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`${data.configured}/${data.total} webhooks configurados`);
        loadWebhooks(instanceId);
      } else {
        toast.error('Falha ao configurar webhooks');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfiguringWebhooks(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const toggleWebhook = async (instanceId: string, type: string, enabled: boolean, url?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks/${type}/toggle`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ enabled, url: url || webhookUrlInput || undefined })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Webhook ${type} ${enabled ? 'ativado' : 'desativado'}`);
        loadWebhooks(instanceId);
      } else {
        toast.error(`Falha ao alterar webhook ${type}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getWebhookUrl = (wh: WebhookInfo): string => {
    if (!wh.data) return '—';
    return wh.data?.url || wh.data?.webhook?.url || wh.data?.webhookUrl || '—';
  };

  const isWebhookEnabled = (wh: WebhookInfo): boolean => {
    if (!wh.ok) return false;
    const d = wh.data;
    return d?.enabled === true || d?.webhook?.enabled === true || !!d?.url || !!d?.webhook?.url;
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error('Informe o nome da instância');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: newInstanceName.trim(), rejectCalls, callMessage })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar instância');
      toast.success(`Instância criada! ID: ${data.instanceId || data.id || 'OK'}`);
      setCreateDialogOpen(false);
      setNewInstanceName('');
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const checkAllStatuses = async () => {
    for (const inst of filtered.slice(0, 20)) {
      checkInstanceStatus(inst);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold">Instâncias W-API</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Instância
          </Button>
          <Button variant="outline" size="sm" onClick={checkAllStatuses}>
            <Wifi className="h-4 w-4 mr-1" /> Verificar Todos
          </Button>
          <Button variant="outline" size="sm" onClick={loadInstances} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, ID, organização, telefone..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[220px]">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por organização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as organizações</SelectItem>
            <SelectItem value="unlinked">Sem vínculo</SelectItem>
            {uniqueOrgs.map(org => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span>{filtered.length} de {instances.length} instâncias</span>
        {orgFilter !== 'all' && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => setOrgFilter('all')}>
            <X className="h-3 w-3 mr-1" /> Limpar filtro
          </Badge>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && instances.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {instances.length === 0 ? 'Nenhuma instância encontrada.' : 'Nenhuma instância corresponde aos filtros.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Webhooks</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inst, idx) => {
                  const id = getInstanceId(inst);
                  const cached = statusCache[id];
                  const isExpanded = expandedInstance === id;
                  const instanceWebhooks = webhookData[id] || [];
                  const activeWebhooks = instanceWebhooks.filter(w => isWebhookEnabled(w)).length;

                  return (
                    <>
                      <TableRow key={id || idx} className="cursor-pointer" onClick={() => toggleExpand(id)}>
                        <TableCell className="w-10 px-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{getInstanceName(inst)}</span>
                            <div className="text-xs text-muted-foreground font-mono">{id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {inst.local ? (
                            <div>
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {inst.local.orgName || 'Sem org'}
                              </Badge>
                              {inst.local.ownerName && (
                                <div className="text-xs text-muted-foreground mt-0.5">{inst.local.ownerName}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem vínculo local</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {cached ? (
                            cached.status === 'connected' ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Wifi className="h-3 w-3 mr-1" /> Conectado
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <WifiOff className="h-3 w-3 mr-1" /> Desconectado
                              </Badge>
                            )
                          ) : (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); checkInstanceStatus(inst); }}>
                              Verificar
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>{cached?.phone || inst.local?.phoneNumber || inst.phoneNumber || inst.phone || '—'}</TableCell>
                        <TableCell>
                          {instanceWebhooks.length > 0 ? (
                            <Badge variant={activeWebhooks >= 1 ? 'default' : 'destructive'} className="text-xs">
                              {activeWebhooks}/{instanceWebhooks.length} ativos
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar instância?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A instância <strong>{getInstanceName(inst)}</strong> ({id}) será removida.
                                  {inst.local?.orgName && <> Pertence à organização <strong>{inst.local.orgName}</strong>.</>}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteInstance(inst)} className="bg-destructive hover:bg-destructive/90">
                                  Deletar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>

                      {/* Expanded webhook config */}
                      {isExpanded && (
                        <TableRow key={`${id}-webhooks`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2">
                                  <Globe className="h-4 w-4" /> Webhooks — {getInstanceName(inst)}
                                </h4>
                                <Button variant="outline" size="sm" onClick={() => loadWebhooks(id)} disabled={webhookLoading[id]}>
                                  {webhookLoading[id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                </Button>
                              </div>

                              {webhookLoading[id] ? (
                                <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                              ) : (
                                <>
                                  {/* Webhook list */}
                                  <div className="grid gap-2">
                                    {instanceWebhooks.length > 0 ? instanceWebhooks.map(wh => {
                                      const enabled = isWebhookEnabled(wh);
                                      const url = getWebhookUrl(wh);
                                      return (
                                        <div key={wh.type} className="flex items-center justify-between gap-3 rounded-md border p-2 px-3">
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <Switch
                                              checked={enabled}
                                              onCheckedChange={(val) => toggleWebhook(id, wh.type, val, url !== '—' ? url : undefined)}
                                            />
                                            <span className="font-mono text-sm font-medium w-28">{wh.type}</span>
                                            <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
                                          </div>
                                          {enabled ? (
                                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                                              <Check className="h-3 w-3 mr-1" /> Ativo
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="shrink-0">Inativo</Badge>
                                          )}
                                        </div>
                                      );
                                    }) : (
                                      <p className="text-sm text-muted-foreground">Clique em atualizar para carregar os webhooks.</p>
                                    )}
                                  </div>

                                  {/* Configure all at once */}
                                  <div className="border-t pt-3 space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                      Configure todos os webhooks de uma vez com a URL do backend:
                                    </p>
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="https://seu-backend.com/api/wapi/webhook"
                                        value={webhookUrlInput}
                                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                                        className="flex-1 text-sm"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => configureAllWebhooks(id)}
                                        disabled={configuringWebhooks[id] || !webhookUrlInput}
                                      >
                                        {configuringWebhooks[id] ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                                        Aplicar Todos
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Instance Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Nova Instância W-API
            </DialogTitle>
            <DialogDescription>Crie uma nova instância via integrador W-API</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input placeholder="ex: minha-instancia" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Rejeitar chamadas</Label>
              <Switch checked={rejectCalls} onCheckedChange={setRejectCalls} />
            </div>
            {rejectCalls && (
              <div className="space-y-2">
                <Label>Mensagem de rejeição</Label>
                <Input value={callMessage} onChange={(e) => setCallMessage(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createInstance} disabled={creating || !newInstanceName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
