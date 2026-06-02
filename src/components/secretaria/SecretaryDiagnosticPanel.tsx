import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Trash2, Activity, AlertCircle, CheckCircle2, Clock, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { useGroupSecretary, type DiagnosticEvent } from "@/hooks/use-group-secretary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STAGE_LABELS: Record<string, string> = {
  webhook_received: "Webhook recebido",
  skipped: "Ignorado",
  ai_called: "IA chamada",
  detected: "Detectado",
  no_detection: "Sem detecção",
  error: "Erro",
  completed: "Concluído",
};

const STAGE_ICONS: Record<string, JSX.Element> = {
  webhook_received: <Activity className="h-3.5 w-3.5" />,
  skipped: <Clock className="h-3.5 w-3.5" />,
  ai_called: <RefreshCw className="h-3.5 w-3.5" />,
  detected: <CheckCircle2 className="h-3.5 w-3.5" />,
  no_detection: <XCircle className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />,
};

function levelVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "error") return "destructive";
  if (level === "warn") return "secondary";
  return "outline";
}

export default function SecretaryDiagnosticPanel() {
  const { getDiagnosticEvents, clearDiagnosticEvents } = useGroupSecretary();
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<DiagnosticEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDiagnosticEvents({
        provider: providerFilter !== "all" ? providerFilter : undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        limit: 300,
      });
      setEvents(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar eventos");
    } finally {
      setLoading(false);
    }
  }, [getDiagnosticEvents, providerFilter, stageFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const handleClear = async () => {
    if (!confirm("Limpar todos os eventos de diagnóstico desta organização?")) return;
    try {
      await clearDiagnosticEvents();
      toast.success("Eventos limpos");
      setEvents([]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao limpar");
    }
  };

  const counts = events.reduce(
    (acc, e) => {
      acc.total++;
      if (e.stage === "detected") acc.detected++;
      if (e.level === "error") acc.errors++;
      if (e.stage === "skipped") acc.skipped++;
      return acc;
    },
    { total: 0, detected: 0, errors: 0, skipped: 0 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Auditoria da Secretária IA
          </CardTitle>
          <CardDescription>
            Eventos em tempo real do pipeline de análise de grupos (UAZAPI, W-API, Evolution). Buffer em memória dos últimos 500 eventos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-semibold">{counts.total}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Detecções</div><div className="text-xl font-semibold text-green-600">{counts.detected}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Ignorados</div><div className="text-xl font-semibold text-amber-600">{counts.skipped}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Erros</div><div className="text-xl font-semibold text-destructive">{counts.errors}</div></CardContent></Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos provedores</SelectItem>
                <SelectItem value="uazapi">UAZAPI</SelectItem>
                <SelectItem value="wapi">W-API</SelectItem>
                <SelectItem value="evolution">Evolution</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estágios</SelectItem>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              Auto {autoRefresh ? "ON" : "OFF"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          </div>

          <ScrollArea className="h-[480px] border rounded-md">
            <div className="divide-y">
              {events.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum evento registrado ainda. Envie uma mensagem em um grupo monitorado para ver o pipeline aqui.
                </div>
              )}
              {events.map((e) => (
                <div key={e.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={levelVariant(e.level)} className="gap-1">
                          {STAGE_ICONS[e.stage] || <Activity className="h-3.5 w-3.5" />}
                          {STAGE_LABELS[e.stage] || e.stage}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">{e.provider}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.timestamp).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-sm font-medium truncate">{e.message || "—"}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {e.groupName && <span>📱 {e.groupName}</span>}
                        {e.senderName && <span>👤 {e.senderName}</span>}
                        {e.messageId && <span className="font-mono">🆔 {e.messageId.slice(0, 24)}</span>}
                      </div>
                      {e.error && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded p-1.5 mt-1 font-mono break-all">
                          {e.error}
                        </div>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setSelected(e)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && STAGE_ICONS[selected.stage]}
              Detalhes do evento
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Estágio:</span> <strong>{STAGE_LABELS[selected.stage] || selected.stage}</strong></div>
                <div><span className="text-muted-foreground">Nível:</span> <Badge variant={levelVariant(selected.level)}>{selected.level}</Badge></div>
                <div><span className="text-muted-foreground">Provedor:</span> {selected.provider}</div>
                <div><span className="text-muted-foreground">Horário:</span> {new Date(selected.timestamp).toLocaleString("pt-BR")}</div>
                {selected.messageId && <div className="col-span-2 break-all"><span className="text-muted-foreground">Message ID:</span> <code className="text-xs">{selected.messageId}</code></div>}
                {selected.conversationId && <div className="col-span-2 break-all"><span className="text-muted-foreground">Conversa:</span> <code className="text-xs">{selected.conversationId}</code></div>}
                {selected.groupName && <div><span className="text-muted-foreground">Grupo:</span> {selected.groupName}</div>}
                {selected.senderName && <div><span className="text-muted-foreground">Remetente:</span> {selected.senderName}</div>}
              </div>
              {selected.message && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mensagem</div>
                  <div className="bg-muted rounded p-2 text-xs">{selected.message}</div>
                </div>
              )}
              {selected.error && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Erro</div>
                  <pre className="bg-destructive/10 text-destructive rounded p-2 text-xs whitespace-pre-wrap break-all">{selected.error}</pre>
                </div>
              )}
              {selected.details && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Detalhes</div>
                  <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">{JSON.stringify(selected.details, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}