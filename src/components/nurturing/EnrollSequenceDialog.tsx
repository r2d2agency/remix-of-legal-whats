import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Loader2,
  Play,
  Mail,
  MessageSquare,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { 
  useNurturingSequences, 
  useNurturingMutations,
  NurturingSequence 
} from "@/hooks/use-nurturing";
import { cn } from "@/lib/utils";

interface EnrollSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  conversationId?: string | null;
  dealId?: string | null;
  onSuccess?: () => void;
}

export function EnrollSequenceDialog({
  open,
  onOpenChange,
  contactPhone,
  contactEmail,
  contactName,
  conversationId,
  dealId,
  onSuccess,
}: EnrollSequenceDialogProps) {
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({});
  
  const { data: sequences = [], isLoading } = useNurturingSequences();
  const { enrollContact } = useNurturingMutations();

  // Filter only active sequences
  const activeSequences = sequences.filter(s => s.is_active);

  const selectedSequence = activeSequences.find(s => s.id === selectedSequenceId);

  const handleEnroll = async () => {
    if (!selectedSequenceId) return;

    await enrollContact.mutateAsync({
      sequenceId: selectedSequenceId,
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      contact_name: contactName || undefined,
      conversation_id: conversationId || undefined,
      deal_id: dealId || undefined,
      variables: {
        nome: contactName || "",
        telefone: contactPhone || "",
        email: contactEmail || "",
        ...customVariables,
      },
    });

    onOpenChange(false);
    setSelectedSequenceId(null);
    setCustomVariables({});
    onSuccess?.();
  };

  const getDelayText = (value: number, unit: string) => {
    const unitLabels: Record<string, string> = {
      minutes: value === 1 ? "minuto" : "minutos",
      hours: value === 1 ? "hora" : "horas",
      days: value === 1 ? "dia" : "dias",
    };
    return `${value} ${unitLabels[unit] || unit}`;
  };

  const getChannelIcon = (channel: string) => {
    if (channel === 'whatsapp') return <MessageSquare className="h-3 w-3 text-green-500" />;
    if (channel === 'email') return <Mail className="h-3 w-3 text-blue-500" />;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Inscrever em Sequência de Nurturing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <div className="flex flex-wrap gap-2">
            {contactName && (
              <Badge variant="secondary" className="text-xs">
                {contactName}
              </Badge>
            )}
            {contactPhone && (
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {contactPhone}
              </Badge>
            )}
            {contactEmail && (
              <Badge variant="outline" className="text-xs">
                <Mail className="h-3 w-3 mr-1" />
                {contactEmail}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Sequence List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeSequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma sequência ativa encontrada</p>
              <p className="text-sm">Crie uma sequência em Disparos → Sequências</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {activeSequences.map((sequence) => (
                  <div
                    key={sequence.id}
                    onClick={() => setSelectedSequenceId(sequence.id)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedSequenceId === sequence.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sequence.name}</span>
                          {selectedSequenceId === sequence.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        {sequence.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {sequence.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {sequence.steps_count || 0} passos
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {sequence.contacts_enrolled} inscritos
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Steps preview */}
                    {selectedSequenceId === sequence.id && sequence.steps && sequence.steps.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Passos da sequência:</p>
                        {sequence.steps.slice(0, 5).map((step, idx) => (
                          <div
                            key={step.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </Badge>
                            {getChannelIcon(step.channel)}
                            <span className="flex-1 truncate">
                              {step.channel === 'whatsapp' 
                                ? step.whatsapp_content?.substring(0, 40) + '...'
                                : step.email_subject || 'Email'}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getDelayText(step.delay_value, step.delay_unit)}
                            </span>
                          </div>
                        ))}
                        {sequence.steps.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{sequence.steps.length - 5} passos adicionais
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Warnings */}
          {selectedSequence && (
            <div className="space-y-2">
              {selectedSequence.pause_on_reply && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  ⏸️ Pausará automaticamente se o contato responder
                </p>
              )}
              {!contactPhone && activeSequences.some(s => s.steps?.some(st => st.channel === 'whatsapp')) && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠️ Contato sem telefone - passos de WhatsApp não serão enviados
                </p>
              )}
              {!contactEmail && activeSequences.some(s => s.steps?.some(st => st.channel === 'email')) && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠️ Contato sem email - passos de Email não serão enviados
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={!selectedSequenceId || enrollContact.isPending}
          >
            {enrollContact.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inscrevendo...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Inscrever na Sequência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
