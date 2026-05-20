import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Bot, User, Wrench, ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";

interface ToolCall {
  name: string;
  arguments?: any;
  result?: any;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  tokens?: number;
}

interface GlobalAgent {
  id: string;
  name: string;
  capabilities?: string[];
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

export default function MarinaTestChat() {
  const [agents, setAgents] = useState<GlobalAgent[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/global-agents/admin/list`, { headers: headers() });
        const data = await res.json();
        if (res.ok) {
          setAgents(data);
          const marina = data.find((a: GlobalAgent) => /marina/i.test(a.name));
          if (marina) setAgentId(marina.id);
          else if (data[0]) setAgentId(data[0].id);
        }
      } catch (e: any) {
        toast.error("Erro ao carregar agentes");
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [agentId, loading]);

  const resetChat = () => {
    setMessages([]);
    setOpenTools({});
  };

  const send = async () => {
    if (!input.trim() || !agentId || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const history = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${agentId}/test`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ message: userMsg.content, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "(sem resposta)",
          toolCalls: data.toolCalls || [],
          tokens: data.tokens,
        },
      ]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (key: string) => {
    setOpenTools(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toolBadgeVariant = (name: string) => {
    if (name.includes("appointment")) return "default" as const;
    if (name.includes("availability")) return "secondary" as const;
    return "outline" as const;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 max-w-5xl">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Simulador de Conversa — Marina</h1>
            <p className="text-sm text-muted-foreground">
              Teste o fluxo: coleta de dados → confirmação → chamada de <code>appbarber_availability</code> e <code>appbarber_appointment</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); resetChat(); }}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={resetChat} title="Limpar conversa">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="h-[70vh] flex flex-col">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              {agents.find(a => a.id === agentId)?.name || "Selecione um agente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    Envie uma mensagem para iniciar (ex.: "oi, quero agendar um corte amanhã").
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] space-y-2 ${m.role === "user" ? "items-end" : ""}`}>
                      {m.role === "user" ? (
                        <div className="rounded-2xl px-4 py-2 bg-primary text-primary-foreground">
                          {m.content}
                        </div>
                      ) : (
                        <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </div>
                      )}
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="space-y-1">
                          {m.toolCalls.map((t, ti) => {
                            const key = `${i}-${ti}`;
                            const open = openTools[key];
                            return (
                              <div key={key} className="rounded-md border bg-muted/30 text-xs">
                                <button
                                  onClick={() => toggleTool(key)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50"
                                >
                                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <Wrench className="h-3 w-3 text-primary" />
                                  <Badge variant={toolBadgeVariant(t.name)} className="text-[10px]">{t.name}</Badge>
                                  <span className="text-muted-foreground ml-auto">ferramenta executada</span>
                                </button>
                                {open && (
                                  <div className="px-3 pb-2 space-y-2">
                                    <div>
                                      <div className="font-semibold text-muted-foreground mb-1">Argumentos</div>
                                      <pre className="bg-background border rounded p-2 overflow-x-auto text-[10px]">
{JSON.stringify(t.arguments ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-muted-foreground mb-1">Resultado</div>
                                      <pre className="bg-background border rounded p-2 overflow-x-auto text-[10px] max-h-60">
{typeof t.result === "string" ? t.result : JSON.stringify(t.result ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {m.tokens != null && (
                        <div className="text-[10px] text-muted-foreground">{m.tokens} tokens</div>
                      )}
                    </div>
                    {m.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3 items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Marina está pensando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-3 flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Digite uma mensagem..."
                disabled={loading || !agentId}
              />
              <Button onClick={send} disabled={loading || !input.trim() || !agentId} size="icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Roteiro sugerido para validar o fluxo</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>1. "Oi, quero agendar um corte." → Marina deve perguntar nome, profissional e horário (sem chamar API ainda).</p>
            <p>2. Informe os dados pedidos. → Ela deve chamar <code>appbarber_availability</code> apenas após ter data/serviço/profissional.</p>
            <p>3. Escolha um horário e confirme. → Só então deve chamar <code>appbarber_appointment</code>.</p>
            <p>Cada chamada aparece como cartão de ferramenta com argumentos + resultado.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}