import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, TrendingUp, AlertCircle, CheckCircle2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GhostSummary } from "@/hooks/use-ghost-analysis";

const categoryLabels: Record<string, string> = {
  off_topic: "Fora do Foco",
  deal_risk: "Risco",
  slow_response: "Lento",
  no_followup: "Sem Follow-up",
  sentiment_negative: "Negativo",
  opportunity: "Oportunidade",
};

export function ExtraMetricsPanel({ summary }: { summary: GhostSummary }) {
  const { avg_response_times, peak_hours, critical_clients, resolution_rate } = summary;

  const hasAny = (avg_response_times?.length || 0) > 0 ||
    (peak_hours?.length || 0) > 0 ||
    (critical_clients?.length || 0) > 0 ||
    resolution_rate !== undefined;

  if (!hasAny) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Resolution Rate */}
      {resolution_rate !== undefined && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Taxa de Resolução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray={`${resolution_rate}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
                  {resolution_rate}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Das conversas analisadas, {resolution_rate}% foram resolvidas ou finalizadas.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avg Response Times */}
      {avg_response_times && avg_response_times.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              Tempo Médio de Resposta
            </CardTitle>
            <CardDescription>Minutos entre mensagem do cliente e resposta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {avg_response_times.map((rt) => (
              <div key={rt.user_name} className="flex items-center gap-3">
                <span className="text-sm font-medium w-28 truncate">{rt.user_name}</span>
                <Progress value={Math.min(100, (rt.avg_minutes / 60) * 100)} className="flex-1 h-2" />
                <span className={cn(
                  "text-sm font-bold w-16 text-right",
                  rt.avg_minutes <= 5 ? "text-green-500" :
                  rt.avg_minutes <= 15 ? "text-yellow-500" : "text-destructive"
                )}>
                  {rt.avg_minutes}min
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Peak Hours */}
      {peak_hours && peak_hours.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Horários de Pico de Problemas
            </CardTitle>
            <CardDescription>Quando mais alertas são gerados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 24 }, (_, h) => {
                const entry = peak_hours.find(p => p.hour === h);
                const count = entry?.count || 0;
                const maxCount = Math.max(...peak_hours.map(p => p.count), 1);
                const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
                const isPeak = peak_hours.slice(0, 3).some(p => p.hour === h);
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}h: ${count} alertas`}>
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        isPeak ? "bg-destructive" : count > 0 ? "bg-primary/60" : "bg-muted"
                      )}
                      style={{ height: `${height}%` }}
                    />
                    {h % 4 === 0 && (
                      <span className="text-[9px] text-muted-foreground">{h}h</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {peak_hours.slice(0, 3).map(p => (
                <Badge key={p.hour} variant="destructive" className="text-xs">
                  {p.hour}h-{p.hour + 1}h • {p.count} alertas
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Clients */}
      {critical_clients && critical_clients.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Clientes Mais Críticos
            </CardTitle>
            <CardDescription>Ranking por quantidade de alertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {critical_clients.slice(0, 5).map((client, idx) => (
              <div key={client.phone || idx} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                    idx === 0 ? "bg-destructive text-destructive-foreground" :
                    idx < 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium truncate">{client.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-1">
                    {client.categories.slice(0, 3).map(cat => (
                      <Badge key={cat} variant="outline" className="text-[10px] px-1 py-0">
                        {categoryLabels[cat] || cat}
                      </Badge>
                    ))}
                  </div>
                  <Badge variant="destructive" className="text-xs">{client.issues}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
