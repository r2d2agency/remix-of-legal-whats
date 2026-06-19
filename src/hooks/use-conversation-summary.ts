import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface ConversationSummary {
  id: string;
  conversation_id: string;
  organization_id: string;
  summary: string;
  key_points: string[];
  customer_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
  action_items: string[];
  resolution_status: 'resolved' | 'pending' | 'escalated' | 'unknown';
  messages_analyzed: number;
  generated_by: string;
  ai_provider: string;
  ai_model: string;
  processing_time_ms: number;
  triggered_by: string | null;
  triggered_by_name?: string;
  created_at: string;
  updated_at: string;
}

// Get summary for a conversation
export function useConversationSummary(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ["conversation-summary", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      return api<ConversationSummary | null>(`/api/conversation-summary/${conversationId}`);
    },
    enabled: !!conversationId,
    staleTime: 60000, // 1 minute
  });
}

// Generate summary for a conversation
export function useGenerateSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (
      input: string | { conversationId: string; days?: number }
    ) => {
      const conversationId = typeof input === 'string' ? input : input.conversationId;
      const days = typeof input === 'string' ? undefined : input.days;
      const qs = days && days > 0 ? `?days=${days}` : '';
      return api<ConversationSummary>(
        `/api/conversation-summary/${conversationId}/generate${qs}`,
        { method: "POST" }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-summary", data.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Resumo gerado com sucesso" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao gerar resumo", 
        description: error.message || "Verifique se há um agente IA configurado",
        variant: "destructive"
      });
    }
  });
}

// Finish conversation with summary
export function useFinishWithSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return api<{ success: boolean; summary: ConversationSummary | null }>(
        `/api/conversation-summary/${conversationId}/finish-with-summary`,
        { method: "POST" }
      );
    },
    onSuccess: (data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-summary", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-counts"] });
      
      if (data.summary) {
        toast({ title: "Conversa finalizada com resumo IA" });
      } else {
        toast({ title: "Conversa finalizada" });
      }
    },
  });
}

// Delete summary
export function useDeleteSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return api(`/api/conversation-summary/${conversationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversation-summary", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Resumo removido" });
    },
  });
}

// Helper to get sentiment info
export function getSentimentInfo(sentiment: string | undefined) {
  switch (sentiment) {
    case 'positive':
      return { label: 'Positivo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', emoji: '😊' };
    case 'negative':
      return { label: 'Negativo', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', emoji: '😞' };
    case 'mixed':
      return { label: 'Misto', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', emoji: '😐' };
    case 'neutral':
    default:
      return { label: 'Neutro', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', emoji: '😐' };
  }
}

// Helper to get resolution info
export function getResolutionInfo(resolution: string | undefined) {
  switch (resolution) {
    case 'resolved':
      return { label: 'Resolvido', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'pending':
      return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'escalated':
      return { label: 'Escalado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'unknown':
    default:
      return { label: 'Indefinido', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
  }
}
