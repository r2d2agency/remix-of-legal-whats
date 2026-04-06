import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, QrCode, RefreshCw, Plug, Unplug, Trash2, Phone, Loader2, Wifi, WifiOff, Send, Settings2, AlertTriangle, CheckCircle, Eye, Activity, Users, Download, Pencil, UserCheck, MessageSquare, Check, History, Smartphone, Globe, Copy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, API_URL } from "@/lib/api";
import { toast } from "sonner";
import { TestMessageDialog } from "@/components/conexao/TestMessageDialog";
import { WebhookDiagnosticPanel } from "@/components/conexao/WebhookDiagnosticPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { LeadDistributionDialog } from "@/components/conexao/LeadDistributionDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Connection {
  id: string;
  name: string;
  provider?: 'evolution' | 'wapi' | 'meta';
  instance_name: string;
  instance_id?: string;
  status: string;
  phone_number?: string;
  show_groups?: boolean;
  meta_phone_number_id?: string;
  meta_waba_id?: string;
  meta_webhook_verify_token?: string;
  created_at: string;
}

interface PlanLimits {
  max_connections: number;
  current_connections: number;
  plan_name: string;
}

const Conexao = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState("");
  const [newConnectionProvider, setNewConnectionProvider] = useState<'wapi' | 'meta'>('wapi');
  const [newConnectionInstanceId, setNewConnectionInstanceId] = useState("");
  const [newConnectionWapiToken, setNewConnectionWapiToken] = useState("");
  const [newMetaToken, setNewMetaToken] = useState("");
  const [newMetaPhoneNumberId, setNewMetaPhoneNumberId] = useState("");
  const [newMetaWabaId, setNewMetaWabaId] = useState("");
  const [validatingMeta, setValidatingMeta] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  
  // QR Code state
  const [qrCodeDialog, setQrCodeDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState<'qr' | 'phone'>('qr');
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingPairingCode, setLoadingPairingCode] = useState(false);
  
  // Test message state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testConnection, setTestConnection] = useState<Connection | null>(null);
  
  // Webhook diagnostic state
  const [diagLoading, setDiagLoading] = useState<string | null>(null);
  const [diagResults, setDiagResults] = useState<Record<string, any>>({});

  // W-API webhook config state
  const [configuringWapiWebhooks, setConfiguringWapiWebhooks] = useState<string | null>(null);
  
  // W-API contact sync state
  const [syncingContacts, setSyncingContacts] = useState<string | null>(null);
  const [syncingConversations, setSyncingConversations] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; messagesImported: number; conversationsCreated: number } | null>(null);
  const [syncingProfilePics, setSyncingProfilePics] = useState<string | null>(null);
  const [validatingNumbers, setValidatingNumbers] = useState<string | null>(null);
  const [connectingMeta, setConnectingMeta] = useState<string | null>(null);

  // Webhook viewer state (shows what the backend is actually receiving)
  const [webhookViewerOpen, setWebhookViewerOpen] = useState(false);
  const [webhookViewerConnection, setWebhookViewerConnection] = useState<Connection | null>(null);
  const [webhookEventsLoading, setWebhookEventsLoading] = useState(false);
  const [webhookEventsError, setWebhookEventsError] = useState<string | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  
  // Diagnostic panel state (full panel view)
  const [diagnosticPanelOpen, setDiagnosticPanelOpen] = useState(false);
  
  // Edit connection state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstanceId, setEditInstanceId] = useState("");
  const [editWapiToken, setEditWapiToken] = useState("");
  const [editMetaToken, setEditMetaToken] = useState("");
  const [editMetaPhoneNumberId, setEditMetaPhoneNumberId] = useState("");
  const [editMetaWabaId, setEditMetaWabaId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [diagnosticConnection, setDiagnosticConnection] = useState<Connection | null>(null);
  
  // Lead distribution state
  const [leadDistributionDialogOpen, setLeadDistributionDialogOpen] = useState(false);
  const [leadDistributionConnection, setLeadDistributionConnection] = useState<Connection | null>(null);

  // Migration dialog state
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrateTargetConnection, setMigrateTargetConnection] = useState<Connection | null>(null);
  const [migrateSourceId, setMigrateSourceId] = useState<string>("");
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    loadConnections();
    loadPlanLimits();
  }, [authLoading, user?.id, user?.organization_id]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const [orgScopedConnections, assignedConnections, orgDirectConnections] = await Promise.all([
        api<Connection[]>('/api/connections?scope=organization').catch(() => []),
        api<Connection[]>('/api/connections').catch(() => []),
        user?.organization_id
          ? api<Connection[]>(`/api/organizations/${user.organization_id}/connections`).catch(() => [])
          : Promise.resolve([] as Connection[]),
      ]);

      const mergedConnections = new Map<string, Connection>();
      [...orgScopedConnections, ...assignedConnections, ...orgDirectConnections].forEach((conn) => {
        mergedConnections.set(conn.id, conn);
      });

      setConnections(Array.from(mergedConnections.values()));
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  };

  const loadPlanLimits = async () => {
    try {
      const data = await api<PlanLimits>('/api/evolution/limits');
      setPlanLimits(data);
    } catch (error) {
      console.error('Error loading plan limits:', error);
    }
  };

  const resetCreateForm = () => {
    setNewConnectionName('');
    setNewConnectionInstanceId('');
    setNewConnectionWapiToken('');
    setNewConnectionProvider('wapi');
    setNewMetaToken('');
    setNewMetaPhoneNumberId('');
    setNewMetaWabaId('');
  };

  const handleCreateConnection = async () => {
    if (!newConnectionName.trim()) {
      toast.error('Digite um nome para a conexão');
      return;
    }

    if (newConnectionProvider === 'meta') {
      if (!newMetaToken.trim() || !newMetaPhoneNumberId.trim() || !newMetaWabaId.trim()) {
        toast.error('Token, Phone Number ID e WABA ID são obrigatórios');
        return;
      }
    }

    setCreating(true);
    try {
      let result: Connection & { qrCode?: string };

      if (newConnectionProvider === 'meta') {
        result = await api<Connection>('/api/connections', {
          method: 'POST',
          body: {
            provider: 'meta',
            name: newConnectionName,
            meta_token: newMetaToken,
            meta_phone_number_id: newMetaPhoneNumberId,
            meta_waba_id: newMetaWabaId,
          },
        });
        toast.success('Conexão Meta API criada com sucesso!');
      } else {
        result = await api<Connection>('/api/connections', {
          method: 'POST',
          body: {
            provider: 'wapi',
            name: newConnectionName,
          },
        });
        toast.success('Conexão criada! Instância W-API gerada automaticamente.');
        setSelectedConnection(result);
        handleGetQRCode(result);
      }

      setConnections(prev => [...prev, result]);
      setShowCreateDialog(false);
      resetCreateForm();
    } catch (error: any) {
      console.error('[Conexao] Create connection error:', error);
      toast.error(error.message || 'Erro ao criar conexão', { duration: 8000 });
    } finally {
      setCreating(false);
    }
  };

  const handleValidateMetaToken = async () => {
    if (!newMetaToken.trim() || !newMetaWabaId.trim()) {
      toast.error('Preencha o Token e WABA ID para validar');
      return;
    }
    setValidatingMeta(true);
    try {
      const result = await api<{ valid: boolean; error?: string; account?: any }>('/api/meta/validate', {
        method: 'POST',
        body: { token: newMetaToken, waba_id: newMetaWabaId },
      });
      if (result.valid) {
        toast.success(`Token válido! Conta: ${result.account?.name || 'OK'}`);
      } else {
        toast.error(result.error || 'Token inválido');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao validar');
    } finally {
      setValidatingMeta(false);
    }
  };

  const handleMetaConnect = async (connection: Connection) => {
    setConnectingMeta(connection.id);
    try {
      const result = await api<Connection>(`/api/connections/${connection.id}/meta-connect`, {
        method: 'POST',
      });
      setConnections(prev => prev.map(c => c.id === connection.id ? result : c));
      toast.success('Conexão Meta ativada! Token de verificação gerado.');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar Meta');
    } finally {
      setConnectingMeta(null);
    }
  };

const handleGetQRCode = async (connection: Connection) => {
  setSelectedConnection(connection);
  setQrCodeDialog(true);
  setLoadingQr(true);
  setQrCode(null);

  try {
    const result = await api<{ qrCode: string }>(`/api/evolution/${connection.id}/qrcode`);
    setQrCode(result.qrCode);
  } catch (error) {
    toast.error('Erro ao buscar QR Code');
  } finally {
    setLoadingQr(false);
  }
};

  const handleRefreshQRCode = async () => {
    if (!selectedConnection) return;
    
    setLoadingQr(true);
    try {
      const result = await api<{ qrCode: string; success?: boolean }>(`/api/evolution/${selectedConnection.id}/restart`, {
        method: 'POST',
      });
      setQrCode(result.qrCode);
      toast.success('QR Code atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar QR Code');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleGetPairingCode = async () => {
    if (!selectedConnection || !pairingPhone.trim()) {
      toast.error('Informe o número de telefone');
      return;
    }
    setLoadingPairingCode(true);
    setPairingCode(null);
    try {
      const result = await api<{ code: string }>(`/api/evolution/${selectedConnection.id}/pairing-code`, {
        method: 'POST',
        body: { phoneNumber: pairingPhone.trim() },
      });
      setPairingCode(result.code);
      toast.success('Código de pareamento gerado!');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar código de pareamento');
    } finally {
      setLoadingPairingCode(false);
    }
  };

  const handleCheckStatus = async (connection: Connection) => {
    setCheckingStatus(connection.id);
    try {
      const result = await api<{ status: string; phoneNumber?: string }>(`/api/evolution/${connection.id}/status`);
      
      setConnections(prev => prev.map(c => 
        c.id === connection.id 
          ? { ...c, status: result.status, phone_number: result.phoneNumber } 
          : c
      ));

      if (result.status === 'connected') {
        toast.success(`Conectado: ${result.phoneNumber || 'WhatsApp'}`);
        setQrCodeDialog(false);
        setQrCode(null);
      } else {
        toast.info('Aguardando conexão...');
      }
    } catch (error) {
      toast.error('Erro ao verificar status');
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleLogout = async (connection: Connection) => {
    try {
      await api(`/api/evolution/${connection.id}/logout`, { method: 'POST' });
      
      setConnections(prev => prev.map(c => 
        c.id === connection.id 
          ? { ...c, status: 'disconnected', phone_number: undefined } 
          : c
      ));
      
      toast.success('Desconectado com sucesso');
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  const handleDelete = async (connection: Connection) => {
    try {
      const isWapi = connection.provider === 'wapi' || !!connection.instance_id;
      const deleteUrl = isWapi 
        ? `/api/connections/${connection.id}` 
        : `/api/evolution/${connection.id}`;
      await api(deleteUrl, { method: 'DELETE' });
      setConnections(prev => prev.filter(c => c.id !== connection.id));
      toast.success('Conexão excluída');
    } catch (error) {
      toast.error('Erro ao excluir conexão');
    }
  };

  const handleMigrateConversations = async (connection: Connection, sourceId?: string) => {
    setMigrating(true);
    try {
      const url = sourceId 
        ? `/api/connections/${connection.id}/migrate-conversations?from=${sourceId}`
        : `/api/connections/${connection.id}/migrate-conversations`;
      const result = await api<{ migrated: number }>(url, {
        method: 'POST',
        auth: true,
      });
      if (result.migrated > 0) {
        toast.success(`${result.migrated} conversas migradas com sucesso!`);
        setMigrateDialogOpen(false);
      } else {
        toast.info('Nenhuma conversa encontrada para migrar.');
      }
    } catch {
      toast.error('Erro ao migrar conversas');
    } finally {
      setMigrating(false);
    }
  };

  const handleWebhookDiagnostic = async (connection: Connection) => {
    setDiagLoading(connection.id);
    try {
      const result = await api<any>(`/api/evolution/${connection.id}/webhook-diagnostic`);
      setDiagResults(prev => ({ ...prev, [connection.id]: result }));
      
      if (result.healthy) {
        toast.success('Webhook está saudável!');
      } else if (result.errors?.length > 0) {
        toast.warning(`Problemas encontrados: ${result.errors.length}`);
      }
    } catch (error: any) {
      toast.error('Erro ao diagnosticar webhook');
      setDiagResults(prev => ({ ...prev, [connection.id]: { error: error.message } }));
    } finally {
      setDiagLoading(null);
    }
  };

  const handleReconfigureWebhook = async (connection: Connection) => {
    setDiagLoading(connection.id);
    try {
      await api(`/api/evolution/${connection.id}/reconfigure-webhook`, { method: 'POST' });
      toast.success('Webhook reconfigurado!');
      // Re-run diagnostic
      await handleWebhookDiagnostic(connection);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reconfigurar webhook');
    } finally {
      setDiagLoading(null);
    }
  };

  const handleConfigureWapiWebhooks = async (connection: Connection) => {
    const isWapi = connection.provider === 'wapi' || !!connection.instance_id;

    if (!isWapi) {
      toast.info('Esta ação é apenas para conexões W-API');
      return;
    }

    setConfiguringWapiWebhooks(connection.id);
    try {
      const result = await api<{ success: boolean; message?: string }>(
        `/api/connections/${connection.id}/configure-webhooks`,
        { method: 'POST' }
      );

      if (result.success) {
        toast.success(result.message || 'Webhooks configurados com sucesso');
      } else {
        toast.error(result.message || 'Falha ao configurar webhooks');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao configurar webhooks');
    } finally {
      setConfiguringWapiWebhooks(null);
    }
  };

  const postWapiWithFallback = useCallback(
    async <T,>(connectionId: string, endpoint: string, body?: Record<string, unknown>) => {
      try {
        return await api<T>(`/api/wapi/${connectionId}${endpoint}`, {
          method: 'POST',
          body,
        });
      } catch (error: any) {
        const message = String(error?.message || '');
        const is404 = message.includes('404');

        if (!is404) throw error;

        const fallbackBody = body ? { connectionId, ...body } : { connectionId };
        return api<T>(`/api/wapi${endpoint}`, {
          method: 'POST',
          body: fallbackBody,
        });
      }
    },
    []
  );

  const ensureConnectionReadyForSync = useCallback(
    async (connection: Connection, actionLabel: string) => {
      if (connection.status === 'connected') return true;

      try {
        const liveStatus = await api<{ status: string; phoneNumber?: string }>(`/api/evolution/${connection.id}/status`);

        setConnections((prev) =>
          prev.map((c) =>
            c.id === connection.id
              ? { ...c, status: liveStatus.status, phone_number: liveStatus.phoneNumber }
              : c
          )
        );

        if (liveStatus.status === 'connected') {
          return true;
        }

        toast.warning(`A conexão precisa estar conectada para ${actionLabel}`);
        return false;
      } catch (error: any) {
        toast.error(error?.message || 'Erro ao verificar status da conexão');
        return false;
      }
    },
    []
  );

  const handleSyncWapiContacts = async (connection: Connection) => {
    const isWapi = connection.provider === 'wapi' || !!connection.instance_id;

    if (!isWapi) {
      toast.info('Esta ação é apenas para conexões W-API');
      return;
    }

    const ready = await ensureConnectionReadyForSync(connection, 'sincronizar contatos');
    if (!ready) return;

    setSyncingContacts(connection.id);
    try {
      const result = await postWapiWithFallback<{ 
        success: boolean; 
        total: number; 
        imported: number; 
        updated: number; 
        skipped: number;
        error?: string;
      }>(connection.id, '/sync-contacts');

      if (result.success) {
        toast.success(
          `Sincronização concluída! ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados (Total: ${result.total})`
        );
      } else {
        toast.error(result.error || 'Erro ao sincronizar contatos');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao sincronizar contatos');
    } finally {
      setSyncingContacts(null);
    }
  };

  const handleSyncWapiConversations = async (connection: Connection) => {
    const isWapi = connection.provider === 'wapi' || !!connection.instance_id;

    if (!isWapi) {
      toast.info('Esta ação é apenas para conexões W-API');
      return;
    }

    const ready = await ensureConnectionReadyForSync(connection, 'sincronizar conversas');
    if (!ready) return;

    setSyncingConversations(connection.id);
    setSyncProgress({ current: 0, total: 0, messagesImported: 0, conversationsCreated: 0 });

    try {
      // Step 1: Prepare - get total chat count
      const prepResult = await postWapiWithFallback<{ success: boolean; sync_id: string; total_chats: number; error?: string }>(
        connection.id,
        '/sync-conversations/prepare'
      );

      if (!prepResult.success) {
        toast.error(prepResult.error || 'Erro ao preparar sincronização');
        return;
      }

      const { sync_id, total_chats } = prepResult;
      setSyncProgress({ current: 0, total: total_chats, messagesImported: 0, conversationsCreated: 0 });

      if (total_chats === 0) {
        toast.info('Nenhuma conversa encontrada para sincronizar');
        return;
      }

      // Step 2: Process in batches
      const BATCH_SIZE = 10;
      let offset = 0;
      let totalMessagesImported = 0;
      let totalConversationsCreated = 0;

      while (offset < total_chats) {
        const batchResult = await postWapiWithFallback<{
          success: boolean;
          processed: number;
          total: number;
          done: boolean;
          conversations_created: number;
          messages_imported: number;
          error?: string;
        }>(connection.id, '/sync-conversations/batch', { sync_id, offset, limit: BATCH_SIZE });

        if (!batchResult.success) {
          toast.error(batchResult.error || 'Erro durante sincronização');
          break;
        }

        totalMessagesImported += batchResult.messages_imported;
        totalConversationsCreated += batchResult.conversations_created;

        setSyncProgress({
          current: batchResult.processed,
          total: batchResult.total,
          messagesImported: totalMessagesImported,
          conversationsCreated: totalConversationsCreated,
        });

        if (batchResult.done) break;
        offset += BATCH_SIZE;

        // Small delay to yield to UI
        await new Promise(r => setTimeout(r, 50));
      }

      toast.success(
        `Sincronização concluída! ${totalConversationsCreated} conversas novas, ${totalMessagesImported} mensagens importadas (últimos 2 meses)`
      );
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao sincronizar conversas');
    } finally {
      setSyncingConversations(null);
      setSyncProgress(null);
    }
  };

  const handleSyncProfilePictures = async (connection: Connection) => {
    setSyncingProfilePics(connection.id);
    try {
      const result = await postWapiWithFallback<{ success: boolean; total: number; updated: number; errors: number }>(
        connection.id,
        '/sync-profile-pictures'
      );
      if (result.success) {
        toast.success(`Fotos de perfil: ${result.updated} atualizadas de ${result.total} contatos`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao sincronizar fotos de perfil');
    } finally {
      setSyncingProfilePics(null);
    }
  };

  const handleValidateAllContacts = async (connection: Connection) => {
    setValidatingNumbers(connection.id);
    try {
      const result = await postWapiWithFallback<{ success: boolean; total: number; valid: number; invalid: number; message?: string }>(
        connection.id,
        '/validate-all-contacts'
      );
      if (result.success) {
        toast.success(result.message || `Validação concluída: ${result.valid} válidos, ${result.invalid} inválidos (de ${result.total})`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao validar números');
    } finally {
      setValidatingNumbers(null);
    }
  };

  const handleOpenEditDialog = (connection: Connection) => {
    setEditingConnection(connection);
    setEditName(connection.name);
    setEditInstanceId(connection.instance_id || '');
    setEditWapiToken('');
    setEditMetaToken('');
    setEditMetaPhoneNumberId(connection.meta_phone_number_id || '');
    setEditMetaWabaId(connection.meta_waba_id || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingConnection) return;
    
    if (!editName.trim()) {
      toast.error('Digite um nome para a conexão');
      return;
    }

    const isWapi = editingConnection.provider === 'wapi' || !!editingConnection.instance_id;
    const isMeta = editingConnection.provider === 'meta';
    
    if (isWapi && !editInstanceId.trim()) {
      toast.error('Instance ID é obrigatório');
      return;
    }

    if (isMeta && !editMetaPhoneNumberId.trim()) {
      toast.error('Phone Number ID é obrigatório');
      return;
    }
    if (isMeta && !editMetaWabaId.trim()) {
      toast.error('WABA ID é obrigatório');
      return;
    }

    setSavingEdit(true);
    try {
      const body: Record<string, string> = { name: editName };
      
      if (isWapi) {
        body.instance_id = editInstanceId;
        if (editWapiToken.trim()) {
          body.wapi_token = editWapiToken;
        }
      }

      if (isMeta) {
        body.meta_phone_number_id = editMetaPhoneNumberId;
        body.meta_waba_id = editMetaWabaId;
        if (editMetaToken.trim()) {
          body.meta_token = editMetaToken;
        }
      }

      await api(`/api/connections/${editingConnection.id}`, {
        method: 'PATCH',
        body,
      });

      setConnections(prev => prev.map(c => 
        c.id === editingConnection.id 
          ? { 
              ...c, 
              name: editName, 
              instance_id: editInstanceId,
              ...(isMeta ? { meta_phone_number_id: editMetaPhoneNumberId, meta_waba_id: editMetaWabaId } : {}),
            } 
          : c
      ));

      toast.success('Conexão atualizada!');
      setEditDialogOpen(false);
      setEditingConnection(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar conexão');
    } finally {
      setSavingEdit(false);
    }
  };

  const fetchWebhookEvents = useCallback(async (connection: Connection) => {
    setWebhookEventsLoading(true);
    setWebhookEventsError(null);
    try {
      const endpointBase = connection.provider === 'wapi' || connection.instance_id ? '/api/wapi' : '/api/evolution';
      const result = await api<{ events: any[] }>(`${endpointBase}/${connection.id}/webhook-events?limit=50`);
      setWebhookEvents(result.events || []);
    } catch (error: any) {
      setWebhookEventsError(error.message || 'Erro ao buscar eventos do webhook');
    } finally {
      setWebhookEventsLoading(false);
    }
  }, []);

  const handleOpenWebhookViewer = async (connection: Connection) => {
    setWebhookViewerConnection(connection);
    setWebhookViewerOpen(true);
    await fetchWebhookEvents(connection);
  };

  const handleClearWebhookEvents = async () => {
    if (!webhookViewerConnection) return;
    try {
      const endpointBase = webhookViewerConnection.provider === 'wapi' || webhookViewerConnection.instance_id ? '/api/wapi' : '/api/evolution';
      await api(`${endpointBase}/${webhookViewerConnection.id}/webhook-events`, { method: 'DELETE' });
      setWebhookEvents([]);
      toast.success('Eventos limpos');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao limpar eventos');
    }
  };

  useEffect(() => {
    if (!webhookViewerOpen || !webhookViewerConnection) return;

    const interval = setInterval(() => {
      fetchWebhookEvents(webhookViewerConnection);
    }, 2000);

    return () => clearInterval(interval);
  }, [webhookViewerOpen, webhookViewerConnection, fetchWebhookEvents]);

  // Auto-check status when QR dialog is open
  useEffect(() => {
    if (!qrCodeDialog || !selectedConnection) return;

    const interval = setInterval(async () => {
      try {
        const result = await api<{ status: string; phoneNumber?: string }>(`/api/evolution/${selectedConnection.id}/status`);
        
        if (result.status === 'connected') {
          setConnections(prev => prev.map(c => 
            c.id === selectedConnection.id 
              ? { ...c, status: result.status, phone_number: result.phoneNumber } 
              : c
          ));
          setQrCodeDialog(false);
          setQrCode(null);
          toast.success(`WhatsApp conectado: ${result.phoneNumber || ''}`);
          clearInterval(interval);
        }
      } catch (error) {
        // Ignore errors during polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [qrCodeDialog, selectedConnection]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Conexões WhatsApp</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie suas conexões com o WhatsApp
            </p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Plan limits badge */}
            {planLimits && (
              <Badge variant="outline" className="text-sm py-1 px-3">
                {connections.length} / {planLimits.max_connections} conexões
                {planLimits.plan_name && (
                  <span className="ml-1 text-muted-foreground">({planLimits.plan_name})</span>
                )}
              </Badge>
            )}

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="gradient"
                  disabled={planLimits && connections.length >= planLimits.max_connections}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conexão
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
                <DialogDescription>
                  Escolha o tipo de conexão e preencha os dados.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>Tipo de Conexão</Label>
                  <Select value={newConnectionProvider} onValueChange={(v: 'wapi' | 'meta') => setNewConnectionProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wapi">W-API (WhatsApp não-oficial)</SelectItem>
                      <SelectItem value="meta">Meta Cloud API (Oficial)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Connection Name */}
                <div className="space-y-2">
                  <Label>Nome da Conexão</Label>
                  <Input 
                    placeholder="Ex: WhatsApp Principal"
                    value={newConnectionName}
                    onChange={(e) => setNewConnectionName(e.target.value)}
                  />
                </div>

                {newConnectionProvider === 'wapi' ? (
                  <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      💡 A instância será criada automaticamente usando o token W-API configurado nas <strong>Configurações da Organização</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Token de Acesso Permanente</Label>
                      <Input 
                        placeholder="EAAxxxxxxx..."
                        value={newMetaToken}
                        onChange={(e) => setNewMetaToken(e.target.value)}
                        type="password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input 
                        placeholder="Ex: 123456789012345"
                        value={newMetaPhoneNumberId}
                        onChange={(e) => setNewMetaPhoneNumberId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Business Account ID (WABA ID)</Label>
                      <Input 
                        placeholder="Ex: 123456789012345"
                        value={newMetaWabaId}
                        onChange={(e) => setNewMetaWabaId(e.target.value)}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleValidateMetaToken}
                      disabled={validatingMeta || !newMetaToken || !newMetaWabaId}
                      className="w-full"
                    >
                      {validatingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Validar Credenciais
                    </Button>
                    <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        💡 Obtenha estas credenciais no <strong>Meta Business Suite</strong> → Configurações → API do WhatsApp.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateConnection} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Connections Grid */}
        {connections.length === 0 ? (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Phone className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma conexão
              </h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Crie sua primeira conexão WhatsApp para começar a enviar mensagens.
              </p>
              <Button variant="gradient" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Conexão
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((connection) => (
              <Card key={connection.id} className="animate-fade-in shadow-card overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{connection.name}</CardTitle>
                    <Badge 
                      variant={connection.status === 'connected' || connection.provider === 'meta' ? 'default' : 'outline'}
                      className={connection.status === 'connected' || connection.provider === 'meta' ? 'bg-green-500' : ''}
                    >
                      {connection.provider === 'meta' ? (
                        <><Wifi className="h-3 w-3 mr-1" /> Meta API</>
                      ) : connection.status === 'connected' ? (
                        <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                      ) : (
                        <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                      )}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs truncate">
                    {connection.provider === 'meta'
                      ? `WABA: ${connection.meta_waba_id || ''}`
                      : (connection.provider === 'wapi' || !!connection.instance_id)
                        ? (connection.instance_id || 'W-API')
                        : (connection.instance_name || '')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Status Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">
                        {connection.phone_number || "Sem telefone"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {connection.provider === 'meta' 
                          ? 'Meta API'
                          : (connection.provider === 'wapi' || !!connection.instance_id) ? 'W-API' : 'Evolution'}
                      </Badge>
                      <code className="text-[10px] truncate flex-1">
                        {connection.provider === 'meta'
                          ? connection.meta_phone_number_id
                          : (connection.provider === 'wapi' || !!connection.instance_id) 
                            ? connection.instance_id 
                            : connection.instance_name}
                      </code>
                    </div>
                  </div>

                  {/* Groups Toggle - not for Meta */}
                  {connection.provider !== 'meta' && (
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Grupos</p>
                        <p className="text-xs text-muted-foreground">Receber mensagens de grupos</p>
                      </div>
                    </div>
                    <Switch
                      checked={connection.show_groups || false}
                      onCheckedChange={async (checked) => {
                        try {
                          await api(`/api/connections/${connection.id}`, {
                            method: 'PATCH',
                            body: { show_groups: checked }
                          });
                          setConnections(prev => prev.map(c => 
                            c.id === connection.id ? { ...c, show_groups: checked } : c
                          ));
                          toast.success(checked ? 'Grupos habilitados' : 'Grupos desabilitados');
                        } catch (error: any) {
                          toast.error(error.message || 'Erro ao atualizar');
                        }
                      }}
                    />
                  </div>
                  )}

                  {/* Meta Webhook Config */}
                  {connection.provider === 'meta' && (
                    <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Configuração do Webhook</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configure estes dados na aba <strong>Configuração</strong> do seu app no Meta Business Suite:
                      </p>
                      <div className="space-y-1.5">
                        <div>
                          <Label className="text-xs text-muted-foreground">URL de callback</Label>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                              {`${API_URL}/api/meta/webhook`}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(`${API_URL}/api/meta/webhook`);
                                toast.success('URL copiada!');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Verificar token</Label>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                              {connection.meta_webhook_verify_token || 'Não gerado'}
                            </code>
                            {connection.meta_webhook_verify_token ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(connection.meta_webhook_verify_token!);
                                  toast.success('Token copiado!');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title={connection.meta_webhook_verify_token ? 'Regenerar token' : 'Gerar token'}
                              disabled={connectingMeta === connection.id}
                              onClick={() => handleMetaConnect(connection)}
                            >
                              {connectingMeta === connection.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {!connection.meta_webhook_verify_token 
                          ? 'Clique no ícone ↻ ao lado para gerar o token, depois configure no Meta Business Suite.'
                          : 'Após configurar, clique em "Verificar e salvar" no Meta Business Suite.'
                        }
                      </p>
                    </div>
                  )}

                  {/* Lead Distribution Button */}
                  <div 
                    className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setLeadDistributionConnection(connection);
                      setLeadDistributionDialogOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Distribuição de Leads</p>
                        <p className="text-xs text-muted-foreground">Distribuir leads automaticamente</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Configurar
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {connection.status === 'connected' ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            setTestConnection(connection);
                            setTestDialogOpen(true);
                          }}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Testar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCheckStatus(connection)}
                          disabled={checkingStatus === connection.id}
                        >
                          {checkingStatus === connection.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleLogout(connection)}
                        >
                          <Unplug className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {connection.provider === 'meta' ? (
                          <Button 
                            variant="default" 
                            size="sm"
                            className="flex-1"
                            disabled={connectingMeta === connection.id}
                            onClick={() => handleMetaConnect(connection)}
                          >
                            {connectingMeta === connection.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Globe className="h-4 w-4 mr-1" />
                            )}
                            Conectar Meta
                          </Button>
                        ) : (
                          <Button 
                            variant="default" 
                            size="sm"
                            className="flex-1"
                            onClick={() => handleGetQRCode(connection)}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Conectar
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCheckStatus(connection)}
                          disabled={checkingStatus === connection.id}
                          title="Verificar status"
                        >
                          {checkingStatus === connection.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}

                    {/* Full Diagnostic Panel */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDiagnosticConnection(connection);
                        setDiagnosticPanelOpen(true);
                      }}
                      title="Painel de diagnóstico completo"
                    >
                      <Activity className="h-4 w-4" />
                    </Button>

                    {/* W-API: Configure webhooks */}
                    {(connection.provider === 'wapi' || !!connection.instance_id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigureWapiWebhooks(connection)}
                        disabled={configuringWapiWebhooks === connection.id}
                        title="Configurar webhooks (W-API)"
                      >
                        {configuringWapiWebhooks === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Settings2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    {/* W-API: Sync contacts */}
                    {(connection.provider === 'wapi' || !!connection.instance_id) && connection.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncWapiContacts(connection)}
                        disabled={syncingContacts === connection.id}
                        title="Sincronizar contatos do WhatsApp"
                      >
                        {syncingContacts === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* W-API: Sync conversations */}
                    {(connection.provider === 'wapi' || !!connection.instance_id) && connection.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncWapiConversations(connection)}
                        disabled={syncingConversations === connection.id}
                        title="Sincronizar conversas (últimos 2 meses)"
                      >
                        {syncingConversations === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* Sync conversations progress bar */}
                    {syncingConversations === connection.id && syncProgress && (
                      <div className="w-full mt-2 space-y-1.5 col-span-full">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Sincronizando conversas...
                          </span>
                          <span className="font-medium">
                            {syncProgress.current}/{syncProgress.total} chats
                          </span>
                        </div>
                        <Progress value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0} className="h-2" />
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{syncProgress.conversationsCreated} conversas novas</span>
                          <span>{syncProgress.messagesImported} mensagens</span>
                        </div>
                      </div>
                    )}

                    {/* W-API: Sync profile pictures */}
                    {(connection.provider === 'wapi' || !!connection.instance_id) && connection.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncProfilePictures(connection)}
                        disabled={syncingProfilePics === connection.id}
                        title="Sincronizar fotos de perfil"
                      >
                        {syncingProfilePics === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* W-API: Validate all contacts */}
                    {(connection.provider === 'wapi' || !!connection.instance_id) && connection.status === 'connected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleValidateAllContacts(connection)}
                        disabled={validatingNumbers === connection.id}
                        title="Validar números WhatsApp em lote"
                      >
                        {validatingNumbers === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {!(connection.provider === 'wapi' || !!connection.instance_id) && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleWebhookDiagnostic(connection)}
                            disabled={diagLoading === connection.id}
                          >
                            {diagLoading === connection.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : diagResults[connection.id]?.healthy ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : diagResults[connection.id]?.errors?.length > 0 ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <Settings2 className="h-4 w-4" />
                            )}
                          </Button>
                        </PopoverTrigger>
                        {diagResults[connection.id] && (
                          <PopoverContent className="w-80">
                            <div className="space-y-2">
                              <h4 className="font-semibold">Diagnóstico Webhook</h4>
                              <div className="text-xs space-y-1">
                                <p>Status: {diagResults[connection.id].instanceStatus?.state || 'unknown'}</p>
                                <p>URL: {diagResults[connection.id].evolutionWebhook?.url || 'Não configurado'}</p>
                                {diagResults[connection.id].errors?.map((err: string, i: number) => (
                                  <p key={i} className="text-destructive">⚠️ {err}</p>
                                ))}
                              </div>
                              {!diagResults[connection.id].healthy && (
                                <Button size="sm" onClick={() => handleReconfigureWebhook(connection)} className="w-full mt-2">
                                  Reconfigurar Webhook
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    )}
                    
                    {/* Edit button - all connections can edit name */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditDialog(connection)}
                      title="Editar conexão"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    {/* Migrate conversations from another connection */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMigrateTargetConnection(connection);
                        setMigrateSourceId("");
                        setMigrateDialogOpen(true);
                      }}
                      title="Migrar conversas de outra conexão"
                    >
                      <History className="h-4 w-4 text-primary" />
                    </Button>

                    {/* Delete button - always visible */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conexão?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A conexão "{connection.name}" será permanentemente excluída.
                            {connection.status === 'connected' && (
                              <span className="block mt-2 text-yellow-500">
                                ⚠️ Esta conexão está ativa e será desconectada.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(connection)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Webhook Viewer Dialog */}
        <Dialog
          open={webhookViewerOpen}
          onOpenChange={(open) => {
            setWebhookViewerOpen(open);
            if (!open) {
              setWebhookViewerConnection(null);
              setWebhookEvents([]);
              setWebhookEventsError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Monitor do Webhook</DialogTitle>
              <DialogDescription>
                Aqui você vê os últimos eventos que o backend recebeu da Evolution para esta instância.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {webhookViewerConnection ? (
                  <span>
                    Instância: <span className="text-foreground">{webhookViewerConnection.instance_name}</span>
                  </span>
                ) : (
                  'Selecione uma conexão.'
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => webhookViewerConnection && fetchWebhookEvents(webhookViewerConnection)}
                  disabled={!webhookViewerConnection || webhookEventsLoading}
                >
                  {webhookEventsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearWebhookEvents}
                  disabled={!webhookViewerConnection}
                >
                  Limpar
                </Button>
              </div>
            </div>

            {webhookEventsError && (
              <div className="text-sm text-destructive">{webhookEventsError}</div>
            )}

            <ScrollArea className="h-[420px] rounded-md border border-border">
              <div className="p-3 space-y-3">
                {webhookEvents.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum evento recebido ainda.
                  </div>
                ) : (
                  webhookEvents.map((ev, idx) => (
                    <div key={idx} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-foreground">
                          {ev.normalizedEvent || ev.event || 'evento'}
                        </div>
                        <div className="text-xs text-muted-foreground">{ev.at}</div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <div>Headers: {ev.headers ? Object.keys(ev.headers).filter(Boolean).join(', ') : '-'}</div>
                      </div>
                      {ev.preview && (
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground/90">
                          {ev.preview}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* QR Code / Phone Code Dialog */}
        <Dialog open={qrCodeDialog} onOpenChange={(open) => {
          setQrCodeDialog(open);
          if (!open) {
            setConnectMode('qr');
            setPairingCode(null);
            setPairingPhone('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Conectar WhatsApp
              </DialogTitle>
              <DialogDescription>
                Escolha como deseja conectar seu WhatsApp.
              </DialogDescription>
            </DialogHeader>

            {/* Mode Toggle */}
            {selectedConnection && (selectedConnection.provider === 'wapi' || !!selectedConnection.instance_id) && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                    connectMode === 'qr' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setConnectMode('qr')}
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                    connectMode === 'phone' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setConnectMode('phone')}
                >
                  <Smartphone className="h-4 w-4" />
                  Código por Telefone
                </button>
              </div>
            )}
            
            {connectMode === 'qr' ? (
              <div className="flex flex-col items-center justify-center py-6">
                {loadingQr ? (
                  <div className="flex h-64 w-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  </div>
                ) : qrCode ? (
                  <div className="rounded-xl border-2 border-primary/20 bg-white p-4">
                    <img
                      src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code WhatsApp"
                      className="h-64 w-64"
                    />
                  </div>
                ) : (
                  <div className="flex h-64 w-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
                    <div className="text-center">
                      <QrCode className="mx-auto h-16 w-16 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">
                        Clique em atualizar para gerar o QR Code
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={handleRefreshQRCode}
                    disabled={loadingQr}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingQr ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                  {selectedConnection && (
                    <Button
                      variant="default"
                      onClick={() => handleCheckStatus(selectedConnection)}
                      disabled={checkingStatus === selectedConnection.id}
                    >
                      {checkingStatus === selectedConnection.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4 mr-2" />
                      )}
                      Verificar
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  O status será verificado automaticamente a cada 5 segundos
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="w-full space-y-2">
                  <Label>Número do Telefone</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="5511999999999"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleGetPairingCode}
                      disabled={loadingPairingCode || !pairingPhone.trim()}
                    >
                      {loadingPairingCode ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Gerar Código'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Informe o número com código do país (ex: 5511999999999)
                  </p>
                </div>

                {pairingCode && (
                  <div className="w-full rounded-xl border-2 border-primary/20 bg-muted/30 p-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">Seu código de pareamento:</p>
                    <p className="text-3xl font-bold tracking-widest text-foreground font-mono">
                      {pairingCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No WhatsApp, vá em <strong>Dispositivos Conectados</strong> → <strong>Conectar Dispositivo</strong> → <strong>Conectar com número de telefone</strong> e insira este código.
                    </p>
                  </div>
                )}

                {!pairingCode && !loadingPairingCode && (
                  <div className="rounded-xl border-2 border-dashed border-border bg-muted/50 p-8 text-center">
                    <Smartphone className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Conecte sem câmera! Gere um código numérico e insira diretamente no WhatsApp.
                    </p>
                  </div>
                )}

                {selectedConnection && (
                  <Button
                    variant="default"
                    onClick={() => handleCheckStatus(selectedConnection)}
                    disabled={checkingStatus === selectedConnection.id}
                    className="w-full"
                  >
                    {checkingStatus === selectedConnection.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4 mr-2" />
                    )}
                    Verificar Conexão
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Test Message Dialog */}
        <TestMessageDialog
          connection={testConnection}
          open={testDialogOpen}
          onClose={() => {
            setTestDialogOpen(false);
            setTestConnection(null);
          }}
        />
        
        {/* Diagnostic Panel Dialog */}
        <Dialog 
          open={diagnosticPanelOpen} 
          onOpenChange={(open) => {
            setDiagnosticPanelOpen(open);
            if (!open) setDiagnosticConnection(null);
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Diagnóstico do Webhook</DialogTitle>
            </DialogHeader>
            {diagnosticConnection && (
              <WebhookDiagnosticPanel 
                connection={diagnosticConnection} 
                onClose={() => setDiagnosticPanelOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Connection Dialog */}
        <Dialog 
          open={editDialogOpen} 
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditingConnection(null);
              setEditName('');
              setEditInstanceId('');
              setEditWapiToken('');
              setEditMetaToken('');
              setEditMetaPhoneNumberId('');
              setEditMetaWabaId('');
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Conexão</DialogTitle>
              <DialogDescription>
                {editingConnection?.provider === 'meta'
                  ? 'Atualize os dados da sua conexão Meta Cloud API.'
                  : editingConnection && (editingConnection.provider === 'wapi' || !!editingConnection.instance_id)
                  ? 'Atualize os dados da sua conexão W-API.'
                  : 'Dê um nome amigável para sua conexão.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome Amigável</Label>
                <Input 
                  placeholder="Ex: WhatsApp Principal, Vendas, Suporte..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Este nome será exibido no chat e em toda a plataforma
                </p>
              </div>
              
              {/* W-API specific fields */}
              {editingConnection && (editingConnection.provider === 'wapi' || !!editingConnection.instance_id) && (
                <>
                  <div className="space-y-2">
                    <Label>Instance ID</Label>
                    <Input 
                      placeholder="Seu Instance ID da W-API"
                      value={editInstanceId}
                      onChange={(e) => setEditInstanceId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token (deixe em branco para manter o atual)</Label>
                    <Input 
                      type="password"
                      placeholder="Novo token (opcional)"
                      value={editWapiToken}
                      onChange={(e) => setEditWapiToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Por segurança, o token atual não é exibido.
                    </p>
                  </div>
                </>
              )}

              {/* Meta API specific fields */}
              {editingConnection?.provider === 'meta' && (
                <>
                  <div className="space-y-2">
                    <Label>WABA ID</Label>
                    <Input 
                      placeholder="WhatsApp Business Account ID"
                      value={editMetaWabaId}
                      onChange={(e) => setEditMetaWabaId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID da conta WhatsApp Business no Meta Business Suite
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input 
                      placeholder="ID do número de telefone"
                      value={editMetaPhoneNumberId}
                      onChange={(e) => setEditMetaPhoneNumberId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Encontrado em WhatsApp &gt; API Setup no Meta Developers
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Token Permanente (deixe em branco para manter o atual)</Label>
                    <Input 
                      type="password"
                      placeholder="Novo token (opcional)"
                      value={editMetaToken}
                      onChange={(e) => setEditMetaToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Por segurança, o token atual não é exibido. Preencha apenas se quiser alterar.
                    </p>
                  </div>
                  {editingConnection.meta_webhook_verify_token && (
                    <div className="space-y-2">
                      <Label>Webhook Verify Token</Label>
                      <div className="flex gap-2">
                        <Input 
                          readOnly
                          value={editingConnection.meta_webhook_verify_token}
                          className="font-mono text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(editingConnection.meta_webhook_verify_token!);
                            toast.success('Verify Token copiado!');
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use este token ao configurar o webhook no Meta Developers
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lead Distribution Dialog */}
        <LeadDistributionDialog
          open={leadDistributionDialogOpen}
          onOpenChange={setLeadDistributionDialogOpen}
          connection={leadDistributionConnection}
        />

        {/* Migrate Conversations Dialog */}
        <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Migrar Conversas</DialogTitle>
              <DialogDescription>
                Transfira todas as conversas de outra conexão (ou conversas órfãs) para <strong>{migrateTargetConnection?.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Origem das conversas</Label>
                <Select value={migrateSourceId} onValueChange={setMigrateSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orphaned">🔄 Conversas órfãs (conexão excluída)</SelectItem>
                    {connections
                      .filter(c => c.id !== migrateTargetConnection?.id)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.phone_number ? `(${c.phone_number})` : ''} {c.status === 'connected' ? '🟢' : '🔴'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ Todas as conversas da origem selecionada serão movidas para esta conexão. O histórico de mensagens será preservado.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMigrateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (migrateTargetConnection) {
                    handleMigrateConversations(
                      migrateTargetConnection, 
                      migrateSourceId === 'orphaned' ? undefined : migrateSourceId
                    );
                  }
                }}
                disabled={!migrateSourceId || migrating}
              >
                {migrating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Migrando...
                  </>
                ) : (
                  'Migrar Conversas'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Conexao;
