import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type AIProvider = 'openai' | 'gemini';
export type KnowledgeSourceType = 'file' | 'url' | 'text';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AgentCapability = 
  | 'respond_messages'
  | 'read_files'
  | 'schedule_meetings'
  | 'create_deals'
  | 'suggest_actions'
  | 'generate_content'
  | 'summarize_history'
  | 'qualify_leads';

export interface AIAgent {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_active: boolean;
  ai_provider: AIProvider;
  ai_model: string;
  ai_api_key: string | null;
  system_prompt: string;
  personality_traits: string[];
  language: string;
  temperature: number;
  max_tokens: number;
  context_window: number;
  capabilities: AgentCapability[];
  greeting_message: string | null;
  fallback_message: string;
  handoff_message: string;
  handoff_keywords: string[];
  auto_handoff_after_failures: number;
  default_department_id: string | null;
  default_user_id: string | null;
  lead_scoring_criteria: Record<string, unknown>;
  auto_create_deal_funnel_id: string | null;
  auto_create_deal_stage_id: string | null;
  total_conversations: number;
  total_messages: number;
  avg_response_time_ms: number | null;
  satisfaction_score: number | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  // Computed
  knowledge_sources_count?: number;
  connections_count?: number;
  active_sessions?: number;
}

export interface KnowledgeSource {
  id: string;
  agent_id: string;
  source_type: KnowledgeSourceType;
  name: string;
  description: string | null;
  source_content: string;
  file_type: string | null;
  file_size: number | null;
  original_filename: string | null;
  status: ProcessingStatus;
  error_message: string | null;
  processed_at: string | null;
  chunk_count: number;
  total_tokens: number;
  is_active: boolean;
  priority: number;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConnection {
  id: string;
  agent_id: string;
  connection_id: string;
  mode: 'always' | 'business_hours' | 'keywords';
  trigger_keywords: string[];
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  is_active: boolean;
  priority: number;
  connection_name?: string;
  connection_phone?: string;
  connection_status?: string;
  created_at: string;
}

export interface AgentStats {
  summary: {
    total_sessions: number;
    total_messages: number;
    total_tokens_used: number;
    handoff_count: number;
    avg_response_time_ms: number;
    positive_feedback: number;
    negative_feedback: number;
    deals_created: number;
    meetings_scheduled: number;
    leads_qualified: number;
  };
  daily: Array<{
    date: string;
    total_sessions: number;
    total_messages: number;
    handoff_count: number;
    deals_created: number;
  }>;
  active_sessions: number;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
}

export interface AIModels {
  openai: AIModel[];
  gemini: AIModel[];
}

export interface PromptTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string | null;
  template: string;
  variables: string[];
  is_system: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useAIAgents = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== AGENTES ====================

  const getAgents = useCallback(async (): Promise<AIAgent[]> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AIAgent[]>('/api/ai-agents', { auth: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agentes';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getAgent = useCallback(async (id: string): Promise<AIAgent | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AIAgent>(`/api/ai-agents/${id}`, { auth: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agente';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (data: Partial<AIAgent>): Promise<AIAgent | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AIAgent>('/api/ai-agents', {
        method: 'POST',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar agente';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAgent = useCallback(async (id: string, data: Partial<AIAgent>): Promise<AIAgent | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AIAgent>(`/api/ai-agents/${id}`, {
        method: 'PATCH',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar agente';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/ai-agents/${id}`, { method: 'DELETE', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar agente';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAgent = useCallback(async (id: string): Promise<{ id: string; is_active: boolean } | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<{ id: string; is_active: boolean }>(`/api/ai-agents/${id}/toggle`, {
        method: 'POST',
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alternar agente';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== KNOWLEDGE BASE ====================

  const getKnowledgeSources = useCallback(async (agentId: string): Promise<KnowledgeSource[]> => {
    setLoading(true);
    setError(null);
    try {
      return await api<KnowledgeSource[]>(`/api/ai-agents/${agentId}/knowledge`, { auth: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar fontes';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addKnowledgeSource = useCallback(async (
    agentId: string, 
    data: Partial<KnowledgeSource>
  ): Promise<KnowledgeSource | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<KnowledgeSource>(`/api/ai-agents/${agentId}/knowledge`, {
        method: 'POST',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar fonte';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateKnowledgeSource = useCallback(async (
    agentId: string,
    sourceId: string,
    data: Partial<KnowledgeSource>
  ): Promise<KnowledgeSource | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<KnowledgeSource>(`/api/ai-agents/${agentId}/knowledge/${sourceId}`, {
        method: 'PATCH',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar fonte';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteKnowledgeSource = useCallback(async (agentId: string, sourceId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/ai-agents/${agentId}/knowledge/${sourceId}`, { method: 'DELETE', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar fonte';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reprocessKnowledgeSource = useCallback(async (agentId: string, sourceId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/ai-agents/${agentId}/knowledge/${sourceId}/reprocess`, { method: 'POST', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao reprocessar fonte';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== CONEXÕES ====================

  const getAgentConnections = useCallback(async (agentId: string): Promise<AgentConnection[]> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AgentConnection[]>(`/api/ai-agents/${agentId}/connections`, { auth: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar conexões';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const linkAgentToConnection = useCallback(async (
    agentId: string,
    data: Partial<AgentConnection>
  ): Promise<AgentConnection | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<AgentConnection>(`/api/ai-agents/${agentId}/connections`, {
        method: 'POST',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao vincular conexão';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const unlinkAgentFromConnection = useCallback(async (agentId: string, connectionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/ai-agents/${agentId}/connections/${connectionId}`, { method: 'DELETE', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desvincular conexão';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== ESTATÍSTICAS ====================

  const getAgentStats = useCallback(async (
    agentId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AgentStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      
      const url = `/api/ai-agents/${agentId}/stats${params.toString() ? `?${params}` : ''}`;
      return await api<AgentStats>(url, { auth: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar estatísticas';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== MODELOS E TEMPLATES ====================

  const getAIModels = useCallback(async (): Promise<AIModels> => {
    try {
      return await api<AIModels>('/api/ai-agents/config/models', { auth: true });
    } catch {
      return { openai: [], gemini: [] };
    }
  }, []);

  const getPromptTemplates = useCallback(async (category?: string): Promise<PromptTemplate[]> => {
    try {
      const params = category ? `?category=${category}` : '';
      return await api<PromptTemplate[]>(`/api/ai-agents/templates${params}`, { auth: true });
    } catch {
      return [];
    }
  }, []);

  const createPromptTemplate = useCallback(async (data: Partial<PromptTemplate>): Promise<PromptTemplate | null> => {
    setLoading(true);
    setError(null);
    try {
      return await api<PromptTemplate>('/api/ai-agents/templates', {
        method: 'POST',
        body: data,
        auth: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar template';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    // Agentes
    getAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgent,
    // Knowledge Base
    getKnowledgeSources,
    addKnowledgeSource,
    updateKnowledgeSource,
    deleteKnowledgeSource,
    reprocessKnowledgeSource,
    // Conexões
    getAgentConnections,
    linkAgentToConnection,
    unlinkAgentFromConnection,
    // Estatísticas
    getAgentStats,
    // Modelos e Templates
    getAIModels,
    getPromptTemplates,
    createPromptTemplate,
  };
};
