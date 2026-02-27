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
import { Loader2, RefreshCw, Trash2, Wifi, WifiOff, Globe, Plus, Search, Building2, ChevronDown, ChevronUp, Check, X, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { API_URL, getAuthToken } from '@/lib/api';
import React from 'react';

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

const DEFAULT_WEBHOOK_URL = 'https://blaster-whats-backend.isyhhh.easypanel.host/api/wapi/webhook';

export function WapiInstancesTab() {
  const [instances, setInstances] = useState<WapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [statusCache, setStatusCache] = useState<Record<string, { status: string; phone?: string; error?: string }>>({});

  // Webhook management
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);
  const [webhookData, setWebhookData] = useState<Record<string, WebhookInfo[]>>({});
  const [webhookLoading, setWebhookLoading] = useState<Record<string, boolean>>({});
  const [configuringWebhooks, setConfiguringWebhooks] = useState<Record<string, boolean>>({});
  const [togglingWebhook, setTogglingWebhook] = useState<Record<string, boolean>>({});
  const [webhookUrlInput, setWebhookUrlInput] = useState(DEFAULT_WEBHOOK_URL);

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
        throw new Error(err.error || `Erro ao listar instâncias (HTTP ${response.status})`);
      }
      const data = await response.json();
      const list = data?.instances || (Array.isArray(data) ? data : data?.data || []);
      console.log('[WapiInstances] Loaded', list.length, 'instances');
      setInstances(list);
    } catch (err: any) {
      console.error('[WapiInstances] loadInstances error:', err);
      toast.error(`Erro ao carregar instâncias: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  // Auto-check all statuses and load webhooks after instances load
  useEffect(() => {
    if (instances.length > 0) {
      instances.slice(0, 30).forEach(inst => {
        const id = inst.instanceId || inst.id || '';
        if (id) {
          if (!statusCache[id]) checkInstanceStatus(inst);
          if (!webhookData[id]) loadWebhooks(id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances]);

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

  // Deeply search for connected status in any nested object
  const parseStatusResponse = (data: any): { connected: boolean; phone: string } => {
    let connected = false;
    let phone = '';
    
    const check = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      // Check common fields
      if (obj.connected === true || obj.isConnected === true) connected = true;
      const st = String(obj.status || obj.state || '').toLowerCase();
      if (['connected', 'open', 'online', 'authenticated'].includes(st)) connected = true;
      phone = phone || obj.phoneNumber || obj.phone || obj.number || obj.wid || '';
    };

    // Check top level
    check(data);
    check(data?.data);
    check(data?.data?.data);
    check(data?.data?.result);
    check(data?.data?.instance);
    check(data?.data?.info);
    // Also check if the W-API returns status directly
    if (data?.ok && data?.data) {
      check(data.data);
    }
    
    console.log('[WapiInstances] parseStatus result:', { connected, phone, rawData: data });
    return { connected, phone };
  };

  const checkInstanceStatus = async (inst: WapiInstance) => {
    const id = getInstanceId(inst);
    setStatusCache(prev => ({ ...prev, [id]: { status: 'checking' } }));
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}/status`, {
        headers: getHeaders()
      });
      const data = await response.json();
      console.log(`[WapiInstances] Status for ${id}:`, JSON.stringify(data).substring(0, 500));
      
      if (!response.ok) {
        setStatusCache(prev => ({ ...prev, [id]: { status: 'error', error: data?.error || `HTTP ${response.status}` } }));
        return;
      }
      
      const { connected, phone } = parseStatusResponse(data);
      setStatusCache(prev => ({ ...prev, [id]: { status: connected ? 'connected' : 'disconnected', phone } }));
    } catch (err: any) {
      console.error(`[WapiInstances] checkStatus error for ${id}:`, err);
      setStatusCache(prev => ({ ...prev, [id]: { status: 'error', error: err.message } }));
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
        throw new Error(err.error || `Erro ao deletar (HTTP ${response.status})`);
      }
      toast.success('Instância deletada');
      loadInstances();
    } catch (err: any) {
      console.error('[WapiInstances] deleteInstance error:', err);
      toast.error(err.message);
    }
  };

  const loadWebhooks = async (instanceId: string) => {
    setWebhookLoading(prev => ({ ...prev, [instanceId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error(`[WapiInstances] loadWebhooks error for ${instanceId}:`, err);
        // Create empty webhook entries for each type so UI shows toggles
        const emptyWebhooks: WebhookInfo[] = ['received', 'delivery', 'message-status', 'connected', 'disconnected', 'chat-presence']
          .map(type => ({ type, ok: false, error: err.error || `HTTP ${response.status}` }));
        setWebhookData(prev => ({ ...prev, [instanceId]: emptyWebhooks }));
        return;
      }
      const data = await response.json();
      const webhooks = data?.webhooks || [];
      console.log(`[WapiInstances] Webhooks for ${instanceId}:`, webhooks.map((w: any) => `${w.type}:${w.ok}`).join(', '));
      
      // If backend returned fewer than 6, fill missing types
      const existingTypes = new Set(webhooks.map((w: any) => w.type));
      const allTypes = ['received', 'delivery', 'message-status', 'connected', 'disconnected', 'chat-presence'];
      for (const type of allTypes) {
        if (!existingTypes.has(type)) {
          webhooks.push({ type, ok: false, data: null });
        }
      }
      
      setWebhookData(prev => ({ ...prev, [instanceId]: webhooks }));
    } catch (err: any) {
      console.error(`[WapiInstances] loadWebhooks error for ${instanceId}:`, err);
    } finally {
      setWebhookLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const toggleExpand = (instanceId: string) => {
    if (expandedInstance === instanceId) {
      setExpandedInstance(null);
    } else {
      setExpandedInstance(instanceId);
      // Always reload webhooks when expanding
      loadWebhooks(instanceId);
    }
  };

  const configureAllWebhooks = async (instanceId: string) => {
    const url = webhookUrlInput || DEFAULT_WEBHOOK_URL;
    if (!url) {
      toast.error('Informe a URL do webhook');
      return;
    }
    setConfiguringWebhooks(prev => ({ ...prev, [instanceId]: true }));
    try {
      console.log(`[WapiInstances] Configuring all webhooks for ${instanceId} with URL: ${url}`);
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ webhookUrl: url })
      });
      const data = await response.json();
      console.log(`[WapiInstances] configureAll response:`, data);
      
      if (!response.ok) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }
      
      if (data.success) {
        toast.success(`${data.configured}/${data.total} webhooks configurados com sucesso`);
        // Show details of any failures
        const failures = (data.results || []).filter((r: any) => !r.ok);
        if (failures.length > 0) {
          console.warn('[WapiInstances] Some webhooks failed:', failures);
          toast.warning(`${failures.length} webhook(s) falharam: ${failures.map((f: any) => f.type).join(', ')}`);
        }
        loadWebhooks(instanceId);
      } else {
        toast.error(`Falha ao configurar webhooks: ${data.error || 'Resposta inesperada'}`);
      }
    } catch (err: any) {
      console.error('[WapiInstances] configureAllWebhooks error:', err);
      toast.error(`Erro ao configurar webhooks: ${err.message}`);
    } finally {
      setConfiguringWebhooks(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const toggleWebhook = async (instanceId: string, type: string, enabled: boolean, existingUrl?: string) => {
    // Always use a URL when enabling - prefer existing, then input, then default
    const url = enabled 
      ? (existingUrl && existingUrl !== '—' ? existingUrl : webhookUrlInput || DEFAULT_WEBHOOK_URL)
      : undefined;
    
    const toggleKey = `${instanceId}-${type}`;
    setTogglingWebhook(prev => ({ ...prev, [toggleKey]: true }));
    
    try {
      console.log(`[WapiInstances] Toggle webhook ${type} for ${instanceId}: enabled=${enabled}, url=${url}`);
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(instanceId)}/webhooks/${type}/toggle`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ enabled, url })
      });
      const data = await response.json();
      console.log(`[WapiInstances] toggleWebhook response:`, data);
      
      if (!response.ok) {
        throw new Error(data.error || `Erro HTTP ${response.status}`);
      }
      
      if (data.success) {
        toast.success(`Webhook ${type} ${enabled ? 'ativado' : 'desativado'}`);
        loadWebhooks(instanceId);
      } else {
        const detail = data.data?.message || data.data?.error || JSON.stringify(data.data || {}).substring(0, 100);
        toast.error(`Falha ao alterar webhook ${type}: ${detail}`);
      }
    } catch (err: any) {
      console.error(`[WapiInstances] toggleWebhook error for ${type}:`, err);
      toast.error(`Erro ao alterar webhook ${type}: ${err.message}`);
    } finally {
      setTogglingWebhook(prev => ({ ...prev, [toggleKey]: false }));
    }
  };

  const getWebhookUrl = (wh: WebhookInfo): string => {
    if (!wh.data) return '—';
    return wh.data?.url || wh.data?.webhook?.url || wh.data?.webhookUrl || '—';
  };

  const isWebhookEnabled = (wh: WebhookInfo): boolean => {
    if (!wh.ok) return false;
    const d = wh.data;
    if (!d) return false;
    // Check various response formats from W-API
    if (d.enabled === true) return true;
    if (d.webhook?.enabled === true) return true;
    // If there's a URL set and it's not empty, consider enabled
    if (d.url && d.url.startsWith('http')) return true;
    if (d.webhook?.url && d.webhook.url.startsWith('http')) return true;
    return false;
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
        body: JSON.stringify({ 
          instanceName: newInstanceName.trim(), 
          rejectCalls, 
          callMessage,
          webhookUrl: DEFAULT_WEBHOOK_URL 
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Erro ao criar instância (HTTP ${response.status})`);
      const whResult = data.webhooksResult;
      if (whResult) {
        toast.success(`Instância criada com ${whResult.configured}/${whResult.total} webhooks configurados!`);
      } else {
        toast.success(`Instância criada! ID: ${data.instanceId || data.id || 'OK'}`);
      }
      setCreateDialogOpen(false);
      setNewInstanceName('');
      loadInstances();
    } catch (err: any) {
      console.error('[WapiInstances] createInstance error:', err);
      toast.error(`Erro ao criar: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const checkAllStatuses = async () => {
    toast.info('Verificando status de todas as instâncias...');
    const promises = filtered.slice(0, 30).map(inst => checkInstanceStatus(inst));
    await Promise.allSettled(promises);
    toast.success('Verificação concluída');
  };

  const getStatusDisplay = (id: string) => {
    const cached = statusCache[id];
    if (!cached) return null;
    
    if (cached.status === 'checking') {
      return (
        <Badge variant="outline" className="text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Verificando
        </Badge>
      );
    }
    if (cached.status === 'connected') {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <Wifi className="h-3 w-3 mr-1" /> Conectado
        </Badge>
      );
    }
    if (cached.status === 'error') {
      return (
        <Badge variant="destructive" className="text-xs cursor-help" title={cached.error}>
          <AlertCircle className="h-3 w-3 mr-1" /> Erro
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <WifiOff className="h-3 w-3 mr-1" /> Desconectado
      </Badge>
    );
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
              {instances.length === 0 ? 'Nenhuma instância encontrada. Verifique se o token W-API está configurado.' : 'Nenhuma instância corresponde aos filtros.'}
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
                    <React.Fragment key={id || idx}>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(id)}>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {getStatusDisplay(id) || (
                            <Button variant="ghost" size="sm" onClick={() => checkInstanceStatus(inst)}>
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
                            <Badge variant="outline" className="text-xs">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> ...
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => checkInstanceStatus(inst)} title="Re-verificar status">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
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
                                    A instância <strong>{getInstanceName(inst)}</strong> ({id}) será removida permanentemente da W-API.
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
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded webhook config */}
                      {isExpanded && (
                        <TableRow>
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
                                    {instanceWebhooks.map(wh => {
                                      const enabled = isWebhookEnabled(wh);
                                      const url = getWebhookUrl(wh);
                                      const toggleKey = `${id}-${wh.type}`;
                                      const isToggling = togglingWebhook[toggleKey];
                                      return (
                                        <div key={wh.type} className="flex items-center justify-between gap-3 rounded-md border p-2 px-3">
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <Switch
                                              checked={enabled}
                                              disabled={isToggling}
                                              onCheckedChange={(val) => toggleWebhook(id, wh.type, val, url !== '—' ? url : undefined)}
                                            />
                                            <span className="font-mono text-sm font-medium w-32">{wh.type}</span>
                                            <span className="text-xs text-muted-foreground truncate flex-1">
                                              {url}
                                              {wh.error && <span className="text-destructive ml-2">({wh.error})</span>}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {isToggling && <Loader2 className="h-3 w-3 animate-spin" />}
                                            {enabled ? (
                                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                                <Check className="h-3 w-3 mr-1" /> Ativo
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary">Inativo</Badge>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {instanceWebhooks.length === 0 && (
                                      <p className="text-sm text-muted-foreground">Nenhum webhook encontrado. Use "Aplicar Todos" abaixo para configurar.</p>
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
                    </React.Fragment>
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
            <DialogDescription>Crie uma nova instância via integrador W-API. Webhooks serão configurados automaticamente.</DialogDescription>
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
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Webhook URL:</strong> {DEFAULT_WEBHOOK_URL}
              <br />Os 6 tipos de webhook serão configurados automaticamente após a criação.
            </div>
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
