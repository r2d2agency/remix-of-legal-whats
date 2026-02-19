import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FolderKanban,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  Paperclip,
  StickyNote,
  Send,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useProjectsByDeal,
  useProjects,
  useProjectTasks,
  useProjectNotes,
  useProjectAttachments,
  useProjectNoteMutations,
  useProjectTaskMutations,
  Project,
  ProjectTask,
  ProjectNote,
  ProjectAttachment,
} from "@/hooks/use-projects";
import { useCRMDealsByPhone } from "@/hooks/use-crm";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ProjectSidePanelProps {
  conversationId: string;
  contactPhone: string | null;
  contactName: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

export function ProjectSidePanel({
  conversationId,
  contactPhone,
  contactName,
  isOpen,
  onToggle,
}: ProjectSidePanelProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get deals linked to this contact to find projects
  const { data: deals = [] } = useCRMDealsByPhone(contactPhone);
  const { data: allProjects = [], isLoading: loadingProjects } = useProjects();

  // Find projects linked to any of the contact's deals
  const contactProjects = allProjects.filter(
    (p) => deals.some((d) => d.id === p.deal_id)
  );

  // Selected project for detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Detail data
  const { data: tasks = [], refetch: refetchTasks } = useProjectTasks(selectedProject?.id || null);
  const { data: notes = [], refetch: refetchNotes } = useProjectNotes(selectedProject?.id || null);
  const { data: attachments = [] } = useProjectAttachments(selectedProject?.id || null);

  const noteMut = useProjectNoteMutations();
  const taskMut = useProjectTaskMutations();

  const [newNote, setNewNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  // Reset selection when conversation changes
  useEffect(() => {
    setSelectedProject(null);
  }, [conversationId]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedProject) return;
    setSendingNote(true);
    try {
      await noteMut.create.mutateAsync({ projectId: selectedProject.id, content: newNote.trim() });
      setNewNote("");
      refetchNotes();
    } catch {
      toast.error("Erro ao adicionar nota");
    }
    setSendingNote(false);
  };

  const handleToggleTask = async (task: ProjectTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await taskMut.update.mutateAsync({
        taskId: task.id,
        projectId: selectedProject!.id,
        status: newStatus,
      });
      refetchTasks();
    } catch {
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "high": return "text-red-500";
      case "urgent": return "text-red-700";
      case "low": return "text-muted-foreground";
      default: return "text-yellow-500";
    }
  };

  const priorityLabel = (p: string) => {
    switch (p) {
      case "high": return "Alta";
      case "urgent": return "Urgente";
      case "low": return "Baixa";
      default: return "Média";
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex-shrink-0 border-l bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors",
          isMobile ? "hidden" : "w-8"
        )}
        title="Abrir Projetos"
      >
        <div className="flex flex-col items-center gap-1">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        </div>
      </button>
    );
  }

  // Detail view for a selected project
  if (selectedProject) {
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <div className={cn("flex-shrink-0 border-l bg-background flex flex-col", isMobile ? "w-full" : "w-[340px]")}>
        {/* Header */}
        <div className="p-3 border-b flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedProject(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{selectedProject.title}</h3>
            {selectedProject.stage_name && (
              <Badge variant="outline" className="text-xs mt-0.5" style={{ borderColor: selectedProject.stage_color || undefined }}>
                {selectedProject.stage_name}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/projetos")} title="Abrir Projetos">
            <ExternalLink className="h-4 w-4" />
          </Button>
          {!isMobile && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress */}
        {totalTasks > 0 && (
          <div className="px-3 py-2 border-b">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso</span>
              <span>{completedTasks}/{totalTasks} ({progress}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <Accordion type="multiple" defaultValue={["tasks", "notes"]} className="px-3">
            {/* Tasks */}
            <AccordionItem value="tasks">
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Tarefas ({totalTasks})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleToggleTask(task)}
                      className="flex items-start gap-2 w-full text-left p-1.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      {task.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <span className={cn("text-xs", task.status === "completed" && "line-through text-muted-foreground")}>
                        {task.title}
                      </span>
                    </button>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma tarefa</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notes */}
            <AccordionItem value="notes">
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notas ({notes.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-muted/50 rounded p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">{note.user_name || "Usuário"}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(parseISO(note.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma nota</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Attachments */}
            <AccordionItem value="attachments">
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Anexos ({attachments.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors text-xs text-primary underline"
                    >
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{att.name}</span>
                    </a>
                  ))}
                  {attachments.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Nenhum anexo</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>

        {/* Add note input */}
        <div className="border-t p-2 flex gap-1">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Adicionar nota..."
            className="text-xs min-h-[36px] max-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleAddNote} disabled={sendingNote || !newNote.trim()}>
            {sendingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Project list view
  return (
    <div className={cn("flex-shrink-0 border-l bg-background flex flex-col", isMobile ? "w-full" : "w-[340px]")}>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Projetos</h3>
          {contactProjects.length > 0 && (
            <Badge variant="secondary" className="text-xs">{contactProjects.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/projetos")} title="Abrir Projetos">
            <ExternalLink className="h-4 w-4" />
          </Button>
          {!isMobile && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loadingProjects ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contactProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum projeto vinculado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {contactName ? `${contactName} não tem projetos associados.` : "Este contato não tem projetos."}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {contactProjects.map((project) => {
              const progress = project.total_tasks > 0
                ? Math.round((project.completed_tasks / project.total_tasks) * 100)
                : 0;

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="w-full text-left bg-muted/30 hover:bg-muted/60 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-sm truncate flex-1">{project.title}</h4>
                    <Badge variant="outline" className={cn("text-[10px] ml-2", priorityColor(project.priority))}>
                      {priorityLabel(project.priority)}
                    </Badge>
                  </div>

                  {project.stage_name && (
                    <Badge variant="outline" className="text-[10px] mb-1.5" style={{ borderColor: project.stage_color || undefined }}>
                      {project.stage_name}
                    </Badge>
                  )}

                  {project.deal_title && (
                    <p className="text-[10px] text-muted-foreground truncate mb-1">
                      Negociação: {project.deal_title}
                    </p>
                  )}

                  {project.total_tasks > 0 && (
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>{project.completed_tasks}/{project.total_tasks} tarefas</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1">
                        <div className="bg-primary rounded-full h-1 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {project.due_date && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Prazo: {format(parseISO(project.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
