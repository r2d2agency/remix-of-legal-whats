import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { LeadScore, getScoreColorLight, getScoreTrendIcon } from "@/hooks/use-lead-scoring";
import { Flame, Thermometer, Snowflake, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  score?: number;
  label?: 'hot' | 'warm' | 'cold';
  trend?: 'up' | 'down' | 'stable';
  showTrend?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LeadScoreBadge({ 
  score = 0, 
  label = 'cold', 
  trend,
  showTrend = false,
  size = 'sm',
  className 
}: LeadScoreBadgeProps) {
  const getIcon = () => {
    switch (label) {
      case 'hot':
        return <Flame className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'warm':
        return <Thermometer className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'cold':
      default:
        return <Snowflake className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
    }
  };

  const getTrendIcon = () => {
    if (!showTrend || !trend) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getLabel = () => {
    switch (label) {
      case 'hot':
        return 'Quente';
      case 'warm':
        return 'Morno';
      case 'cold':
      default:
        return 'Frio';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary"
            className={cn(
              "flex items-center gap-1 cursor-help",
              getScoreColorLight(label),
              size === 'sm' && "text-[10px] px-1.5 py-0.5",
              size === 'md' && "text-xs px-2 py-1",
              size === 'lg' && "text-sm px-3 py-1.5",
              className
            )}
          >
            {getIcon()}
            <span className="font-medium">{score}</span>
            {showTrend && getTrendIcon()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p><strong>Lead Score:</strong> {score}/100</p>
          <p><strong>Classificação:</strong> {getLabel()}</p>
          {trend && (
            <p><strong>Tendência:</strong> {trend === 'up' ? 'Subindo' : trend === 'down' ? 'Caindo' : 'Estável'}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LeadScoreDetailProps {
  scoreData: LeadScore;
  className?: string;
}

export function LeadScoreDetail({ scoreData, className }: LeadScoreDetailProps) {
  const factors = [
    { label: 'Tempo de Resposta', value: scoreData.score_response_time, color: 'bg-blue-500' },
    { label: 'Engajamento', value: scoreData.score_engagement, color: 'bg-green-500' },
    { label: 'Perfil Completo', value: scoreData.score_profile, color: 'bg-purple-500' },
    { label: 'Valor do Negócio', value: scoreData.score_value, color: 'bg-yellow-500' },
    { label: 'Progresso no Funil', value: scoreData.score_funnel, color: 'bg-pink-500' },
    { label: 'Atividade Recente', value: scoreData.score_recency, color: 'bg-cyan-500' },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LeadScoreBadge 
            score={scoreData.score} 
            label={scoreData.score_label}
            trend={scoreData.score_trend}
            showTrend
            size="lg"
          />
          {scoreData.previous_score !== undefined && scoreData.previous_score !== scoreData.score && (
            <span className="text-xs text-muted-foreground">
              (anterior: {scoreData.previous_score})
            </span>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Detalhamento</h4>
        {factors.map((factor) => (
          <div key={factor.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{factor.label}</span>
              <span className="font-medium">{factor.value}%</span>
            </div>
            <Progress value={factor.value} className="h-1.5" />
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Mensagens:</span>
          <span className="ml-1 font-medium">{scoreData.total_messages}</span>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Perfil:</span>
          <span className="ml-1 font-medium">{scoreData.profile_fields_filled}/{scoreData.profile_fields_total}</span>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <span className="text-muted-foreground">Etapa:</span>
          <span className="ml-1 font-medium">{scoreData.funnel_stages_completed}/{scoreData.funnel_stages_total}</span>
        </div>
      </div>

      {/* AI Insights */}
      {scoreData.ai_summary && (
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
          <h4 className="text-xs font-medium mb-1 flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Insight IA
          </h4>
          <p className="text-xs text-muted-foreground">{scoreData.ai_summary}</p>
          {scoreData.ai_recommended_action && (
            <p className="text-xs mt-2 font-medium text-primary">
              Ação recomendada: {scoreData.ai_recommended_action}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
