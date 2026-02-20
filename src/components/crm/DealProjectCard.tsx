import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FolderKanban,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Paperclip,
  Send,
  Loader2,
  Upload,
  ExternalLink,
  Reply,
  FileText,
  Image,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useProjectNotes,
  useProjectAttachments,
  useProjectNoteMutations,
  useProjectAttachmentMutations,
  Project,
  ProjectNote,
} from "@/hooks/use-projects";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface DealProjectCardProps {
  project: Project;
}

export function DealProjectCard({ project }: DealProjectCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [replyTo, setReplyTo] = useState<ProjectNote | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: notes = [], refetch: refetchNotes } = useProjectNotes(isOpen ? project.id : null);
  const { data: attachments = [], refetch: refetchAttachments } = useProjectAttachments(isOpen ? project.id : null);
  const noteMut = useProjectNoteMutations();
  const attachMut = useProjectAttachmentMutations();
  const { uploadFile, isUploading } = useUpload();

  const progress = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : 0;

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSendingNote(true);
    try {
      await noteMut.create.mutateAsync({ projectId: project.id, content: newNote.trim() });
      setNewNote("");
      refetchNotes();
    } catch {
      toast.error("Erro ao adicionar nota");
    }
    setSendingNote(false);
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !replyTo) return;
    setSendingReply(true);
    try {
      await noteMut.create.mutateAsync({
        projectId: project.id,
        content: replyContent.trim(),
        parent_id: replyTo.id,
      });
      setReplyContent("");
      setReplyTo(null);
      refetchNotes();
    } catch {
      toast.error("Erro ao responder nota");
    }
    setSendingReply(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      if (url) {
        await attachMut.create.mutateAsync({
          projectId: project.id,
          name: file.name,
          url,
          mimetype: file.type,
          size: file.size,
        });
        refetchAttachments();
        toast.success("Arquivo enviado!");
      }
    } catch {
      toast.error("Erro ao enviar arquivo");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (mimetype?: string) => {
    if (mimetype?.startsWith("image/")) return <Image className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  // Group notes: top-level + replies
  const topNotes = notes.filter((n) => !n.parent_id);
  const repliesMap = notes.reduce<Record<string, ProjectNote[]>>((acc, n) => {
    if (n.parent_id) {
      acc[n.parent_id] = acc[n.parent_id] || [];
      acc[n.parent_id].push(n);
    }
    return acc;
  }, {});

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FolderKanban className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.stage_name || "Sem etapa"} • {project.completed_tasks}/{project.total_tasks} tarefas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {project.stage_color && (
                  <Badge className="text-[10px]" style={{ backgroundColor: project.stage_color, color: "#fff" }}>
                    {project.stage_name}
                  </Badge>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {project.total_tasks > 0 && (
              <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4 space-y-3">
            {/* Open full project link */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projetos?project=${project.id}`);
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir projeto completo
              </Button>
            </div>

            {/* Notes section */}
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                <StickyNote className="h-3 w-3" />
                Notas ({notes.length})
              </h5>

              {topNotes.length > 0 && (
                <ScrollArea className={cn(topNotes.length > 3 ? "max-h-[200px]" : "")}>
                  <div className="space-y-2">
                    {topNotes.map((note) => (
                      <div key={note.id} className="bg-muted/50 rounded-lg p-2.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium">{note.user_name || "Usuário"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(note.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{note.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] mt-1 px-2"
                          onClick={() => setReplyTo(replyTo?.id === note.id ? null : note)}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Responder
                        </Button>

                        {/* Replies */}
                        {repliesMap[note.id]?.map((reply) => (
                          <div key={reply.id} className="ml-4 mt-1.5 border-l-2 border-primary/30 pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-medium">{reply.user_name || "Usuário"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(reply.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-[11px] whitespace-pre-wrap">{reply.content}</p>
                          </div>
                        ))}

                        {/* Reply input */}
                        {replyTo?.id === note.id && (
                          <div className="mt-2 flex gap-1">
                            <Textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Responder..."
                              className="text-xs min-h-[32px] max-h-[60px] resize-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
                              }}
                            />
                            <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleReply} disabled={sendingReply || !replyContent.trim()}>
                              {sendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* New note input */}
              <div className="mt-2 flex gap-1">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Adicionar nota..."
                  className="text-xs min-h-[32px] max-h-[60px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); }
                  }}
                />
                <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleAddNote} disabled={sendingNote || !newNote.trim()}>
                  {sendingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Attachments section */}
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                <Paperclip className="h-3 w-3" />
                Arquivos ({attachments.length})
              </h5>

              {attachments.length > 0 && (
                <div className="space-y-1 mb-2">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors text-xs text-primary underline"
                    >
                      {getFileIcon(att.mimetype)}
                      <span className="truncate flex-1">{att.name}</span>
                    </a>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="h-3 w-3 mr-1" /> Enviar arquivo</>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
