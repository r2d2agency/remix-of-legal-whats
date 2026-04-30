import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useFlows, Flow } from "@/hooks/use-flows";
import { useStageAutomation, useStageAutomationMutations, StageAutomation } from "@/hooks/use-crm-automation";
import { useCRMFunnels, CRMStage } from "@/hooks/use-crm";
import { api } from "@/lib/api";
import { 
  Zap, ChevronDown, ChevronUp, Clock, ArrowRight, Loader2, Trash2, Calendar, 
  GitBranch, Plus, ThumbsUp, ThumbsDown 
} from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const DEAL_STANDARD_FIELDS = [
  { variable: 'deal_title', label: 'Título' },
  { variable: 'deal_value', label: 'Valor' },
  { variable: 'deal_status', label: 'Status' },
  { variable: 'deal_stage_name', label: 'Etapa' },
  { variable: 'deal_funnel_name', label: 'Funil' },
  { variable: 'deal_company_name', label: 'Empresa' },
  { variable: 'deal_source', label: 'Origem' },
  { variable: 'deal_probability', label: 'Probabilidade' },
];

const OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_contains', label: 'Não contém' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'is_empty', label: 'Está vazio' },
  { value: 'is_not_empty', label: 'Não está vazio' },
];

interface ConditionRule {
  id: string;
  variable: string;
  operator: string;
  value: string;
}

interface StageAutomationEditorProps {
  stage: CRMStage;
  allStages: CRMStage[];
  funnelId?: string;
}

export function StageAutomationEditor({ stage, allStages, funnelId }: StageAutomationEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({
    flow_id: null,
    wait_hours: 24,
    next_stage_id: null,
    fallback_funnel_id: null,
    fallback_stage_id: null,
    is_active: true,
    execute_immediately: true,
    schedule_days: [1, 2, 3, 4, 5],
    schedule_start_time: '08:00',
    schedule_end_time: '18:00',
    conditions: [],
    condition_logic: 'and',
    condition_true_flow_id: null,
    condition_true_stage_id: null,
    condition_false_flow_id: null,
    condition_false_stage_id: null,
    outside_hours_flow_id: null,
  });

  const { data: existingAutomation, isLoading: loadingAutomation } = useStageAutomation(stage.id || null);
  const { saveAutomation, deleteAutomation } = useStageAutomationMutations();
  const { data: funnels } = useCRMFunnels();
  
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const { getFlows } = useFlows();
  const [customFields, setCustomFields] = useState<Array<{ field_name: string; label: string }>>([]);
  const [webhookVars, setWebhookVars] = useState<Array<{ field_name: string; label: string }>>([]);
  const [allFunnelStages, setAllFunnelStages] = useState<Record<string, CRMStage[]>>({});

  // Load flows + fields
  useEffect(() => {
    async function loadFlows() {
      setLoadingFlows(true);
      const result = await getFlows();
      setFlows(result.filter(f => f.is_active));
      setLoadingFlows(false);
    }
    if (isOpen) {
      loadFlows();
      loadCustomFields();
      loadWebhookVars();
    }
  }, [isOpen, getFlows]);

  const loadCustomFields = async () => {
    try {
      const fields = await api<Array<{ field_name: string; label: string }>>('/api/crm/custom-fields?entity_type=deal');
      setCustomFields(fields || []);
    } catch (e) {}
  };

  const loadWebhookVars = async () => {
    try {
      const webhooks = await api<Array<{ field_mapping: Record<string, string> }>>('/api/lead-webhooks');
      const vars = new Map<string, string>();
      for (const wh of webhooks) {
        if (wh.field_mapping) {
          for (const [sourceField, targetField] of Object.entries(wh.field_mapping)) {
            if (targetField === 'custom_fields' || (typeof targetField === 'string' && targetField.startsWith('custom_fields:'))) {
              const varName = typeof targetField === 'string' && targetField.includes(':')
                ? targetField.split(':')[1]
                : sourceField.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
              if (varName) {
                vars.set(varName, sourceField);
              }
            }
          }
        }
      }
      setWebhookVars(Array.from(vars.entries()).map(([field_name, source]) => ({
        field_name,
        label: field_name,
      })));
    } catch (e) {}
  };

  // Load stages for conditional target funnels
  const loadFunnelStages = async (fId: string) => {
    if (allFunnelStages[fId]) return;
    try {
      const funnel = await api<{ stages: CRMStage[] }>(`/api/crm/funnels/${fId}`);
      if (funnel?.stages) {
        setAllFunnelStages(prev => ({ ...prev, [fId]: funnel.stages }));
      }
    } catch (e) {}
  };

  // Load existing automation
  useEffect(() => {
    if (existingAutomation) {
      const ea = existingAutomation as any;
      setLocalConfig({
        flow_id: existingAutomation.flow_id,
        wait_hours: existingAutomation.wait_hours,
        next_stage_id: existingAutomation.next_stage_id,
        fallback_funnel_id: existingAutomation.fallback_funnel_id,
        fallback_stage_id: existingAutomation.fallback_stage_id,
        is_active: existingAutomation.is_active,
        execute_immediately: existingAutomation.execute_immediately,
        schedule_days: ea.schedule_days || [1, 2, 3, 4, 5],
        schedule_start_time: ea.schedule_start_time || '08:00',
        schedule_end_time: ea.schedule_end_time || '18:00',
        conditions: ea.conditions || [],
        condition_logic: ea.condition_logic || 'and',
        condition_true_flow_id: ea.condition_true_flow_id || null,
        condition_true_stage_id: ea.condition_true_stage_id || null,
        condition_false_flow_id: ea.condition_false_flow_id || null,
        condition_false_stage_id: ea.condition_false_stage_id || null,
        outside_hours_flow_id: ea.outside_hours_flow_id || null,
      });
    }
  }, [existingAutomation]);

  // Filter stages that come after current stage
  const nextStageOptions = allStages.filter(s => 
    s.id !== stage.id && s.position > stage.position && !s.is_final
  );

  const toggleDay = (day: number) => {
    const days = localConfig.schedule_days || [1, 2, 3, 4, 5];
    setLocalConfig(prev => ({
      ...prev,
      schedule_days: days.includes(day) ? days.filter((d: number) => d !== day) : [...days, day].sort()
    }));
  };

  // Conditions management
  const conditions: ConditionRule[] = localConfig.conditions || [];

  const addCondition = () => {
    setLocalConfig(prev => ({
      ...prev,
      conditions: [...(prev.conditions || []), { id: `c_${Date.now()}`, variable: '', operator: 'equals', value: '' }]
    }));
  };

  const updateCondition = (id: string, field: string, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      conditions: (prev.conditions || []).map((c: ConditionRule) => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const removeCondition = (id: string) => {
    setLocalConfig(prev => ({
      ...prev,
      conditions: (prev.conditions || []).filter((c: ConditionRule) => c.id !== id)
    }));
  };

  const handleSave = () => {
    if (!stage.id) return;
    saveAutomation.mutate({
      stageId: stage.id,
      ...localConfig,
    } as any);
  };

  const handleDelete = () => {
    if (!stage.id) return;
    deleteAutomation.mutate(stage.id);
    setLocalConfig({
      flow_id: null, wait_hours: 24, next_stage_id: null,
      fallback_funnel_id: null, fallback_stage_id: null,
      is_active: true, execute_immediately: true,
      schedule_days: [1, 2, 3, 4, 5], schedule_start_time: '08:00', schedule_end_time: '18:00',
      conditions: [], condition_logic: 'and',
      condition_true_flow_id: null, condition_true_stage_id: null,
      condition_false_flow_id: null, condition_false_stage_id: null,
    });
  };

  const hasAutomation = existingAutomation || localConfig.flow_id || conditions.length > 0;
  const hasConditions = conditions.length > 0;

  // Build all stages from all funnels for conditional target selection
  const getAllStagesForSelect = (currentFunnelId?: string) => {
    const result: Array<{ id: string; name: string; funnelName: string }> = [];
    // Current funnel stages
    allStages.forEach(s => {
      if (s.id && s.id !== stage.id) {
        result.push({ id: s.id, name: s.name, funnelName: 'Este funil' });
      }
    });
    // Other funnels stages
    for (const [fId, stages] of Object.entries(allFunnelStages)) {
      if (fId === funnelId) continue;
      const funnel = funnels?.find(f => f.id === fId);
      stages.forEach(s => {
        if (s.id) result.push({ id: s.id, name: s.name, funnelName: funnel?.name || 'Outro funil' });
      });
    }
    return result;
  };

  if (stage.is_final) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between mt-2 h-8">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3" />
            <span className="text-xs">Automação</span>
            {hasAutomation && (
              <Badge variant={(existingAutomation as any)?.is_active ? "default" : "secondary"} className="text-[10px] h-4">
                {(existingAutomation as any)?.is_active ? "Ativo" : "Inativo"}
              </Badge>
            )}
            {hasConditions && (
              <Badge variant="outline" className="text-[10px] h-4">
                <GitBranch className="h-2 w-2 mr-0.5" />
                Cond.
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="p-3 mt-2 space-y-3 bg-muted/50">
          {loadingAutomation ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <>
              {/* Default Flow Selection */}
              <div className="space-y-1">
                <Label className="text-xs">Fluxo padrão (sem condição)</Label>
                <Select
                  value={localConfig.flow_id || "none"}
                  onValueChange={(v) => setLocalConfig(prev => ({ ...prev, flow_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione um fluxo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum fluxo</SelectItem>
                    {loadingFlows ? (
                      <SelectItem value="loading" disabled>Carregando...</SelectItem>
                    ) : (
                      flows.map(flow => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* === CONDITIONS SECTION === */}
              <div className="space-y-2 p-2 bg-background rounded border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1 font-medium">
                    <GitBranch className="h-3 w-3" />
                    Condições do Card
                  </Label>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={addCondition}>
                    <Plus className="h-2.5 w-2.5 mr-0.5" />
                    Condição
                  </Button>
                </div>

                {conditions.length > 0 && (
                  <>
                    <Select
                      value={localConfig.condition_logic || 'and'}
                      onValueChange={(v) => setLocalConfig(prev => ({ ...prev, condition_logic: v }))}
                    >
                      <SelectTrigger className="h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">E (todas verdadeiras)</SelectItem>
                        <SelectItem value="or">OU (pelo menos uma)</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="space-y-2">
                      {conditions.map((rule, idx) => (
                        <div key={rule.id} className="space-y-1 p-2 bg-muted/50 rounded border">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-muted-foreground">Regra {idx + 1}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCondition(rule.id)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                          
                          <Input
                            value={rule.variable}
                            onChange={(e) => updateCondition(rule.id, 'variable', e.target.value)}
                            placeholder="Campo (ex: deal_value)"
                            className="h-7 text-[10px]"
                          />

                          {/* Deal field badges */}
                          <div className="flex flex-wrap gap-0.5">
                            {DEAL_STANDARD_FIELDS.map(f => (
                              <Badge
                                key={f.variable}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-[9px] h-4 px-1"
                                onClick={() => updateCondition(rule.id, 'variable', f.variable)}
                              >
                                {f.label}
                              </Badge>
                            ))}
                            {customFields.map(f => (
                              <Badge
                                key={`cf-${f.field_name}`}
                                variant="outline"
                                className="cursor-pointer hover:bg-accent text-[9px] h-4 px-1"
                                onClick={() => updateCondition(rule.id, 'variable', f.field_name)}
                              >
                                {f.label || f.field_name}
                              </Badge>
                            ))}
                            {webhookVars.filter(w => !customFields.some(c => c.field_name === w.field_name)).map(f => (
                              <Badge
                                key={`wh-${f.field_name}`}
                                variant="outline"
                                className="cursor-pointer hover:bg-accent text-[9px] h-4 px-1 border-blue-500/50 text-blue-600 dark:text-blue-400"
                                onClick={() => updateCondition(rule.id, 'variable', f.field_name)}
                              >
                                🔗 {f.label}
                              </Badge>
                            ))}
                          </div>

                          <Select
                            value={rule.operator}
                            onValueChange={(v) => updateCondition(rule.id, 'operator', v)}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map(op => (
                                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                            <Input
                              value={rule.value}
                              onChange={(e) => updateCondition(rule.id, 'value', e.target.value)}
                              placeholder="Valor"
                              className="h-7 text-[10px]"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Condition TRUE path */}
                    <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/30 space-y-1">
                      <Label className="text-[10px] font-medium flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <ThumbsUp className="h-3 w-3" />
                        Se VERDADEIRO
                      </Label>
                      <Select
                        value={localConfig.condition_true_flow_id || "none"}
                        onValueChange={(v) => setLocalConfig(prev => ({ ...prev, condition_true_flow_id: v === "none" ? null : v }))}
                      >
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue placeholder="Executar fluxo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum fluxo</SelectItem>
                          {flows.map(flow => (
                            <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={localConfig.condition_true_stage_id || "none"}
                        onValueChange={(v) => setLocalConfig(prev => ({ ...prev, condition_true_stage_id: v === "none" ? null : v }))}
                      >
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue placeholder="Mover card para..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não mover</SelectItem>
                          {allStages.filter(s => s.id && s.id !== stage.id).map(s => (
                            <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>
                          ))}
                          {funnels?.filter(f => f.id !== funnelId).map(f => (
                            <SelectItem key={`funnel-${f.id}`} value={`funnel-${f.id}`} disabled className="font-bold text-muted-foreground">
                              ── {f.name} ──
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Condition FALSE path */}
                    <div className="p-2 bg-destructive/10 rounded border border-destructive/30 space-y-1">
                      <Label className="text-[10px] font-medium flex items-center gap-1 text-destructive">
                        <ThumbsDown className="h-3 w-3" />
                        Se FALSO
                      </Label>
                      <Select
                        value={localConfig.condition_false_flow_id || "none"}
                        onValueChange={(v) => setLocalConfig(prev => ({ ...prev, condition_false_flow_id: v === "none" ? null : v }))}
                      >
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue placeholder="Executar fluxo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum fluxo</SelectItem>
                          {flows.map(flow => (
                            <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={localConfig.condition_false_stage_id || "none"}
                        onValueChange={(v) => setLocalConfig(prev => ({ ...prev, condition_false_stage_id: v === "none" ? null : v }))}
                      >
                        <SelectTrigger className="h-7 text-[10px]">
                          <SelectValue placeholder="Mover card para..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não mover</SelectItem>
                          {allStages.filter(s => s.id && s.id !== stage.id).map(s => (
                            <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-[9px] text-muted-foreground">
                      💡 Se a condição for verdadeira, executa o fluxo/move do caminho verde. Senão, usa o vermelho.
                    </p>
                  </>
                )}

                {conditions.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Adicione condições para avaliar campos do card (ex: valor {'>'} 1000, origem = "site")
                  </p>
                )}
              </div>

              {/* Wait Time */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tempo de espera
                </Label>
                {(() => {
                  // Derive unit + amount from wait_hours (decimal)
                  const wh = Number(localConfig.wait_hours) || 0;
                  const unit: 'minutes' | 'hours' | 'days' =
                    wh > 0 && wh < 1 ? 'minutes' : (wh >= 24 && wh % 24 === 0 ? 'days' : 'hours');
                  const amount =
                    unit === 'minutes' ? Math.round(wh * 60) :
                    unit === 'days' ? Math.round(wh / 24) :
                    wh;
                  const updateWait = (newAmount: number, newUnit: 'minutes' | 'hours' | 'days') => {
                    const safe = Math.max(1, Number(newAmount) || 1);
                    const hours =
                      newUnit === 'minutes' ? safe / 60 :
                      newUnit === 'days' ? safe * 24 :
                      safe;
                    setLocalConfig(prev => ({ ...prev, wait_hours: hours }));
                  };
                  const labelUnit = unit === 'minutes' ? 'min' : unit === 'days' ? 'd' : 'h';
                  return (
                    <>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={amount}
                          onChange={(e) => updateWait(Number(e.target.value), unit)}
                          className="h-8 text-xs flex-1"
                        />
                        <Select value={unit} onValueChange={(v) => updateWait(amount, v as any)}>
                          <SelectTrigger className="h-8 text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutos</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Se não houver resposta em {amount}{labelUnit}, move para próxima etapa
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Business Hours Schedule */}
              <div className="space-y-2 p-2 bg-background rounded border">
                <Label className="text-xs flex items-center gap-1 font-medium">
                  <Calendar className="h-3 w-3" />
                  Horário de execução
                </Label>
                
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={(localConfig.schedule_days || []).includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Início</Label>
                    <Input
                      type="time"
                      value={localConfig.schedule_start_time || '08:00'}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, schedule_start_time: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fim</Label>
                    <Input
                      type="time"
                      value={localConfig.schedule_end_time || '18:00'}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, schedule_end_time: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Fora deste horário, ações serão agendadas para o próximo dia útil
                </p>

                {/* Outside-hours flow */}
                <div className="space-y-1 pt-2 border-t">
                  <Label className="text-[11px] font-medium">
                    Fluxo fora do horário (opcional)
                  </Label>
                  <Select
                    value={localConfig.outside_hours_flow_id || "none"}
                    onValueChange={(v) => setLocalConfig(prev => ({ ...prev, outside_hours_flow_id: v === "none" ? null : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Nenhum (apenas reagendar)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (apenas reagendar)</SelectItem>
                      {flows.map(f => (
                        <SelectItem key={f.id} value={f.id!}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Se o lead cair fora do horário, este fluxo é disparado <strong>uma única vez</strong> (ex.: aviso "voltamos às 8h"). O fluxo principal segue agendado para o próximo horário comercial.
                  </p>
                </div>
              </div>

              {/* Next Stage (no response fallback) */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Próxima etapa (sem resposta)
                </Label>
                <Select
                  value={localConfig.next_stage_id || "none"}
                  onValueChange={(v) => setLocalConfig(prev => ({ ...prev, next_stage_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a próxima etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (usar fallback)</SelectItem>
                    {nextStageOptions.map(s => (
                      <SelectItem key={s.id} value={s.id!}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fallback Funnel */}
              {!localConfig.next_stage_id && (
                <div className="space-y-2 p-2 bg-background rounded border">
                  <p className="text-[10px] font-medium text-muted-foreground">Fallback (última etapa)</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Mover para funil</Label>
                    <Select
                      value={localConfig.fallback_funnel_id || "none"}
                      onValueChange={(v) => setLocalConfig(prev => ({ 
                        ...prev, 
                        fallback_funnel_id: v === "none" ? null : v,
                        fallback_stage_id: null 
                      }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o funil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {funnels?.filter(f => f.id !== funnelId).map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ativo</Label>
                <Switch
                  checked={localConfig.is_active}
                  onCheckedChange={(v) => setLocalConfig(prev => ({ ...prev, is_active: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Executar ao entrar na etapa</Label>
                <Switch
                  checked={localConfig.execute_immediately}
                  onCheckedChange={(v) => setLocalConfig(prev => ({ ...prev, execute_immediately: v }))}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={handleSave}
                  disabled={saveAutomation.isPending}
                >
                  {saveAutomation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                </Button>
                {existingAutomation && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={handleDelete}
                    disabled={deleteAutomation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
