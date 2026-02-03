import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Types
export interface CTWACampaign {
  id: string;
  organization_id: string;
  name: string;
  platform: 'meta' | 'google' | 'tiktok' | 'other';
  campaign_id?: string;
  ad_set_id?: string;
  ad_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  tracking_code: string;
  total_spend: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined stats
  total_leads?: number;
  converted_leads?: number;
  qualified_leads?: number;
  total_revenue?: number;
  avg_response_time?: number;
}

export interface CTWALead {
  id: string;
  organization_id: string;
  campaign_id?: string;
  phone: string;
  contact_name?: string;
  conversation_id?: string;
  deal_id?: string;
  source_platform?: string;
  referrer_url?: string;
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  tracking_code?: string;
  entry_message?: string;
  status: 'new' | 'engaged' | 'qualified' | 'converted' | 'lost';
  converted_at?: string;
  conversion_value?: number;
  first_response_at?: string;
  response_time_seconds?: number;
  assigned_user_id?: string;
  created_at: string;
  updated_at: string;
  // Joined
  campaign_name?: string;
  platform?: string;
  assigned_user_name?: string;
}

export interface CTWAOverview {
  stats: {
    total_leads: number;
    new_leads: number;
    engaged_leads: number;
    qualified_leads: number;
    converted_leads: number;
    lost_leads: number;
    total_revenue: number;
    avg_response_time: number;
    conversion_rate: number;
  };
  by_campaign: Array<{
    id: string;
    name: string;
    platform: string;
    total_spend: number;
    leads: number;
    conversions: number;
    revenue: number;
    cost_per_lead: number;
    roi: number;
  }>;
  by_day: Array<{
    date: string;
    total: number;
    converted: number;
  }>;
  by_source: Array<{
    source: string;
    leads: number;
    conversions: number;
  }>;
}

// Hooks

export function useCTWACampaigns() {
  return useQuery({
    queryKey: ["ctwa-campaigns"],
    queryFn: () => api<CTWACampaign[]>("/api/ctwa/campaigns"),
  });
}

export function useCTWACampaign(id: string | null) {
  return useQuery({
    queryKey: ["ctwa-campaign", id],
    queryFn: () => api<CTWACampaign & { funnel_stats: any[]; daily_leads: any[] }>(`/api/ctwa/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCTWALeads(filters?: { campaign_id?: string; status?: string; start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ["ctwa-leads", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.campaign_id) params.set("campaign_id", filters.campaign_id);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.start_date) params.set("start_date", filters.start_date);
      if (filters?.end_date) params.set("end_date", filters.end_date);
      return api<CTWALead[]>(`/api/ctwa/leads?${params.toString()}`);
    },
  });
}

export function useCTWAOverview(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["ctwa-overview", startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      return api<CTWAOverview>(`/api/ctwa/overview?${params.toString()}`);
    },
  });
}

export function useCTWAMutations() {
  const queryClient = useQueryClient();

  const createCampaign = useMutation({
    mutationFn: (data: Partial<CTWACampaign>) =>
      api<CTWACampaign>("/api/ctwa/campaigns", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctwa-campaigns"] });
      toast.success("Campanha criada com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar campanha");
    },
  });

  const updateCampaign = useMutation({
    mutationFn: ({ id, ...data }: Partial<CTWACampaign> & { id: string }) =>
      api<CTWACampaign>(`/api/ctwa/campaigns/${id}`, { method: "PATCH", body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ctwa-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["ctwa-campaign", variables.id] });
      toast.success("Campanha atualizada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar campanha");
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: string) =>
      api(`/api/ctwa/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctwa-campaigns"] });
      toast.success("Campanha excluída");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir campanha");
    },
  });

  const registerLead = useMutation({
    mutationFn: (data: Partial<CTWALead>) =>
      api<CTWALead>("/api/ctwa/leads", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctwa-leads"] });
      queryClient.invalidateQueries({ queryKey: ["ctwa-overview"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao registrar lead");
    },
  });

  const updateLead = useMutation({
    mutationFn: ({ id, ...data }: Partial<CTWALead> & { id: string }) =>
      api<CTWALead>(`/api/ctwa/leads/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ctwa-leads"] });
      queryClient.invalidateQueries({ queryKey: ["ctwa-overview"] });
      toast.success("Lead atualizado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar lead");
    },
  });

  return {
    createCampaign,
    updateCampaign,
    deleteCampaign,
    registerLead,
    updateLead,
  };
}
