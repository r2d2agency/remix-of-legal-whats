import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, FileText, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, Upload, Brain, Mic } from 'lucide-react';
import { TelehealthSession } from '@/hooks/use-telehealth';
import { cn } from '@/lib/utils';

interface SessionDetailDialogProps {
  session: TelehealthSession | null;
  open: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  waiting: { label: 'Aguardando', color: 'bg-muted text-muted-foreground', icon: Clock },
  recording: { label: 'Gravando', color: 'bg-destructive text-destructive-foreground', icon: Mic },
  processing: { label: 'Processando', color: 'bg-blue-500 text-white', icon: Loader2 },
  transcribing: { label: 'Transcrevendo', color: 'bg-blue-500 text-white', icon: Loader2 },
  organizing: { label: 'Organizando', color: 'bg-purple-500 text-white', icon: Brain },
  completed: { label: 'Concluído', color: 'bg-green-500 text-white', icon: CheckCircle2 },
  error: { label: 'Erro', color: 'bg-destructive text-destructive-foreground', icon: XCircle },
};

const PIPELINE_STEPS = ['processing', 'transcribing', 'organizing', 'completed'];

export function SessionDetailDialog({ session, open, onClose, onRetry }: SessionDetailDialogProps) {
  if (!session) return null;

  const statusInfo = STATUS_MAP[session.status] || STATUS_MAP.waiting;
  const StatusIcon = statusInfo.icon;
  const currentStepIndex = PIPELINE_STEPS.indexOf(session.status);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{session.title || 'Sessão sem título'}</span>
            <Badge className={cn('shrink-0', statusInfo.color)}>
              <StatusIcon className={cn("h-3 w-3 mr-1", session.status === 'transcribing' || session.status === 'organizing' || session.status === 'processing' ? 'animate-spin' : '')} />
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Processing pipeline tracker */}
        {['processing', 'transcribing', 'organizing', 'completed', 'error'].includes(session.status) && (
          <div className="flex items-center gap-1 px-1">
            {[
              { key: 'processing', label: 'Enviado', icon: Upload },
              { key: 'transcribing', label: 'Transcrevendo', icon: Mic },
              { key: 'organizing', label: 'Organizando', icon: Brain },
              { key: 'completed', label: 'Concluído', icon: CheckCircle2 },
            ].map((step, i) => {
              const stepIdx = PIPELINE_STEPS.indexOf(step.key);
              const isDone = currentStepIndex > stepIdx || session.status === 'completed';
              const isActive = session.status === step.key;
              const isError = session.status === 'error' && currentStepIndex === stepIdx;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={cn(
                    "flex flex-col items-center gap-1",
                    isDone ? "text-green-500" : isActive ? "text-primary" : isError ? "text-destructive" : "text-muted-foreground"
                  )}>
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center border-2",
                      isDone ? "border-green-500 bg-green-500/10" : isActive ? "border-primary bg-primary/10" : isError ? "border-destructive bg-destructive/10" : "border-muted"
                    )}>
                      <step.icon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                    </div>
                    <span className="text-[10px] font-medium">{step.label}</span>
                  </div>
                  {i < 3 && <div className={cn("flex-1 h-0.5 mx-1", isDone ? "bg-green-500" : "bg-muted")} />}
                </div>
              );
            })}
          </div>
        )}

        {session.status === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm flex-1">{session.error_message || 'Erro no processamento'}</p>
            <Button size="sm" variant="outline" onClick={() => onRetry(session.id)} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </Button>
          </div>
        )}

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="transcript">Transcrição</TabsTrigger>
            <TabsTrigger value="structured">Conteúdo Estruturado</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="info" className="p-4 space-y-3 m-0">
              {session.contact_name && <div><span className="text-sm font-medium text-muted-foreground">Contato:</span> <span className="text-sm">{session.contact_name}</span></div>}
              {session.deal_title && <div><span className="text-sm font-medium text-muted-foreground">Negociação:</span> <span className="text-sm">{session.deal_title}</span></div>}
              {session.reason && <div><span className="text-sm font-medium text-muted-foreground">Motivo:</span> <p className="text-sm mt-1">{session.reason}</p></div>}
              {session.notes && <div><span className="text-sm font-medium text-muted-foreground">Anotações:</span> <p className="text-sm mt-1 whitespace-pre-wrap">{session.notes}</p></div>}
              {session.audio_duration && <div><span className="text-sm font-medium text-muted-foreground">Duração do áudio:</span> <span className="text-sm">{Math.floor(session.audio_duration / 60)}:{(session.audio_duration % 60).toString().padStart(2, '0')}</span></div>}
              {session.attachments?.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Anexos:</span>
                  <div className="mt-1 space-y-1">
                    {session.attachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <FileText className="h-4 w-4" /> {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div><span className="text-sm font-medium text-muted-foreground">Criado em:</span> <span className="text-sm">{new Date(session.created_at).toLocaleString('pt-BR')}</span></div>
            </TabsContent>

            <TabsContent value="transcript" className="p-4 m-0">
              {session.transcript ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{session.transcript}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Transcrição não disponível ainda.</p>
              )}
            </TabsContent>

            <TabsContent value="structured" className="p-4 m-0">
              {session.structured_content ? (
                <div className="space-y-4">
                  {session.structured_content.resumo && (
                    <div><h4 className="font-medium text-sm mb-1">Resumo</h4><p className="text-sm">{session.structured_content.resumo}</p></div>
                  )}
                  {session.structured_content.pontos_principais?.length > 0 && (
                    <div><h4 className="font-medium text-sm mb-1">Pontos Principais</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {session.structured_content.pontos_principais.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  {session.structured_content.decisoes?.length > 0 && (
                    <div><h4 className="font-medium text-sm mb-1">Decisões</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {session.structured_content.decisoes.map((d: string, i: number) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {session.structured_content.acoes?.length > 0 && (
                    <div><h4 className="font-medium text-sm mb-1">Ações</h4>
                      <div className="space-y-2">
                        {session.structured_content.acoes.map((a: any, i: number) => (
                          <div key={i} className="p-2 bg-muted rounded text-sm">
                            <strong>{a.responsavel}</strong>: {a.acao} {a.prazo && <span className="text-muted-foreground">— {a.prazo}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.structured_content.observacoes && (
                    <div><h4 className="font-medium text-sm mb-1">Observações</h4><p className="text-sm">{session.structured_content.observacoes}</p></div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Conteúdo estruturado não disponível ainda.</p>
              )}
            </TabsContent>

            <TabsContent value="audit" className="p-4 m-0">
              {session.audit_logs?.length ? (
                <div className="space-y-2">
                  {session.audit_logs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-sm border-b pb-2">
                      <span className="text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                      <div>
                        <span className="font-medium">{log.user_name || 'Sistema'}</span>
                        <span className="text-muted-foreground ml-1">— {log.action.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
