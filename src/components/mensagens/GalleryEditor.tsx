import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Image,
  Trash2,
  GripVertical,
  Variable,
  Upload,
  Loader2,
  Images,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";
import { MessageItem, GalleryImage } from "./MessageItemEditor";

interface GalleryEditorProps {
  item: MessageItem;
  index: number;
  onUpdate: (id: string, updates: Partial<MessageItem>) => void;
  onDelete: (id: string) => void;
  insertVariable: (id: string, variable: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const MAX_GALLERY_IMAGES = 10;

export function GalleryEditor({
  item,
  index,
  onUpdate,
  onDelete,
  insertVariable,
  dragHandleProps,
}: GalleryEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();
  const [uploadingCount, setUploadingCount] = useState(0);

  const galleryImages = item.galleryImages || [];
  const canAddMore = galleryImages.length < MAX_GALLERY_IMAGES;

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = MAX_GALLERY_IMAGES - galleryImages.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    if (files.length > availableSlots) {
      toast.warning(`Limite de ${MAX_GALLERY_IMAGES} imagens. ${files.length - availableSlots} arquivo(s) ignorado(s).`);
    }

    setUploadingCount(filesToUpload.length);
    const newImages: GalleryImage[] = [];

    for (const file of filesToUpload) {
      try {
        const url = await uploadFile(file);
        if (url) {
          newImages.push({ url, fileName: file.name });
        }
      } catch (error) {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      onUpdate(item.id, { 
        galleryImages: [...galleryImages, ...newImages] 
      });
      toast.success(`${newImages.length} imagem(ns) adicionada(s)!`);
    }

    setUploadingCount(0);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (imageIndex: number) => {
    const updated = galleryImages.filter((_, i) => i !== imageIndex);
    onUpdate(item.id, { galleryImages: updated });
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
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-teal-500/10">
          <Images className="h-4 w-4 text-teal-500" />
          <span className="text-xs font-medium text-teal-500">
            Galeria {index + 1}
          </span>
          <span className="text-xs text-muted-foreground">
            ({galleryImages.length}/{MAX_GALLERY_IMAGES})
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

      <div className="space-y-3">
        {/* Hidden file input - multiple */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelect}
        />

        {/* Gallery Images Grid */}
        {galleryImages.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {galleryImages.map((img, imgIndex) => (
              <div 
                key={imgIndex} 
                className="relative aspect-square rounded-lg overflow-hidden bg-muted group/img"
              >
                <img
                  src={img.url}
                  alt={img.fileName || `Imagem ${imgIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                  onClick={() => removeImage(imgIndex)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 truncate">
                  {img.fileName || `Imagem ${imgIndex + 1}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        {canAddMore && (
          <Button 
            variant="outline" 
            className={cn(
              "w-full border-dashed flex flex-col gap-2",
              galleryImages.length === 0 ? "h-24" : "h-16"
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || uploadingCount > 0}
          >
            {uploadingCount > 0 ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Enviando {uploadingCount} imagem(ns)...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="text-xs">
                  {galleryImages.length === 0 
                    ? `Clique para selecionar até ${MAX_GALLERY_IMAGES} imagens` 
                    : `Adicionar mais imagens (${MAX_GALLERY_IMAGES - galleryImages.length} restantes)`
                  }
                </span>
              </>
            )}
          </Button>
        )}

        {/* Caption for gallery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Legenda (será enviada com a primeira imagem)
            </Label>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => insertVariable(item.id, "nome")}
            >
              <Variable className="h-3 w-3 mr-1" />
              Nome
            </Button>
          </div>
          <Textarea
            placeholder="Adicione uma legenda..."
            value={item.caption || ""}
            onChange={(e) => onUpdate(item.id, { caption: e.target.value })}
            className="min-h-[60px] resize-none"
          />
        </div>
      </div>
    </div>
  );
}
