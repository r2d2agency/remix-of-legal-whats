import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface StageAutomation {
  id: string;
  stage_id: string;
  flow_id: string | null;
  flow_name?: string;
  wait_hours: number;
  next_stage_id: string | null;
  next_stage_name?: string;
  fallback_funnel_id: string | null;
  fallback_funnel_name?: string;
  fallback_stage_id: string | null;
  fallback_stage_name?: string;
  is_active: boolean;
  execute_immediately: boolean;
  conditions?: Array<{ id: string; variable: string; operator: string; value: string }>;
  condition_logic?: string;
  condition_true_flow_id?: string | null;
  condition_true_stage_id?: string | null;
  condition_false_flow_id?: string | null;
  condition_false_stage_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealAutomation {
  id: string;
  deal_id: string;
  stage_id: string;
  stage_name?: string;
  automation_id: string | null;
  status: 'pending' | 'flow_sent' | 'waiting' | 'responded' | 'moved' | 'cancelled';
  flow_id: string | null;
  flow_name?: string;
  flow_session_id: string | null;
  flow_sent_at: string | null;
  wait_until: string | null;
  responded_at: string | null;
  moved_at: string | null;
  next_stage_id: string | null;
  next_stage_name?: string;
  contact_phone: string | null;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  deal_automation_id: string | null;
  deal_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Get automation config for a stage
export function useStageAutomation(stageId: string | null) {
  return useQuery({
    queryKey: ["stage-automation", stageId],
    queryFn: async () => {
      if (!stageId) return null;
      return api<StageAutomation | null>(`/api/crm/automation/stages/${stageId}/automation`);
    },
    enabled: !!stageId,
  });
}

// Get all automations for a funnel
export function useFunnelAutomations(funnelId: string | null) {
  return useQuery({
    queryKey: ["funnel-automations", funnelId],
    queryFn: async () => {
      if (!funnelId) return [];
      return api<(StageAutomation & { stage_name: string; position: number })[]>(
        `/api/crm/automation/funnels/${funnelId}/automations`
      );
    },
    enabled: !!funnelId,
  });
}

// Get automation status for a deal
export function useDealAutomationStatus(dealId: string | null) {
  return useQuery({
    queryKey: ["deal-automation-status", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      return api<DealAutomation[]>(`/api/crm/automation/deals/${dealId}/automation-status`);
    },
    enabled: !!dealId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get automation logs for a deal
export function useDealAutomationLogs(dealId: string | null) {
  return useQuery({
    queryKey: ["deal-automation-logs", dealId],
    queryFn: async () => {
      if (!dealId) return [];
      return api<AutomationLog[]>(`/api/crm/automation/deals/${dealId}/automation-logs`);
    },
    enabled: !!dealId,
  });
}

// Mutations
export function useStageAutomationMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveAutomation = useMutation({
    mutationFn: async ({
      stageId,
      ...data
    }: {
      stageId: string;
      flow_id?: string | null;
      wait_hours?: number;
      next_stage_id?: string | null;
      fallback_funnel_id?: string | null;
      fallback_stage_id?: string | null;
      is_active?: boolean;
      execute_immediately?: boolean;
    }) => {
      return api<StageAutomation>(`/api/crm/automation/stages/${stageId}/automation`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stage-automation", variables.stageId] });
      queryClient.invalidateQueries({ queryKey: ["funnel-automations"] });
      toast({ title: "Automação salva com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar automação", description: error.message, variant: "destructive" });
    },
  });

  const deleteAutomation = useMutation({
    mutationFn: async (stageId: string) => {
      return api<void>(`/api/crm/automation/stages/${stageId}/automation`, { method: "DELETE" });
    },
    onSuccess: (_, stageId) => {
      queryClient.invalidateQueries({ queryKey: ["stage-automation", stageId] });
      queryClient.invalidateQueries({ queryKey: ["funnel-automations"] });
      toast({ title: "Automação removida" });
    },
  });

  return { saveAutomation, deleteAutomation };
}

export function useDealAutomationMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startAutomation = useMutation({
    mutationFn: async (dealId: string) => {
      return api<DealAutomation>(`/api/crm/automation/deals/${dealId}/start-automation`, { method: "POST" });
    },
    onSuccess: (_, dealId) => {
      queryClient.invalidateQueries({ queryKey: ["deal-automation-status", dealId] });
      toast({ title: "Automação iniciada" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao iniciar automação", description: error.message, variant: "destructive" });
    },
  });

  const cancelAutomation = useMutation({
    mutationFn: async (dealId: string) => {
      return api<{ success: boolean; cancelled: number }>(
        `/api/crm/automation/deals/${dealId}/cancel-automation`,
        { method: "POST" }
      );
    },
    onSuccess: (_, dealId) => {
      queryClient.invalidateQueries({ queryKey: ["deal-automation-status", dealId] });
      toast({ title: "Automação cancelada" });
    },
  });

  const bulkStartAutomation = useMutation({
    mutationFn: async ({ dealIds, targetStageId }: { dealIds: string[]; targetStageId: string }) => {
      return api<{ success: boolean; started: number; failed: number }>(
        `/api/crm/automation/deals/bulk-start-automation`,
        { method: "POST", body: { deal_ids: dealIds, target_stage_id: targetStageId } }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      toast({ title: `${data.started} negociações iniciadas na automação` });
    },
  });

  return { startAutomation, cancelAutomation, bulkStartAutomation };
}
