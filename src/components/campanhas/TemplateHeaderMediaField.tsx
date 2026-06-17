import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X, Image as ImageIcon, Video as VideoIcon, FileText } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
  value: string;
  onChange: (url: string) => void;
}

const ACCEPT: Record<Props["format"], string> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf",
};

const LABEL: Record<Props["format"], string> = {
  IMAGE: "Imagem do cabeçalho",
  VIDEO: "Vídeo do cabeçalho",
  DOCUMENT: "Documento do cabeçalho (PDF)",
};

function toAbsolute(url: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_URL}${url}`;
  return url;
}

export function TemplateHeaderMediaField({ format, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();
  const [busy, setBusy] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadFile(f);
      if (url) onChange(toAbsolute(url));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar arquivo");
    } finally {
      setBusy(false);
    }
  };

  const Icon = format === "IMAGE" ? ImageIcon : format === "VIDEO" ? VideoIcon : FileText;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <Label className="text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {LABEL[format]}
      </Label>
      <p className="text-xs text-muted-foreground">
        Este template exige mídia de cabeçalho. Envie um arquivo ou cole uma URL pública.
      </p>
      <input ref={inputRef} type="file" className="hidden" accept={ACCEPT[format]} onChange={handleSelect} />
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... ou faça upload"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => inputRef.current?.click()}
          disabled={busy || isUploading}
        >
          {busy || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && format === "IMAGE" && (
        <img src={value} alt="Preview" className="mt-2 max-h-32 rounded border object-contain" />
      )}
    </div>
  );
}