import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface GlobalAgentCustomField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required?: boolean;
  options?: string[]; // for select type
  placeholder?: string;
}

export interface GlobalAgentActivation {
  id: string;
  connection_id: string;
  is_active: boolean;
  schedule_mode: 'always' | 'scheduled' | 'manual';
  schedule_windows: ScheduleWindow[];
  custom_field_values: Record<string, string>;
  prompt_additions?: string;
  client_ai_api_key?: string;
  connection_name?: string;
  connection_phone?: string;
}

export interface ScheduleWindow {
  days: number[]; // 0=domingo, 1=segunda...6=sábado
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export interface GlobalAgentForClient {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  custom_fields: GlobalAgentCustomField[];
  system_prompt: string;
  greeting_message?: string;
  ai_provider?: string;
  ai_model?: string;
  capabilities?: string[];
  has_knowledge_base?: boolean;
  activations: GlobalAgentActivation[];
}

export function useGlobalAgents() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAvailableAgents = useCallback(async (): Promise<GlobalAgentForClient[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<GlobalAgentForClient[]>('/api/global-agents/available', { auth: true });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agentes';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const activateAgent = useCallback(async (data: {
    global_agent_id: string;
    connection_id: string;
    schedule_mode: string;
    schedule_windows: ScheduleWindow[];
    custom_field_values: Record<string, string>;
    prompt_additions?: string;
    client_ai_api_key?: string;
  }): Promise<GlobalAgentActivation | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<GlobalAgentActivation>('/api/global-agents/activate', {
        method: 'POST',
        body: data,
        auth: true,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao ativar agente';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateActivation = useCallback(async (id: string, data: Partial<GlobalAgentActivation>): Promise<GlobalAgentActivation | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<GlobalAgentActivation>(`/api/global-agents/activation/${id}`, {
        method: 'PATCH',
        body: data,
        auth: true,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar ativação';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivateAgent = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      await api(`/api/global-agents/deactivate/${id}`, { method: 'POST', auth: true });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteActivation = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      await api(`/api/global-agents/activation/${id}`, { method: 'DELETE', auth: true });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAIModels = useCallback(async () => {
    try {
      return await api<Record<string, { id: string; name: string; description: string }[]>>('/api/global-agents/models', { auth: true });
    } catch {
      return { openai: [], gemini: [] };
    }
  }, []);

  const testAgent = useCallback(async (agentId: string, data: {
    message: string;
    history?: { role: string; content: string }[];
    client_ai_api_key?: string;
    custom_name?: string;
    prompt_additions?: string;
    selected_model?: string;
  }) => {
    const result = await api<{ response: string; tokens: number; model: string }>(`/api/global-agents/test/${agentId}`, {
      method: 'POST',
      body: data,
      auth: true,
    });
    return result;
  }, []);

  return { loading, error, getAvailableAgents, activateAgent, updateActivation, deactivateAgent, deleteActivation, getAIModels, testAgent };
}
