import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SalesTimelineData {
  period: string;
  open: number;
  won: number;
  lost: number;
  wonValue: number;
  lostValue: number;
  openValue: number;
}

export interface SalesSummary {
  open: { count: number; value: number };
  won: { count: number; value: number };
  lost: { count: number; value: number };
  winRate: number;
  totalValue: number;
}

export interface FunnelSalesData {
  funnelId: string;
  funnelName: string;
  funnelColor: string;
  open: number;
  won: number;
  lost: number;
  wonValue: number;
}

export interface OwnerSalesData {
  userId: string;
  userName: string;
  wonCount: number;
  lostCount: number;
  wonValue: number;
  lostValue: number;
  openValue: number;
  totalDeals: number;
  avgTicket: number;
}

export interface GroupSalesData {
  groupId: string;
  groupName: string;
  open: number;
  won: number;
  lost: number;
  openValue: number;
  wonValue: number;
  lostValue: number;
  totalDeals: number;
  avgTicket: number;
}

export interface SalesReportData {
  timeline: SalesTimelineData[];
  summary: SalesSummary;
  newLeads: number;
  avgTicket: number;
  avgCycleDays: number;
  totalPipeline: number;
  byFunnel: FunnelSalesData[];
  byOwner: OwnerSalesData[];
  byGroup: GroupSalesData[];
}

export interface ConversionStageData {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
  isFinal: boolean;
  dealCount: number;
  totalValue: number;
}

export function useCRMSalesReport(params: {
  startDate?: string;
  endDate?: string;
  funnelId?: string;
  groupBy?: 'day' | 'week' | 'month';
  groupId?: string;
  ownerId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.startDate) searchParams.append('start_date', params.startDate);
  if (params.endDate) searchParams.append('end_date', params.endDate);
  if (params.funnelId) searchParams.append('funnel_id', params.funnelId);
  if (params.groupBy) searchParams.append('group_by', params.groupBy);
  if (params.groupId) searchParams.append('group_id', params.groupId);
  if (params.ownerId) searchParams.append('owner_id', params.ownerId);

  return useQuery({
    queryKey: ["crm-sales-report", params],
    queryFn: async () => {
      return api<SalesReportData>(`/api/crm/reports/sales?${searchParams.toString()}`);
    },
  });
}

export function useCRMConversionReport(params: {
  funnelId: string;
  startDate?: string;
  endDate?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.append('funnel_id', params.funnelId);
  if (params.startDate) searchParams.append('start_date', params.startDate);
  if (params.endDate) searchParams.append('end_date', params.endDate);

  return useQuery({
    queryKey: ["crm-conversion-report", params],
    queryFn: async () => {
      return api<ConversionStageData[]>(`/api/crm/reports/conversion?${searchParams.toString()}`);
    },
    enabled: !!params.funnelId,
  });
}

// ============================================
// REVENUE INTELLIGENCE HOOKS
// ============================================

export interface RevenueForecast {
  pipeline: Array<{
    funnel_name: string;
    stage_name: string;
    position: number;
    is_final: boolean;
    deal_count: number;
    total_value: number;
    avg_lead_score: number;
  }>;
  historical_wins: Array<{
    month: string;
    won_count: number;
    won_value: number;
  }>;
  avg_deal_value: number;
  avg_days_to_close: number;
  current_pipeline_value: number;
  forecast: Array<{
    month: string;
    projected: number;
    optimistic: number;
    pessimistic: number;
    confidence: number;
  }>;
}

export interface PipelineVelocity {
  velocity: number;
  metrics: {
    won_deals: number;
    open_deals: number;
    avg_deal_value: number;
    avg_cycle_days: number;
    win_rate: number;
  };
  stage_conversion: Array<{
    stage_id: string;
    stage_name: string;
    position: number;
    deals_entered: number;
    deals_won: number;
    conversion_rate: number;
  }>;
  stage_time: Array<{
    stage_name: string;
    position: number;
    avg_days_in_stage: number;
  }>;
}

export interface WinLossAnalysis {
  summary: {
    won: {
      count: number;
      total_value: number;
      avg_value: number;
      avg_days: number;
    };
    lost: {
      count: number;
      total_value: number;
      avg_value: number;
      avg_days: number;
    };
    win_rate: number;
  };
  loss_reasons: Array<{
    reason: string;
    count: number;
    lost_value: number;
  }>;
  by_owner: Array<{
    user_id: string;
    user_name: string;
    won_count: number;
    lost_count: number;
    won_value: number;
    win_rate: number;
  }>;
  by_segment: Array<{
    segment: string;
    won_count: number;
    lost_count: number;
    won_value: number;
  }>;
  trend: Array<{
    month: string;
    won_count: number;
    lost_count: number;
    won_value: number;
    lost_value: number;
  }>;
}

export function useRevenueForecast(months?: number) {
  return useQuery({
    queryKey: ["revenue-forecast", months],
    queryFn: () => api<RevenueForecast>(`/api/crm/intelligence/revenue-forecast?months=${months || 6}`),
  });
}

export function usePipelineVelocity(funnelId?: string) {
  const params = new URLSearchParams();
  if (funnelId) params.set("funnel_id", funnelId);

  return useQuery({
    queryKey: ["pipeline-velocity", funnelId],
    queryFn: () => api<PipelineVelocity>(`/api/crm/intelligence/pipeline-velocity?${params.toString()}`),
  });
}

export function useWinLossAnalysis(params?: {
  startDate?: string;
  endDate?: string;
  funnelId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set("start_date", params.startDate);
  if (params?.endDate) searchParams.set("end_date", params.endDate);
  if (params?.funnelId) searchParams.set("funnel_id", params.funnelId);

  return useQuery({
    queryKey: ["win-loss-analysis", params],
    queryFn: () => api<WinLossAnalysis>(`/api/crm/intelligence/win-loss-analysis?${searchParams.toString()}`),
  });
}
