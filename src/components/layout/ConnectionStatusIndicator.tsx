import { useState } from "react";
import { Wifi, WifiOff, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ConnectionStatusIndicator() {
  const [open, setOpen] = useState(false);
  const {
    connections,
    isLoading,
    lastChecked,
    connectedCount,
    totalCount,
    hasConnectedConnection,
    allConnected,
    refresh,
  } = useConnectionStatus({ intervalSeconds: 30 });

  // Don't render if no connections
  if (totalCount === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (isLoading) return "text-muted-foreground";
    if (allConnected) return "text-green-500";
    if (hasConnectedConnection) return "text-yellow-500";
    return "text-destructive";
  };

  const getStatusBgColor = () => {
    if (isLoading) return "bg-muted";
    if (allConnected) return "bg-green-500/10";
    if (hasConnectedConnection) return "bg-yellow-500/10";
    return "bg-destructive/10";
  };

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (hasConnectedConnection) return <Wifi className="h-4 w-4" />;
    return <WifiOff className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (isLoading) return "Verificando...";
    if (allConnected) return `${connectedCount} conectada${connectedCount > 1 ? 's' : ''}`;
    if (hasConnectedConnection) return `${connectedCount}/${totalCount} conectada${connectedCount > 1 ? 's' : ''}`;
    return "Desconectado";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
            "hover:bg-accent cursor-pointer",
            getStatusBgColor()
          )}
        >
          <span className={cn("flex items-center gap-1.5", getStatusColor())}>
            {getStatusIcon()}
            <span className="text-sm font-medium hidden sm:inline">
              {getStatusText()}
            </span>
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Conexões WhatsApp</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refresh()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          {lastChecked && (
            <p className="text-xs text-muted-foreground mt-1">
              Última verificação: {format(lastChecked, "HH:mm:ss", { locale: ptBR })}
            </p>
          )}
        </div>

        <ScrollArea className="max-h-60">
          <div className="p-2 space-y-1">
            {connections.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhuma conexão configurada
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        conn.status === "connected" && "bg-green-500",
                        conn.status === "connecting" && "bg-yellow-500 animate-pulse",
                        conn.status === "disconnected" && "bg-destructive"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{conn.name}</p>
                      {conn.phoneNumber && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conn.phoneNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.provider && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {conn.provider === 'wapi' ? 'W-API' : 'Evolution'}
                      </Badge>
                    )}
                    <Badge
                      variant={conn.status === "connected" ? "default" : "outline"}
                      className={cn(
                        "text-xs",
                        conn.status === "connected" && "bg-green-500 hover:bg-green-600",
                        conn.status === "connecting" && "bg-yellow-500 hover:bg-yellow-600",
                        conn.status === "disconnected" && "text-destructive border-destructive"
                      )}
                    >
                      {conn.status === "connected" && "Conectado"}
                      {conn.status === "connecting" && "Conectando"}
                      {conn.status === "disconnected" && "Offline"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="p-2">
          <p className="text-xs text-center text-muted-foreground">
            Status atualizado automaticamente a cada 30s
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
