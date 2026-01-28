import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { 
  Calendar, Clock, RefreshCw, Play, Pause, Trash2,
  Users, DollarSign, Loader2, Plus, Eye, StopCircle,
  Timer, Settings2, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QueueManagerProps {
  organizationId: string;
}

interface Rule {
  id: string;
  name: string;
  trigger_type: string;
  days_offset: number;
  max_days_overdue: number | null;
  connection_id: string | null;
  connection_name: string | null;
}

interface Batch {
  id: string;
  name: string;
  queue_date: string;
  status: string;
  rule_name: string;
  connection_name: string;
  total_items: number;
  total_value: number;
  sent_count: number;
  failed_count: number;
  start_time: string | null;
  interval_seconds: number;
  started_at: string | null;
  completed_at: string | null;
}

interface QueueItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  payment_value: number;
  due_date: string;
  status: string;
  position: number;
  scheduled_for: string | null;
  sent_at: string | null;
  error_message: string | null;
}

interface PreviewData {
  payments: Array<{
    id: string;
    customer_name: string;
    customer_phone: string;
    value: number;
    due_date: string;
  }>;
  total_count: number;
  total_value: number;
}

export default function QueueManager({ organizationId }: QueueManagerProps) {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Form states
  const [selectedRule, setSelectedRule] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Schedule form
  const [scheduleConfig, setScheduleConfig] = useState({
    start_time: "09:00",
    interval_mode: "fixed",
    interval_seconds: 240,
    interval_min_seconds: 180,
    interval_max_seconds: 300
  });
  
  // Details
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchItems, setBatchItems] = useState<QueueItem[]>([]);
  
  // Actions
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      const data = await api<Batch[]>(`/api/billing-queue/batches/${organizationId}`);
      setBatches(data);
    } catch (err) {
      console.error('Load batches error:', err);
    }
  };

  const loadRules = async () => {
    try {
      const data = await api<Rule[]>(`/api/asaas/rules/${organizationId}`);
      setRules(data.filter(r => r.connection_id)); // Só regras com conexão
    } catch (err) {
      console.error('Load rules error:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadBatches(), loadRules()]);
      setLoading(false);
    };
    load();
  }, [organizationId]);

  const loadPreview = async () => {
    if (!selectedRule) return;
    
    setLoadingPreview(true);
    try {
      const data = await api<PreviewData>(
        `/api/billing-queue/preview/${organizationId}?rule_id=${selectedRule}&date=${selectedDate}`
      );
      setPreview(data);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (selectedRule && showCreateDialog) {
      loadPreview();
    }
  }, [selectedRule, selectedDate, showCreateDialog]);

  const createBatch = async () => {
    if (!selectedRule || !preview || preview.total_count === 0) {
      toast.error('Selecione uma regra com cobranças disponíveis');
      return;
    }

    try {
      setProcessingBatch('creating');
      const result = await api<{ success: boolean; batch: Batch; items_count: number }>(
        `/api/billing-queue/generate/${organizationId}`,
        {
          method: 'POST',
          body: { rule_id: selectedRule, date: selectedDate }
        }
      );

      if (result.success) {
        toast.success(`Fila criada com ${result.items_count} cobranças`);
        setShowCreateDialog(false);
        loadBatches();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar fila');
    } finally {
      setProcessingBatch(null);
    }
  };

  const scheduleBatch = async () => {
    if (!selectedBatch) return;

    try {
      setProcessingBatch(selectedBatch.id);
      const result = await api<{ success: boolean; estimated_end_time: string; total_duration_minutes: number }>(
        `/api/billing-queue/schedule/${organizationId}/${selectedBatch.id}`,
        {
          method: 'POST',
          body: scheduleConfig
        }
      );

      if (result.success) {
        const endTime = new Date(result.estimated_end_time);
        toast.success(`Agendado! Término estimado: ${format(endTime, 'HH:mm', { locale: ptBR })} (~${result.total_duration_minutes} min)`);
        setShowScheduleDialog(false);
        loadBatches();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar');
    } finally {
      setProcessingBatch(null);
    }
  };

  const startBatch = async (batchId: string) => {
    if (!confirm('Iniciar envio imediatamente? Esta ação não pode ser desfeita.')) return;

    try {
      setProcessingBatch(batchId);
      const result = await api<{ success: boolean; sent: number; failed: number; total: number }>(
        `/api/billing-queue/start/${organizationId}/${batchId}`,
        { method: 'POST' }
      );

      if (result.success) {
        toast.success(`Envio concluído: ${result.sent}/${result.total} enviados`);
        loadBatches();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar');
    } finally {
      setProcessingBatch(null);
    }
  };

  const cancelBatch = async (batchId: string) => {
    if (!confirm('Cancelar este lote?')) return;

    try {
      await api(`/api/billing-queue/cancel/${organizationId}/${batchId}`, { method: 'POST' });
      toast.success('Lote cancelado');
      loadBatches();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar');
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('Excluir este lote permanentemente?')) return;

    try {
      await api(`/api/billing-queue/batch/${organizationId}/${batchId}`, { method: 'DELETE' });
      toast.success('Lote excluído');
      loadBatches();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const viewBatchDetails = async (batch: Batch) => {
    setSelectedBatch(batch);
    
    try {
      const data = await api<{ batch: Batch; items: QueueItem[] }>(
        `/api/billing-queue/batch/${organizationId}/${batch.id}`
      );
      setBatchItems(data.items);
      setShowDetailsDialog(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar detalhes');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Aguardando" },
      scheduled: { variant: "outline", label: "Agendado" },
      running: { variant: "default", label: "Enviando" },
      completed: { variant: "default", label: "Concluído" },
      cancelled: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const calculateEstimatedTime = (count: number, intervalSeconds: number) => {
    const totalSeconds = count * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciador de Filas</h2>
          <p className="text-muted-foreground">
            Crie e gerencie filas de cobrança com controle de horários
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fila
          </Button>
        </div>
      </div>

      {/* Batches List */}
      <Card>
        <CardHeader>
          <CardTitle>Filas de Cobrança</CardTitle>
          <CardDescription>
            Lotes de cobrança criados para envio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma fila criada ainda</p>
              <p className="text-sm">Clique em "Nova Fila" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Regra</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Progresso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(batch.queue_date), 'dd/MM', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{batch.rule_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{batch.total_items}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(batch.total_value)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(batch.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {batch.status === 'completed' || batch.status === 'running' ? (
                        <span className="text-sm">
                          <span className="text-green-600">{batch.sent_count}</span>
                          {batch.failed_count > 0 && (
                            <span className="text-destructive">/{batch.failed_count}</span>
                          )}
                          <span className="text-muted-foreground">/{batch.total_items}</span>
                        </span>
                      ) : batch.start_time ? (
                        <span className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {batch.start_time}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewBatchDetails(batch)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {batch.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedBatch(batch);
                                setShowScheduleDialog(true);
                              }}
                              title="Agendar envio"
                            >
                              <Timer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => startBatch(batch.id)}
                              disabled={processingBatch === batch.id}
                              title="Iniciar agora"
                            >
                              {processingBatch === batch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        
                        {batch.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelBatch(batch.id)}
                            title="Cancelar"
                          >
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {(batch.status === 'completed' || batch.status === 'cancelled') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteBatch(batch.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Queue Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Nova Fila de Cobrança</DialogTitle>
            <DialogDescription>
              Selecione uma regra e a data para gerar a fila de cobranças
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Regra de Notificação</Label>
                <Select value={selectedRule} onValueChange={setSelectedRule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma regra" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Referência</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            {/* Preview */}
            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : preview ? (
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Preview da Fila</CardTitle>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold">{preview.total_count}</span>
                        <span className="text-muted-foreground">cobranças</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold">{formatCurrency(preview.total_value)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                {preview.payments.length > 0 && (
                  <CardContent className="pt-0">
                    <ScrollArea className="h-48">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.payments.slice(0, 20).map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.customer_name}</TableCell>
                              <TableCell className="text-muted-foreground">{p.customer_phone}</TableCell>
                              <TableCell>{format(parseISO(p.due_date), 'dd/MM/yy')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(p.value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {preview.payments.length > 20 && (
                        <p className="text-center text-sm text-muted-foreground py-2">
                          +{preview.payments.length - 20} outros...
                        </p>
                      )}
                    </ScrollArea>
                  </CardContent>
                )}
              </Card>
            ) : selectedRule ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma cobrança encontrada para esta regra/data
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={createBatch} 
              disabled={!preview || preview.total_count === 0 || processingBatch === 'creating'}
            >
              {processingBatch === 'creating' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar Fila ({preview?.total_count || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Envio</DialogTitle>
            <DialogDescription>
              Configure o horário e intervalo de envio para "{selectedBatch?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Horário de Início</Label>
              <Input
                type="time"
                value={scheduleConfig.start_time}
                onChange={(e) => setScheduleConfig(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Modo de Intervalo</Label>
              <RadioGroup 
                value={scheduleConfig.interval_mode}
                onValueChange={(v) => setScheduleConfig(prev => ({ ...prev, interval_mode: v }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed">Fixo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random">Aleatório (mais natural)</Label>
                </div>
              </RadioGroup>
            </div>

            {scheduleConfig.interval_mode === 'fixed' ? (
              <div className="space-y-2">
                <Label>Intervalo (segundos)</Label>
                <Input
                  type="number"
                  value={scheduleConfig.interval_seconds}
                  onChange={(e) => setScheduleConfig(prev => ({ 
                    ...prev, 
                    interval_seconds: parseInt(e.target.value) || 240 
                  }))}
                  min={60}
                  max={600}
                />
                <p className="text-sm text-muted-foreground">
                  = {Math.round(scheduleConfig.interval_seconds / 60)} minutos entre mensagens
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mínimo (seg)</Label>
                  <Input
                    type="number"
                    value={scheduleConfig.interval_min_seconds}
                    onChange={(e) => setScheduleConfig(prev => ({ 
                      ...prev, 
                      interval_min_seconds: parseInt(e.target.value) || 180 
                    }))}
                    min={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo (seg)</Label>
                  <Input
                    type="number"
                    value={scheduleConfig.interval_max_seconds}
                    onChange={(e) => setScheduleConfig(prev => ({ 
                      ...prev, 
                      interval_max_seconds: parseInt(e.target.value) || 300 
                    }))}
                    min={60}
                  />
                </div>
              </div>
            )}

            {selectedBatch && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Estimativa:</strong> {selectedBatch.total_items} mensagens em ~
                  {calculateEstimatedTime(
                    selectedBatch.total_items,
                    scheduleConfig.interval_mode === 'fixed' 
                      ? scheduleConfig.interval_seconds 
                      : (scheduleConfig.interval_min_seconds + scheduleConfig.interval_max_seconds) / 2
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={scheduleBatch} disabled={processingBatch === selectedBatch?.id}>
              {processingBatch === selectedBatch?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Timer className="h-4 w-4 mr-2" />
              )}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Fila</DialogTitle>
            <DialogDescription>
              {selectedBatch?.name} - {selectedBatch && format(parseISO(selectedBatch.queue_date), 'dd/MM/yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{selectedBatch.total_items}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{selectedBatch.sent_count}</div>
                      <div className="text-sm text-muted-foreground">Enviados</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">{selectedBatch.failed_count}</div>
                      <div className="text-sm text-muted-foreground">Falhas</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatCurrency(selectedBatch.total_value)}</div>
                      <div className="text-sm text-muted-foreground">Valor Total</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Items list */}
              <ScrollArea className="h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{item.position}</TableCell>
                        <TableCell className="font-medium">{item.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.customer_phone}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.payment_value)}</TableCell>
                        <TableCell className="text-center">
                          {item.status === 'sent' && <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />}
                          {item.status === 'failed' && <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                          {item.status === 'pending' && <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          {item.status === 'sending' && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.sent_at 
                            ? format(parseISO(item.sent_at), 'HH:mm:ss') 
                            : item.scheduled_for 
                              ? format(parseISO(item.scheduled_for), 'HH:mm')
                              : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
