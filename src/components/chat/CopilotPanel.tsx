import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Copy, Send, ChevronDown } from 'lucide-react';
import * as Icons from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useCopilotAgents, useAgentActions, runCopilotAction } from '@/hooks/use-agent-modes';
import { toast } from 'sonner';

interface Props {
  conversationId?: string;
  onUseResponse?: (text: string) => void;
}

function IconByName({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as any)[name] || Icons.Sparkles;
  return <Cmp className={className} />;
}

export function CopilotPanel({ conversationId, onUseResponse }: Props) {
  const { agents } = useCopilotAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const { actions } = useAgentActions(selectedAgentId);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ actionName: string; content: string } | null>(null);

  if (!agents.length) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Copiloto
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm text-muted-foreground">
          Nenhum agente Copiloto cadastrado. Crie em <b>Agentes IA → Copiloto de Vendas</b>.
        </PopoverContent>
      </Popover>
    );
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  if (!selectedAgentId && agents[0]) setSelectedAgentId(agents[0].id);

  const handleRun = async (actionId: string, actionName: string) => {
    if (!selectedAgentId) return;
    setRunning(actionId);
    setOutput(null);
    try {
      const r = await runCopilotAction(selectedAgentId, actionId, conversationId);
      setOutput({ actionName, content: r.content });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao executar');
    } finally {
      setRunning(null);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
          <Sparkles className="h-4 w-4" /> Copiloto
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-3" align="end">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Copiloto de Vendas</span>
        </div>

        {agents.length > 1 && (
          <div className="mb-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  {selectedAgent.name}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-1">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAgentId(a.id); setOutput(null); }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                  >{a.name}</button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <Button
              key={a.id}
              variant="outline" size="sm"
              className="h-auto py-2 flex flex-col gap-1 items-center"
              disabled={!!running}
              onClick={() => handleRun(a.id, a.name)}
            >
              {running === a.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <IconByName name={a.icon} className="h-4 w-4" />}
              <span className="text-xs">{a.name}</span>
            </Button>
          ))}
          {actions.length === 0 && (
            <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
              Este agente ainda não tem ações.
            </p>
          )}
        </div>

        {output && (
          <Card className="mt-3 p-3 bg-muted/30 max-h-[300px] overflow-y-auto">
            <div className="text-xs font-medium text-primary mb-1">{output.actionName}</div>
            <div className="text-sm whitespace-pre-wrap">{output.content}</div>
            <div className="flex gap-2 mt-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(output.content); toast.success('Copiado'); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
              {onUseResponse && (
                <Button size="sm" onClick={() => { onUseResponse(output.content); toast.success('Texto carregado no campo'); }}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Usar resposta
                </Button>
              )}
            </div>
          </Card>
        )}
      </PopoverContent>
    </Popover>
  );
}