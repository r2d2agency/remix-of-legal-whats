import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import * as Icons from "lucide-react";
import { Sparkles, Loader2, ArrowLeft, Copy, Send } from "lucide-react";
import {
  useCopilotAgents,
  useAgentActions,
  runCopilotAction,
  type CopilotAgent,
} from "@/hooks/use-agent-modes";
import { toast } from "sonner";

interface Props {
  conversationId: string;
  isOpen: boolean;
  onUseResponse?: (text: string) => void;
}

function IconByName({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as any)[name] || Icons.Sparkles;
  return <Cmp className={className} />;
}

export function CRMCopilotsSection({ conversationId, isOpen, onUseResponse }: Props) {
  const { agents, loading, reload } = useCopilotAgents();
  const [selected, setSelected] = useState<CopilotAgent | null>(null);
  const { actions, loading: loadingActions } = useAgentActions(selected?.id);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ title: string; content: string } | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen, reload]);

  const handleRun = async (actionId: string, actionName: string) => {
    if (!selected) return;
    setRunning(actionId);
    try {
      const r = await runCopilotAction(selected.id, actionId, conversationId);
      setOutput({ title: actionName, content: r.content });
      setShowModal(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar copiloto");
    } finally {
      setRunning(null);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output.content);
    toast.success("Copiado!");
  };

  return (
    <>
      <AccordionItem value="copilots" className="border rounded-lg px-3">
        <AccordionTrigger className="py-2 hover:no-underline">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Copilotos</span>
            {agents.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">{agents.length}</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhum copiloto cadastrado. Crie em <b>Agentes IA → Modos → Copiloto</b>.
            </p>
          ) : selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs font-medium truncate">{selected.name}</p>
                </div>
              </div>

              {loadingActions ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : actions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Este copiloto não tem ações configuradas.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {actions.map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      disabled={!!running}
                      onClick={() => handleRun(a.id, a.name)}
                    >
                      {running === a.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <IconByName name={a.icon} className="h-3 w-3" />
                      )}
                      {a.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => setSelected(agent)}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{agent.name}</p>
                    {agent.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{agent.description}</p>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1 py-0 mt-1">
                      {agent.action_count} ações
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {output?.title || "Copiloto"}
              {selected && (
                <span className="text-sm font-normal text-muted-foreground">— {selected.name}</span>
              )}
            </DialogTitle>
            <DialogDescription>Resultado da ação do copiloto</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-4 rounded-lg bg-muted/30 border text-sm leading-relaxed whitespace-pre-wrap">
              {output?.content}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleCopy}>
              <Copy className="h-4 w-4" />Copiar
            </Button>
            {onUseResponse && output && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  onUseResponse(output.content);
                  setShowModal(false);
                  toast.success("Inserido no campo de mensagem");
                }}
              >
                <Send className="h-4 w-4" />Usar resposta
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowModal(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}