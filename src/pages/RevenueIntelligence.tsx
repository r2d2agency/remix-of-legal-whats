import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  Users,
  Loader2,
  Brain,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useRevenueForecast,
  usePipelineVelocity,
  useWinLossAnalysis,
} from "@/hooks/use-crm-reports";
import {
  useCRMFunnels,
} from "@/hooks/use-crm";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
} from "recharts";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(142 76% 36%)",
  danger: "hsl(0 84% 60%)",
  warning: "hsl(38 92% 50%)",
  muted: "hsl(var(--muted-foreground))",
};

export default function RevenueIntelligence() {
  const [selectedFunnel, setSelectedFunnel] = useState<string | undefined>();

  const { data: forecast, isLoading: loadingForecast } = useRevenueForecast(6);
  const { data: velocity, isLoading: loadingVelocity } = usePipelineVelocity(selectedFunnel);
  const { data: winLoss, isLoading: loadingWinLoss } = useWinLossAnalysis({ funnelId: selectedFunnel });
  const { data: funnels } = useCRMFunnels();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatMonth = (monthStr: string) => {
    try {
      if (!monthStr || typeof monthStr !== 'string') return String(monthStr || '');
      const parts = monthStr.split('-');
      if (parts.length < 2) return monthStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const date = new Date(year, month, 1);
      if (isNaN(date.getTime())) return monthStr;
      return format(date, "MMM/yy", { locale: ptBR });
    } catch {
      return String(monthStr || '');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Revenue Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Previsão de receita, velocidade do pipeline e análise de ganhos/perdas
            </p>
          </div>
          <Select value={selectedFunnel || "all"} onValueChange={(v) => setSelectedFunnel(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os funis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Funis</SelectItem>
              {funnels?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="forecast" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="forecast" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Previsão
            </TabsTrigger>
            <TabsTrigger value="velocity" className="gap-2">
              <Gauge className="h-4 w-4" />
              Velocidade
            </TabsTrigger>
            <TabsTrigger value="winloss" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Win/Loss
            </TabsTrigger>
          </TabsList>

          {/* ==================== FORECAST TAB ==================== */}
          <TabsContent value="forecast" className="space-y-6">
            {loadingForecast ? (
              <LoadingState />
            ) : (
              <>
                {/* KPIs */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pipeline Atual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(forecast?.current_pipeline_value || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valor total em negociação
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ticket Médio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(forecast?.avg_deal_value || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Por negócio ganho
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ciclo de Vendas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Math.round(forecast?.avg_days_to_close || 0)} dias
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Média até fechar
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Previsão 3 meses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(
                          (forecast?.forecast || []).slice(0, 3).reduce((sum, f) => sum + f.projected, 0)
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Receita projetada
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Forecast Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Previsão de Receita</CardTitle>
                    <CardDescription>
                      Projeção para os próximos meses com cenários otimista e pessimista
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecast?.forecast || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" tickFormatter={formatMonth} className="text-xs" />
                          <YAxis
                            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                            className="text-xs"
                          />
                          <Tooltip
                            formatter={(v: number) => formatCurrency(v)}
                            labelFormatter={formatMonth}
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="optimistic"
                            name="Otimista"
                            stroke={CHART_COLORS.success}
                            fill={CHART_COLORS.success}
                            fillOpacity={0.1}
                            strokeDasharray="5 5"
                          />
                          <Area
                            type="monotone"
                            dataKey="projected"
                            name="Projetado"
                            stroke={CHART_COLORS.primary}
                            fill={CHART_COLORS.primary}
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="pessimistic"
                            name="Pessimista"
                            stroke={CHART_COLORS.danger}
                            fill={CHART_COLORS.danger}
                            fillOpacity={0.1}
                            strokeDasharray="5 5"
                          />
                          <Legend />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Confidence Indicators */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Nível de Confiança</div>
                      <div className="flex gap-4">
                        {(forecast?.forecast || []).slice(0, 4).map((f) => (
                          <div key={f.month} className="flex-1">
                            <div className="text-xs text-muted-foreground mb-1">
                              {formatMonth(f.month)}
                            </div>
                            <Progress value={f.confidence} className="h-2" />
                            <div className="text-xs mt-1">{f.confidence}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Historical Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Histórico de Vendas</CardTitle>
                    <CardDescription>Receita mensal dos últimos 12 meses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={forecast?.historical_wins || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(v) => formatMonth(v)}
                            className="text-xs"
                          />
                          <YAxis
                            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                            className="text-xs"
                          />
                          <Tooltip
                            formatter={(v: number, name) => [
                              name === "won_value" ? formatCurrency(v) : v,
                              name === "won_value" ? "Receita" : "Negócios",
                            ]}
                            labelFormatter={(v) => formatMonth(v)}
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="won_value" name="Receita" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ==================== VELOCITY TAB ==================== */}
          <TabsContent value="velocity" className="space-y-6">
            {loadingVelocity ? (
              <LoadingState />
            ) : (
              <>
                {/* Velocity Score */}
                <div className="grid gap-4 md:grid-cols-5">
                  <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Velocidade do Pipeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-primary">
                        {formatCurrency(velocity?.velocity || 0)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Receita potencial por dia
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-sm">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-muted-foreground">
                          = (Deals × Ticket × Win Rate) / Ciclo
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Negócios Abertos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{velocity?.metrics.open_deals || 0}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Win Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {velocity?.metrics.win_rate || 0}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ciclo Médio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {velocity?.metrics.avg_cycle_days || 0} dias
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Stage Funnel */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Conversão por Etapa</CardTitle>
                      <CardDescription>Taxa de conversão em cada estágio do funil</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(velocity?.stage_conversion || []).map((stage, idx, arr) => (
                          <div key={stage.stage_id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{stage.stage_name}</span>
                              <span className="text-sm text-muted-foreground">
                                {stage.deals_entered} deals → {stage.conversion_rate || 0}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={stage.conversion_rate || 0}
                                className="h-3 flex-1"
                              />
                              {idx < arr.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tempo por Etapa</CardTitle>
                      <CardDescription>Dias médios em cada estágio</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={velocity?.stage_time || []}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis
                              type="category"
                              dataKey="stage_name"
                              width={100}
                              className="text-xs"
                            />
                            <Tooltip
                              formatter={(v: number) => [`${Math.round(v)} dias`, "Tempo médio"]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar
                              dataKey="avg_days_in_stage"
                              fill={CHART_COLORS.primary}
                              radius={[0, 4, 4, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ==================== WIN/LOSS TAB ==================== */}
          <TabsContent value="winloss" className="space-y-6">
            {loadingWinLoss ? (
              <LoadingState />
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Ganhos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {winLoss?.summary.won.count || 0}
                      </div>
                      <p className="text-sm text-green-600/70">
                        {formatCurrency(winLoss?.summary.won.total_value || 0)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Perdidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                        {winLoss?.summary.lost.count || 0}
                      </div>
                      <p className="text-sm text-red-600/70">
                        {formatCurrency(winLoss?.summary.lost.total_value || 0)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Win Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {winLoss?.summary.win_rate || 0}%
                      </div>
                      <Progress value={winLoss?.summary.win_rate || 0} className="h-2 mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ticket Médio (Ganho)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(winLoss?.summary.won.avg_value || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ~{winLoss?.summary.won.avg_days || 0} dias para fechar
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Win/Loss Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tendência Win/Loss</CardTitle>
                      <CardDescription>Evolução mensal de ganhos e perdas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={winLoss?.trend || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey="month"
                              tickFormatter={(v) => formatMonth(v)}
                              className="text-xs"
                            />
                            <YAxis className="text-xs" />
                            <Tooltip
                              labelFormatter={(v) => formatMonth(v)}
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="won_count" name="Ganhos" fill={CHART_COLORS.success} />
                            <Bar dataKey="lost_count" name="Perdidos" fill={CHART_COLORS.danger} />
                            <Legend />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Loss Reasons */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Motivos de Perda
                      </CardTitle>
                      <CardDescription>Principais razões para negócios perdidos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(winLoss?.loss_reasons || []).length > 0 ? (
                        <div className="space-y-3">
                          {winLoss?.loss_reasons.map((reason, idx) => {
                            const total = winLoss.loss_reasons.reduce((s, r) => s + r.count, 0);
                            const pct = total > 0 ? (reason.count / total) * 100 : 0;
                            return (
                              <div key={idx}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span>{reason.reason}</span>
                                  <span className="text-muted-foreground">
                                    {reason.count} ({pct.toFixed(0)}%)
                                  </span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum motivo registrado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* By Owner and Segment */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* By Owner */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Performance por Vendedor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[250px]">
                        <div className="space-y-3">
                          {(winLoss?.by_owner || []).map((owner) => (
                            <div
                              key={owner.user_id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div>
                                <div className="font-medium">{owner.user_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {owner.won_count} ganhos • {owner.lost_count} perdidos
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-green-600">
                                  {formatCurrency(owner.won_value)}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    owner.win_rate >= 50
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  )}
                                >
                                  {owner.win_rate}% win rate
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* By Segment */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4" />
                        Performance por Segmento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(winLoss?.by_segment || []).map((s) => ({
                                name: s.segment,
                                value: s.won_value,
                              }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, percent }) =>
                                `${name} (${(percent * 100).toFixed(0)}%)`
                              }
                            >
                              {(winLoss?.by_segment || []).map((_, idx) => (
                                <Cell
                                  key={idx}
                                  fill={
                                    [
                                      CHART_COLORS.primary,
                                      CHART_COLORS.success,
                                      CHART_COLORS.warning,
                                      CHART_COLORS.danger,
                                      CHART_COLORS.muted,
                                    ][idx % 5]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
