import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Type,
  Image,
  Video,
  Mic,
  FileText,
  Trash2,
  GripVertical,
  Variable,
  Upload,
  Loader2,
  File,
  MousePointerClick,
  List,
  BarChart3,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";

export type MessageItemType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "gallery"
  | "buttons"
  | "list"
  | "poll";

export interface GalleryImage {
  url: string;
  fileName?: string;
}

export interface InteractiveOption {
  id?: string;
  label: string;
  description?: string;
}

export interface MessageItem {
  id: string;
  type: MessageItemType;
  content: string;
  mediaUrl?: string;
  caption?: string;
  ptt?: boolean;
  fileName?: string;
  galleryImages?: GalleryImage[];
  // Interactive (UAZAPI only)
  options?: InteractiveOption[];
  buttonText?: string;
  footer?: string;
  multiSelect?: boolean;
}

interface MessageItemEditorProps {
  item: MessageItem;
  index: number;
  onUpdate: (id: string, updates: Partial<MessageItem>) => void;
  onDelete: (id: string) => void;
  insertVariable: (id: string, variable: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const typeConfig = {
  text: {
    icon: Type,
    label: "Texto",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    accept: "",
  },
  image: {
    icon: Image,
    label: "Imagem",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    accept: "image/*",
  },
  video: {
    icon: Video,
    label: "Vídeo",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    accept: "video/mp4,video/webm,video/ogg,video/quicktime",
  },
  audio: {
    icon: Mic,
    label: "Áudio",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    accept: "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/aac,audio/m4a",
  },
  document: {
    icon: FileText,
    label: "Documento",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar",
  },
  gallery: {
    icon: Image,
    label: "Galeria",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    accept: "image/*",
  },
  buttons: {
    icon: MousePointerClick,
    label: "Botões",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    accept: "",
  },
  list: {
    icon: List,
    label: "Lista",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    accept: "",
  },
  poll: {
    icon: BarChart3,
    label: "Enquete",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    accept: "",
  },
};

const isInteractive = (t: MessageItemType) => t === "buttons" || t === "list" || t === "poll";

export function MessageItemEditor({
  item,
  index,
  onUpdate,
  onDelete,
  insertVariable,
  dragHandleProps,
}: MessageItemEditorProps) {
  const config = typeConfig[item.type];
  const Icon = config.icon;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file);
      if (url) {
        onUpdate(item.id, { mediaUrl: url, fileName: file.name });
        toast.success("Arquivo enviado com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao enviar arquivo");
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="group relative rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="flex items-center gap-2 text-muted-foreground cursor-grab active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className={cn("flex items-center gap-2 px-2 py-1 rounded-md", config.bgColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label} {index + 1}
          </span>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Content based on type */}
      {isInteractive(item.type) ? (
        <InteractiveEditor item={item} onUpdate={onUpdate} />
      ) : item.type === "text" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Mensagem de texto</Label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => insertVariable(item.id, "nome")}
              >
                <Variable className="h-3 w-3 mr-1" />
                nome
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => insertVariable(item.id, "telefone")}
              >
                telefone
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => insertVariable(item.id, "email")}
              >
                email
              </Button>
            </div>
          </div>
          <Textarea
            placeholder="Digite sua mensagem aqui... Use {nome}, {telefone}, {email} para personalizar"
            value={item.content}
            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
            className="min-h-[100px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>, <code className="bg-muted px-1 rounded">{'{telefone}'}</code>, <code className="bg-muted px-1 rounded">{'{email}'}</code>, <code className="bg-muted px-1 rounded">{'{empresa}'}</code>, <code className="bg-muted px-1 rounded">{'{cargo}'}</code>, <code className="bg-muted px-1 rounded">{'{obs}'}</code>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={config.accept}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Media Upload */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {item.mediaUrl ? `${config.label} carregado` : `Enviar ${config.label.toLowerCase()}`}
            </Label>
            
            {item.mediaUrl ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
                <div className={cn("p-2 rounded", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <span className="text-sm flex-1 truncate">
                  {item.fileName || "Arquivo carregado"}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onUpdate(item.id, { mediaUrl: undefined, fileName: undefined })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full h-20 border-dashed flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs">Enviando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Clique para selecionar {config.label.toLowerCase()}</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* PTT option for audio */}
          {item.type === "audio" && (
            <div className="flex items-center justify-between rounded-lg bg-accent/50 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enviar como áudio gravado</Label>
                <p className="text-xs text-muted-foreground">
                  O áudio será enviado como mensagem de voz (PTT)
                </p>
              </div>
              <Switch
                checked={item.ptt ?? true}
                onCheckedChange={(checked) => onUpdate(item.id, { ptt: checked })}
              />
            </div>
          )}

          {/* Preview for images */}
          {item.type === "image" && item.mediaUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-w-[200px]">
              <img
                src={item.mediaUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Audio preview */}
          {item.type === "audio" && item.mediaUrl && (
            <div className="rounded-lg bg-muted p-3">
              <audio controls className="w-full h-8">
                <source src={item.mediaUrl} />
                Seu navegador não suporta áudio.
              </audio>
            </div>
          )}

          {/* Video preview */}
          {item.type === "video" && item.mediaUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-w-[300px]">
              <video controls className="w-full h-full">
                <source src={item.mediaUrl} />
                Seu navegador não suporta vídeo.
              </video>
            </div>
          )}

          {/* Document preview */}
          {item.type === "document" && item.mediaUrl && (
            <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <div className="flex items-center justify-center w-10 h-10 bg-red-500 rounded">
                <File className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.fileName || 'documento'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.fileName?.split('.').pop()?.toUpperCase() || 'DOC'}
                </p>
              </div>
              <a 
                href={item.mediaUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Abrir
              </a>
            </div>
          )}

          {/* Caption for media */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => insertVariable(item.id, "nome")}
                >
                  <Variable className="h-3 w-3 mr-1" />
                  nome
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => insertVariable(item.id, "telefone")}
                >
                  telefone
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Adicione uma legenda... Use {nome} para personalizar"
              value={item.caption || ""}
              onChange={(e) => onUpdate(item.id, { caption: e.target.value })}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Editor para tipos interativos UAZAPI (botões / lista / enquete)
 */
function InteractiveEditor({
  item,
  onUpdate,
}: {
  item: MessageItem;
  onUpdate: (id: string, updates: Partial<MessageItem>) => void;
}) {
  const options = item.options || [];
  const maxOptions = item.type === "buttons" ? 3 : item.type === "list" ? 10 : 12;
  const placeholderText =
    item.type === "buttons"
      ? "Texto da mensagem que será exibida acima dos botões"
      : item.type === "list"
        ? "Texto da mensagem que aparecerá antes do botão da lista"
        : "Pergunta da enquete";

  const updateOption = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = { ...next[idx], label: value };
    onUpdate(item.id, { options: next });
  };
  const addOption = () => {
    if (options.length >= maxOptions) {
      toast.error(`Máximo de ${maxOptions} opções para este tipo`);
      return;
    }
    onUpdate(item.id, { options: [...options, { label: "" }] });
  };
  const removeOption = (idx: number) => {
    const next = options.filter((_, i) => i !== idx);
    onUpdate(item.id, { options: next });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs text-muted-foreground">
        ⚡ Recurso exclusivo UAZAPI — só funcionará em conexões UAZAPI.
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {item.type === "poll" ? "Pergunta" : "Mensagem"}
        </Label>
        <Textarea
          placeholder={placeholderText}
          value={item.content}
          onChange={(e) => onUpdate(item.id, { content: e.target.value })}
          className="min-h-[80px] resize-none"
        />
      </div>

      {item.type === "list" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Texto do botão da lista</Label>
          <Input
            placeholder="Ver opções"
            value={item.buttonText || ""}
            onChange={(e) => onUpdate(item.id, { buttonText: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            Opções ({options.length}/{maxOptions})
          </Label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addOption}>
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhuma opção adicionada ainda.</p>
        )}
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
            <Input
              placeholder={`Opção ${idx + 1}`}
              value={opt.label}
              onChange={(e) => updateOption(idx, e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => removeOption(idx)}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {item.type !== "poll" && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Rodapé (opcional)</Label>
          <Input
            placeholder="Texto pequeno exibido no rodapé"
            value={item.footer || ""}
            onChange={(e) => onUpdate(item.id, { footer: e.target.value })}
          />
        </div>
      )}

      {item.type === "poll" && (
        <div className="flex items-center justify-between rounded-lg bg-accent/50 p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Permitir múltiplas respostas</Label>
            <p className="text-xs text-muted-foreground">
              Participantes poderão escolher mais de uma opção
            </p>
          </div>
          <Switch
            checked={!!item.multiSelect}
            onCheckedChange={(checked) => onUpdate(item.id, { multiSelect: checked })}
          />
        </div>
      )}
    </div>
  );
}
