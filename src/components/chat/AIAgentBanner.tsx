import { useState, useEffect, useCallback } from 'react';
import { Bot, X, Pause, Play, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AgentSession {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar?: string;
  is_active: boolean;
  paused_until?: string | null;
  human_takeover?: boolean;
  human_takeover_by?: string | null;
  message_count?: number;
  started_at: string;
}

interface SimpleAgent {
  id: string;
  name: string;
  is_active: boolean;
}

interface AIAgentBannerProps {
  conversationId: string;
  isGroup?: boolean;
  className?: string;
  onSessionChange?: (session: AgentSession | null) => void;
}

export function AIAgentBanner({ conversationId, isGroup, className, onSessionChange }: AIAgentBannerProps) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [agents, setAgents] = useState<SimpleAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const data = await api<AgentSession | null>(
        `/api/chat/conversations/${conversationId}/agent-session`
      );
      setSession(data);
      onSessionChange?.(data);
    } catch {
      // silently fail
    }
  }, [conversationId, onSessionChange]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api<SimpleAgent[]>('/api/ai-agents', { auth: true });
      setAgents((data || []).filter(a => a.is_active));
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [fetchSession]);

  const handleStartAgent = async (agentId: string) => {
    setActionLoading(true);
    try {
      const data = await api<AgentSession>(
        `/api/chat/conversations/${conversationId}/agent-session`,
        { method: 'POST', body: { agent_id: agentId } }
      );
      setSession(data);
      onSessionChange?.(data);
      setShowAgentSelect(false);
      toast.success('Agente IA ativado para esta conversa');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ativar agente');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopAgent = async () => {
    setActionLoading(true);
    try {
      await api(`/api/chat/conversations/${conversationId}/agent-session`, {
        method: 'DELETE',
      });
      setSession(null);
      onSessionChange?.(null);
      toast.success('Agente IA desativado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desativar agente');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTakeover = async (enabled: boolean) => {
    setActionLoading(true);
    try {
      await api(`/api/chat/conversations/${conversationId}/agent-session/takeover`, {
        method: 'POST',
        body: { enabled },
      });
      await fetchSession();
      toast.success(enabled ? 'IA pausada — você assumiu a conversa' : 'IA reativada');
    } catch (err: any) {
      toast.error(err.message || 'Erro');
    } finally {
      setActionLoading(false);
    }
  };

  const isPaused = session?.paused_until && new Date(session.paused_until) > new Date();
  const isTakenOver = session?.human_takeover;

  // No active session — show activate button
  if (!session) {
    if (isGroup) return null; // Don't show for groups

    if (showAgentSelect) {
      if (agents.length === 0) fetchAgents();

      return (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 border-b bg-muted/30",
          className
        )}>
          <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select onValueChange={handleStartAgent}>
            <SelectTrigger className="h-7 text-xs flex-1 max-w-[200px]">
              <SelectValue placeholder="Selecione um agente..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
              {agents.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum agente ativo
                </div>
              )}
            </SelectContent>
          </Select>
          {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowAgentSelect(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex items-center justify-center px-4 py-1 border-b",
        className
      )}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground gap-1.5 hover:text-primary"
          onClick={() => {
            setShowAgentSelect(true);
            fetchAgents();
          }}
        >
          <Bot className="h-3.5 w-3.5" />
          Ativar Agente IA
        </Button>
      </div>
    );
  }

  // Active session — show status banner
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-1.5 border-b transition-colors",
      isTakenOver
        ? "bg-amber-500/10 border-amber-500/30"
        : isPaused
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-primary/5 border-primary/20",
      className
    )}>
      <Bot className={cn(
        "h-4 w-4 flex-shrink-0",
        isTakenOver ? "text-amber-500" : isPaused ? "text-yellow-500" : "text-primary"
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">
            {session.agent_name}
          </span>
          {isTakenOver ? (
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500/50 text-amber-600">
              <User className="h-2.5 w-2.5 mr-0.5" />
              Humano
            </Badge>
          ) : isPaused ? (
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-yellow-500/50 text-yellow-600">
              <Pause className="h-2.5 w-2.5 mr-0.5" />
              Pausada
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/50 text-primary">
              <Play className="h-2.5 w-2.5 mr-0.5" />
              Ativa
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {actionLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <>
            {/* Toggle human takeover */}
            {isTakenOver ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-primary hover:text-primary"
                onClick={() => handleTakeover(false)}
                title="Reativar IA"
              >
                <Play className="h-3 w-3" />
                Reativar IA
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-amber-600 hover:text-amber-700"
                onClick={() => handleTakeover(true)}
                title="Assumir conversa (desabilitar IA)"
              >
                <User className="h-3 w-3" />
                Assumir
              </Button>
            )}

            {/* Stop agent */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={handleStopAgent}
              title="Desativar agente IA"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
