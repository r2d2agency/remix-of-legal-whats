import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Trash2, CheckCircle, XCircle, Save, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
});

interface UazapiInstance {
  id?: string;
  token?: string;
  name?: string;
  status?: string;
  phone?: string;
  local?: { connectionName?: string; orgName?: string; phoneNumber?: string };
}

const DEFAULT_WEBHOOK_URL = `${window.location.origin.replace('id-preview--', '').replace('.lovable.app', '')}/api/uazapi/webhook`.replace('https://id-', 'https://');

export function UazapiInstancesTab() {
  const [config, setConfig] = useState({ url: '', admintoken: '', hasToken: false });
  const [savingConfig, setSavingConfig] = useState(false);
  const [validating, setValidating] = useState(false);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newInstance, setNewInstance] = useState({ name: '', webhookUrl: DEFAULT_WEBHOOK_URL });
  const [creating, setCreating] = useState(false);
  const [statusCache, setStatusCache] = useState<Record<string, any>>({});

  const loadConfig = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/config`, { headers: getHeaders() });
      const data = await r.json();
      if (r.ok) setConfig(data);
    } catch (e: any) {
      toast.error('Erro ao carregar config: ' + e.message);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/config`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          url: config.url,
          admintoken: config.admintoken && !config.admintoken.startsWith('••') ? config.admintoken : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success('Configuração salva!');
      loadConfig();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const validateConfig = async () => {
    setValidating(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/validate`, { method: 'POST', headers: getHeaders() });
      const data = await r.json();
      if (data.valid) toast.success(data.message);
      else toast.error(data.error || 'Validação falhou');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValidating(false);
    }
  };

  const loadInstances = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/instances`, { headers: getHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setInstances(data.instances || []);
    } catch (e: any) {
      toast.error('Erro ao listar instâncias: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (token: string) => {
    setStatusCache((p) => ({ ...p, [token]: { status: 'checking' } }));
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/instances/${encodeURIComponent(token)}/status`, {
        headers: getHeaders(),
      });
      const data = await r.json();
      setStatusCache((p) => ({
        ...p,
        [token]: {
          status: data.connected ? 'connected' : 'disconnected',
          phone: data.phoneNumber,
          error: data.error,
        },
      }));
    } catch (e: any) {
      setStatusCache((p) => ({ ...p, [token]: { status: 'error', error: e.message } }));
    }
  };

  const createInstance = async () => {
    if (!newInstance.name.trim()) return toast.error('Nome obrigatório');
    setCreating(true);
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/instances`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ instanceName: newInstance.name, webhookUrl: newInstance.webhookUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success(`Instância criada! Token: ${data.token?.slice(0, 12)}...`);
      setShowCreate(false);
      setNewInstance({ name: '', webhookUrl: DEFAULT_WEBHOOK_URL });
      loadInstances();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteInstance = async (token: string) => {
    if (!confirm('Deletar essa instância?')) return;
    try {
      const r = await fetch(`${API_URL}/api/admin/uazapi/instances/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success('Instância deletada');
      loadInstances();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Configuração UAZAPI
          </CardTitle>
          <CardDescription>
            Configure a URL base e o admintoken da sua conta UAZAPI (
            <a href="https://docs.uazapi.com/" target="_blank" rel="noopener" className="underline">
              docs
            </a>
            )
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>URL Base (ex: https://meusubdominio.uazapi.com)</Label>
            <Input
              value={config.url}
              onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
              placeholder="https://meusubdominio.uazapi.com"
            />
          </div>
          <div>
            <Label>Admin Token</Label>
            <Input
              type="password"
              value={config.admintoken}
              onChange={(e) => setConfig((c) => ({ ...c, admintoken: e.target.value }))}
              placeholder={config.hasToken ? '••••••••' : 'Cole o admintoken'}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={validateConfig} disabled={validating}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Validar
            </Button>
            <Button variant="outline" onClick={loadInstances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Listar Instâncias
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instâncias UAZAPI ({instances.length})</CardTitle>
            <CardDescription>Gerencie as instâncias do servidor UAZAPI configurado</CardDescription>
          </div>
          <Button onClick={() => setShowCreate(true)} disabled={!config.hasToken}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Instância
          </Button>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? 'Carregando...' : 'Nenhuma instância. Clique em "Listar Instâncias" para carregar.'}
            </p>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => {
                const tk = inst.token || inst.id || '';
                const st = statusCache[tk];
                return (
                  <div key={tk} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{inst.name || 'sem nome'}</span>
                        {st?.status === 'connected' && <Badge variant="default">Conectado</Badge>}
                        {st?.status === 'disconnected' && <Badge variant="outline">Desconectado</Badge>}
                        {st?.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {inst.local?.orgName && (
                          <Badge variant="secondary">{inst.local.orgName}</Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground">
                        {tk.slice(0, 24)}... {st?.phone && `• ${st.phone}`}
                      </code>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => checkStatus(tk)}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteInstance(tk)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância UAZAPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da instância</Label>
              <Input
                value={newInstance.name}
                onChange={(e) => setNewInstance((p) => ({ ...p, name: e.target.value }))}
                placeholder="ex: minha-empresa-01"
              />
            </div>
            <div>
              <Label>Webhook URL (opcional)</Label>
              <Input
                value={newInstance.webhookUrl}
                onChange={(e) => setNewInstance((p) => ({ ...p, webhookUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Configura webhook automaticamente após criar.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={createInstance} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
