import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { useCRMDealsByPhone as useDealsByPhone } from "@/hooks/use-crm";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useConversationSummary,
  useGenerateSummary,
  getSentimentInfo,
  getResolutionInfo,
  ConversationSummary,
} from "@/hooks/use-conversation-summary";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Clock,
  MessageSquare,
  Target,
  ListChecks,
  Tag,
  CheckCircle,
  AlertCircle,
  XCircle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationSummaryPanelProps {
  conversationId: string;
  className?: string;
  compact?: boolean;
  contactPhone?: string;
}

export function ConversationSummaryPanel({
  conversationId,
  className,
  compact = false,
  contactPhone,
}: ConversationSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const [days, setDays] = useState<string>("2");
  const { data: summary, isLoading } = useConversationSummary(conversationId);
  const generateSummary = useGenerateSummary();

  const triggerGenerate = () =>
    generateSummary.mutate({
      conversationId,
      days: days === "all" ? undefined : parseInt(days, 10),
    });

  if (isLoading) {
    return (
      <Card className={cn("p-4 h-full", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando resumo...</span>
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={cn("p-4 h-full", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm">Sem resumo IA</span>
          </div>
          <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último dia</SelectItem>
              <SelectItem value="2">Últimos 2 dias</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerGenerate}
            disabled={generateSummary.isPending}
          >
            {generateSummary.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Resumo
          </Button>
          </div>
        </div>
      </Card>
    );
  }

  const sentimentInfo = getSentimentInfo(summary.customer_sentiment);
  const resolutionInfo = getResolutionInfo(summary.resolution_status);

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className={cn("overflow-hidden", className)}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Resumo IA</span>
                <Badge variant="secondary" className={cn("text-xs", sentimentInfo.color)}>
                  {sentimentInfo.emoji} {sentimentInfo.label}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            <SummaryContent summary={summary} onRegenerate={triggerGenerate} isRegenerating={generateSummary.isPending} contactPhone={contactPhone} fillHeight={false} />
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className={cn("overflow-hidden h-full flex flex-col", className)}>
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium">Resumo IA</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-xs", sentimentInfo.color)}>
            {sentimentInfo.emoji} {sentimentInfo.label}
          </Badge>
          <Badge variant="secondary" className={cn("text-xs", resolutionInfo.color)}>
            {resolutionInfo.label}
          </Badge>
        </div>
      </div>
      <SummaryContent summary={summary} onRegenerate={triggerGenerate} isRegenerating={generateSummary.isPending} contactPhone={contactPhone} fillHeight />
    </Card>
  );
}

interface SummaryContentProps {
  summary: ConversationSummary;
  onRegenerate: () => void;
  isRegenerating: boolean;
  contactPhone?: string;
  fillHeight?: boolean;
}

function SummaryContent({ summary, onRegenerate, isRegenerating, contactPhone, fillHeight }: SummaryContentProps) {
  const resolutionInfo = getResolutionInfo(summary.resolution_status);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const { data: deals = [], isLoading: loadingDeals } = useDealsByPhone(linkOpen ? (contactPhone || null) : null);

  const buildNoteContent = () => {
    const lines = [`📝 Resumo IA da conversa`, '', summary.summary];
    if (summary.key_points?.length) {
      lines.push('', 'Pontos principais:', ...summary.key_points.map(p => `• ${p}`));
    }
    if (summary.action_items?.length) {
      lines.push('', 'Ações pendentes:', ...summary.action_items.map(p => `• ${p}`));
    }
    return lines.join('\n');
  };

  const linkToDeal = async (dealId: string, dealTitle: string) => {
    setLinking(dealId);
    try {
      await api(`/api/crm/deals/${dealId}/history`, {
        method: 'POST',
        body: { action: 'note', notes: buildNoteContent() },
      });
      toast.success(`Resumo anexado em "${dealTitle}"`);
      setLinkOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao vincular resumo');
    } finally {
      setLinking(null);
    }
  };

  return (
    <ScrollArea className={cn(fillHeight ? "flex-1 h-full" : "max-h-[400px]")}>
      <div className="p-4 space-y-4">
        {/* Main Summary */}
        <div>
          <p className="text-sm leading-relaxed">{summary.summary}</p>
        </div>

        {/* Key Points */}
        {summary.key_points && summary.key_points.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Target className="h-3 w-3" />
              Pontos Principais
            </div>
            <ul className="space-y-1">
              {summary.key_points.map((point, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {summary.action_items && summary.action_items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              Ações Pendentes
            </div>
            <ul className="space-y-1">
              {summary.action_items.map((item, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Topics */}
        {summary.topics && summary.topics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              Tópicos
            </div>
            <div className="flex flex-wrap gap-1">
              {summary.topics.map((topic, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Link to CRM deal */}
        {contactPhone && (
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Vincular como anotação no CRM
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="text-xs font-medium px-2 py-1 text-muted-foreground">
                Negociações deste contato
              </div>
              {loadingDeals ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              ) : deals.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  Nenhuma negociação encontrada para este contato.
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-auto">
                  {deals.map((deal: any) => (
                    <button
                      key={deal.id}
                      onClick={() => linkToDeal(deal.id, deal.title)}
                      disabled={linking === deal.id}
                      className="w-full text-left px-2 py-2 rounded hover:bg-muted text-sm flex items-center justify-between gap-2 disabled:opacity-50"
                    >
                      <span className="truncate">{deal.title}</span>
                      {linking === deal.id ? (
                        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                      ) : (
                        <Link2 className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {summary.messages_analyzed} msgs
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {summary.processing_time_ms}ms
            </span>
            <span>
              {format(parseISO(summary.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 text-xs"
          >
            {isRegenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// Compact badge for conversation list
interface SummaryBadgeProps {
  sentiment?: string;
  className?: string;
}

export function SummaryBadge({ sentiment, className }: SummaryBadgeProps) {
  if (!sentiment) return null;
  
  const info = getSentimentInfo(sentiment);
  
  return (
    <Badge 
      variant="secondary" 
      className={cn("text-[10px] px-1.5 py-0", info.color, className)}
    >
      {info.emoji}
    </Badge>
  );
}
