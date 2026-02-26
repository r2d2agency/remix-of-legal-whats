import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Mic,
  Phone,
  Reply,
  RotateCcw,
  Pencil,
  Trash2,
  X,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media";
import { ChatMessage, Conversation } from "@/hooks/use-chat";
import { AudioPlayer } from "./AudioPlayer";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  conversation: Conversation;
  isMobile: boolean;
  isSearchResult: boolean;
  isCurrentResult: boolean;
  searchQuery: string;
  onReply: (msg: ChatMessage) => void;
  onSendMessage: (content: string, type?: string, mediaUrl?: string, quotedMessageId?: string, mediaMimetype?: string) => Promise<void>;
  onEditMessage?: (messageId: string, content: string) => Promise<boolean>;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  highlightText: (text: string, query: string) => React.ReactNode;
  getDocumentDisplayName: (msg: ChatMessage, resolvedUrl?: string | null) => string;
  looksLikeFilename: (value: string) => boolean;
  messageRef: (el: HTMLDivElement | null) => void;
}

const messageStatusIcon = (status: string) => {
  switch (status) {
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'pending':
      return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
};

export function ChatMessageBubble({
  msg,
  conversation,
  isMobile,
  isSearchResult,
  isCurrentResult,
  searchQuery,
  onReply,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  highlightText,
  getDocumentDisplayName,
  looksLikeFilename,
  messageRef,
}: ChatMessageBubbleProps) {
  const mediaUrl = resolveMediaUrl(msg.media_url);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content || '');
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = msg.from_me && msg.message_type === 'text' && !msg.is_deleted && !!onEditMessage;
  const canDelete = msg.from_me && !msg.is_deleted && !!onDeleteMessage;

  const handleEdit = async () => {
    if (!editContent.trim() || !onEditMessage) return;
    setIsSaving(true);
    const ok = await onEditMessage(msg.id, editContent.trim());
    setIsSaving(false);
    if (ok) {
      toast.success("Mensagem editada");
      setIsEditing(false);
    } else {
      toast.error("Falha ao editar");
    }
  };

  const handleDelete = async () => {
    if (!onDeleteMessage) return;
    const ok = await onDeleteMessage(msg.id);
    if (ok) {
      toast.success("Mensagem apagada");
    } else {
      toast.error("Falha ao apagar");
    }
  };

  return (
    <div
      ref={messageRef}
      className={cn(
        "flex w-full min-w-0 group",
        msg.from_me ? "justify-end" : "justify-start"
      )}
    >
      {/* Reply button - left side for received messages */}
      {!msg.from_me && msg.message_type !== 'system' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity self-center mr-1"
          onClick={() => onReply(msg)}
          title="Responder"
        >
          <Reply className="h-3 w-3" />
        </Button>
      )}

      <div
        className={cn(
          "rounded-lg transition-all overflow-hidden min-w-0",
          isMobile ? "max-w-[85%] p-2.5" : "max-w-[70%] p-3",
          msg.from_me ? "message-sent" : "message-received",
          msg.message_type === 'system' && "!bg-accent !text-accent-foreground text-center max-w-full text-xs italic",
          isSearchResult && "ring-2 ring-yellow-400",
          isCurrentResult && "ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-900/30",
          msg.status === 'failed' && "ring-2 ring-destructive bg-destructive/10"
        )}
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        {/* Sender name for group messages */}
        {conversation?.is_group && !msg.from_me && msg.sender_name && (
          <div className="text-xs font-semibold mb-1 text-primary">
            {msg.sender_name}
            {msg.sender_phone && (
              <span className="font-normal text-muted-foreground ml-1">
                ({msg.sender_phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')})
              </span>
            )}
          </div>
        )}

        {/* Quoted message */}
        {msg.quoted_message_id && msg.quoted_content && (
          <div className={cn(
            "mb-2 p-2 rounded border-l-4 text-xs",
            msg.from_me 
              ? "bg-primary-foreground/10 border-primary-foreground/50" 
              : "bg-background/50 border-primary/50"
          )}>
            <div className="font-medium opacity-80 mb-0.5">
              <Reply className="h-3 w-3 inline mr-1" />
              {msg.quoted_from_me ? 'Você' : (msg.quoted_sender_name || 'Contato')}
            </div>
            <p className="line-clamp-2 opacity-70">
              {msg.quoted_message_type !== 'text' ? (
                <span className="italic">
                  {msg.quoted_message_type === 'image' && '📷 Imagem'}
                  {msg.quoted_message_type === 'video' && '🎥 Vídeo'}
                  {msg.quoted_message_type === 'audio' && '🎤 Áudio'}
                  {msg.quoted_message_type === 'document' && '📄 Documento'}
                </span>
              ) : msg.quoted_content}
            </p>
          </div>
        )}

        {/* Media content */}
        {(msg.message_type === 'image' || (msg.media_mimetype?.startsWith('image/') ?? false)) && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={mediaUrl}
              alt="Imagem recebida"
              loading="lazy"
              className="rounded max-w-full max-h-[300px] mb-2 cursor-pointer hover:opacity-90"
              crossOrigin="anonymous"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = document.createElement('div');
                fallback.className = 'flex items-center gap-2 text-sm opacity-70 mb-2 p-3 rounded bg-muted';
                fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Imagem não disponível</span>';
                target.parentElement?.appendChild(fallback);
              }}
            />
          </a>
        )}

        {(msg.message_type === 'video' || (msg.media_mimetype?.startsWith('video/') ?? false)) && mediaUrl && (
          <div className="mb-2">
            <video controls playsInline preload="metadata" className="rounded max-w-full max-h-[300px]" crossOrigin="anonymous">
              {msg.media_mimetype && <source src={mediaUrl} type={msg.media_mimetype} />}
              <source src={mediaUrl} type="video/mp4" />
              <source src={mediaUrl} type="video/webm" />
              Seu navegador não suporta vídeo.
            </video>
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-70 hover:opacity-100">
              Abrir vídeo
            </a>
          </div>
        )}

        {(msg.message_type === 'audio' || msg.message_type === 'ptt' || (msg.media_mimetype?.startsWith('audio/') ?? false)) && (
          mediaUrl ? (
            <div className="mb-2">
              <AudioPlayer src={mediaUrl} mimetype={msg.media_mimetype || undefined} isFromMe={msg.from_me} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70 mb-2 p-3 rounded-lg bg-background/30">
              <Mic className="h-4 w-4" />
              <span>Áudio não disponível</span>
            </div>
          )
        )}

        {msg.message_type === 'sticker' && mediaUrl && (
          <img
            src={mediaUrl}
            alt="Sticker recebido"
            className="max-w-[150px] max-h-[150px] mb-2"
            crossOrigin="anonymous"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'flex items-center gap-2 text-sm opacity-70 mb-2';
              fallback.innerHTML = '🎭 <span>Sticker não disponível</span>';
              target.parentElement?.appendChild(fallback);
            }}
          />
        )}

        {msg.message_type === 'document' && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline mb-2 min-w-0">
            <FileText className="h-4 w-4" />
            <span className="truncate">{getDocumentDisplayName(msg, mediaUrl)}</span>
          </a>
        )}

        {/* Call Log */}
        {msg.message_type === 'call_log' && (
          <div className="bg-background/50 rounded-lg p-3 border border-primary/20 mb-2">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Phone className="h-4 w-4" />
              <span className="font-medium text-sm">Registro de Chamada</span>
            </div>
            {msg.content && (
              <p className="text-sm whitespace-pre-wrap opacity-90" style={{ wordBreak: 'break-word' }}>
                {msg.content}
              </p>
            )}
          </div>
        )}

        {/* Text content */}
        {msg.is_deleted ? (
          <p className="text-sm whitespace-pre-wrap line-through opacity-50 italic" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {msg.content || '🚫 Mensagem apagada'}
          </p>
        ) : isEditing ? (
          <div className="flex flex-col gap-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-sm min-h-[40px] bg-background/50 border-primary/30"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                }
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <div className="flex items-center gap-1 justify-end">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleEdit} disabled={isSaving || !editContent.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : msg.content && msg.message_type !== 'call_log' && !(msg.message_type === 'document' && looksLikeFilename(msg.content)) ? (
          <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {searchQuery ? highlightText(msg.content, searchQuery) : msg.content}
          </p>
        ) : null}

        {/* Timestamp and status */}
        <div className={cn(
          "flex items-center gap-1 mt-1",
          msg.from_me ? "justify-end" : "justify-start"
        )}>
          {msg.is_deleted && <span className="text-[10px] opacity-50 italic">🚫 apagada</span>}
          {msg.is_edited && !msg.is_deleted && <span className="text-[10px] opacity-50 italic">editada</span>}
          <span className="text-[10px] opacity-70">
            {format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
          </span>
          {msg.from_me && messageStatusIcon(msg.status)}
        </div>

        {/* Failed message indicator with retry */}
        {msg.status === 'failed' && msg.from_me && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-destructive/30">
            {msg.error_message && (
              <span className="text-[10px] text-destructive/80 break-words">{msg.error_message}</span>
            )}
            <div className="flex items-center justify-end gap-2">
              <span className="text-[10px] text-destructive font-medium">Falha no envio</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  try {
                    const retryContent = msg.content || (msg.message_type === 'document' ? getDocumentDisplayName(msg, mediaUrl) : '');
                    await onSendMessage(retryContent, msg.message_type, msg.media_url || undefined, msg.quoted_message_id || undefined, msg.media_mimetype || undefined);
                    toast.success("Mensagem reenviada!");
                  } catch {
                    toast.error("Falha ao reenviar");
                  }
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reenviar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons - right side for sent messages */}
      {msg.from_me && msg.message_type !== 'system' && !msg.is_deleted && (
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onReply(msg)}
            title="Responder"
          >
            <Reply className="h-3 w-3" />
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setEditContent(msg.content || ''); setIsEditing(true); }}
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:text-destructive"
              onClick={handleDelete}
              title="Apagar"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {msg.from_me && msg.message_type !== 'system' && msg.is_deleted && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onReply(msg)}
            title="Responder"
          >
            <Reply className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
