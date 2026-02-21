import { CRMDeal, CRMStage, useCRMDealMutations } from "@/hooks/use-crm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Building2, User, Clock, ChevronRight, Trophy, XCircle, Pause, DollarSign } from "lucide-react";
import { differenceInHours, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PipelineViewProps {
  stages: CRMStage[];
  dealsByStage: Record<string, CRMDeal[]>;
  onDealClick: (deal: CRMDeal) => void;
  onStatusChange?: (dealId: string, status: 'won' | 'lost' | 'paused' | 'open') => void;
  newWinDealId?: string | null;
}

export function PipelineView({ stages, dealsByStage, onDealClick, onStatusChange, newWinDealId }: PipelineViewProps) {
  const { moveDeal } = useCRMDealMutations();

  // Flatten all deals into a single list with stage info
  const allDeals = stages.flatMap(stage => {
    const deals = dealsByStage[stage.id!] || [];
    return deals.map(deal => ({ ...deal, stageName: stage.name, stageColor: stage.color }));
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusStyles = (deal: CRMDeal) => {
    if (deal.status === 'won') return "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20";
    if (deal.status === 'lost') return "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    if (deal.status === 'paused') return "border-l-4 border-l-gray-400 bg-gray-100/50 dark:bg-gray-800/50 opacity-70";
    return "border-l-4";
  };

  const getStatusIcon = (status: string) => {
    if (status === 'won') return <Trophy className="h-4 w-4 text-green-500" />;
    if (status === 'lost') return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'paused') return <Pause className="h-4 w-4 text-gray-500" />;
    return null;
  };

  return (
    <ScrollArea className="h-full" role="region" aria-label="Lista de negociações">
      <div className="p-4 space-y-2" role="list">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b" role="row" aria-hidden="true">
          <div className="col-span-3">Título</div>
          <div className="col-span-2">Empresa</div>
          <div className="col-span-2">Etapa</div>
          <div className="col-span-1 text-right">Valor</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1">Responsável</div>
          <div className="col-span-2">Última atividade</div>
        </div>

        {/* Deals list */}
        {allDeals.map((deal) => {
          const hoursInactive = differenceInHours(new Date(), parseISO(deal.last_activity_at));
          const isNewWin = newWinDealId === deal.id;

          return (
            <Card
              key={deal.id}
              role="listitem"
              aria-label={`${deal.title}, ${formatCurrency(deal.value)}, etapa ${deal.stageName}`}
              onClick={() => onDealClick(deal)}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer hover:shadow-md transition-all items-center",
                getStatusStyles(deal),
                isNewWin && "animate-scale-in ring-2 ring-green-500"
              )}
              style={{ borderLeftColor: deal.stageColor }}
            >
              {/* Title */}
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(deal.status)}
                  <span className={cn(
                    "font-medium text-sm truncate",
                    deal.status === 'paused' && "text-muted-foreground"
                  )}>
                    {deal.title}
                  </span>
                </div>
              </div>

              {/* Company */}
              <div className="col-span-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{deal.company_name}</span>
              </div>

              {/* Stage */}
              <div className="col-span-2">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: deal.stageColor, color: deal.stageColor }}
                >
                  {deal.stageName}
                </Badge>
              </div>

              {/* Value */}
              <div className="col-span-1 text-right">
                <Badge variant="secondary" className={cn(
                  "text-xs",
                  deal.status === 'won' && "bg-green-100 text-green-700",
                  deal.status === 'lost' && "bg-red-100 text-red-700 line-through"
                )}>
                  {formatCurrency(deal.value)}
                </Badge>
              </div>

              {/* Status */}
              <div className="col-span-1 flex justify-center">
                {deal.status === 'won' && (
                  <Badge className="bg-green-500 text-white text-[10px]">Ganho</Badge>
                )}
                {deal.status === 'lost' && (
                  <Badge className="bg-red-500 text-white text-[10px]">Perdido</Badge>
                )}
                {deal.status === 'paused' && (
                  <Badge className="bg-gray-500 text-white text-[10px]">Pausado</Badge>
                )}
                {deal.status === 'open' && (
                  <Badge variant="outline" className="text-[10px]">Em aberto</Badge>
                )}
              </div>

              {/* Owner */}
              <div className="col-span-1">
                {deal.owner_name ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                      {deal.owner_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-muted-foreground truncate hidden xl:block">
                      {deal.owner_name.split(' ')[0]}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>

              {/* Last activity */}
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(parseISO(deal.last_activity_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                <span className="text-muted-foreground/50">({hoursInactive}h)</span>
              </div>
            </Card>
          );
        })}

        {allDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma negociação encontrada</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
