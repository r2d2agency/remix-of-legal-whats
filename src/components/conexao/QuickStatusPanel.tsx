import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Wifi,
  WifiOff,
  Clock,
  Copy,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Connection {
  id: string;
  name: string;
  provider?: 'evolution' | 'wapi' | 'meta';
  instance_name?: string | null;
  instance_id?: string | null;
  status: string;
  phone_number?: string | null;
}

interface StatusResult {
  status: string;
  phoneNumber?: string | null;
  provider?: string | null;
  error?: string | null;
  requestId?: string | null;
}

interface Props {
  connection: Connection;
  onConfigureWebhooks?: () => void;
  onOpenFullDiagnostic?: () => void;
}

export function QuickStatusPanel({ connection, onConfigureWebhooks, onOpenFullDiagnostic }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checkDuration, setCheckDuration] = useState<number | null>(null);

  // Detect provider
  const isMeta = connection.provider === 'meta';
  const isWapi = connection.provider === 'wapi' || 
    (!isMeta && !!connection.instance_id && !connection.instance_name);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const result = await api<StatusResult>(`/api/evolution/${connection.id}/status`);
      setStatus(result);
      setLastCheck(new Date());
      setCheckDuration(Date.now() - startTime);
    } catch (error: any) {
      setStatus({
        status: 'error',
        error: error.message || 'Falha na verificação',
      });
      setLastCheck(new Date());
      setCheckDuration(Date.now() - startTime);
    } finally {
      setLoading(false);
    }
  }, [connection.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const isConnected = status?.status === 'connected';
  const hasError = status?.status === 'error' || !!status?.error;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isMeta ? "default" : isWapi ? "secondary" : "outline"} className="text-xs">
            {isMeta ? "Meta API" : isWapi ? "W-API" : "Evolution"}
          </Badge>
          <span className="font-medium">{connection.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkStatus}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status */}
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : hasError ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-500" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className={cn(
              "text-sm font-medium truncate",
              isConnected && "text-green-500",
              hasError && "text-destructive",
              !isConnected && !hasError && "text-amber-500"
            )}>
              {loading ? "Verificando..." : 
               isConnected ? "Conectado" : 
               hasError ? "Erro" : "Desconectado"}
            </p>
          </div>
        </div>

        {/* Phone */}
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Telefone</p>
            <p className="text-sm font-medium truncate">
              {status?.phoneNumber || connection.phone_number || "—"}
            </p>
          </div>
        </div>

        {/* Instance ID (W-API) or Instance Name (Evolution) */}
        <div className="flex items-center gap-2 p-2 rounded bg-muted/50 col-span-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {isWapi ? "Instance ID" : "Instance Name"}
            </p>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-background px-1.5 py-0.5 rounded truncate flex-1">
                {isWapi ? connection.instance_id : connection.instance_name || "—"}
              </code>
              {(isWapi ? connection.instance_id : connection.instance_name) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => copyToClipboard(
                    (isWapi ? connection.instance_id : connection.instance_name) || ""
                  )}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {status?.error && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-destructive">Erro</p>
            <p className="text-xs text-destructive/80 break-words">{status.error}</p>
            {status.requestId && (
              <p className="text-xs text-muted-foreground mt-1">
                Request ID: <code className="text-xs">{status.requestId}</code>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {lastCheck ? (
            <span>
              Verificado em {checkDuration}ms
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onConfigureWebhooks && (
            <Button variant="ghost" size="sm" onClick={onConfigureWebhooks} className="h-6 text-xs">
              <Settings2 className="h-3 w-3 mr-1" />
              Webhooks
            </Button>
          )}
          {onOpenFullDiagnostic && (
            <Button variant="ghost" size="sm" onClick={onOpenFullDiagnostic} className="h-6 text-xs">
              Diagnóstico Completo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
