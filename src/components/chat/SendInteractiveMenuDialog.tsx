import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Plus, Trash2, List, Link, Phone, Copy, Upload, X } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";

type ButtonType = 'reply' | 'url' | 'call' | 'copy';

interface SendInteractiveMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string, buttons: string[], footer?: string, image?: string) => Promise<void>;
}

const MAX_BUTTONS = 10;

export function SendInteractiveMenuDialog({
  open,
  onOpenChange,
  onSend,
}: SendInteractiveMenuDialogProps) {
  const [text, setText] = useState("");
  const [footer, setFooter] = useState("");
  const [image, setImage] = useState("");
  const [buttons, setButtons] = useState<string[]>([""]);
  const [buttonTypes, setButtonTypes] = useState<ButtonType[]>(["reply"]);
  const [buttonValues, setButtonValues] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddButton = () => {
    if (buttons.length >= MAX_BUTTONS) {
      toast.error(`Limite de ${MAX_BUTTONS} botões atingido`);
      return;
    }
    setButtons([...buttons, ""]);
    setButtonTypes([...buttonTypes, "reply"]);
    setButtonValues([...buttonValues, ""]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
    setButtonTypes(buttonTypes.filter((_, i) => i !== index));
    setButtonValues(buttonValues.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, value: string) => {
    const next = [...buttons];
    next[index] = value;
    setButtons(next);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file);
      if (url) {
        setImage(url);
        toast.success("Imagem enviada com sucesso");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar imagem");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!text.trim()) {
      toast.error("O texto do menu é obrigatório");
      return;
    }
    const finalButtons = buttons
      .map((b, i) => {
        const label = (b || "").trim();
        if (!label) return "";
        const type = buttonTypes[i] || 'reply';
        const val = (buttonValues[i] || "").trim();
        if (type === 'url') return val ? `${label}|url:${val}` : "";
        if (type === 'call') return val ? `${label}|call:${val}` : "";
        if (type === 'copy') return val ? `${label}|copy:${val}` : "";
        return val ? `${label}|${val}` : label;
      })
      .filter(Boolean);

    if (finalButtons.length === 0) {
      toast.error("Adicione ao menos um botão válido");
      return;
    }

    setSending(true);
    try {
      await onSend(text.trim(), finalButtons, footer.trim() || undefined, image.trim() || undefined);
      onOpenChange(false);
      setText("");
      setFooter("");
      setImage("");
      setButtons([""]);
      setButtonTypes(["reply"]);
      setButtonValues([""]);
    } catch (error) {
      console.error("Error sending menu:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            Enviar Menu Interativo
          </DialogTitle>
          <DialogDescription>
            Crie um menu com botões. O contato pode clicar em uma das opções.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label>Imagem do Menu (Opcional)</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="URL da imagem..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Subir imagem do computador"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
              
              {image && (
                <div className="relative w-full aspect-video rounded-lg border overflow-hidden bg-muted group">
                  <img src={image} alt="Preview" className="h-full w-full object-contain" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setImage("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mensagem principal</Label>
            <Textarea
              placeholder="Ex: Como posso te ajudar hoje?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Botões (Max {MAX_BUTTONS})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddButton}
                disabled={buttons.length >= MAX_BUTTONS}
                className="h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Botão
              </Button>
            </div>
            <div className="space-y-4">
              {buttons.map((btn, idx) => (
                <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2 relative">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] uppercase font-bold opacity-70">Texto do Botão</Label>
                      <Input
                        placeholder="Ex: Ver Site"
                        value={btn}
                        onChange={(e) => handleButtonChange(idx, e.target.value)}
                        maxLength={30}
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-[10px] uppercase font-bold opacity-70">Tipo</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={buttonTypes[idx]}
                        onChange={(e) => {
                          const next = [...buttonTypes];
                          next[idx] = e.target.value as ButtonType;
                          setButtonTypes(next);
                        }}
                      >
                        <option value="reply">Resposta</option>
                        <option value="url">Link/URL</option>
                        <option value="call">Chamada</option>
                        <option value="copy">Copiar</option>
                      </select>
                    </div>
                  </div>

                  {buttonTypes[idx] !== 'reply' && (
                    <div>
                      <Label className="text-[10px] uppercase font-bold opacity-70">
                        {buttonTypes[idx] === 'url' ? 'URL (https://...)' :
                          buttonTypes[idx] === 'call' ? 'Telefone (+55...)' : 'Código para copiar'}
                      </Label>
                      <div className="flex gap-2 items-center">
                        {buttonTypes[idx] === 'url' && <Link className="h-4 w-4 shrink-0 text-primary" />}
                        {buttonTypes[idx] === 'call' && <Phone className="h-4 w-4 shrink-0 text-primary" />}
                        {buttonTypes[idx] === 'copy' && <Copy className="h-4 w-4 shrink-0 text-primary" />}
                        <Input
                          placeholder={buttonTypes[idx] === 'url' ? 'https://google.com' :
                            buttonTypes[idx] === 'call' ? '+5511999999999' : 'CÓDIGO123'}
                          value={buttonValues[idx]}
                          onChange={(e) => {
                            const next = [...buttonValues];
                            next[idx] = e.target.value;
                            setButtonValues(next);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {buttons.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute -top-2 -right-2 bg-background border shadow-sm text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveButton(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rodapé (opcional)</Label>
            <Input
              placeholder="Texto menor abaixo dos botões"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
