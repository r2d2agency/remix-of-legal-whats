import { useState, useMemo, useEffect } from "react";
import { api } from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, Settings, FolderKanban, Trash2, GripVertical, Edit,
  FileText, MessageSquare, CheckSquare, Paperclip, Upload, Loader2, X,
  Calendar, User, ArrowRight, ExternalLink, Clock, Send, Reply, LayoutTemplate,
  BarChart3, ChevronDown, ChevronUp as ChevronUpIcon
} from "lucide-react";
import { ProjectKanbanBoard } from "@/components/projects/ProjectKanbanBoard";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUpload } from "@/hooks/use-upload";
import { useOrganizations } from "@/hooks/use-organizations";
import { resolveMediaUrl } from "@/lib/media";
import { useNavigate } from "react-router-dom";
import {
  useProjectStages, useProjects, useProjectMutations, useProjectStageMutations,
  useProjectAttachments, useProjectNotes, useProjectTasks, useProjectTemplates,
  useProjectTemplateTasks, useProjectNoteMutations, useProjectAttachmentMutations,
  useProjectTaskMutations, useProjectTemplateMutations, useIsDesigner,
  Project, ProjectStage, ProjectTask, ProjectNote, ProjectTemplate
} from "@/hooks/use-projects";

export default function Projetos() {
  const { user } = useAuth();
  const { data: stages = [], isLoading: loadingStages } = useProjectStages();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: templates = [] } = useProjectTemplates();
  const { data: designerCheck } = useIsDesigner();
  const projectMut = useProjectMutations();
  const stageMut = useProjectStageMutations();
  const templateMut = useProjectTemplateMutations();

  const [search, setSearch] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Create project state
  const [newProject, setNewProject] = useState({ title: "", description: "", priority: "medium", template_id: "" });

  // Stage editor state
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateTasks, setTemplateTasks] = useState<Array<{ title: string; duration_days: number }>>([]);

  const isAdmin = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const isDesignerUser = designerCheck?.isDesigner || false;
  const canEdit = isAdmin || isDesignerUser;

  // Group projects by stage
  const projectsByStage = useMemo(() => {
    const map: Record<string, Project[]> = {};
    const filtered = projects.filter(p =>
      !search || p.title.toLowerCase().includes(search.toLowerCase())
    );
    for (const stage of stages) {
      map[stage.id] = filtered.filter(p => p.stage_id === stage.id);
    }
    // Unassigned
    const unassigned = filtered.filter(p => !p.stage_id || !stages.find(s => s.id === p.stage_id));
    if (unassigned.length > 0) {
      map['_unassigned'] = unassigned;
    }
    return map;
  }, [projects, stages, search]);

  const handleCreateProject = () => {
    if (!newProject.title.trim()) return toast.error("Título obrigatório");
    projectMut.create.mutate({
      title: newProject.title,
      description: newProject.description,
      priority: newProject.priority,
      template_id: newProject.template_id && newProject.template_id !== "none" ? newProject.template_id : undefined,
    }, {
      onSuccess: () => {
        setShowCreateProject(false);
        setNewProject({ title: "", description: "", priority: "medium", template_id: "" });
      }
    });
  };

  const handleCreateStage = () => {
    if (!newStageName.trim()) return;
    stageMut.create.mutate({ name: newStageName, color: newStageColor }, {
      onSuccess: () => { setNewStageName(""); setNewStageColor("#6366f1"); }
    });
  };

  const handleMoveProject = (projectId: string, stageId: string) => {
    projectMut.move.mutate({ id: projectId, stage_id: stageId });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return toast.error("Nome obrigatório");
    const validTasks = templateTasks.filter(t => t.title.trim());
    const onSuccess = () => {
      setShowTemplateEditor(false);
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateDesc("");
      setTemplateTasks([]);
    };
    const onError = () => toast.error("Erro ao salvar template. Verifique se o módulo de projetos está ativo no plano.");
    if (editingTemplate?.id) {
      templateMut.update.mutate({ id: editingTemplate.id, name: templateName, description: templateDesc, tasks: validTasks }, { onSuccess, onError });
    } else {
      templateMut.create.mutate({ name: templateName, description: templateDesc, tasks: validTasks }, { onSuccess, onError });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FolderKanban className="h-6 w-6 text-primary" />
              Projetos
            </h1>
            <p className="text-sm text-muted-foreground">{projects.length} projeto(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[150px] sm:w-64 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {canEdit && (
              <Button onClick={() => setShowCreateProject(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Novo Projeto</span><span className="sm:hidden">Novo</span>
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowStageEditor(true)}>
                  <Settings className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Etapas</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowTemplateEditor(true); setEditingTemplate(null); setTemplateName(""); setTemplateDesc(""); setTemplateTasks([]); }}>
                  <LayoutTemplate className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Templates</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        {loadingStages || loadingProjects ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stages.length === 0 ? (
          <Card className="py-16 text-center">
            <CardContent>
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma etapa configurada</h3>
              <p className="text-muted-foreground mb-4">Crie etapas para organizar seus projetos no Kanban.</p>
              {isAdmin && (
                <Button onClick={() => setShowStageEditor(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Criar Etapas
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <ProjectKanbanBoard
            stages={stages}
            projectsByStage={projectsByStage}
            onProjectClick={(p) => setSelectedProject(p)}
            canEdit={canEdit}
          />
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))} placeholder="Nome do projeto" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o projeto..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioridade</Label>
                <Select value={newProject.priority} onValueChange={v => setNewProject(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={newProject.template_id} onValueChange={v => setNewProject(p => ({ ...p, template_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem template</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.task_count} tarefas)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProject(false)}>Cancelar</Button>
            <Button onClick={handleCreateProject} disabled={projectMut.create.isPending}>
              {projectMut.create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Editor Dialog */}
      <Dialog open={showStageEditor} onOpenChange={setShowStageEditor}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerenciar Etapas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add new stage */}
            <div className="flex gap-2">
              <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Nova etapa..." className="flex-1" />
              <input type="color" value={newStageColor} onChange={e => setNewStageColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
              <Button size="sm" onClick={handleCreateStage}><Plus className="h-4 w-4" /></Button>
            </div>

            {/* Stage list with edit/reorder */}
            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  {editingStage?.id === stage.id ? (
                    <>
                      <input
                        type="color"
                        value={editStageColor}
                        onChange={e => setEditStageColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                      <Input
                        value={editStageName}
                        onChange={e => setEditStageName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            stageMut.update.mutate({ id: stage.id, name: editStageName, color: editStageColor });
                            setEditingStage(null);
                          }
                          if (e.key === 'Escape') setEditingStage(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        stageMut.update.mutate({ id: stage.id, name: editStageName, color: editStageColor });
                        setEditingStage(null);
                      }}>
                        <CheckSquare className="h-3 w-3 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStage(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost" size="icon" className="h-5 w-5"
                          disabled={idx === 0}
                          onClick={() => {
                            const reordered = stages.map((s, i) => ({
                              id: s.id,
                              position: i === idx ? idx - 1 : i === idx - 1 ? idx : i
                            }));
                            stageMut.reorder.mutate(reordered);
                          }}
                        >
                          <ArrowRight className="h-3 w-3 -rotate-90" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-5 w-5"
                          disabled={idx === stages.length - 1}
                          onClick={() => {
                            const reordered = stages.map((s, i) => ({
                              id: s.id,
                              position: i === idx ? idx + 1 : i === idx + 1 ? idx : i
                            }));
                            stageMut.reorder.mutate(reordered);
                          }}
                        >
                          <ArrowRight className="h-3 w-3 rotate-90" />
                        </Button>
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="flex-1 text-sm font-medium">{stage.name}</span>
                      {stage.is_final && <Badge variant="outline" className="text-xs">Final</Badge>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingStage(stage);
                        setEditStageName(stage.name);
                        setEditStageColor(stage.color);
                      }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => stageMut.remove.mutate(stage.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTemplate ? "Editar Template" : "Templates de Projeto"}</DialogTitle></DialogHeader>
          {!editingTemplate ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-3 rounded-lg border">
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.task_count} tarefas</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                      setEditingTemplate(t);
                      setTemplateName(t.name);
                      setTemplateDesc(t.description || "");
                      try {
                        const tasks = await api<Array<{ title: string; duration_days: number }>>(`/api/projects/templates/${t.id}/tasks`, { auth: true });
                        setTemplateTasks(tasks.map(tk => ({ title: tk.title, duration_days: tk.duration_days || 1 })));
                      } catch {
                        setTemplateTasks([]);
                      }
                    }}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => templateMut.remove.mutate(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => {
                setEditingTemplate({} as ProjectTemplate);
                setTemplateName("");
                setTemplateDesc("");
                setTemplateTasks([{ title: "", duration_days: 1 }]);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Template
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} />
              </div>
              <div>
                <Label>Tarefas</Label>
                <div className="space-y-2">
                  {templateTasks.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={t.title} onChange={e => {
                        const arr = [...templateTasks];
                        arr[i].title = e.target.value;
                        setTemplateTasks(arr);
                      }} placeholder={`Tarefa ${i + 1}`} className="flex-1" />
                      <Input type="number" value={t.duration_days} onChange={e => {
                        const arr = [...templateTasks];
                        arr[i].duration_days = parseInt(e.target.value) || 1;
                        setTemplateTasks(arr);
                      }} className="w-20" min={1} />
                      <Button variant="ghost" size="icon" onClick={() => setTemplateTasks(templateTasks.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setTemplateTasks([...templateTasks, { title: "", duration_days: 1 }])}>
                    <Plus className="h-4 w-4 mr-1" /> Tarefa
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>Voltar</Button>
                <Button onClick={handleSaveTemplate}>Salvar Template</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog */}
      {selectedProject && (
        <ProjectDetailDialog
          project={selectedProject}
          open={!!selectedProject}
          onOpenChange={(o) => { if (!o) setSelectedProject(null); }}
          stages={stages}
          canEdit={canEdit}
          onMove={handleMoveProject}
        />
      )}
    </MainLayout>
  );
}

// ========================
// Project Card
// ========================
function ProjectCard({ project, stages, canEdit, onOpen, onMove }: {
  project: Project;
  stages: ProjectStage[];
  canEdit: boolean;
  onOpen: () => void;
  onMove: (projectId: string, stageId: string) => void;
}) {
  const progress = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
  const priorityColors: Record<string, string> = {
    low: "bg-green-500/10 text-green-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    high: "bg-orange-500/10 text-orange-600",
    urgent: "bg-red-500/10 text-red-600",
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onOpen}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="text-sm font-semibold line-clamp-2">{project.title}</h4>
          <Badge className={cn("text-[10px] shrink-0 ml-2", priorityColors[project.priority] || "")}>
            {project.priority === "low" ? "Baixa" : project.priority === "medium" ? "Média" : project.priority === "high" ? "Alta" : "Urgente"}
          </Badge>
        </div>

        {project.deal_title && project.deal_id && (
          <div
            className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/crm/negociacoes?deal=${project.deal_id}`;
            }}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{project.deal_title}</span>
          </div>
        )}

        {project.total_tasks > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{project.completed_tasks}/{project.total_tasks} tarefas</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center justify-between">
          {project.assigned_to_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{project.assigned_to_name}</span>
            </div>
          )}
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(project.created_at), "dd/MM", { locale: ptBR })}
          </span>
        </div>

        {/* Quick stage move - only for editors */}
        {canEdit && <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
          {stages.filter(s => s.id !== project.stage_id).slice(0, 3).map(s => (
            <Tooltip key={s.id} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="h-5 w-5 rounded-full border-2 hover:scale-110 transition-transform"
                  style={{ borderColor: s.color, backgroundColor: `${s.color}30` }}
                  onClick={() => onMove(project.id, s.id)}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{s.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>}
      </CardContent>
    </Card>
  );
}

// ========================
// Task Checklist Item (editable)
// ========================
function TaskChecklistItem({ task, projectId, isCompleted, orgMembers, taskMut, canEdit }: {
  task: ProjectTask;
  projectId: string;
  isCompleted: boolean;
  orgMembers: Array<{ user_id: string; name: string }>;
  taskMut: ReturnType<typeof useProjectTaskMutations>;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || "");
  const [startDate, setStartDate] = useState(task.start_date ? format(new Date(task.start_date), "yyyy-MM-dd") : "");
  const [endDate, setEndDate] = useState(task.end_date ? format(new Date(task.end_date), "yyyy-MM-dd") : "");

  const handleSave = () => {
    taskMut.update.mutate({
      taskId: task.id,
      projectId,
      assigned_to: assignedTo || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    toast.success("Tarefa atualizada!");
    setExpanded(false);
  };

  return (
    <div className={cn("rounded-lg border transition-colors", isCompleted && "bg-muted/30")}>
      <div className="flex items-center gap-3 p-2.5 hover:bg-muted/50">
        <div
          className={cn(
            "h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
            isCompleted ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground",
            canEdit && "cursor-pointer"
          )}
          onClick={() => canEdit && taskMut.update.mutate({
            taskId: task.id,
            projectId,
            status: isCompleted ? 'pending' : 'completed'
          })}
        >
          {isCompleted && <CheckSquare className="h-3 w-3" />}
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <p className={cn("text-sm", isCompleted && "line-through text-muted-foreground")}>{task.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {task.assigned_to_name && <span>{task.assigned_to_name}</span>}
            {task.end_date && <span>• {format(new Date(task.end_date), "dd/MM")}</span>}
          </div>
        </div>
        {canEdit && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-destructive opacity-50 hover:opacity-100"
              onClick={() => taskMut.remove.mutate({ taskId: task.id, projectId })}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
      {expanded && canEdit && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {orgMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// Project Detail Dialog
// ========================
function ProjectDetailDialog({ project, open, onOpenChange, stages, canEdit, onMove }: {
  project: Project;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stages: ProjectStage[];
  canEdit: boolean;
  onMove: (projectId: string, stageId: string) => void;
}) {
  const { user } = useAuth();
  const { data: attachments = [] } = useProjectAttachments(project.id);
  const { data: notes = [] } = useProjectNotes(project.id);
  const { data: tasks = [] } = useProjectTasks(project.id);
  const { data: templates = [] } = useProjectTemplates();
  const noteMut = useProjectNoteMutations();
  const attMut = useProjectAttachmentMutations();
  const taskMut = useProjectTaskMutations();
  const projectMut = useProjectMutations();
  const { uploadFile, isUploading } = useUpload();
  const { getMembers } = useOrganizations();

  const [noteText, setNoteText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState(1);
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(project.description || "");
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [orgMembers, setOrgMembers] = useState<Array<{ user_id: string; name: string }>>([]);
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);
  const [templateConfigId, setTemplateConfigId] = useState("");
  const [templateStartDate, setTemplateStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [templateAssignedTo, setTemplateAssignedTo] = useState(project.assigned_to || "");

  const navigate = useNavigate();

  // Load org members for responsible selector
  useEffect(() => {
    if (user?.organization_id) {
      getMembers(user.organization_id).then((m: any[]) => setOrgMembers(m));
    }
  }, [user?.organization_id]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    noteMut.create.mutate({ projectId: project.id, content: noteText, parent_id: replyTo || undefined }, {
      onSuccess: () => { setNoteText(""); setReplyTo(null); }
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      if (url) {
        attMut.create.mutate({ projectId: project.id, name: file.name, url, mimetype: file.type, size: file.size });
      }
    } catch {}
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const endDate = newTaskEndDate || undefined;
    const startDate = new Date().toISOString();
    taskMut.create.mutate({
      projectId: project.id,
      title: newTaskTitle,
      duration_days: newTaskDuration,
      assigned_to: newTaskAssignedTo || undefined,
      end_date: endDate,
      start_date: startDate,
    }, {
      onSuccess: () => {
        setNewTaskTitle("");
        setNewTaskDuration(1);
        setNewTaskAssignedTo("");
        setNewTaskEndDate("");
      }
    });
  };

  const handleApplyTemplate = (templateId: string) => {
    taskMut.applyTemplate.mutate({
      projectId: project.id,
      template_id: templateId,
      assigned_to: templateAssignedTo || undefined,
      start_date: templateStartDate || undefined,
    }, {
      onSuccess: () => setShowTemplateConfig(false),
    });
  };

  const handleSaveDesc = () => {
    projectMut.update.mutate({ id: project.id, description: desc });
    setEditingDesc(false);
  };

  // Group notes: root + replies
  const rootNotes = notes.filter(n => !n.parent_id);
  const repliesMap: Record<string, ProjectNote[]> = {};
  notes.filter(n => n.parent_id).forEach(n => {
    if (!repliesMap[n.parent_id!]) repliesMap[n.parent_id!] = [];
    repliesMap[n.parent_id!].push(n);
  });

  // Gantt chart calculations
  const ganttData = useMemo(() => {
    if (tasks.length === 0) return { tasks: [], minDate: new Date(), maxDate: new Date(), totalDays: 1 };
    const now = new Date();
    let minDate = new Date(now);
    let maxDate = new Date(now);
    const mapped = tasks.map(t => {
      const start = t.start_date ? new Date(t.start_date) : now;
      const end = t.end_date ? new Date(t.end_date) : new Date(start.getTime() + (t.duration_days || 1) * 86400000);
      if (start < minDate) minDate = new Date(start);
      if (end > maxDate) maxDate = new Date(end);
      return { ...t, startDate: start, endDate: end };
    });
    // Add padding
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000));
    return { tasks: mapped, minDate, maxDate, totalDays };
  }, [tasks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">{project.title}</DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {project.deal_title && project.deal_id && (
              <Badge
                variant="outline"
                className="text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/crm/negociacoes?deal=${project.deal_id}`);
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {project.deal_title}
              </Badge>
            )}
            {canEdit ? (
              <Select value={project.stage_id || ""} onValueChange={v => onMove(project.id, v)}>
                <SelectTrigger className="h-7 w-32 sm:w-40 text-xs">
                  <SelectValue placeholder="Mover etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-xs">
                {project.stage_name || "Sem etapa"}
              </Badge>
            )}
            {project.requested_by_name && (
              <span className="text-xs text-muted-foreground hidden sm:inline">Solicitado por: {project.requested_by_name}</span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm"><FileText className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Detalhes</span></TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm"><MessageSquare className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Notas</span> ({notes.length})</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm"><CheckSquare className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Tarefas</span> ({tasks.length})</TabsTrigger>
            <TabsTrigger value="attachments" className="text-xs sm:text-sm"><Paperclip className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Arquivos</span> ({attachments.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-3">
            {/* Details */}
            <TabsContent value="details" className="mt-0 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Descrição</Label>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingDesc(!editingDesc)}>
                      <Edit className="h-3 w-3 mr-1" /> {editingDesc ? "Cancelar" : "Editar"}
                    </Button>
                  )}
                </div>
                {editingDesc ? (
                  <div className="space-y-2">
                    <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} />
                    <Button size="sm" onClick={handleSaveDesc}>Salvar</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {project.description || "Sem descrição"}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Prioridade</Label>
                  <p className="text-sm font-medium capitalize">{project.priority}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <p className="text-sm font-medium">{project.assigned_to_name || "Não atribuído"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Criado em</Label>
                  <p className="text-sm">{format(new Date(project.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Atualizado em</Label>
                  <p className="text-sm">{format(new Date(project.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-0 space-y-3">
              <div className="space-y-3">
                {rootNotes.map(note => (
                  <div key={note.id} className="space-y-2">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{note.user_name || "Usuário"}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(note.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => setReplyTo(note.id)}>
                        <Reply className="h-3 w-3 mr-1" /> Responder
                      </Button>
                    </div>
                    {repliesMap[note.id]?.map(reply => (
                      <div key={reply.id} className="ml-6 rounded-lg bg-accent/30 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{reply.user_name || "Usuário"}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(reply.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota ainda</p>
                )}
              </div>
              <div className="border-t pt-3">
                {replyTo && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Reply className="h-3 w-3" />
                    <span>Respondendo nota</span>
                    <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => setReplyTo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva uma nota..." className="min-h-[60px]" />
                  <Button size="icon" onClick={handleAddNote} disabled={noteMut.create.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tasks */}
            <TabsContent value="tasks" className="mt-0 space-y-3">
              {/* Template selector when no tasks */}
              {canEdit && tasks.length === 0 && templates.length > 0 && !showTemplateConfig && (
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center space-y-3">
                    <LayoutTemplate className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa ainda. Carregar de um template?</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {templates.map(t => (
                        <Button
                          key={t.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTemplateConfigId(t.id);
                            setTemplateStartDate(format(new Date(), "yyyy-MM-dd"));
                            setTemplateAssignedTo(project.assigned_to || "");
                            setShowTemplateConfig(true);
                          }}
                        >
                          <LayoutTemplate className="h-3 w-3 mr-1" />
                          {t.name} ({t.task_count} tarefas)
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Template config panel */}
              {showTemplateConfig && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 text-primary" />
                        Configurar Template
                      </h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTemplateConfig(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Data de Início</Label>
                        <Input
                          type="date"
                          value={templateStartDate}
                          onChange={e => setTemplateStartDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Responsável</Label>
                        <Select value={templateAssignedTo} onValueChange={setTemplateAssignedTo}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {orgMembers.map(m => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleApplyTemplate(templateConfigId)}
                      disabled={taskMut.applyTemplate.isPending}
                    >
                      {taskMut.applyTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckSquare className="h-4 w-4 mr-1" />}
                      Aplicar Template
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* View toggle */}
              {tasks.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <CheckSquare className="h-3.5 w-3.5 mr-1" /> Checklist
                    </Button>
                    <Button
                      variant={viewMode === "gantt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("gantt")}
                    >
                      <BarChart3 className="h-3.5 w-3.5 mr-1" /> Gantt
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {tasks.filter(t => t.status === 'completed').length}/{tasks.length} concluídas
                    </span>
                  </div>
                </div>
              )}

              {/* Gantt View */}
              {viewMode === "gantt" && tasks.length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <div className="min-w-[600px]">
                    {/* Gantt header - dates */}
                    <div className="flex border-b bg-muted/50">
                      <div className="w-48 shrink-0 p-2 text-xs font-semibold border-r">Tarefa</div>
                      <div className="flex-1 flex">
                        {Array.from({ length: Math.min(ganttData.totalDays, 60) }, (_, i) => {
                          const d = new Date(ganttData.minDate);
                          d.setDate(d.getDate() + i);
                          return (
                            <div key={i} className="flex-1 min-w-[28px] text-center text-[9px] text-muted-foreground p-1 border-r">
                              {format(d, "dd", { locale: ptBR })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Gantt rows */}
                    {ganttData.tasks.map(task => {
                      const startOffset = Math.max(0, Math.ceil((task.startDate.getTime() - ganttData.minDate.getTime()) / 86400000));
                      const duration = Math.max(1, Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / 86400000));
                      const isCompleted = task.status === "completed";
                      const displayDays = Math.min(ganttData.totalDays, 60);

                      return (
                        <div key={task.id} className="flex border-b hover:bg-muted/30">
                          <div className="w-48 shrink-0 p-2 border-r">
                            <p className={cn("text-xs font-medium truncate", isCompleted && "line-through text-muted-foreground")}>{task.title}</p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {task.assigned_to_name && <><User className="h-2.5 w-2.5" /><span className="truncate">{task.assigned_to_name}</span></>}
                              {task.end_date && <><Calendar className="h-2.5 w-2.5 ml-1" /><span>{format(new Date(task.end_date), "dd/MM")}</span></>}
                            </div>
                          </div>
                          <div className="flex-1 flex relative py-1.5">
                            {Array.from({ length: displayDays }, (_, i) => (
                              <div key={i} className="flex-1 min-w-[28px] border-r border-dashed border-border/30" />
                            ))}
                            {/* Bar */}
                            <div
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 h-5 rounded-sm",
                                isCompleted ? "bg-primary/60" : "bg-primary"
                              )}
                              style={{
                                left: `${(startOffset / displayDays) * 100}%`,
                                width: `${Math.min((duration / displayDays) * 100, 100 - (startOffset / displayDays) * 100)}%`,
                                minWidth: "8px",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Checklist View */}
              {viewMode === "list" && (
                <div className="space-y-1">
                  {tasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    return (
                      <TaskChecklistItem
                        key={task.id}
                        task={task}
                        projectId={project.id}
                        isCompleted={isCompleted}
                        orgMembers={orgMembers}
                        taskMut={taskMut}
                        canEdit={canEdit}
                      />
                    );
                  })}
                  {tasks.length === 0 && templates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa ainda</p>
                  )}

                  {/* Quick add task - only for editors */}
                  {canEdit && (
                    <div className="flex gap-2 pt-2">
                      <Input
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Adicionar tarefa..."
                        className="flex-1 h-8 text-sm"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newTaskTitle.trim()) {
                            handleAddTask();
                          }
                        }}
                      />
                      <Button size="sm" className="h-8" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Attachments */}
            <TabsContent value="attachments" className="mt-0 space-y-3">
              {canEdit && (
                <div>
                  <input type="file" id="proj-file-upload" className="hidden" onChange={handleUpload} />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById("proj-file-upload")?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    Anexar Arquivo
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={resolveMediaUrl(att.url)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">{att.name}</a>
                      <p className="text-xs text-muted-foreground">{att.uploaded_by_name} · {format(new Date(att.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => attMut.remove.mutate({ attId: att.id, projectId: project.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {attachments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo anexado</p>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
