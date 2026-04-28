import { useState } from "react";
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
import { Loader2, Send, Plus, Trash2, List, Image as ImageIcon, Link, Phone, Copy } from "lucide-react";
  const [image, setImage] = useState("");
  const [buttonTypes, setButtonsTypes] = useState<('reply' | 'url' | 'call' | 'copy')[]>(["reply"]);
  const [buttonValues, setButtonValues] = useState<string[]>([""]);
import { toast } from "sonner";

interface SendInteractiveMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string, buttons: string[], footer?: string) => Promise<void>;
}

export function SendInteractiveMenuDialog({
  open,
  onOpenChange,
  onSend,
}: SendInteractiveMenuDialogProps) {
  const [text, setText] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error("Limite de 3 botões atingido");
      return;
    }
    setButtons([...buttons, ""]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = value;
    setButtons(newButtons);
  };

  const handleSend = async () => {
    const filteredButtons = buttons.map(b => b.trim()).filter(Boolean);
    if (!text.trim()) {
      toast.error("O texto do menu é obrigatório");
      return;
    }
    if (filteredButtons.length === 0) {
      toast.error("Adicione ao menos um botão");
      return;
    }

    setSending(true);
    try {
    const finalButtons = buttons.map((b, i) => {
      const type = buttonTypes[i];
      const val = buttonValues[i].trim();
      if (type === 'url') return `${b.trim()}|url:${val}`;
      if (type === 'call') return `${b.trim()}|call:${val}`;
      if (type === 'copy') return `${b.trim()}|copy:${val}`;
      return val ? `${b.trim()}|${val}` : b.trim();
    });

    await (onSend as any)(text.trim(), finalButtons, footer.trim(), image.trim());
    onOpenChange(false);
    setText("");
    setFooter("");
    setImage("");
    setButtons([""]);
    setButtonsTypes(["reply"]);
    setButtonValues([""]);
  const handleAddButton = () => {
    if (buttons.length >= 10) { // Aumentado para 10 conforme documentação uazapi
      toast.error("Limite de 10 botões atingido");
      return;
    }
    setButtons([...buttons, ""]);
    setButtonsTypes([...buttonTypes, "reply"]);
    setButtonValues([...buttonValues, ""]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
    setButtonsTypes(buttonTypes.filter((_, i) => i !== index));
    setButtonValues(buttonValues.filter((_, i) => i !== index));
  };
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
            Enviar Menu Interativo (UAZAPI)
          </DialogTitle>
          <DialogDescription>
            Crie um menu com botões rápidos. O contato pode clicar em uma das opções para responder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto px-1">
          <div className="space-y-2">
            <Label>Imagem do Menu (URL opcional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://exemplo.com/imagem.jpg"
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
              {image && (
                <div className="h-10 w-10 rounded border overflow-hidden shrink-0">
                  <img src={image} alt="Preview" className="h-full w-full object-cover" />
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
              <Label>Botões (Max 10)</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddButton}
                disabled={buttons.length >= 10}
                className="h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Botão
              </Button>
            </div>
            <div className="space-y-4">
              {buttons.map((btn, idx) => (
                <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2 relative group">
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
                          const newTypes = [...buttonTypes];
                          newTypes[idx] = e.target.value as any;
                          setButtonsTypes(newTypes);
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
                            const newVals = [...buttonValues];
                            newVals[idx] = e.target.value;
                            setButtonValues(newVals);
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