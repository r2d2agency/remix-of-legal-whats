import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2, Trash2, Globe, User, Activity, RefreshCw, Pause, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AvailableAgent {
  id: string;
  name: string;
  kind: 'regular' | 'global';
}

interface AssignedAgent {
  link_id: string;
  agent_id: string;
  name: string;
  kind: 'regular' | 'global';
  mode: string;
  is_active: boolean;
  agent_active: boolean;
}

interface LogEntry {
  ts: string;
  level: string;
  event: string;
  agentId?: string;
  agentName?: string;
  connectionId?: string;
  conversationId?: string;
  toolName?: string;
  toolNames?: string[];
  toolsUsed?: string[];
  args?: Record<string, unknown>;
  resultPreview?: string;
  durationMs?: number;
  error?: { message?: string };
  contactPhone?: string;
  agentSource?: string;
  reason?: string;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
}

export function ConnectionAIAgentDialog({ open, onClose, connectionId, connectionName }: Props) {
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [assigned, setAssigned] = useState<AssignedAgent[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tab, setTab] = useState('agents');
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const [av, as] = await Promise.all([
        api<AvailableAgent[]>(`/api/connections/${connectionId}/ai-agents/available`),
        api<AssignedAgent[]>(`/api/connections/${connectionId}/ai-agents`),
      ]);
      setAvailable(av || []);
      setAssigned(as || []);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  const loadLogs = useCallback(async () => {
    if (!connectionId) return;
    setLogsLoading(true);
    try {
      const res = await api<{ logs: LogEntry[] }>(`/api/ai-agents/debug/logs?limit=200`, { auth: true });
      const all = res?.logs || [];
      // Filter by connectionId OR by the agents currently assigned to this connection
      const assignedAgentIds = new Set(assigned.map(a => a.agent_id));
      const filtered = all.filter(l => 
        l.connectionId === connectionId || 
        (l.agentId && assignedAgentIds.has(String(l.agentId)))
      );
      setLogs(filtered);
    } catch (err: any) {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [connectionId, assigned]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Auto-refresh logs every 3s when on logs tab
  useEffect(() => {
    if (!open || tab !== 'logs' || !autoRefresh) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    loadLogs();
    pollRef.current = window.setInterval(loadLogs, 3000);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [open, tab, autoRefresh, loadLogs]);

  const handleAssign = async () => {
    if (!selected) return;
    const [kind, id] = selected.split(':');
    if (!kind || !id) return;
    setSaving(true);
    try {
      await api(`/api/connections/${connectionId}/ai-agents`, {
        method: 'POST',
        body: { agent_id: id, kind },
      });
      toast.success('Agente ativado para esta conexão — sempre ativo');
      setSelected('');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao ativar agente');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (a: AssignedAgent) => {
    if (!confirm(`Remover "${a.name}" desta conexão?`)) return;
    try {
      await api(`/api/connections/${connectionId}/ai-agents/${a.link_id}?kind=${a.kind}`, {
        method: 'DELETE',
      });
      toast.success('Agente removido');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover');
    }
  };

  const assignedKeys = new Set(assigned.map(a => `${a.kind}:${a.agent_id}`));
  const availableFiltered = available.filter(a => !assignedKeys.has(`${a.kind}:${a.id}`));

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false }); } catch { return ts; }
  };

  const getEventColor = (event: string, level: string) => {
    if (level === 'error') return 'text-destructive';
    if (event.includes('appbarber')) return 'text-purple-600 dark:text-purple-400';
    if (event.includes('tools_')) return 'text-blue-600 dark:text-blue-400';
    if (event.includes('session_created') || event.includes('agent_resolved')) return 'text-green-600 dark:text-green-400';
    if (event.includes('no_agent') || event.includes('takeover') || event.includes('paused')) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const getEventLabel = (event: string) => event.replace('ai_agent_processor.', '').replace('ai_caller.', '🤖 ');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agente IA — {connectionName}
          </DialogTitle>
          <DialogDescription>
            Escolha um agente sempre ativo nesta conexão e veja os logs da IA em tempo real.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agents"><Bot className="h-4 w-4 mr-1.5" />Agentes</TabsTrigger>
            <TabsTrigger value="logs"><Activity className="h-4 w-4 mr-1.5" />Logs em tempo real</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="flex-1 overflow-auto mt-4">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Agentes ativos nesta conexão</h4>
                  {assigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-md">
                      Nenhum agente ativo. Selecione abaixo para ativar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assigned.map(a => (
                        <div key={a.link_id} className="flex items-center justify-between p-3 rounded-md border bg-card">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.kind === 'global' ? <Globe className="h-4 w-4 text-primary flex-shrink-0" /> : <User className="h-4 w-4 text-primary flex-shrink-0" />}
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{a.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  {a.kind === 'global' ? 'Global' : 'Próprio'}
                                </Badge>
                                <Badge variant={a.is_active && a.agent_active ? 'default' : 'secondary'} className="text-[10px] h-4 px-1">
                                  {a.is_active && a.agent_active ? 'Sempre ativo' : 'Inativo'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => handleRemove(a)} className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {availableFiltered.length > 0 && (
                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium mb-2">Adicionar agente</h4>
                    <div className="flex gap-2">
                      <Select value={selected} onValueChange={setSelected}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um agente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFiltered.map(a => (
                            <SelectItem key={`${a.kind}:${a.id}`} value={`${a.kind}:${a.id}`}>
                              <div className="flex items-center gap-2">
                                {a.kind === 'global' ? <Globe className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                <span>{a.name}</span>
                                <Badge variant="outline" className="text-[10px] ml-1">
                                  {a.kind === 'global' ? 'Global' : 'Próprio'}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssign} disabled={!selected || saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                )}

                {availableFiltered.length === 0 && assigned.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Nenhum agente disponível. Crie um em <strong>Atendimento → Agentes IA</strong>.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="flex-1 overflow-hidden mt-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                Mostrando últimos eventos da IA para esta conexão e seus agentes
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setAutoRefresh(!autoRefresh)} className="h-7 text-xs">
                  {autoRefresh ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {autoRefresh ? 'Pausar' : 'Auto'}
                </Button>
                <Button size="sm" variant="ghost" onClick={loadLogs} disabled={logsLoading} className="h-7">
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 border rounded-md bg-muted/20">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {logsLoading ? 'Carregando…' : 'Nenhum log ainda. Envie uma mensagem ao WhatsApp para ver a IA trabalhando.'}
                </div>
              ) : (
                <div className="p-2 space-y-1 font-mono text-[11px]">
                  {logs.map((l, i) => (
                    <div key={i} className="border-b border-border/50 pb-1 last:border-0">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0">{formatTime(l.ts)}</span>
                        <span className={`font-semibold ${getEventColor(l.event, l.level)}`}>
                          {getEventLabel(l.event)}
                        </span>
                      </div>
                      {(l.agentName || l.toolName || l.toolNames || l.toolsUsed || l.resultPreview || l.error?.message || l.reason || l.agentSource) && (
                        <div className="ml-14 text-muted-foreground space-y-0.5">
                          {l.agentName && <div>👤 Agente: <span className="text-foreground">{l.agentName}</span> {l.agentSource && <Badge variant="outline" className="text-[9px] h-3 px-1 ml-1">{l.agentSource}</Badge>}</div>}
                          {l.toolName && <div>🔧 Ferramenta: <span className="text-foreground">{l.toolName}</span> {typeof l.durationMs === 'number' && <span className="text-[10px]">({l.durationMs}ms)</span>}</div>}
                          {l.toolNames && <div>🛠️ Disponíveis: {l.toolNames.join(', ')}</div>}
                          {l.toolsUsed && l.toolsUsed.length > 0 && <div>✅ Usadas: <span className="text-foreground">{l.toolsUsed.join(' → ')}</span></div>}
                          {l.args && <div className="truncate">📥 Args: <span className="text-foreground">{JSON.stringify(l.args).substring(0, 150)}</span></div>}
                          {l.resultPreview && <div className="truncate">📤 Result: <span className="text-foreground">{l.resultPreview}</span></div>}
                          {l.reason && <div>⚠️ Motivo: {l.reason}</div>}
                          {l.error?.message && <div className="text-destructive">❌ {l.error.message}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
