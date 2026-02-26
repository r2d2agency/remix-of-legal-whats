import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { User, ExternalLink, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Project, ProjectStage, useProjectMutations } from "@/hooks/use-projects";

interface ProjectKanbanBoardProps {
  stages: ProjectStage[];
  projectsByStage: Record<string, Project[]>;
  onProjectClick: (project: Project) => void;
  canEdit: boolean;
}

// ---- Sortable Project Card ----
function SortableProjectCard({
  project,
  onClick,
  isActive,
  isOver,
}: {
  project: Project;
  onClick: () => void;
  isActive: boolean;
  isOver: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const progress = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
  const priorityColors: Record<string, string> = {
    low: "bg-green-500/10 text-green-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    high: "bg-orange-500/10 text-orange-600",
    urgent: "bg-red-500/10 text-red-600",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isOver && !isActive && (
        <div className="h-1 rounded-full bg-primary mx-2 mb-1 animate-pulse" />
      )}
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-all",
          isActive && "ring-2 ring-primary shadow-lg"
        )}
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <div
                {...attributes}
                {...listeners}
                className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold line-clamp-2">{project.title}</h4>
            </div>
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
            {project.assigned_to_name ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{project.assigned_to_name}</span>
              </div>
            ) : <span />}
            <span className="text-[10px] text-muted-foreground">
              {(() => { try { return format(new Date(project.created_at), "dd/MM", { locale: ptBR }); } catch { return ""; } })()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Droppable Column ----
function ProjectKanbanColumn({
  stage,
  projects,
  onProjectClick,
  activeId,
  overId,
}: {
  stage: ProjectStage & { id: string };
  projects: Project[];
  onProjectClick: (p: Project) => void;
  activeId: string | null;
  overId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalTasks = projects.reduce((s, p) => s + (p.total_tasks || 0), 0);
  const completedTasks = projects.reduce((s, p) => s + (p.completed_tasks || 0), 0);
  const stageProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[85vw] sm:w-72 lg:w-80 rounded-xl border border-border transition-colors flex flex-col snap-start",
        isOver && !activeId ? "" : "",
        isOver && activeId ? "bg-primary/5 border-primary/30" : "bg-muted/30"
      )}
    >
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-xl border-b border-border"
        style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{stage.name}</span>
          <Badge variant="secondary" className="text-xs">{projects.length}</Badge>
        </div>
        {totalTasks > 0 && (
          <span className="text-[10px] text-muted-foreground">{stageProgress}%</span>
        )}
      </div>

      <ScrollArea className="flex-1 p-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="space-y-2 min-h-[60px]">
          {projects.map((project) => (
            <SortableProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectClick(project)}
              isActive={activeId === project.id}
              isOver={overId === project.id}
            />
          ))}
          {projects.length === 0 && (
            <div className={cn(
              "py-8 text-center text-xs text-muted-foreground rounded-lg border-2 border-dashed transition-colors",
              isOver && activeId ? "border-primary/40 bg-primary/5" : "border-transparent"
            )}>
              {isOver && activeId ? "Soltar aqui" : "Nenhum projeto"}
            </div>
          )}
        </div>
      </ScrollArea>

      {stage.is_final && (
        <div className="px-3 py-1.5 border-t text-center">
          <span className="text-[10px] text-muted-foreground">✅ Etapa final</span>
        </div>
      )}
    </div>
  );
}

// ---- Main Board ----
export function ProjectKanbanBoard({ stages, projectsByStage, onProjectClick, canEdit }: ProjectKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const projectMut = useProjectMutations();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeProject = useMemo(() => {
    if (!activeId) return null;
    for (const projects of Object.values(projectsByStage)) {
      const p = projects.find((p) => p.id === activeId);
      if (p) return p;
    }
    return null;
  }, [activeId, projectsByStage]);

  const findStageForProject = (projectId: string): string | null => {
    for (const [stageId, projects] of Object.entries(projectsByStage)) {
      if (projects.some((p) => p.id === projectId)) return stageId;
    }
    return null;
  };

  function handleDragStart(e: DragStartEvent) {
    if (!canEdit) return;
    setActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId(e.over?.id as string || null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setOverId(null);
    if (!over || !canEdit) return;

    const projectId = active.id as string;
    const targetId = over.id as string;
    if (projectId === targetId) return;

    const currentStageId = findStageForProject(projectId);
    if (!currentStageId) return;

    const isStageColumn = stages.some((s) => s.id === targetId);
    const targetStageId = isStageColumn ? targetId : findStageForProject(targetId);
    if (!targetStageId) return;

    if (currentStageId !== targetStageId) {
      projectMut.move.mutate({ id: projectId, stage_id: targetStageId });
    }
  }

  const measuringConfig = {
    droppable: { strategy: MeasuringStrategy.Always },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
      measuring={measuringConfig}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ minHeight: "60vh" }}>
        {stages.map((stage) => {
          const projects = projectsByStage[stage.id] || [];
          return (
            <SortableContext key={stage.id} items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ProjectKanbanColumn
                stage={stage as ProjectStage & { id: string }}
                projects={projects}
                onProjectClick={onProjectClick}
                activeId={activeId}
                overId={overId}
              />
            </SortableContext>
          );
        })}
      </div>

      <DragOverlay
        dropAnimation={{ duration: 250, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}
        style={{ cursor: "grabbing" }}
      >
        {activeProject ? (
          <div className="rotate-2 scale-105 shadow-2xl w-72">
            <Card className="ring-2 ring-primary">
              <CardContent className="p-3">
                <h4 className="text-sm font-semibold">{activeProject.title}</h4>
                {activeProject.total_tasks > 0 && (
                  <Progress value={Math.round((activeProject.completed_tasks / activeProject.total_tasks) * 100)} className="h-1.5 mt-2" />
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
