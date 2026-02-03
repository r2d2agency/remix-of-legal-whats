import React, { useMemo } from 'react';
import { 
  Lightbulb, 
  Calendar, 
  FileText, 
  MessageSquare, 
  Phone,
  Mail,
  Target,
  Clock,
  AlertTriangle,
  TrendingUp,
  Gift,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';

interface ActionSuggestion {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'follow-up' | 'sales' | 'support' | 'engagement';
  action?: () => void;
}

interface ActionSuggestionsProps {
  messages: ChatMessage[];
  conversationData?: {
    lastMessageAt?: string;
    attendanceStatus?: string;
    tags?: { name: string }[];
  };
  onScheduleMessage?: () => void;
  onScheduleMeeting?: () => void;
  onOpenCRM?: () => void;
  onSendQuickReply?: () => void;
  compact?: boolean;
}

// Padrões de contexto para análise
const CONTEXT_PATTERNS = {
  // Interesse de compra
  buyingIntent: [
    'preço', 'valor', 'quanto custa', 'orçamento', 'proposta',
    'comprar', 'adquirir', 'contratar', 'fechar', 'negócio',
    'desconto', 'condições', 'pagamento', 'parcelamento'
  ],
  // Dúvidas técnicas
  technicalQuestions: [
    'como funciona', 'como usar', 'dúvida', 'não entendi',
    'problema', 'erro', 'não consigo', 'ajuda', 'suporte'
  ],
  // Urgência
  urgency: [
    'urgente', 'rápido', 'hoje', 'agora', 'imediato',
    'prazo', 'deadline', 'preciso logo'
  ],
  // Interesse em reunião
  meetingIntent: [
    'reunião', 'call', 'conversar', 'apresentação',
    'demonstração', 'demo', 'agendar', 'marcar'
  ],
  // Reclamação
  complaint: [
    'insatisfeito', 'reclamação', 'problema', 'péssimo',
    'horrível', 'cancelar', 'devolver', 'estorno'
  ],
  // Elogio/Satisfação
  satisfaction: [
    'obrigado', 'excelente', 'ótimo', 'parabéns',
    'satisfeito', 'recomendo', 'adorei', 'perfeito'
  ],
  // Pedido de informação
  infoRequest: [
    'informação', 'detalhes', 'mais sobre', 'me fala',
    'gostaria de saber', 'pode explicar', 'documentação'
  ]
};

function analyzeConversationContext(messages: ChatMessage[]) {
  // Pegar apenas mensagens do cliente (não from_me)
  const customerMessages = messages
    .filter(m => !m.from_me && m.content)
    .slice(-15); // Últimas 15 mensagens do cliente
  
  const allText = customerMessages
    .map(m => m.content?.toLowerCase() || '')
    .join(' ');
  
  const context = {
    buyingIntent: 0,
    technicalQuestions: 0,
    urgency: 0,
    meetingIntent: 0,
    complaint: 0,
    satisfaction: 0,
    infoRequest: 0,
    messageCount: customerMessages.length,
    avgResponseTime: 0,
    lastMessageAge: 0,
    hasMedia: messages.some(m => m.media_url),
    hasQuestions: allText.includes('?')
  };
  
  // Contar padrões
  Object.entries(CONTEXT_PATTERNS).forEach(([key, patterns]) => {
    patterns.forEach(pattern => {
      if (allText.includes(pattern)) {
        context[key as keyof typeof CONTEXT_PATTERNS]++;
      }
    });
  });
  
  // Calcular idade da última mensagem do cliente
  const lastCustomerMessage = customerMessages[customerMessages.length - 1];
  if (lastCustomerMessage) {
    const lastTime = new Date(lastCustomerMessage.timestamp).getTime();
    context.lastMessageAge = Date.now() - lastTime;
  }
  
  return context;
}

function generateSuggestions(
  context: ReturnType<typeof analyzeConversationContext>,
  conversationData?: ActionSuggestionsProps['conversationData'],
  callbacks?: {
    onScheduleMessage?: () => void;
    onScheduleMeeting?: () => void;
    onOpenCRM?: () => void;
    onSendQuickReply?: () => void;
  }
): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];
  
  // Análise de tempo sem resposta
  const hoursWithoutResponse = context.lastMessageAge / (1000 * 60 * 60);
  
  // 1. Follow-up por inatividade
  if (hoursWithoutResponse > 24 && hoursWithoutResponse < 72) {
    suggestions.push({
      id: 'follow-up-24h',
      icon: <Clock className="h-4 w-4" />,
      title: 'Fazer follow-up',
      description: `Cliente sem resposta há ${Math.floor(hoursWithoutResponse)}h`,
      priority: 'high',
      category: 'follow-up',
      action: callbacks?.onScheduleMessage
    });
  } else if (hoursWithoutResponse >= 72) {
    suggestions.push({
      id: 'follow-up-72h',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'Follow-up urgente',
      description: 'Cliente inativo há mais de 3 dias',
      priority: 'high',
      category: 'follow-up',
      action: callbacks?.onScheduleMessage
    });
  }
  
  // 2. Interesse de compra detectado
  if (context.buyingIntent >= 2) {
    suggestions.push({
      id: 'send-proposal',
      icon: <FileText className="h-4 w-4" />,
      title: 'Enviar proposta',
      description: 'Cliente demonstrou interesse em valores',
      priority: 'high',
      category: 'sales',
      action: callbacks?.onSendQuickReply
    });
    
    suggestions.push({
      id: 'create-deal',
      icon: <Target className="h-4 w-4" />,
      title: 'Criar negociação',
      description: 'Oportunidade de venda identificada',
      priority: 'high',
      category: 'sales',
      action: callbacks?.onOpenCRM
    });
  }
  
  // 3. Interesse em reunião
  if (context.meetingIntent >= 1) {
    suggestions.push({
      id: 'schedule-meeting',
      icon: <Calendar className="h-4 w-4" />,
      title: 'Agendar reunião',
      description: 'Cliente mencionou interesse em conversar',
      priority: 'high',
      category: 'engagement',
      action: callbacks?.onScheduleMeeting
    });
  }
  
  // 4. Dúvidas técnicas
  if (context.technicalQuestions >= 2) {
    suggestions.push({
      id: 'send-docs',
      icon: <FileText className="h-4 w-4" />,
      title: 'Enviar documentação',
      description: 'Cliente tem dúvidas técnicas',
      priority: 'medium',
      category: 'support'
    });
  }
  
  // 5. Urgência detectada
  if (context.urgency >= 1) {
    suggestions.push({
      id: 'priority-response',
      icon: <Phone className="h-4 w-4" />,
      title: 'Ligar para cliente',
      description: 'Demanda urgente detectada',
      priority: 'high',
      category: 'support'
    });
  }
  
  // 6. Reclamação detectada
  if (context.complaint >= 1) {
    suggestions.push({
      id: 'handle-complaint',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'Tratar reclamação',
      description: 'Cliente insatisfeito - priorizar atendimento',
      priority: 'high',
      category: 'support'
    });
  }
  
  // 7. Cliente satisfeito - oportunidade
  if (context.satisfaction >= 2 && context.complaint === 0) {
    suggestions.push({
      id: 'upsell',
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'Oferecer upgrade',
      description: 'Cliente satisfeito - oportunidade de upsell',
      priority: 'medium',
      category: 'sales'
    });
    
    suggestions.push({
      id: 'request-referral',
      icon: <Gift className="h-4 w-4" />,
      title: 'Pedir indicação',
      description: 'Cliente feliz pode indicar outros',
      priority: 'low',
      category: 'sales'
    });
  }
  
  // 8. Pedido de informação
  if (context.infoRequest >= 1 && suggestions.length < 3) {
    suggestions.push({
      id: 'send-info',
      icon: <Mail className="h-4 w-4" />,
      title: 'Enviar material',
      description: 'Cliente pediu mais informações',
      priority: 'medium',
      category: 'engagement',
      action: callbacks?.onSendQuickReply
    });
  }
  
  // 9. Muitas mensagens = engajamento alto
  if (context.messageCount > 10 && suggestions.length < 4) {
    suggestions.push({
      id: 'high-engagement',
      icon: <MessageSquare className="h-4 w-4" />,
      title: 'Lead engajado',
      description: 'Alta interação - priorizar atendimento',
      priority: 'medium',
      category: 'engagement'
    });
  }
  
  // Ordenar por prioridade
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  // Retornar no máximo 4 sugestões
  return suggestions.slice(0, 4);
}

export function ActionSuggestions({
  messages,
  conversationData,
  onScheduleMessage,
  onScheduleMeeting,
  onOpenCRM,
  onSendQuickReply,
  compact = false
}: ActionSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (messages.length < 3) return [];
    
    const context = analyzeConversationContext(messages);
    return generateSuggestions(context, conversationData, {
      onScheduleMessage,
      onScheduleMeeting,
      onOpenCRM,
      onSendQuickReply
    });
  }, [messages, conversationData, onScheduleMessage, onScheduleMeeting, onOpenCRM, onSendQuickReply]);
  
  if (suggestions.length === 0) return null;
  
  const priorityColors = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-warning/10 text-warning border-warning/20',
    low: 'bg-muted text-muted-foreground border-border'
  };
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
        {suggestions.slice(0, 2).map(suggestion => (
          <Button
            key={suggestion.id}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs gap-1.5 shrink-0",
              suggestion.priority === 'high' && "text-destructive"
            )}
            onClick={suggestion.action}
          >
            {suggestion.icon}
            {suggestion.title}
          </Button>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lightbulb className="h-4 w-4 text-primary" />
        <span>Sugestões de Ação</span>
        <Badge variant="secondary" className="text-[10px] h-4">
          IA
        </Badge>
      </div>
      
      <div className="space-y-1.5">
        {suggestions.map(suggestion => (
          <div
            key={suggestion.id}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
              priorityColors[suggestion.priority]
            )}
            onClick={suggestion.action}
          >
            <div className="shrink-0">
              {suggestion.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{suggestion.title}</p>
              <p className="text-xs opacity-70 truncate">{suggestion.description}</p>
            </div>
            {suggestion.action && (
              <ChevronRight className="h-4 w-4 opacity-50 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
