import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Types
export interface ProjectStage {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  color: string;
  is_final: boolean;
}

export interface Project {
  id: string;
  organization_id: string;
  deal_id: string | null;
  stage_id: string | null;
  title: string;
  description: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  priority: string;
  due_date: string | null;
  position: number;
  stage_name: string | null;
  stage_color: string | null;
  deal_title: string | null;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectAttachment {
  id: string;
  project_id: string;
  name: string;
  url: string;
  mimetype: string;
  size: number;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  depends_on: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  task_count: number;
}

export interface ProjectTemplateTask {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  position: number;
  duration_days: number;
  depends_on_position: number | null;
}

export interface ProjectNoteNotification {
  id: string;
  user_id: string;
  project_id: string;
  note_id: string;
  project_title: string;
  sender_name: string;
  content_preview: string;
  read: boolean;
  created_at: string;
}

// Hooks
export function useProjectStages() {
  return useQuery<ProjectStage[]>({
    queryKey: ["project-stages"],
    queryFn: () => api("/api/projects/stages", { auth: true }),
  });
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api("/api/projects", { auth: true }),
  });
}

export function useProject(id: string | null) {
  return useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => api(`/api/projects/${id}`, { auth: true }),
    enabled: !!id,
  });
}

export function useProjectsByDeal(dealId: string | null) {
  return useQuery<Project[]>({
    queryKey: ["projects-by-deal", dealId],
    queryFn: () => api(`/api/projects/by-deal/${dealId}`, { auth: true }),
    enabled: !!dealId,
  });
}

export function useProjectAttachments(projectId: string | null) {
  return useQuery<ProjectAttachment[]>({
    queryKey: ["project-attachments", projectId],
    queryFn: () => api(`/api/projects/${projectId}/attachments`, { auth: true }),
    enabled: !!projectId,
  });
}

export function useProjectNotes(projectId: string | null) {
  return useQuery<ProjectNote[]>({
    queryKey: ["project-notes", projectId],
    queryFn: () => api(`/api/projects/${projectId}/notes`, { auth: true }),
    enabled: !!projectId,
  });
}

export function useProjectTasks(projectId: string | null) {
  return useQuery<ProjectTask[]>({
    queryKey: ["project-tasks", projectId],
    queryFn: () => api(`/api/projects/${projectId}/tasks`, { auth: true }),
    enabled: !!projectId,
  });
}

export function useProjectTemplates() {
  return useQuery<ProjectTemplate[]>({
    queryKey: ["project-templates"],
    queryFn: () => api("/api/projects/templates", { auth: true }),
  });
}

export function useProjectTemplateTasks(templateId: string | null) {
  return useQuery<ProjectTemplateTask[]>({
    queryKey: ["project-template-tasks", templateId],
    queryFn: () => api(`/api/projects/templates/${templateId}/tasks`, { auth: true }),
    enabled: !!templateId,
  });
}

export function useIsDesigner() {
  return useQuery<{ isDesigner: boolean }>({
    queryKey: ["is-designer"],
    queryFn: () => api("/api/projects/check-designer", { auth: true }),
  });
}

export function useProjectNoteNotifications() {
  return useQuery<ProjectNoteNotification[]>({
    queryKey: ["project-note-notifications"],
    queryFn: () => api("/api/projects/note-notifications/unread", { auth: true }),
    refetchInterval: 10000,
  });
}

export function useProjectNoteNotificationMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project-note-notifications"] });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/api/projects/note-notifications/${id}/read`, { method: "POST", auth: true }),
    onSuccess: inv,
  });

  const markAllRead = useMutation({
    mutationFn: () => api("/api/projects/note-notifications/read-all", { method: "POST", auth: true }),
    onSuccess: inv,
  });

  return { markRead, markAllRead };
}
export function useProjectStageMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project-stages"] });

  const create = useMutation({
    mutationFn: (data: Partial<ProjectStage>) => api("/api/projects/stages", { method: "POST", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Etapa criada!"); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<ProjectStage> & { id: string }) =>
      api(`/api/projects/stages/${id}`, { method: "PATCH", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Etapa atualizada!"); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/projects/stages/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => { inv(); toast.success("Etapa removida!"); },
  });

  const reorder = useMutation({
    mutationFn: (stages: { id: string; position: number }[]) =>
      api("/api/projects/stages/reorder", { method: "POST", body: { stages }, auth: true }),
    onSuccess: () => { inv(); },
  });

  return { create, update, remove, reorder };
}

export function useProjectMutations() {
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["projects-by-deal"] });
  };

  const create = useMutation({
    mutationFn: (data: any) => api("/api/projects", { method: "POST", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Projeto criado!"); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/projects/${id}`, { method: "PATCH", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Projeto atualizado!"); },
  });

  const move = useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/projects/${id}/move`, { method: "POST", body: data, auth: true }),
    onSuccess: () => inv(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/projects/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => { inv(); toast.success("Projeto removido!"); },
  });

  return { create, update, move, remove };
}

export function useProjectNoteMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; content: string; parent_id?: string }) =>
      api(`/api/projects/${projectId}/notes`, { method: "POST", body: data, auth: true }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["project-notes", vars.projectId] }),
  });

  const remove = useMutation({
    mutationFn: ({ noteId, projectId }: { noteId: string; projectId: string }) =>
      api(`/api/projects/notes/${noteId}`, { method: "DELETE", auth: true }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["project-notes", vars.projectId] }),
  });

  return { create, remove };
}

export function useProjectAttachmentMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; name: string; url: string; mimetype: string; size: number }) =>
      api(`/api/projects/${projectId}/attachments`, { method: "POST", body: data, auth: true }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["project-attachments", vars.projectId] }); toast.success("Arquivo anexado!"); },
  });

  const remove = useMutation({
    mutationFn: ({ attId, projectId }: { attId: string; projectId: string }) =>
      api(`/api/projects/attachments/${attId}`, { method: "DELETE", auth: true }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["project-attachments", vars.projectId] }); toast.success("Arquivo removido!"); },
  });

  return { create, remove };
}

export function useProjectTaskMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: ({ projectId, ...data }: any) =>
      api(`/api/projects/${projectId}/tasks`, { method: "POST", body: data, auth: true }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["project-tasks", vars.projectId] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const update = useMutation({
    mutationFn: ({ taskId, projectId, ...data }: any) =>
      api(`/api/projects/tasks/${taskId}`, { method: "PATCH", body: data, auth: true }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["project-tasks", vars.projectId] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const remove = useMutation({
    mutationFn: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
      api(`/api/projects/tasks/${taskId}`, { method: "DELETE", auth: true }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["project-tasks", vars.projectId] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const applyTemplate = useMutation({
    mutationFn: ({ projectId, template_id, assigned_to, start_date }: { projectId: string; template_id: string; assigned_to?: string; start_date?: string }) =>
      api(`/api/projects/${projectId}/apply-template`, { method: "POST", body: { template_id, assigned_to, start_date }, auth: true }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-tasks", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Template aplicado!");
    },
  });

  return { create, update, remove, applyTemplate };
}

export function useProjectTemplateMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["project-templates"] });

  const create = useMutation({
    mutationFn: (data: any) => api("/api/projects/templates", { method: "POST", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Template criado!"); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/projects/templates/${id}`, { method: "PATCH", body: data, auth: true }),
    onSuccess: () => { inv(); toast.success("Template atualizado!"); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/projects/templates/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => { inv(); toast.success("Template removido!"); },
  });

  return { create, update, remove };
}
