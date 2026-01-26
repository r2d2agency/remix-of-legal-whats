import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCRMLossReasons } from "@/hooks/use-crm-config";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reasonId: string, description: string) => void;
  dealTitle?: string;
}

export function LossReasonDialog({ open, onOpenChange, onConfirm, dealTitle }: LossReasonDialogProps) {
  const [selectedReasonId, setSelectedReasonId] = useState<string>("");
  const [description, setDescription] = useState("");
  const { data: lossReasons, isLoading } = useCRMLossReasons();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedReasonId("");
      setDescription("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedReasonId) return;
    onConfirm(selectedReasonId, description);
    onOpenChange(false);
  };

  const activeReasons = lossReasons?.filter(r => r.is_active) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Marcar como Perdido
          </DialogTitle>
          <DialogDescription>
            {dealTitle && <span className="font-medium">{dealTitle}</span>}
            <br />
            Selecione o motivo da perda para registrar no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeReasons.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm">
                Nenhum motivo de perda configurado. Configure em CRM → Configurações → Motivos de Perda.
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Perda *</Label>
                <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        <div className="flex flex-col">
                          <span>{reason.name}</span>
                          {reason.description && (
                            <span className="text-xs text-muted-foreground">{reason.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Adicione detalhes sobre a perda..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReasonId || isLoading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
