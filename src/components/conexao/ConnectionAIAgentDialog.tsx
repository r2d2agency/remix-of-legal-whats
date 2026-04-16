import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Loader2, Trash2, Globe, User } from 'lucide-react';
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

interface Props {
  open: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
}

export function ConnectionAIAgentDialog({ open, onClose, connectionId, connectionName }: Props) {
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [assigned, setAssigned] = useState<AssignedAgent[]>([]);
  const [selected, setSelected] = useState<string>(''); // value: "kind:id"
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { if (open) load(); }, [open, load]);

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

  // Filter out already assigned
  const assignedKeys = new Set(assigned.map(a => `${a.kind}:${a.agent_id}`));
  const availableFiltered = available.filter(a => !assignedKeys.has(`${a.kind}:${a.id}`));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agente IA — {connectionName}
          </DialogTitle>
          <DialogDescription>
            Escolha um agente que ficará <strong>sempre ativo</strong> nesta conexão.
            Ele responderá automaticamente a novas conversas com contexto das últimas 30 mensagens.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {/* Currently assigned */}
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

            {/* Add new */}
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
                Nenhum agente disponível. Crie um agente em <strong>Atendimento → Agentes IA</strong> primeiro.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
