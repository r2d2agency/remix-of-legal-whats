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
import { Loader2, Send, Plus, Trash2, List } from "lucide-react";
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
      await onSend(text.trim(), filteredButtons, footer.trim());
      onOpenChange(false);
      setText("");
      setFooter("");
      setButtons([""]);
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

        <div className="space-y-4 py-2">
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
              <Label>Botões (Max 3)</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddButton}
                disabled={buttons.length >= 3}
                className="h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Botão
              </Button>
            </div>
            <div className="space-y-2">
              {buttons.map((btn, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder={`Botão ${idx + 1}`}
                    value={btn}
                    onChange={(e) => handleButtonChange(idx, e.target.value)}
                    maxLength={20}
                  />
                  {buttons.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => handleRemoveButton(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
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