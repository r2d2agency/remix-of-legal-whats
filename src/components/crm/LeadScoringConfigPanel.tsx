import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  useLeadScoringConfig, 
  useUpdateLeadScoringConfig, 
  useLeadScoringStats,
  useRecalculateAllScores,
  LeadScoringConfig 
} from "@/hooks/use-lead-scoring";
import { Flame, Thermometer, Snowflake, TrendingUp, TrendingDown, RefreshCw, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export function LeadScoringConfigPanel() {
  const { data: config, isLoading } = useLeadScoringConfig();
  const { data: stats } = useLeadScoringStats();
  const updateConfig = useUpdateLeadScoringConfig();
  const recalculateAll = useRecalculateAllScores();

  const [localConfig, setLocalConfig] = useState<Partial<LeadScoringConfig> | null>(null);

  const currentConfig = localConfig || config;

  const handleChange = (field: keyof LeadScoringConfig, value: any) => {
    setLocalConfig(prev => ({
      ...(prev || config),
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!localConfig) return;
    try {
      await updateConfig.mutateAsync(localConfig);
      setLocalConfig(null);
    } catch (error) {
      toast.error("Erro ao salvar configuração");
    }
  };

  const handleRecalculateAll = async () => {
    try {
      await recalculateAll.mutateAsync();
    } catch (error) {
      toast.error("Erro ao recalcular scores");
    }
  };

  const totalWeight = 
    (currentConfig?.weight_response_time || 0) +
    (currentConfig?.weight_engagement || 0) +
    (currentConfig?.weight_profile_completeness || 0) +
    (currentConfig?.weight_deal_value || 0) +
    (currentConfig?.weight_funnel_progress || 0) +
    (currentConfig?.weight_recency || 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Lead Scoring
          </CardTitle>
          <CardDescription>
            Pontuação automática de leads baseada em comportamento e engajamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 mb-1">
                <Flame className="h-4 w-4" />
                <span className="text-2xl font-bold">{stats?.hot_count || 0}</span>
              </div>
              <span className="text-xs text-muted-foreground">Leads Quentes</span>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400 mb-1">
                <Thermometer className="h-4 w-4" />
                <span className="text-2xl font-bold">{stats?.warm_count || 0}</span>
              </div>
              <span className="text-xs text-muted-foreground">Leads Mornos</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                <Snowflake className="h-4 w-4" />
                <span className="text-2xl font-bold">{stats?.cold_count || 0}</span>
              </div>
              <span className="text-xs text-muted-foreground">Leads Frios</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold text-green-600">{stats?.trending_up || 0}</span>
                <TrendingDown className="h-4 w-4 text-red-500 ml-2" />
                <span className="text-lg font-bold text-red-600">{stats?.trending_down || 0}</span>
              </div>
              <span className="text-xs text-muted-foreground">Tendências</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Score médio: <span className="font-medium text-foreground">{stats?.avg_score || 0}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRecalculateAll}
              disabled={recalculateAll.isPending}
            >
              {recalculateAll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recalcular Todos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração</CardTitle>
          <CardDescription>
            Ajuste os pesos e limites do scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Lead Scoring Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Habilitar cálculo automático de scores
              </p>
            </div>
            <Switch
              checked={currentConfig?.is_active ?? true}
              onCheckedChange={(v) => handleChange('is_active', v)}
            />
          </div>

          <Separator />

          {/* Thresholds */}
          <div className="space-y-4">
            <h4 className="font-medium">Limites de Classificação</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500">HOT</Badge>
                  <span className="text-sm">≥ {currentConfig?.hot_threshold || 70}</span>
                </div>
                <Slider
                  value={[currentConfig?.hot_threshold || 70]}
                  onValueChange={([v]) => handleChange('hot_threshold', v)}
                  min={50}
                  max={100}
                  step={5}
                  className="w-40"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500">WARM</Badge>
                  <span className="text-sm">≥ {currentConfig?.warm_threshold || 40}</span>
                </div>
                <Slider
                  value={[currentConfig?.warm_threshold || 40]}
                  onValueChange={([v]) => handleChange('warm_threshold', v)}
                  min={20}
                  max={70}
                  step={5}
                  className="w-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500">COLD</Badge>
                <span className="text-sm text-muted-foreground">&lt; {currentConfig?.warm_threshold || 40}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Weights */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Pesos dos Fatores</h4>
              <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
                Total: {totalWeight}%
              </Badge>
            </div>
            
            {totalWeight !== 100 && (
              <p className="text-xs text-destructive">
                ⚠️ Para melhores resultados, o total deve ser 100%
              </p>
            )}

            <div className="space-y-4">
              {[
                { key: 'weight_response_time', label: 'Tempo de Resposta', desc: 'Quão rápido o lead responde' },
                { key: 'weight_engagement', label: 'Engajamento', desc: 'Quantidade de mensagens e interações' },
                { key: 'weight_profile_completeness', label: 'Perfil Completo', desc: 'Dados preenchidos (email, empresa, etc)' },
                { key: 'weight_deal_value', label: 'Valor do Negócio', desc: 'Valor relativo da negociação' },
                { key: 'weight_funnel_progress', label: 'Progresso no Funil', desc: 'Etapa atual vs total de etapas' },
                { key: 'weight_recency', label: 'Atividade Recente', desc: 'Tempo desde última interação' },
              ].map((factor) => (
                <div key={factor.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">{factor.label}</Label>
                      <p className="text-xs text-muted-foreground">{factor.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[(currentConfig as any)?.[factor.key] || 0]}
                        onValueChange={([v]) => handleChange(factor.key as keyof LeadScoringConfig, v)}
                        min={0}
                        max={50}
                        step={5}
                        className="w-32"
                      />
                      <span className="text-sm font-medium w-8 text-right">
                        {(currentConfig as any)?.[factor.key] || 0}%
                      </span>
                    </div>
                  </div>
                  <Progress value={(currentConfig as any)?.[factor.key] || 0} className="h-1" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Auto-update settings */}
          <div className="space-y-4">
            <h4 className="font-medium">Atualização Automática</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Ao receber mensagem</Label>
                <p className="text-xs text-muted-foreground">
                  Recalcular quando o lead enviar mensagem
                </p>
              </div>
              <Switch
                checked={currentConfig?.auto_update_on_message ?? true}
                onCheckedChange={(v) => handleChange('auto_update_on_message', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Ao mudar de etapa</Label>
                <p className="text-xs text-muted-foreground">
                  Recalcular quando a negociação mudar de etapa
                </p>
              </div>
              <Switch
                checked={currentConfig?.auto_update_on_stage_change ?? true}
                onCheckedChange={(v) => handleChange('auto_update_on_stage_change', v)}
              />
            </div>
          </div>

          {/* Save Button */}
          {localConfig && (
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={updateConfig.isPending}>
                {updateConfig.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Configuração
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
