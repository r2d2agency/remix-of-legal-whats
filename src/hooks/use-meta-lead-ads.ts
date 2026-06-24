import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export interface MetaPage {
  id: string;
  external_id: string;
  external_name: string | null;
  kind: string;
  status: string;
  forms_count: number;
  created_at: string;
  updated_at: string;
}

export interface MetaLeadForm {
  id: string;
  organization_id: string;
  meta_page_id: string;
  form_id: string;
  form_name: string | null;
  is_active: boolean;
  funnel_id: string | null;
  stage_id: string | null;
  assignee_user_id: string | null;
  distribution_rule_id: string | null;
  trigger_flow_id: string | null;
  connection_id: string | null;
  open_chat: boolean;
  field_mapping: Record<string, string>;
  default_tags: string[];
  page_name?: string | null;
  page_external_id?: string;
  leads_count?: number;
}

export interface MetaLeadEvent {
  id: string;
  leadgen_id: string;
  status: "received" | "processed" | "failed";
  error: string | null;
  ad_id: string | null;
  raw_payload: any;
  prospect_id: string | null;
  prospect_name: string | null;
  form_name: string | null;
  page_name: string | null;
  received_at: string;
  processed_at: string | null;
}

export function useMetaPages() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["meta-lead-ads", "pages"],
    queryFn: () => api<MetaPage[]>("/api/meta/lead-ads/pages"),
  });
  const createPage = useMutation({
    mutationFn: (data: { page_id: string; page_name?: string; page_access_token: string }) =>
      api("/api/meta/lead-ads/pages", { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-lead-ads"] }); toast.success("Página conectada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deletePage = useMutation({
    mutationFn: (id: string) => api(`/api/meta/lead-ads/pages/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-lead-ads"] }); toast.success("Página removida"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncForms = useMutation({
    mutationFn: (id: string) => api(`/api/meta/lead-ads/pages/${id}/sync-forms`, { method: "POST" }),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ["meta-lead-ads"] }); toast.success(`Sincronizados ${data?.synced ?? 0} formulários`); },
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...q, createPage, deletePage, syncForms };
}

export function useMetaLeadForms() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["meta-lead-ads", "forms"],
    queryFn: () => api<MetaLeadForm[]>("/api/meta/lead-ads/forms"),
  });
  const updateForm = useMutation({
    mutationFn: ({ id, ...data }: Partial<MetaLeadForm> & { id: string }) =>
      api(`/api/meta/lead-ads/forms/${id}`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-lead-ads"] }); toast.success("Formulário atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...q, updateForm };
}

export function useMetaLeadEvents() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["meta-lead-ads", "events"],
    queryFn: () => api<MetaLeadEvent[]>("/api/meta/lead-ads/events"),
    refetchInterval: 30000,
  });
  const reprocess = useMutation({
    mutationFn: (id: string) => api(`/api/meta/lead-ads/events/${id}/reprocess`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-lead-ads", "events"] }); toast.success("Reprocessado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return { ...q, reprocess };
}