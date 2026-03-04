import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  TaskCardDetail, TaskChecklist, ChecklistTemplate,
  useTaskCardDetail, useTaskCardMutations, useChecklistMutations,
  useTaskAttachmentMutations, useTaskCommentMutations, useChecklistTemplates,
} from "@/hooks/use-task-boards";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizations } from "@/hooks/use-organizations";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, CheckSquare, Paperclip, MessageSquare, User, Trash2, Plus,
  Send, Image, FileText, X, Clock, Star, Upload, ListChecks
} from "lucide-react";

interface TaskCardDetailDialogProps {
  cardId: string | null;
  boardId: string | null;
  isGlobal: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgMembers?: Array<{ user_id: string; name: string }>;
}

export function TaskCardDetailDialog({ cardId, boardId, isGlobal, open, onOpenChange, orgMembers = [] }: TaskCardDetailDialogProps) {
  const { data: card, isLoading } = useTaskCardDetail(open ? cardId : null);
  const cardMut = useTaskCardMutations(boardId);
  const checklistMut = useChecklistMutations(cardId);
  const attachMut = useTaskAttachmentMutations(cardId);
  const commentMut = useTaskCommentMutations(cardId);
  const { data: templates } = useChecklistTemplates();
  const { uploadFile, isUploading } = useUpload();
  const { user } = useAuth();

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newItemTitles, setNewItemTitles] = useState<Record<string, string>>({});
  const [showChecklistForm, setShowChecklistForm] = useState(false);

  useEffect(() => {
    if (card) {
      setEditTitle(card.title);
      setEditDesc(card.description || "");
    }
  }, [card]);

  if (!cardId) return null;

  const handleSaveDetails = () => {
    if (!cardId) return;
    cardMut.updateCard.mutate({ id: cardId, title: editTitle, description: editDesc } as any);
  };

  const handleUpdateField = (field: string, value: any) => {
    if (!cardId) return;
    cardMut.updateCard.mutate({ id: cardId, [field]: value } as any);
  };

  const handleAddChecklist = (templateId?: string) => {
    const title = templateId ? (templates?.find(t => t.id === templateId)?.name || "Checklist") : newChecklistTitle;
    if (!title.trim()) return;
    checklistMut.addChecklist.mutate({ title, template_id: templateId });
    setNewChecklistTitle("");
    setShowChecklistForm(false);
  };

  const handleAddChecklistItem = (checklistId: string) => {
    const title = newItemTitles[checklistId];
    if (!title?.trim()) return;
    checklistMut.addChecklistItem.mutate({ checklistId, title });
    setNewItemTitles(prev => ({ ...prev, [checklistId]: "" }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      if (url) {
        attachMut.addAttachment.mutate({
          file_url: url,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      }
    } catch {}
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    commentMut.addComment.mutate(newComment);
    setNewComment("");
  };

  const handleDelete = () => {
    if (confirm("Excluir este card permanentemente?")) {
      cardMut.deleteCard.mutate(cardId);
      onOpenChange(false);
    }
  };

  const priorityOptions = [
    { value: "low", label: "Baixa", color: "text-muted-foreground" },
    { value: "medium", label: "Média", color: "text-yellow-600" },
    { value: "high", label: "Alta", color: "text-orange-600" },
    { value: "urgent", label: "Urgente", color: "text-red-600" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <DialogDescription className="sr-only">Detalhes do card de tarefa</DialogDescription>
        {isLoading || !card ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <DialogHeader className="p-4 pb-2 border-b">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <Input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={handleSaveDetails}
                    className="text-lg font-bold border-none p-0 h-auto focus-visible:ring-0 shadow-none"
                    placeholder="Título do card"
                  />
                  {card.deal_title && (
                    <p className="text-xs text-muted-foreground mt-1">📋 {card.deal_title}{card.company_name ? ` • ${card.company_name}` : ''}</p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {/* Main content */}
                <div className="md:col-span-2 space-y-4">
                  {/* Cover Image */}
                  {card.cover_image_url && (
                    <div className="relative">
                      <img src={card.cover_image_url} alt="" className="w-full h-40 object-cover rounded-lg" />
                      <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handleUpdateField('cover_image_url', null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Descrição
                    </h4>
                    <Textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      onBlur={handleSaveDetails}
                      placeholder="Adicionar descrição..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Checklists */}
                  {card.checklists?.map(checklist => {
                    const items = checklist.items || [];
                    const done = items.filter(i => i.is_completed).length;
                    const total = items.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                    return (
                      <div key={checklist.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <CheckSquare className="h-4 w-4" /> {checklist.title}
                            <span className="text-xs text-muted-foreground">{done}/{total}</span>
                          </h4>
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => checklistMut.deleteChecklist.mutate(checklist.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {total > 0 && (
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-500" : "bg-primary")}
                              style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        <div className="space-y-1">
                          {items.map(item => (
                            <div key={item.id} className="flex items-center gap-2 group">
                              <Checkbox
                                checked={item.is_completed}
                                onCheckedChange={(checked) => checklistMut.toggleChecklistItem.mutate({ id: item.id, is_completed: !!checked })}
                              />
                              <span className={cn("text-sm flex-1", item.is_completed && "line-through text-muted-foreground")}>
                                {item.title}
                              </span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                onClick={() => checklistMut.deleteChecklistItem.mutate(item.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        {/* Add item */}
                        <div className="flex gap-2">
                          <Input
                            value={newItemTitles[checklist.id] || ""}
                            onChange={e => setNewItemTitles(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem(checklist.id)}
                            placeholder="Novo item..."
                            className="h-8 text-sm"
                          />
                          <Button size="sm" variant="outline" className="h-8"
                            onClick={() => handleAddChecklistItem(checklist.id)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add checklist */}
                  {showChecklistForm ? (
                    <div className="border rounded-lg p-3 space-y-2">
                      <Input
                        value={newChecklistTitle}
                        onChange={e => setNewChecklistTitle(e.target.value)}
                        placeholder="Nome da checklist"
                        className="h-8"
                        autoFocus
                      />
                      {templates && templates.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Ou use um template:</p>
                          <div className="flex flex-wrap gap-1">
                            {templates.map(t => (
                              <Badge key={t.id} variant="outline" className="cursor-pointer hover:bg-primary/10"
                                onClick={() => handleAddChecklist(t.id)}>
                                <ListChecks className="h-3 w-3 mr-1" />{t.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddChecklist()}>Adicionar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowChecklistForm(false)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowChecklistForm(true)}>
                      <CheckSquare className="h-4 w-4 mr-2" /> Adicionar Checklist
                    </Button>
                  )}

                  <Separator />

                  {/* Attachments */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" /> Anexos ({card.attachments?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {card.attachments?.map(att => (
                        <div key={att.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded group">
                          {att.file_type?.startsWith('image/') ? (
                            <img src={att.file_url} alt="" className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <FileText className="h-10 w-10 text-muted-foreground p-2" />
                          )}
                          <div className="flex-1 min-w-0">
                            <a href={att.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline truncate block">
                              {att.file_name}
                            </a>
                            <p className="text-xs text-muted-foreground">{att.uploaded_by_name}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => attachMut.deleteAttachment.mutate(att.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <label>
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                      <Button variant="outline" size="sm" className="mt-2" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {isUploading ? "Enviando..." : "Enviar arquivo"}
                        </span>
                      </Button>
                    </label>
                  </div>

                  <Separator />

                  {/* Comments */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> Comentários ({card.comments?.length || 0})
                    </h4>
                    <div className="space-y-3 mb-3">
                      {card.comments?.map(comment => (
                        <div key={comment.id} className="flex gap-2 group">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
                            {comment.user_name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{comment.user_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{comment.content}</p>
                          </div>
                          {comment.user_id === user?.id && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100"
                              onClick={() => commentMut.deleteComment.mutate(comment.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                        placeholder="Escrever comentário..."
                        className="h-9"
                      />
                      <Button size="sm" className="h-9" onClick={handleSendComment} disabled={!newComment.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-3">
                  {/* Priority */}
                  <div>
                    <label className="text-xs text-muted-foreground">Prioridade</label>
                    <Select value={card.priority} onValueChange={v => handleUpdateField('priority', v)}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className={p.color}>{p.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee (only on global boards) */}
                  {isGlobal && orgMembers.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground">Responsável</label>
                      <Select value={card.assigned_to || ""} onValueChange={v => handleUpdateField('assigned_to', v || null)}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                        <SelectContent>
                          {orgMembers.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Due Date */}
                  <div>
                    <label className="text-xs text-muted-foreground">Prazo</label>
                    <Input
                      type="datetime-local"
                      value={card.due_date ? format(parseISO(card.due_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      onChange={e => handleUpdateField('due_date', e.target.value || null)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="text-xs text-muted-foreground">Início</label>
                    <Input
                      type="datetime-local"
                      value={card.start_date ? format(parseISO(card.start_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      onChange={e => handleUpdateField('start_date', e.target.value || null)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  {/* Cover image */}
                  <div>
                    <label className="text-xs text-muted-foreground">Capa</label>
                    <label className="block mt-1">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(file);
                        if (url) handleUpdateField('cover_image_url', url);
                      }} />
                      <Button variant="outline" size="sm" className="w-full h-8" asChild>
                        <span><Image className="h-3 w-3 mr-2" />Adicionar capa</span>
                      </Button>
                    </label>
                  </div>

                  {/* Contact */}
                  <div>
                    <label className="text-xs text-muted-foreground">Contato vinculado</label>
                    <Input
                      value={card.contact_name || ""}
                      onChange={e => handleUpdateField('contact_name', e.target.value || null)}
                      placeholder="Nome do contato"
                      className="h-8 mt-1 text-xs"
                    />
                    <Input
                      value={card.contact_phone || ""}
                      onChange={e => handleUpdateField('contact_phone', e.target.value || null)}
                      placeholder="Telefone"
                      className="h-8 mt-1 text-xs"
                    />
                  </div>

                  <Separator />

                  {/* Meta info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Criado por: {card.creator_name}</p>
                    <p>Criado em: {format(parseISO(card.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    {card.completed_at && <p>Concluído: {format(parseISO(card.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>}
                  </div>

                  <Separator />

                  <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Card
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
