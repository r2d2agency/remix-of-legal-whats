import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface LeadScoringConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  weight_response_time: number;
  weight_engagement: number;
  weight_profile_completeness: number;
  weight_deal_value: number;
  weight_funnel_progress: number;
  weight_recency: number;
  hot_threshold: number;
  warm_threshold: number;
  auto_update_on_message: boolean;
  auto_update_on_stage_change: boolean;
  recalculate_interval_hours: number;
  created_at: string;
  updated_at: string;
}

export interface LeadScore {
  id: string;
  deal_id: string;
  organization_id: string;
  score: number;
  score_label: 'hot' | 'warm' | 'cold';
  score_response_time: number;
  score_engagement: number;
  score_profile: number;
  score_value: number;
  score_funnel: number;
  score_recency: number;
  total_messages: number;
  profile_fields_filled: number;
  profile_fields_total: number;
  funnel_stages_completed: number;
  funnel_stages_total: number;
  ai_summary?: string;
  ai_recommended_action?: string;
  previous_score?: number;
  score_trend?: 'up' | 'down' | 'stable';
  created_at: string;
  updated_at: string;
}

export interface LeadScoreWithDeal extends LeadScore {
  deal_title: string;
  deal_value: number;
  deal_status: string;
  company_name: string;
  owner_name: string;
}

export interface LeadScoreStats {
  hot_count: number;
  warm_count: number;
  cold_count: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  trending_up: number;
  trending_down: number;
}

export interface LeadScoreHistory {
  id: string;
  deal_id: string;
  score: number;
  score_label: string;
  trigger_event: string;
  created_at: string;
}

// Config
export function useLeadScoringConfig() {
  return useQuery({
    queryKey: ["lead-scoring-config"],
    queryFn: async () => {
      return api<LeadScoringConfig>("/api/lead-scoring/config");
    },
  });
}

export function useUpdateLeadScoringConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Partial<LeadScoringConfig>) => {
      return api<LeadScoringConfig>("/api/lead-scoring/config", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-config"] });
      toast({ title: "Configuração de scoring atualizada" });
    },
  });
}

// Deal score
export function useDealScore(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-score", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      return api<LeadScore>(`/api/lead-scoring/deal/${dealId}`);
    },
    enabled: !!dealId,
    staleTime: 60000, // 1 minute
  });
}

export function useRecalculateDealScore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, trigger }: { dealId: string; trigger?: string }) => {
      return api<LeadScore>(`/api/lead-scoring/deal/${dealId}/recalculate`, {
        method: "POST",
        body: { trigger },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-score", data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-stats"] });
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-leaderboard"] });
      toast({ title: "Score recalculado" });
    },
  });
}

export function useRecalculateAllScores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return api<{ success: boolean; updated: number }>("/api/lead-scoring/recalculate-all", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lead-score"] });
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-stats"] });
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      toast({ title: `${data.updated} leads recalculados` });
    },
  });
}

// History
export function useDealScoreHistory(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-score-history", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      return api<LeadScoreHistory[]>(`/api/lead-scoring/deal/${dealId}/history`);
    },
    enabled: !!dealId,
  });
}

// Leaderboard
export function useLeadScoringLeaderboard(limit = 10, label?: string) {
  return useQuery({
    queryKey: ["lead-scoring-leaderboard", limit, label],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", String(limit));
      if (label) params.append("label", label);
      return api<LeadScoreWithDeal[]>(`/api/lead-scoring/leaderboard?${params}`);
    },
  });
}

// Stats
export function useLeadScoringStats() {
  return useQuery({
    queryKey: ["lead-scoring-stats"],
    queryFn: async () => {
      return api<LeadScoreStats>("/api/lead-scoring/stats");
    },
  });
}

// Helper to get score color
export function getScoreColor(label: string | undefined): string {
  switch (label) {
    case 'hot':
      return 'bg-red-500 text-white';
    case 'warm':
      return 'bg-orange-500 text-white';
    case 'cold':
    default:
      return 'bg-blue-500 text-white';
  }
}

export function getScoreColorLight(label: string | undefined): string {
  switch (label) {
    case 'hot':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'warm':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'cold':
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

export function getScoreTrendIcon(trend: string | undefined): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    default:
      return '→';
  }
}
