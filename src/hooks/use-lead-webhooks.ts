import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface LeadWebhook {
  id: string;
  name: string;
  description?: string;
  webhook_token: string;
  is_active: boolean;
  funnel_id?: string;
  stage_id?: string;
  owner_id?: string;
  distribution_enabled: boolean;
  field_mapping: Record<string, string>;
  default_value: number;
  default_probability: number;
  total_leads: number;
  last_lead_at?: string;
  funnel_name?: string;
  stage_name?: string;
  owner_name?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  request_body: Record<string, any>;
  response_status: number;
  response_message: string;
  deal_id?: string;
  prospect_id?: string;
  assigned_to?: string;
  source_ip: string;
  user_agent: string;
  created_at: string;
}

export interface DistributionMember {
  id: string;
  webhook_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  is_active: boolean;
  max_leads_per_day: number | null;
  leads_today: number;
  last_lead_at?: string;
}

export function useLeadWebhooks() {
  return useQuery({
    queryKey: ["lead-webhooks"],
    queryFn: async () => {
      return api<LeadWebhook[]>("/api/lead-webhooks");
    },
  });
}

export function useWebhookLogs(webhookId: string | null) {
  return useQuery({
    queryKey: ["webhook-logs", webhookId],
    queryFn: async () => {
      if (!webhookId) return [];
      return api<WebhookLog[]>(`/api/lead-webhooks/${webhookId}/logs`);
    },
    enabled: !!webhookId,
  });
}

export function useWebhookDistribution(webhookId: string | null) {
  return useQuery({
    queryKey: ["webhook-distribution", webhookId],
    queryFn: async () => {
      if (!webhookId) return { distribution_enabled: false, members: [] };
      return api<{ distribution_enabled: boolean; members: DistributionMember[] }>(
        `/api/lead-webhooks/${webhookId}/distribution`
      );
    },
    enabled: !!webhookId,
  });
}

export function useLeadWebhookMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createWebhook = useMutation({
    mutationFn: async (data: Partial<LeadWebhook>) => {
      return api<LeadWebhook>("/api/lead-webhooks", { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-webhooks"] });
      toast({ title: "Webhook criado com sucesso" });
    },
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LeadWebhook> & { id: string }) => {
      return api<LeadWebhook>(`/api/lead-webhooks/${id}`, { method: "PUT", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-webhooks"] });
      toast({ title: "Webhook atualizado" });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      return api<void>(`/api/lead-webhooks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-webhooks"] });
      toast({ title: "Webhook excluído" });
    },
  });

  const regenerateToken = useMutation({
    mutationFn: async (id: string) => {
      return api<LeadWebhook>(`/api/lead-webhooks/${id}/regenerate-token`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-webhooks"] });
      toast({ title: "Token regenerado" });
    },
  });

  const toggleDistribution = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return api<{ id: string; distribution_enabled: boolean }>(
        `/api/lead-webhooks/${id}/distribution/toggle`,
        { method: "PATCH", body: { enabled } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-distribution"] });
    },
  });

  const addDistributionMember = useMutation({
    mutationFn: async ({ webhookId, userId, maxLeadsPerDay }: { webhookId: string; userId: string; maxLeadsPerDay?: number }) => {
      return api<DistributionMember>(
        `/api/lead-webhooks/${webhookId}/distribution/members`,
        { method: "POST", body: { user_id: userId, max_leads_per_day: maxLeadsPerDay } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-distribution"] });
      toast({ title: "Membro adicionado à distribuição" });
    },
  });

  const updateDistributionMember = useMutation({
    mutationFn: async ({ webhookId, userId, ...data }: { webhookId: string; userId: string; is_active?: boolean; max_leads_per_day?: number | null }) => {
      return api<DistributionMember>(
        `/api/lead-webhooks/${webhookId}/distribution/members/${userId}`,
        { method: "PATCH", body: data }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-distribution"] });
    },
  });

  const removeDistributionMember = useMutation({
    mutationFn: async ({ webhookId, userId }: { webhookId: string; userId: string }) => {
      return api<void>(
        `/api/lead-webhooks/${webhookId}/distribution/members/${userId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-distribution"] });
      toast({ title: "Membro removido da distribuição" });
    },
  });

  return { 
    createWebhook, 
    updateWebhook, 
    deleteWebhook, 
    regenerateToken,
    toggleDistribution,
    addDistributionMember,
    updateDistributionMember,
    removeDistributionMember
  };
}

export function getWebhookUrl(token: string): string {
  const baseUrl = API_URL || window.location.origin;
  return `${baseUrl}/api/lead-webhooks/receive/${token}`;
}
