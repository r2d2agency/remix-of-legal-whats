import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; reason: string; contact_name?: string; deal_title?: string; consent_given: boolean }) => void;
}

export function NewSessionDialog({ open, onClose, onCreate }: NewSessionDialogProps) {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [contactName, setContactName] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [consent, setConsent] = useState(false);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      reason: reason.trim(),
      contact_name: contactName.trim() || undefined,
      deal_title: dealTitle.trim() || undefined,
      consent_given: consent,
    });
    setTitle(''); setReason(''); setContactName(''); setDealTitle(''); setConsent(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Sessão de Teleatendimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título da Sessão *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Consulta Dr. Silva" />
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da reunião..." rows={2} />
          </div>
          <div>
            <Label>Contato / Participante</Label>
            <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome do participante (opcional)" />
          </div>
          <div>
            <Label>Negociação Vinculada</Label>
            <Input value={dealTitle} onChange={e => setDealTitle(e.target.value)} placeholder="Título da negociação (opcional)" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={consent} onCheckedChange={setConsent} />
            <Label className="text-sm">Consentimento para gravação obtido</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Criar Sessão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
