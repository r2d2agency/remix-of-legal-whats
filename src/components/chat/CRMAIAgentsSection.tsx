import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bot,
  Loader2,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Send,
  Copy,
  Brain,
  Trophy,
  ClipboardList,
  Zap,
} from "lucide-react";
import { useAIAgents, AIAgent } from "@/hooks/use-ai-agents";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface CRMAIAgentsSectionProps {
  conversationId: string;
  contactPhone: string | null;
  contactName: string | null;
  chatMessages: Array<{ id: string; content: string; sender: string; timestamp: string }>;
  isOpen: boolean;
}

export function CRMAIAgentsSection({
  conversationId,
  contactPhone,
  contactName,
  chatMessages,
  isOpen,
}: CRMAIAgentsSectionProps) {
  const { getAgents } = useAIAgents();
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [activatingAgent, setActivatingAgent] = useState<string | null>(null);

  // AI Consultation
  const [consultAgent, setConsultAgent] = useState<AIAgent | null>(null);
  const [consultPrompt, setConsultPrompt] = useState("");
  const [consultResponse, setConsultResponse] = useState("");
  const [consulting, setConsulting] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadAgents();
    }
  }, [isOpen, conversationId]);

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const data = await getAgents();
      setAiAgents(data.filter(a => a.is_active));
    } catch {
      console.error("Error loading AI agents");
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleActivateAgent = async (agent: AIAgent) => {
    setActivatingAgent(agent.id);
    try {
      await api('/api/ai-agents/' + agent.id + '/sessions', {
        method: 'POST',
        body: { conversation_id: conversationId, contact_phone: contactPhone, contact_name: contactName },
        auth: true,
      });
      toast.success(`Agente "${agent.name}" ativado para esta conversa!`);
    } catch {
      toast.error("Erro ao ativar agente de IA");
    } finally {
      setActivatingAgent(null);
    }
  };

  const handleConsultAgent = async (prompt?: string) => {
    if (!consultAgent) return;
    const actualPrompt = prompt || consultPrompt.trim();
    if (!actualPrompt && !chatMessages.length) return;

    setConsulting(true);
    setConsultResponse("");
    try {
      const data = await api<{ response: string; agent_name: string }>(`/api/ai-agents/${consultAgent.id}/consult`, {
        method: 'POST',
        body: {
          messages: chatMessages.slice(-30).map(m => ({ content: m.content, sender: m.sender })),
          custom_prompt: actualPrompt || undefined,
        },
        auth: true,
      });
      setConsultResponse(data.response || 'Sem resposta');
    } catch {
      toast.error("Erro ao consultar agente de IA");
      setConsultResponse("");
    } finally {
      setConsulting(false);
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(consultResponse);
    toast.success("Resposta copiada!");
  };

  return (
    <AccordionItem value="ai-agents" className="border rounded-lg px-3">
      <AccordionTrigger className="py-2 hover:no-underline">
        <div className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-primary" />
          <span>Agentes IA</span>
          {aiAgents.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{aiAgents.length}</Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        {loadingAgents ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : aiAgents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum agente ativo disponível</p>
        ) : consultAgent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setConsultAgent(null); setConsultResponse(""); setConsultPrompt(""); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs font-medium truncate">{consultAgent.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleConsultAgent("Analise esta conversa e me dê um resumo do que o cliente precisa e sugestões de como proceder.")} disabled={consulting}>
                <Sparkles className="h-3 w-3" />Analisar
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleConsultAgent("Elabore uma resposta profissional e empática para enviar ao cliente baseada no contexto da conversa.")} disabled={consulting}>
                <MessageSquare className="h-3 w-3" />Elaborar resposta
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleConsultAgent("Me ajude a fechar esta negociação. Sugira argumentos de venda, gatilhos mentais e frases de fechamento adequadas ao contexto.")} disabled={consulting}>
                <Trophy className="h-3 w-3" />Ajuda fechamento
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleConsultAgent("Qualifique este lead baseado na conversa. Identifique nível de interesse, urgência, orçamento e próximos passos recomendados.")} disabled={consulting}>
                <ClipboardList className="h-3 w-3" />Qualificar lead
              </Button>
            </div>

            <div className="flex gap-1.5">
              <Textarea
                placeholder="Ou digite sua pergunta..."
                value={consultPrompt}
                onChange={e => setConsultPrompt(e.target.value)}
                rows={2}
                className="resize-none text-xs flex-1"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && consultPrompt.trim()) { e.preventDefault(); handleConsultAgent(); } }}
              />
              <Button size="icon" className="h-auto w-8 flex-shrink-0" onClick={() => handleConsultAgent()} disabled={consulting || !consultPrompt.trim()}>
                {consulting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {consulting && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Analisando conversa...</p>
              </div>
            )}

            {consultResponse && !consulting && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-muted/50 border text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {consultResponse}
                </div>
                <Button variant="outline" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={handleCopyResponse}>
                  <Copy className="h-3 w-3" />Copiar resposta
                </Button>
              </div>
            )}

            <div className="pt-2 border-t">
              <Button size="sm" variant="default" className="w-full h-7 text-[10px] gap-1" onClick={() => handleActivateAgent(consultAgent)} disabled={activatingAgent === consultAgent.id}>
                {activatingAgent === consultAgent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                Ativar atendimento autônomo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {aiAgents.map(agent => (
              <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setConsultAgent(agent)}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  {agent.description && <p className="text-[10px] text-muted-foreground truncate">{agent.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.capabilities.slice(0, 3).map(cap => (
                      <Badge key={cap} variant="outline" className="text-[9px] px-1 py-0">
                        {cap === 'respond_messages' ? 'Respostas' : cap === 'qualify_leads' ? 'Qualificar' : cap === 'create_deals' ? 'Negociações' : cap === 'summarize_history' ? 'Resumos' : cap === 'suggest_actions' ? 'Sugestões' : cap === 'generate_content' ? 'Conteúdo' : cap === 'schedule_meetings' ? 'Reuniões' : cap === 'read_files' ? 'Arquivos' : cap}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Brain className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
