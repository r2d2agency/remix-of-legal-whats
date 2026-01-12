import { Calendar, CheckCircle2, Clock, AlertCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: string;
  name: string;
  status: "scheduled" | "running" | "completed" | "paused";
  progress: number;
  totalContacts: number;
  sentMessages: number;
  scheduledDate?: string;
}

const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Promoção Black Friday",
    status: "completed",
    progress: 100,
    totalContacts: 1250,
    sentMessages: 1250,
  },
  {
    id: "2",
    name: "Lançamento Novo Produto",
    status: "running",
    progress: 65,
    totalContacts: 800,
    sentMessages: 520,
  },
  {
    id: "3",
    name: "Reativação de Clientes",
    status: "scheduled",
    progress: 0,
    totalContacts: 450,
    sentMessages: 0,
    scheduledDate: "15/01/2026 08:00",
  },
];

const statusConfig = {
  scheduled: {
    icon: Calendar,
    label: "Agendada",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  running: {
    icon: Play,
    label: "Em Execução",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  completed: {
    icon: CheckCircle2,
    label: "Concluída",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  paused: {
    icon: AlertCircle,
    label: "Pausada",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function RecentCampaigns() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-card border border-border animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Campanhas Recentes
        </h3>
        <a
          href="/campanhas"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </a>
      </div>

      <div className="space-y-4">
        {mockCampaigns.map((campaign) => {
          const config = statusConfig[campaign.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={campaign.id}
              className="rounded-lg border border-border p-4 transition-all duration-200 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{campaign.name}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        config.bgColor,
                        config.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                    {campaign.scheduledDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {campaign.scheduledDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {campaign.sentMessages}/{campaign.totalContacts}
                  </p>
                  <p className="text-xs text-muted-foreground">mensagens</p>
                </div>
              </div>
              {campaign.status !== "scheduled" && (
                <div className="mt-3">
                  <Progress value={campaign.progress} className="h-2" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
