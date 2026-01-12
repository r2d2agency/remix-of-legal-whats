import { CheckCircle2, XCircle, Loader2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  status: "connected" | "disconnected" | "connecting";
  phoneNumber?: string;
  instanceName?: string;
}

export function ConnectionStatus({
  status,
  phoneNumber,
  instanceName,
}: ConnectionStatusProps) {
  const statusConfig = {
    connected: {
      icon: CheckCircle2,
      label: "Conectado",
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20",
    },
    disconnected: {
      icon: XCircle,
      label: "Desconectado",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
    },
    connecting: {
      icon: Loader2,
      label: "Conectando...",
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-300 animate-fade-in",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            status === "connected" ? "bg-success/20" : "bg-muted"
          )}
        >
          <Smartphone className={cn("h-7 w-7", config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn(
                "h-5 w-5",
                config.color,
                status === "connecting" && "animate-spin"
              )}
            />
            <span className={cn("font-semibold", config.color)}>
              {config.label}
            </span>
          </div>
          {instanceName && (
            <p className="mt-1 text-sm text-muted-foreground">
              Instância: {instanceName}
            </p>
          )}
          {phoneNumber && status === "connected" && (
            <p className="text-sm font-medium text-foreground">{phoneNumber}</p>
          )}
        </div>
      </div>
    </div>
  );
}
