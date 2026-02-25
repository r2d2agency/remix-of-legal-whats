import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Building2,
  Loader2,
  UserPlus,
} from "lucide-react";
import { Conversation, TeamMember } from "@/hooks/use-chat";
import { Department } from "@/hooks/use-departments";
import { toast } from "sonner";
import { api } from "@/lib/api";

// ========== Transfer Dialog ==========
interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  team: TeamMember[];
  onTransfer: (userId: string | null, note?: string) => void;
}

export function TransferDialog({ open, onOpenChange, conversation, team, onTransfer }: TransferDialogProps) {
  const [transferTo, setTransferTo] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferMode, setTransferMode] = useState<'human' | 'ai'>('human');
  const [transferAgents, setTransferAgents] = useState<Array<{ id: string; name: string; is_active: boolean }>>([]);
  const [transferToAgent, setTransferToAgent] = useState("");
  const [transferringToAI, setTransferringToAI] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState("");

  useEffect(() => {
    if (open) {
      setTransferMode('human');
      setTransferTo("");
      setTransferToAgent("");
      setTransferNote("");
      setAgentsError("");
      setLoadingAgents(true);
      api<Array<{ id: string; name: string; is_active: boolean }>>('/api/ai-agents', { auth: true })
        .then(data => {
          console.log('[TransferDialog] Agentes carregados:', data);
          const active = (data || []).filter(a => a.is_active);
          setTransferAgents(active);
          if (active.length === 0) setAgentsError("Nenhum agente IA ativo encontrado");
        })
        .catch((err) => {
          console.error('[TransferDialog] Erro ao carregar agentes:', err);
          setAgentsError(err.message || "Erro ao carregar agentes IA");
        })
        .finally(() => setLoadingAgents(false));
    }
  }, [open]);

  const handleTransfer = async () => {
    if (transferMode === 'ai') {
      if (!transferToAgent || !conversation?.id) return;
      setTransferringToAI(true);
      try {
        await api(`/api/chat/conversations/${conversation.id}/agent-session`, {
          method: 'POST',
          body: { agent_id: transferToAgent },
        });
        toast.success("Conversa transferida para agente IA!");
        onOpenChange(false);
        setTransferToAgent("");
        setTransferNote("");
        setTransferMode('human');
      } catch (err: any) {
        toast.error(err.message || "Erro ao transferir para IA");
      } finally {
        setTransferringToAI(false);
      }
      return;
    }
    const userId = transferTo === "__none__" ? null : (transferTo || null);
    onTransfer(userId, transferNote);
    onOpenChange(false);
    setTransferTo("");
    setTransferNote("");
    toast.success("Conversa transferida!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Atendimento</DialogTitle>
          <DialogDescription>Transfira para um atendente humano ou para um agente de IA.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button variant={transferMode === 'human' ? 'default' : 'ghost'} size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => setTransferMode('human')}>
            <UserPlus className="h-3.5 w-3.5" />Atendente
          </Button>
          <Button variant={transferMode === 'ai' ? 'default' : 'ghost'} size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => setTransferMode('ai')}>
            <Bot className="h-3.5 w-3.5" />Agente IA
          </Button>
        </div>
        <div className="space-y-4">
          {transferMode === 'human' ? (
            <>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger><SelectValue placeholder="Selecione um atendente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Liberar (sem atendente)</SelectItem>
                  {team.filter(m => m.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Observação (opcional)" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
            </>
          ) : (
            <>
              {loadingAgents ? (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando agentes...</span>
                </div>
              ) : agentsError && transferAgents.length === 0 ? (
                <div className="text-sm text-destructive text-center py-4">{agentsError}</div>
              ) : (
                <Select value={transferToAgent} onValueChange={setTransferToAgent}>
                  <SelectTrigger><SelectValue placeholder="Selecione um agente IA" /></SelectTrigger>
                  <SelectContent>
                    {transferAgents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-primary" />{agent.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">O agente de IA assumirá o atendimento e responderá automaticamente ao contato.</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={transferringToAI || (transferMode === 'ai' && !transferToAgent)}>
            {transferringToAI && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {transferMode === 'ai' ? 'Transferir para IA' : 'Transferir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Department Dialog ==========
interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  departments: Department[];
  onSave: (departmentId: string) => void;
  saving: boolean;
}

export function DepartmentDialog({ open, onOpenChange, conversation, departments, onSave, saving }: DepartmentDialogProps) {
  const [selectedId, setSelectedId] = useState(conversation?.department_id || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Atribuir Departamento</DialogTitle>
          <DialogDescription>Selecione o departamento/fila para esta conversa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Selecione um departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__"><span className="text-muted-foreground">Nenhum departamento</span></SelectItem>
              {departments.filter(d => d.is_active).map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                    {dept.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum departamento cadastrado. Acesse o menu Departamentos para criar.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(selectedId)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Delete Conversation Dialog ==========
interface DeleteConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
}

export function DeleteConversationDialog({ open, onOpenChange, onDelete }: DeleteConversationDialogProps) {
  const [deleting, setDeleting] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
          <AlertDialogDescription>Tem certeza que deseja excluir esta conversa? Essa ação remove permanentemente mensagens, notas e tags.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setDeleting(true);
              try { await onDelete(); onOpenChange(false); } finally { setDeleting(false); }
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <span className="inline-flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</span> : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ========== Sync Dialog ==========
interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (days: number) => Promise<void>;
  syncing?: boolean;
}

export function SyncDialog({ open, onOpenChange, onSync, syncing }: SyncDialogProps) {
  const [days, setDays] = useState("7");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronizar histórico</DialogTitle>
          <DialogDescription>Importa mensagens antigas do WhatsApp para esta conversa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último 1 dia</SelectItem>
              <SelectItem value="3">Últimos 3 dias</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Dica: use isso quando mídias antigas não aparecem ou para recuperar histórico.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => { await onSync(parseInt(days, 10)); onOpenChange(false); }} disabled={!!syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sincronizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Create Tag Dialog ==========
interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTag: (name: string, color: string) => void;
}

export function CreateTagDialog({ open, onOpenChange, onCreateTag }: CreateTagDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateTag(name.trim(), color);
    onOpenChange(false);
    setName("");
    setColor("#6366f1");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Tag</DialogTitle>
          <DialogDescription>Crie uma nova tag para organizar suas conversas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Nome da tag" value={name} onChange={e => setName(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Cor:</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Edit Contact Dialog ==========
interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
}

export function EditContactDialog({ open, onOpenChange, conversation }: EditContactDialogProps) {
  const [name, setName] = useState(conversation?.contact_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!conversation || !name.trim()) return;
    setSaving(true);
    try {
      await api('/api/chat/contacts/by-phone', {
        method: 'POST',
        body: {
          phone: conversation.contact_phone,
          connection_id: conversation.connection_id,
          name: name.trim(),
        },
      });
      toast.success('Contato salvo com sucesso');
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent('refresh-conversations'));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setName(conversation?.contact_name || ''); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
          <DialogDescription>Edite o nome do contato para {conversation?.contact_phone}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="contact-name">Nome</Label>
            <Input id="contact-name" placeholder="Nome do contato" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !saving) handleSave(); }} />
          </div>
          <p className="text-xs text-muted-foreground">O contato será vinculado à conexão: <strong>{conversation?.connection_name}</strong></p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
