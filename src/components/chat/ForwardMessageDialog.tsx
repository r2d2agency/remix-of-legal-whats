import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Forward, Loader2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Conversation, ChatMessage } from "@/hooks/use-chat";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage | null;
  conversations: Conversation[];
  currentConversationId: string;
  onForward: (targetConversationId: string, message: ChatMessage) => Promise<void>;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  conversations,
  currentConversationId,
  onForward,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setSending(false);
    }
  }, [open]);

  const filteredConversations = useMemo(() => {
    const others = conversations.filter((c) => c.id !== currentConversationId);
    if (!search.trim()) return others;
    const q = search.toLowerCase();
    return others.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.group_name || "").toLowerCase().includes(q) ||
        (c.contact_phone || "").includes(q) ||
        (c.remote_jid || "").includes(q)
    );
  }, [conversations, currentConversationId, search]);

  const handleForward = async () => {
    if (!selectedId || !message) return;
    setSending(true);
    try {
      await onForward(selectedId, message);
      onOpenChange(false);
    } catch {
      // error handled upstream
    } finally {
      setSending(false);
    }
  };

  const getMessagePreview = () => {
    if (!message) return "";
    if (message.message_type === "image") return "📷 Imagem";
    if (message.message_type === "video") return "🎥 Vídeo";
    if (message.message_type === "audio" || message.message_type === "ptt") return "🎤 Áudio";
    if (message.message_type === "document") return "📄 Documento";
    if (message.message_type === "sticker") return "🎭 Sticker";
    return message.content?.substring(0, 100) || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-primary" />
            Encaminhar mensagem
          </DialogTitle>
          <DialogDescription>
            Selecione a conversa de destino
          </DialogDescription>
        </DialogHeader>

        {/* Message preview */}
        <div className="p-3 rounded-lg bg-muted/50 border text-sm">
          <span className="text-muted-foreground text-xs">Mensagem:</span>
          <p className="line-clamp-2 mt-1">{getMessagePreview()}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Conversations list */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {filteredConversations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma conversa encontrada
              </p>
            )}
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                  "hover:bg-accent",
                  selectedId === conv.id && "bg-primary/10 ring-1 ring-primary"
                )}
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {conv.is_group ? (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {conv.is_group ? conv.group_name : conv.contact_name || conv.contact_phone || conv.remote_jid}
                    </span>
                    {conv.connection_name && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                        {conv.connection_name}
                      </Badge>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Action */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleForward} disabled={!selectedId || sending}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Forward className="h-4 w-4 mr-2" />
            )}
            Encaminhar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
