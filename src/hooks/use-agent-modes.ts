import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface AgentAction {
  id: string;
  agent_id: string;
  name: string;
  icon: string;
  prompt: string;
  order_index: number;
}

export interface AutoReplyConfig {
  id?: string;
  agent_id: string;
  is_active: boolean;
  paused_until: string | null;
  filter_mode: 'all' | 'include' | 'exclude';
  included_tags: string[];
  excluded_tags: string[];
  included_contact_ids: string[];
  excluded_contact_ids: string[];
  included_groups: string[];
  excluded_groups: string[];
  connection_ids: string[];
  schedule_enabled: boolean;
  schedule_windows: Array<{ days: number[]; start: string; end: string }>;
  response_template: string | null;
  max_responses_per_contact: number;
  reply_mode: 'fixed' | 'sdr';
  sdr_max_replies: number;
}

export interface CopilotAgent {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  action_count: number;
}

export function useAgentActions(agentId?: string) {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await api<AgentAction[]>(`/api/agent-modes/${agentId}/actions`, { auth: true });
      setActions(data || []);
    } finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const create = async (a: Partial<AgentAction>) =>
    api<AgentAction>(`/api/agent-modes/${agentId}/actions`, { auth: true, method: 'POST', body: a }).then((r) => { load(); return r; });
  const update = async (id: string, a: Partial<AgentAction>) =>
    api<AgentAction>(`/api/agent-modes/${agentId}/actions/${id}`, { auth: true, method: 'PUT', body: a }).then((r) => { load(); return r; });
  const remove = async (id: string) =>
    api(`/api/agent-modes/${agentId}/actions/${id}`, { auth: true, method: 'DELETE' }).then(() => load());

  return { actions, loading, create, update, remove, reload: load };
}

export function useCopilotAgents() {
  const [agents, setAgents] = useState<CopilotAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<CopilotAgent[]>(`/api/agent-modes/copilot/available`, { auth: true });
      setAgents(data || []);
    } catch { setAgents([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { agents, loading, reload: load };
}

export async function runCopilotAction(agentId: string, actionId: string, conversationId?: string) {
  return api<{ content: string; tokens: number; model: string }>(
    `/api/agent-modes/${agentId}/actions/${actionId}/run`,
    { auth: true, method: 'POST', body: { conversation_id: conversationId, last_n: 30 } }
  );
}

export function useAutoReplyConfig(agentId?: string) {
  const [config, setConfig] = useState<AutoReplyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await api<AutoReplyConfig | null>(`/api/agent-modes/${agentId}/autoreply`, { auth: true });
      setConfig(data);
    } finally { setLoading(false); }
  }, [agentId]);
  useEffect(() => { load(); }, [load]);

  const save = async (cfg: Partial<AutoReplyConfig>) => {
    const data = await api<AutoReplyConfig>(`/api/agent-modes/${agentId}/autoreply`, {
      auth: true, method: 'PUT', body: cfg,
    });
    setConfig(data);
    return data;
  };

  const toggle = async (active: boolean, duration_minutes?: number) => {
    const data = await api<AutoReplyConfig>(`/api/agent-modes/${agentId}/autoreply/toggle`, {
      auth: true, method: 'POST', body: { active, duration_minutes },
    });
    setConfig(data);
    return data;
  };

  return { config, loading, save, toggle, reload: load };
}

export interface ActiveAutoReply { id: string; name: string; is_active: boolean; paused_until: string | null }
export function useActiveAutoReplies() {
  const [items, setItems] = useState<ActiveAutoReply[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api<ActiveAutoReply[]>(`/api/agent-modes/autoreply/active`, { auth: true });
        if (alive) setItems(data || []);
      } catch { /* ignore */ }
    };
    load();
    const i = setInterval(load, 30000);
    return () => { alive = false; clearInterval(i); };
  }, []);
  return items;
}