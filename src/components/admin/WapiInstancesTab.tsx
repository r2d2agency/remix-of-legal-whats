import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Trash2, Wifi, WifiOff, Settings, Eye, Globe } from 'lucide-react';
import { API_URL, getAuthToken } from '@/lib/api';

interface WapiInstance {
  id?: string;
  instanceId?: string;
  instanceName?: string;
  name?: string;
  status?: string;
  connected?: boolean;
  phoneNumber?: string;
  phone?: string;
  createdAt?: string;
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

export function WapiInstancesTab() {
  const [instances, setInstances] = useState<WapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WapiInstance | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [statusCache, setStatusCache] = useState<Record<string, { status: string; phone?: string }>>({});

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
      // W-API pode retornar { instances: [...] } ou array direto
      const list = Array.isArray(data) ? data : (data?.instances || data?.data || []);
      setInstances(list);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const getInstanceId = (inst: WapiInstance) => inst.instanceId || inst.id || '';
  const getInstanceName = (inst: WapiInstance) => inst.instanceName || inst.name || getInstanceId(inst);

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

      setStatusCache(prev => ({
        ...prev,
        [id]: { status: connected ? 'connected' : 'disconnected', phone }
      }));
    } catch {
      setStatusCache(prev => ({
        ...prev,
        [id]: { status: 'error' }
      }));
    }
  };

  const deleteInstance = async (inst: WapiInstance) => {
    const id = getInstanceId(inst);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders()
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

  const openWebhookDialog = async (inst: WapiInstance) => {
    setSelectedInstance(inst);
    setWebhookDialogOpen(true);
    setWebhookLoading(true);
    const id = getInstanceId(inst);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}/webhooks`, {
        headers: getHeaders()
      });
      const data = await response.json();
      setWebhooks(data?.webhooks || []);
    } catch {
      toast.error('Erro ao carregar webhooks');
    } finally {
      setWebhookLoading(false);
    }
  };

  const configureWebhooks = async () => {
    if (!selectedInstance || !customWebhookUrl) {
      toast.error('Informe a URL do webhook');
      return;
    }
    setConfiguring(true);
    const id = getInstanceId(selectedInstance);
    try {
      const response = await fetch(`${API_URL}/api/admin/wapi/instances/${encodeURIComponent(id)}/webhooks`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ webhookUrl: customWebhookUrl })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`${data.configured}/${data.total} webhooks configurados`);
        // Reload webhooks
        openWebhookDialog(selectedInstance);
      } else {
        toast.error('Falha ao configurar webhooks');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfiguring(false);
    }
  };

  const getWebhookUrl = (wh: WebhookInfo): string => {
    if (!wh.data) return '—';
    return wh.data?.url || wh.data?.webhook?.url || wh.data?.webhookUrl || JSON.stringify(wh.data).slice(0, 100);
  };

  const isWebhookEnabled = (wh: WebhookInfo): boolean => {
    if (!wh.ok) return false;
    const d = wh.data;
    return d?.enabled === true || d?.webhook?.enabled === true || !!d?.url || !!d?.webhook?.url;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Instâncias W-API</h2>
        <Button variant="outline" onClick={loadInstances} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && instances.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma instância encontrada. Verifique se o token W-API está configurado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst, idx) => {
                  const id = getInstanceId(inst);
                  const cached = statusCache[id];
                  return (
                    <TableRow key={id || idx}>
                      <TableCell className="font-medium">{getInstanceName(inst)}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{id}</code>
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
                          <Button variant="ghost" size="sm" onClick={() => checkInstanceStatus(inst)}>
                            <Eye className="h-3 w-3 mr-1" /> Verificar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{cached?.phone || inst.phoneNumber || inst.phone || '—'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => openWebhookDialog(inst)}>
                          <Globe className="h-3 w-3 mr-1" /> Webhooks
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => checkInstanceStatus(inst)}>
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
                                A instância <strong>{getInstanceName(inst)}</strong> ({id}) será permanentemente removida da W-API.
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Webhook Config Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Webhooks — {selectedInstance ? getInstanceName(selectedInstance) : ''}
            </DialogTitle>
            <DialogDescription>
              Visualize e configure os webhooks desta instância W-API
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Current webhooks */}
            {webhookLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Configuração Atual</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((wh) => (
                      <TableRow key={wh.type}>
                        <TableCell className="font-medium">{wh.type}</TableCell>
                        <TableCell>
                          {isWebhookEnabled(wh) ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>
                          ) : (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs">
                          {getWebhookUrl(wh)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Configure */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Configurar Webhooks</h3>
              <p className="text-xs text-muted-foreground">
                Define a URL de callback para todos os webhooks desta instância. Use a URL pública do seu backend + /api/wapi/webhook
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://seu-backend.com/api/wapi/webhook"
                  value={customWebhookUrl}
                  onChange={(e) => setCustomWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={configureWebhooks} disabled={configuring || !customWebhookUrl}>
                  {configuring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
