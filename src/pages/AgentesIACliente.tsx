import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGlobalAgents, GlobalAgentForClient, GlobalAgentActivation, ScheduleWindow } from '@/hooks/use-global-agents';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Bot, Clock, Plug, Plus, Trash2, Settings, Power, PowerOff, Loader2, Calendar } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

interface Connection {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export default function AgentesIACliente() {
  const { user } = useAuth();
  const { loading, getAvailableAgents, activateAgent, updateActivation, deactivateAgent, deleteActivation } = useGlobalAgents();
  const [agents, setAgents] = useState<GlobalAgentForClient[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<GlobalAgentForClient | null>(null);
  const [selectedActivation, setSelectedActivation] = useState<GlobalAgentActivation | null>(null);
  
  // Form state
  const [selectedConnection, setSelectedConnection] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'always' | 'scheduled' | 'manual'>('manual');
  const [scheduleWindows, setScheduleWindows] = useState<ScheduleWindow[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [promptAdditions, setPromptAdditions] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role && ['owner', 'admin', 'manager'].includes(user.role);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [agentsData, connsData] = await Promise.all([
      getAvailableAgents(),
      api<Connection[]>('/api/connections', { auth: true }).catch(() => [])
    ]);
    setAgents(agentsData);
    setConnections(connsData);
  };

  const handleOpenConfig = (agent: GlobalAgentForClient, activation?: GlobalAgentActivation) => {
    setSelectedAgent(agent);
    setSelectedActivation(activation || null);
    setSelectedConnection(activation?.connection_id || '');
    setScheduleMode(activation?.schedule_mode || 'manual');
    setScheduleWindows(activation?.schedule_windows || []);
    setCustomFieldValues(activation?.custom_field_values || {});
    setPromptAdditions(activation?.prompt_additions || '');
    setConfigDialogOpen(true);
  };

  const handleAddWindow = () => {
    setScheduleWindows([...scheduleWindows, { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' }]);
  };

  const handleRemoveWindow = (index: number) => {
    setScheduleWindows(scheduleWindows.filter((_, i) => i !== index));
  };

  const handleUpdateWindow = (index: number, field: keyof ScheduleWindow, value: any) => {
    const updated = [...scheduleWindows];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleWindows(updated);
  };

  const toggleDay = (windowIndex: number, day: number) => {
    const updated = [...scheduleWindows];
    const days = updated[windowIndex].days;
    if (days.includes(day)) {
      updated[windowIndex] = { ...updated[windowIndex], days: days.filter(d => d !== day) };
    } else {
      updated[windowIndex] = { ...updated[windowIndex], days: [...days, day].sort() };
    }
    setScheduleWindows(updated);
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    if (!selectedConnection) {
      toast.error('Selecione uma conexão');
      return;
    }

    setSaving(true);
    try {
      if (selectedActivation) {
        await updateActivation(selectedActivation.id, {
          schedule_mode: scheduleMode,
          schedule_windows: scheduleWindows,
          custom_field_values: customFieldValues,
          prompt_additions: promptAdditions,
        } as any);
        toast.success('Configuração atualizada!');
      } else {
        await activateAgent({
          global_agent_id: selectedAgent.id,
          connection_id: selectedConnection,
          schedule_mode: scheduleMode,
          schedule_windows: scheduleWindows,
          custom_field_values: customFieldValues,
          prompt_additions: promptAdditions,
        });
        toast.success('Agente ativado!');
      }
      setConfigDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivation = async (activation: GlobalAgentActivation) => {
    if (activation.is_active) {
      const success = await deactivateAgent(activation.id);
      if (success) {
        toast.success('Agente desativado');
        loadData();
      }
    } else {
      await updateActivation(activation.id, { is_active: true } as any);
      toast.success('Agente ativado');
      loadData();
    }
  };

  const handleDeleteActivation = async (activationId: string) => {
    const success = await deleteActivation(activationId);
    if (success) {
      toast.success('Configuração removida');
      loadData();
    }
  };

  const getConnectionName = (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    return conn ? `${conn.name} (${conn.phone || ''})` : connId;
  };

  const getScheduleLabel = (mode: string, windows: ScheduleWindow[]) => {
    if (mode === 'always') return 'Sempre ativo';
    if (mode === 'manual') return 'Manual';
    if (mode === 'scheduled' && windows.length > 0) return `${windows.length} janela(s) de horário`;
    return 'Sem horários';
  };

  if (loading && agents.length === 0) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Agentes IA
          </h1>
          <p className="text-muted-foreground">
            Gerencie os agentes de IA disponíveis para suas conexões
          </p>
        </div>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Nenhum agente disponível</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Nenhum agente de IA foi disponibilizado para sua organização ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <Card key={agent.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        {agent.description && (
                          <CardDescription className="text-xs mt-0.5">{agent.description}</CardDescription>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {/* Existing activations */}
                  {agent.activations.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Conexões ativas:</Label>
                      {agent.activations.map(act => (
                        <div key={act.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{getConnectionName(act.connection_id)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant={act.is_active ? 'default' : 'secondary'} className="text-[10px] h-4 px-1">
                                {act.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {getScheduleLabel(act.schedule_mode, act.schedule_windows)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={act.is_active}
                              onCheckedChange={() => handleToggleActivation(act)}
                              className="scale-75"
                            />
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleOpenConfig(agent, act)}
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteActivation(act.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add to connection button */}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleOpenConfig(agent)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ativar em Conexão
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Config Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>
                {selectedActivation ? 'Configurar Agente' : 'Ativar Agente'} — {selectedAgent?.name}
              </DialogTitle>
              <DialogDescription>
                Configure os horários e personalize o agente para sua conexão
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="connection" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-3 shrink-0">
                <TabsTrigger value="connection" className="gap-1.5">
                  <Plug className="h-3.5 w-3.5" />
                  Conexão
                </TabsTrigger>
                <TabsTrigger value="schedule" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Horários
                </TabsTrigger>
                <TabsTrigger value="customize" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Personalizar
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-4 space-y-4">
                {/* Connection Tab */}
                <TabsContent value="connection" className="m-0 space-y-4">
                  <div className="space-y-2">
                    <Label>Conexão WhatsApp *</Label>
                    <Select value={selectedConnection} onValueChange={setSelectedConnection} disabled={!!selectedActivation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conexão" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.map(conn => (
                          <SelectItem key={conn.id} value={conn.id}>
                            {conn.name} {conn.phone ? `(${conn.phone})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modo de ativação</Label>
                    <Select value={scheduleMode} onValueChange={(v: any) => setScheduleMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Sempre ativo (24/7)</SelectItem>
                        <SelectItem value="scheduled">Por horário</SelectItem>
                        <SelectItem value="manual">Manual (ligar/desligar)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {scheduleMode === 'always' && 'O agente responde a qualquer hora, todos os dias.'}
                      {scheduleMode === 'scheduled' && 'O agente só responde dentro das janelas de horário configuradas.'}
                      {scheduleMode === 'manual' && 'Controle manualmente quando o agente está ativo.'}
                    </p>
                  </div>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="m-0 space-y-4">
                  {scheduleMode !== 'scheduled' ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Selecione o modo "Por horário" na aba Conexão para configurar janelas.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <Label>Janelas de horário</Label>
                        <Button variant="outline" size="sm" onClick={handleAddWindow} className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar Janela
                        </Button>
                      </div>

                      {scheduleWindows.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma janela configurada. Adicione pelo menos uma.
                        </p>
                      )}

                      {scheduleWindows.map((window, idx) => (
                        <Card key={idx} className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">Janela {idx + 1}</Label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => handleRemoveWindow(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Days selector */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Dias da semana</Label>
                            <div className="flex gap-1 flex-wrap">
                              {DAYS_OF_WEEK.map(day => (
                                <Button
                                  key={day.value}
                                  variant={window.days.includes(day.value) ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-8 w-10 text-xs px-0"
                                  onClick={() => toggleDay(idx, day.value)}
                                >
                                  {day.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Time range */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Início</Label>
                              <Input
                                type="time"
                                value={window.start}
                                onChange={(e) => handleUpdateWindow(idx, 'start', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Fim</Label>
                              <Input
                                type="time"
                                value={window.end}
                                onChange={(e) => handleUpdateWindow(idx, 'end', e.target.value)}
                              />
                            </div>
                          </div>
                        </Card>
                      ))}

                      {scheduleWindows.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Resumo:</p>
                          {scheduleWindows.map((w, i) => (
                            <p key={i}>
                              Janela {i + 1}: {w.days.map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.label).join(', ')} — {w.start} às {w.end}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Customize Tab */}
                <TabsContent value="customize" className="m-0 space-y-4">
                  {/* Custom fields from agent schema */}
                  {selectedAgent?.custom_fields && selectedAgent.custom_fields.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Informações da sua empresa</Label>
                      {selectedAgent.custom_fields.map(field => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-xs">
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                          </Label>
                          {field.type === 'textarea' ? (
                            <Textarea
                              placeholder={field.placeholder || ''}
                              value={customFieldValues[field.key] || ''}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.key]: e.target.value })}
                              rows={3}
                            />
                          ) : field.type === 'select' ? (
                            <Select
                              value={customFieldValues[field.key] || ''}
                              onValueChange={(v) => setCustomFieldValues({ ...customFieldValues, [field.key]: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder || 'Selecione'} />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options || []).map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder={field.placeholder || ''}
                              value={customFieldValues[field.key] || ''}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.key]: e.target.value })}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Instruções adicionais para a IA</Label>
                    <Textarea
                      placeholder="Ex: Sempre mencione nosso horário de atendimento, foque em vender o plano premium..."
                      value={promptAdditions}
                      onChange={(e) => setPromptAdditions(e.target.value)}
                      rows={4}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Essas instruções serão adicionadas ao prompt base do agente.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedActivation ? 'Salvar' : 'Ativar Agente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
