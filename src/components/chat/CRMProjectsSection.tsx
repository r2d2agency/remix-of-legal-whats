import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FolderKanban,
  Plus,
  Loader2,
  Clock,
  Circle,
  CheckCircle2,
  Upload,
  Paperclip,
  Reply,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useProjects,
  useProjectStages,
  useProjectTemplates,
  useProjectMutations,
  useProjectNotes,
  useProjectNoteMutations,
  useProjectAttachmentMutations,
} from "@/hooks/use-projects";
import { useUpload } from "@/hooks/use-upload";
import { resolveMediaUrl } from "@/lib/media";
import { toast } from "sonner";
import { CRMDeal } from "@/hooks/use-crm";

interface CRMProjectsSectionProps {
  allDeals: CRMDeal[];
  selectedDeal: CRMDeal | undefined;
}

export function CRMProjectsSection({ allDeals, selectedDeal }: CRMProjectsSectionProps) {
  const { data: allProjects = [], refetch: refetchProjects } = useProjects();
  const { data: projectStages = [] } = useProjectStages();
  const { data: projectTemplates = [] } = useProjectTemplates();
  const projectMut = useProjectMutations();
  const projectNoteMut = useProjectNoteMutations();
  const projectAttMut = useProjectAttachmentMutations();
  const { uploadFile: projectUploadFile, isUploading: projectUploading } = useUpload();

  const dealIds = useMemo(() => allDeals.map(d => d.id), [allDeals]);
  const contactProjects = useMemo(
    () => allProjects.filter(p => p.deal_id && dealIds.includes(p.deal_id)),
    [allProjects, dealIds]
  );

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const { data: expandedProjectNotes = [] } = useProjectNotes(expandedProjectId);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectPriority, setNewProjectPriority] = useState("medium");
  const [newProjectTemplateId, setNewProjectTemplateId] = useState("");
  const [newProjectDealId, setNewProjectDealId] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectNoteText, setProjectNoteText] = useState("");
  const [replyToProjectNote, setReplyToProjectNote] = useState<string | null>(null);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) {
      toast.error("Informe o título do projeto");
      return;
    }
    setCreatingProject(true);
    try {
      await projectMut.create.mutateAsync({
        title: newProjectTitle.trim(),
        description: newProjectDescription.trim() || undefined,
        priority: newProjectPriority,
        deal_id: newProjectDealId || selectedDeal?.id || undefined,
        template_id: newProjectTemplateId || undefined,
      });
      refetchProjects();
      setShowCreateProject(false);
      setNewProjectTitle("");
      setNewProjectDescription("");
      setNewProjectPriority("medium");
      setNewProjectTemplateId("");
      setNewProjectDealId("");
      toast.success("Projeto criado!");
    } catch {
      toast.error("Erro ao criar projeto");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleAddProjectNote = (projectId: string) => {
    if (!projectNoteText.trim()) return;
    projectNoteMut.create.mutate({
      projectId,
      content: projectNoteText.trim(),
      parent_id: replyToProjectNote || undefined,
    }, {
      onSuccess: () => {
        setProjectNoteText("");
        setReplyToProjectNote(null);
      }
    });
  };

  const handleProjectFileUpload = async (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await projectUploadFile(file);
      if (url) {
        projectAttMut.create.mutate({
          projectId,
          name: file.name,
          url,
          mimetype: file.type,
          size: file.size,
        });
      }
    } catch {
      toast.error("Erro ao enviar arquivo");
    }
    e.target.value = "";
  };

  const getStatusIcon = (stageId: string | null) => {
    const stageName = projectStages.find(s => s.id === stageId)?.name?.toLowerCase() || '';
    switch (true) {
      case stageName.includes('conclu'): return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case stageName.includes('andamento') || stageName.includes('progress'): return <Clock className="h-3 w-3 text-blue-500" />;
      default: return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <AccordionItem value="projects" className="border rounded-lg px-3">
      <AccordionTrigger className="py-2 hover:no-underline">
        <div className="flex items-center gap-2 text-sm">
          <FolderKanban className="h-4 w-4 text-primary" />
          <span>Projetos</span>
          {contactProjects.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{contactProjects.length}</Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          {contactProjects.map((project) => {
            const progress = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
            const isExpanded = expandedProjectId === project.id;
            const stageName = projectStages.find(s => s.id === project.stage_id)?.name;
            return (
              <div key={project.id} className="border rounded-lg p-2 space-y-2">
              <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                  {getStatusIcon(project.stage_id)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{project.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {stageName && <Badge variant="outline" className="text-[9px] px-1 py-0">{stageName}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{progress}%</span>
                    </div>
                  </div>
                </div>
                <Progress value={progress} className="h-1" />
                {isExpanded && (
                  <div className="space-y-2 pt-1 border-t">
                    {expandedProjectNotes.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {expandedProjectNotes.slice(0, 5).map(note => (
                          <div key={note.id} className="text-[10px] p-1.5 rounded bg-muted/50 border">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{note.user_name || 'Usuário'}</span>
                              <span className="text-muted-foreground">{format(new Date(note.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                            </div>
                            <p className="mt-0.5 line-clamp-2">{note.content}</p>
                            <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1 mt-0.5" onClick={() => setReplyToProjectNote(note.id)}>
                              <Reply className="h-2.5 w-2.5 mr-0.5" />Responder
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {replyToProjectNote && (
                      <div className="text-[10px] text-primary flex items-center gap-1">
                        <Reply className="h-3 w-3" />Respondendo nota...
                        <Button variant="ghost" size="sm" className="h-4 px-1 text-[9px]" onClick={() => setReplyToProjectNote(null)}>✕</Button>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Textarea
                        placeholder="Nota do projeto..."
                        value={projectNoteText}
                        onChange={e => setProjectNoteText(e.target.value)}
                        rows={1}
                        className="text-[10px] min-h-[28px] resize-none flex-1"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddProjectNote(project.id); } }}
                      />
                      <Button size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleAddProjectNote(project.id)} disabled={!projectNoteText.trim()}>
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 gap-1" asChild>
                        <label>
                          <Upload className="h-3 w-3" />Arquivo
                          <input type="file" className="hidden" onChange={e => handleProjectFileUpload(project.id, e)} disabled={projectUploading} />
                        </label>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {contactProjects.length === 0 && !showCreateProject && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum projeto vinculado</p>
          )}

          {showCreateProject ? (
            <div className="space-y-2 border rounded-lg p-2 bg-muted/20">
              <Input placeholder="Título do projeto *" value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} className="h-8 text-xs" />
              <Textarea placeholder="Descrição (opcional)" value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} className="text-xs min-h-[50px] max-h-[80px] resize-none" />
              <Select value={newProjectPriority} onValueChange={setNewProjectPriority}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              {allDeals.length > 1 && (
                <Select value={newProjectDealId} onValueChange={setNewProjectDealId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vincular a negociação" /></SelectTrigger>
                  <SelectContent>
                    {allDeals.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {projectTemplates.length > 0 && (
                <Select value={newProjectTemplateId} onValueChange={setNewProjectTemplateId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Usar template (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {projectTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setShowCreateProject(false); setNewProjectTitle(""); setNewProjectDescription(""); }}>Cancelar</Button>
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreateProject} disabled={creatingProject || !newProjectTitle.trim()}>
                  {creatingProject ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}Criar
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => { setShowCreateProject(true); if (selectedDeal) setNewProjectDealId(selectedDeal.id); }}>
              <Plus className="h-3 w-3 mr-1" />Solicitar Projeto
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
