import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useFlows, Flow } from "@/hooks/use-flows";
import { useStageAutomation, useStageAutomationMutations, StageAutomation } from "@/hooks/use-crm-automation";
import { useCRMFunnels, CRMFunnel, CRMStage } from "@/hooks/use-crm";
import { Zap, ChevronDown, ChevronUp, Clock, ArrowRight, Loader2, Trash2, Calendar } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

interface StageAutomationEditorProps {
  stage: CRMStage;
  allStages: CRMStage[];
  funnelId?: string;
}

export function StageAutomationEditor({ stage, allStages, funnelId }: StageAutomationEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<StageAutomation> & { schedule_days?: number[]; schedule_start_time?: string; schedule_end_time?: string }>({
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
  });

  const { data: existingAutomation, isLoading: loadingAutomation } = useStageAutomation(stage.id || null);
  const { saveAutomation, deleteAutomation } = useStageAutomationMutations();
  const { data: funnels } = useCRMFunnels();
  
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const { getFlows } = useFlows();

  // Load flows
  useEffect(() => {
    async function loadFlows() {
      setLoadingFlows(true);
      const result = await getFlows();
      setFlows(result.filter(f => f.is_active));
      setLoadingFlows(false);
    }
    if (isOpen) {
      loadFlows();
    }
  }, [isOpen, getFlows]);

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
      });
    }
  }, [existingAutomation]);

  // Get stages for fallback funnel
  const fallbackFunnel = funnels?.find(f => f.id === localConfig.fallback_funnel_id);
  const [fallbackStages, setFallbackStages] = useState<CRMStage[]>([]);

  useEffect(() => {
    if (localConfig.fallback_funnel_id && fallbackFunnel) {
      setFallbackStages([]);
    }
  }, [localConfig.fallback_funnel_id, fallbackFunnel]);

  // Filter stages that come after current stage (for next_stage_id)
  const nextStageOptions = allStages.filter(s => 
    s.id !== stage.id && s.position > stage.position && !s.is_final
  );

  const toggleDay = (day: number) => {
    const days = localConfig.schedule_days || [1, 2, 3, 4, 5];
    setLocalConfig(prev => ({
      ...prev,
      schedule_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort()
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
    });
  };

  const hasAutomation = existingAutomation || localConfig.flow_id;

  if (stage.is_final) {
    return null; // Final stages don't have automation
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between mt-2 h-8">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3" />
            <span className="text-xs">Automação</span>
            {hasAutomation && (
              <Badge variant={existingAutomation?.is_active ? "default" : "secondary"} className="text-[10px] h-4">
                {existingAutomation?.is_active ? "Ativo" : "Inativo"}
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
              {/* Flow Selection */}
              <div className="space-y-1">
                <Label className="text-xs">Fluxo de automação</Label>
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

              {/* Wait Time */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tempo de espera (horas)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={localConfig.wait_hours}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, wait_hours: Number(e.target.value) }))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se não houver resposta em {localConfig.wait_hours}h, move para próxima etapa
                </p>
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
              </div>

              {/* Next Stage */}
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

              {/* Fallback Funnel (only if no next stage) */}
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
