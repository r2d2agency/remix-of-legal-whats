import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Loader2, Play, Tag, Zap } from "lucide-react";
import { toast } from "sonner";
import { useChatbots, Chatbot } from "@/hooks/use-chatbots";

interface StartFlowDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  connectionId: string;
  onFlowStarted?: () => void;
}

export function StartFlowDialog({
  open,
  onClose,
  conversationId,
  connectionId,
  onFlowStarted,
}: StartFlowDialogProps) {
  const { getAvailableForConnection, startFlowInConversation, loading } = useChatbots();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loadingChatbots, setLoadingChatbots] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (open && connectionId) {
      loadChatbots();
    }
  }, [open, connectionId]);

  const loadChatbots = async () => {
    setLoadingChatbots(true);
    const result = await getAvailableForConnection(connectionId);
    setChatbots(result);
    setLoadingChatbots(false);
  };

  const handleStartFlow = async (chatbot: Chatbot) => {
    setStarting(chatbot.id);
    const success = await startFlowInConversation(conversationId, chatbot.id);
    
    if (success) {
      toast.success(`Fluxo "${chatbot.name}" iniciado!`);
      onFlowStarted?.();
      onClose();
    } else {
      toast.error("Erro ao iniciar fluxo");
    }
    setStarting(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Iniciar Fluxo de Chatbot
          </DialogTitle>
          <DialogDescription>
            Selecione um chatbot para iniciar o fluxo nesta conversa
          </DialogDescription>
        </DialogHeader>

        {loadingChatbots ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : chatbots.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum chatbot disponível para esta conexão</p>
            <p className="text-sm mt-1">
              Configure chatbots em Atendimento → Chatbots
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {chatbots.map((chatbot) => (
                <Card
                  key={chatbot.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleStartFlow(chatbot)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{chatbot.name}</h4>
                          {chatbot.trigger_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Auto
                            </Badge>
                          )}
                        </div>
                        {chatbot.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {chatbot.description}
                          </p>
                        )}
                        {chatbot.trigger_keywords && chatbot.trigger_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {chatbot.trigger_keywords.slice(0, 3).map((kw, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {kw}
                              </Badge>
                            ))}
                            {chatbot.trigger_keywords.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{chatbot.trigger_keywords.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={starting === chatbot.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartFlow(chatbot);
                        }}
                      >
                        {starting === chatbot.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Iniciar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
