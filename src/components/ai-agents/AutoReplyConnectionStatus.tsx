import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Reply, RefreshCw, Bot, Circle } from 'lucide-react';
import { useAutoReplyByConnection } from '@/hooks/use-agent-modes';

export function AutoReplyConnectionStatus({ onAgentClick }: { onAgentClick?: (agentId: string) => void }) {
  const { items, loading, reload } = useAutoReplyByConnection();

  if (!loading && items.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Reply className="h-4 w-4 text-primary" /> Quem responde em cada conexão
          </div>
          <p className="text-xs text-muted-foreground">
            Apenas <strong>uma</strong> auto-resposta pode estar ativa por conexão.
            Ao ativar outra, a anterior é pausada automaticamente.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((c) => {
          const active = !!c.agent;
          return (
            <div
              key={c.connection_id}
              className={`p-3 rounded-md border flex items-center justify-between gap-3 ${
                active ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2 truncate">
                  <Circle
                    className={`h-2 w-2 ${c.status === 'connected' ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`}
                  />
                  <span className="truncate">{c.connection_name}</span>
                </div>
                {c.phone_number && (
                  <div className="text-[11px] text-muted-foreground truncate">{c.phone_number}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {active ? (
                  <button
                    type="button"
                    onClick={() => onAgentClick?.(c.agent!.agent_id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    title={c.agent!.scoped_to_all ? 'Ativo em todas as conexões' : 'Ativo nesta conexão'}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {c.agent!.agent_name}
                  </button>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Sem auto-resposta</Badge>
                )}
                {c.agent?.paused_until && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    até {new Date(c.agent.paused_until).toLocaleString('pt-BR')}
                  </div>
                )}
                {c.agent?.scoped_to_all && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">escopo: todas</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}