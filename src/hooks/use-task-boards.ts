import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ========== TYPES ==========

export interface TaskBoard {
  id: string;
  organization_id: string;
  name: string;
  is_global: boolean;
  created_by: string;
  creator_name?: string;
  card_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskBoardColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  is_done_column: boolean;
  created_at: string;
}

export interface TaskCard {
  id: string;
  organization_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  position: number;
  assigned_to?: string;
  assigned_name?: string;
  created_by: string;
  creator_name?: string;
  due_date?: string;
  start_date?: string;
  priority: string;
  cover_image_url?: string;
  deal_id?: string;
  deal_title?: string;
  company_id?: string;
  company_name?: string;
  contact_phone?: string;
  contact_name?: string;
  crm_task_id?: string;
  status: string;
  completed_at?: string;
  checklist_count?: number;
  checklist_total?: number;
  checklist_done?: number;
  attachment_count?: number;
  comment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCardDetail extends TaskCard {
  checklists: TaskChecklist[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
}

export interface TaskChecklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  template_id?: string;
  items: TaskChecklistItem[] | null;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
  position: number;
  due_date?: string;
  assigned_to?: string;
  completed_at?: string;
}

export interface TaskAttachment {
  id: string;
  card_id: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  card_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  organization_id: string;
  name: string;
  creator_name?: string;
  items: { id: string; title: string; position: number }[] | null;
  created_at: string;
}

// ========== HOOKS ==========

export function useTaskBoards() {
  return useQuery<TaskBoard[]>({
    queryKey: ["task-boards"],
    queryFn: () => api("/api/task-boards/boards", { auth: true }),
  });
}

export function useTaskBoardColumns(boardId: string | null) {
  return useQuery<TaskBoardColumn[]>({
    queryKey: ["task-board-columns", boardId],
    queryFn: () => api(`/api/task-boards/boards/${boardId}/columns`, { auth: true }),
    enabled: !!boardId,
  });
}

export function useTaskBoardCards(boardId: string | null) {
  return useQuery<TaskCard[]>({
    queryKey: ["task-board-cards", boardId],
    queryFn: () => api(`/api/task-boards/boards/${boardId}/cards`, { auth: true }),
    enabled: !!boardId,
  });
}

export function useTaskCardDetail(cardId: string | null) {
  return useQuery<TaskCardDetail>({
    queryKey: ["task-card-detail", cardId],
    queryFn: () => api(`/api/task-boards/cards/${cardId}`, { auth: true }),
    enabled: !!cardId,
  });
}

export function useChecklistTemplates() {
  return useQuery<ChecklistTemplate[]>({
    queryKey: ["checklist-templates"],
    queryFn: () => api("/api/task-boards/checklist-templates", { auth: true }),
  });
}

// ========== MUTATIONS ==========

export function useTaskBoardMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const createBoard = useMutation({
    mutationFn: (data: { name: string; is_global?: boolean; columns?: any[] }) =>
      api("/api/task-boards/boards", { method: "POST", body: data, auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Quadro criado!" });
    },
  });

  const updateBoard = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string }) =>
      api(`/api/task-boards/boards/${id}`, { method: "PUT", body: data, auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-boards"] });
    },
  });

  const deleteBoard = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/boards/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: "Quadro excluído" });
    },
  });

  return { createBoard, updateBoard, deleteBoard };
}

export function useTaskColumnMutations(boardId: string | null) {
  const qc = useQueryClient();

  const createColumn = useMutation({
    mutationFn: (data: { name: string; color?: string; is_done_column?: boolean }) =>
      api(`/api/task-boards/boards/${boardId}/columns`, { method: "POST", body: data, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-board-columns", boardId] }),
  });

  const updateColumn = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string; is_done_column?: boolean }) =>
      api(`/api/task-boards/columns/${id}`, { method: "PUT", body: data, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-board-columns", boardId] }),
  });

  const deleteColumn = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/columns/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-board-columns", boardId] });
      qc.invalidateQueries({ queryKey: ["task-board-cards", boardId] });
    },
  });

  const reorderColumns = useMutation({
    mutationFn: (column_ids: string[]) =>
      api(`/api/task-boards/boards/${boardId}/columns/reorder`, { method: "PUT", body: { column_ids }, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-board-columns", boardId] }),
  });

  return { createColumn, updateColumn, deleteColumn, reorderColumns };
}

export function useTaskCardMutations(boardId?: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    if (boardId) qc.invalidateQueries({ queryKey: ["task-board-cards", boardId] });
    qc.invalidateQueries({ queryKey: ["task-boards"] });
  };

  const createCard = useMutation({
    mutationFn: (data: Partial<TaskCard>) =>
      api("/api/task-boards/cards", { method: "POST", body: data, auth: true }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Card criado!" });
    },
  });

  const updateCard = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TaskCard>) =>
      api(`/api/task-boards/cards/${id}`, { method: "PUT", body: data, auth: true }),
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["task-card-detail", vars.id] });
    },
  });

  const moveCard = useMutation({
    mutationFn: ({ id, ...data }: { id: string; column_id?: string; position?: number; board_id?: string }) =>
      api(`/api/task-boards/cards/${id}/move`, { method: "POST", body: data, auth: true }),
    onSuccess: () => {
      invalidate();
      // Also invalidate all boards since card might move between boards
      qc.invalidateQueries({ queryKey: ["task-board-cards"] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/cards/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Card excluído" });
    },
  });

  return { createCard, updateCard, moveCard, deleteCard };
}

export function useChecklistMutations(cardId: string | null) {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["task-card-detail", cardId] });

  const addChecklist = useMutation({
    mutationFn: (data: { title: string; template_id?: string }) =>
      api(`/api/task-boards/cards/${cardId}/checklists`, { method: "POST", body: data, auth: true }),
    onSuccess: invalidate,
  });

  const deleteChecklist = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/checklists/${id}`, { method: "DELETE", auth: true }),
    onSuccess: invalidate,
  });

  const addChecklistItem = useMutation({
    mutationFn: ({ checklistId, title }: { checklistId: string; title: string }) =>
      api(`/api/task-boards/checklists/${checklistId}/items`, { method: "POST", body: { title }, auth: true }),
    onSuccess: invalidate,
  });

  const toggleChecklistItem = useMutation({
    mutationFn: ({ id, is_completed }: { id: string; is_completed: boolean }) =>
      api(`/api/task-boards/checklist-items/${id}`, { method: "PUT", body: { is_completed }, auth: true }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["task-board-cards"] });
    },
  });

  const deleteChecklistItem = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/checklist-items/${id}`, { method: "DELETE", auth: true }),
    onSuccess: invalidate,
  });

  return { addChecklist, deleteChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem };
}

export function useTaskAttachmentMutations(cardId: string | null) {
  const qc = useQueryClient();

  const addAttachment = useMutation({
    mutationFn: (data: { file_url: string; file_name: string; file_type?: string; file_size?: number }) =>
      api(`/api/task-boards/cards/${cardId}/attachments`, { method: "POST", body: data, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-card-detail", cardId] }),
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/attachments/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-card-detail", cardId] }),
  });

  return { addAttachment, deleteAttachment };
}

export function useTaskCommentMutations(cardId: string | null) {
  const qc = useQueryClient();

  const addComment = useMutation({
    mutationFn: (content: string) =>
      api(`/api/task-boards/cards/${cardId}/comments`, { method: "POST", body: { content }, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-card-detail", cardId] }),
  });

  const deleteComment = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/comments/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-card-detail", cardId] }),
  });

  return { addComment, deleteComment };
}

export function useChecklistTemplateMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const createTemplate = useMutation({
    mutationFn: (data: { name: string; items: { title: string }[] }) =>
      api("/api/task-boards/checklist-templates", { method: "POST", body: data, auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast({ title: "Template criado!" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; items: { title: string }[] }) =>
      api(`/api/task-boards/checklist-templates/${id}`, { method: "PUT", body: data, auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) =>
      api(`/api/task-boards/checklist-templates/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast({ title: "Template excluído" });
    },
  });

  return { createTemplate, updateTemplate, deleteTemplate };
}

export function useMigrateCRMTasks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () =>
      api<{ migrated: number }>("/api/task-boards/migrate-crm-tasks", { method: "POST", auth: true }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["task-board-cards"] });
      qc.invalidateQueries({ queryKey: ["task-boards"] });
      toast({ title: `${data.migrated} tarefas migradas com sucesso!` });
    },
  });
}

export function useEnsureDefaultBoard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api("/api/task-boards/ensure-default-board", { method: "POST", auth: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-boards"] });
    },
  });
}
