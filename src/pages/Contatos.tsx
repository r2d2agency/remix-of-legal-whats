import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  Search,
  Users,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Plus,
  Edit,
  Check,
  X,
  Phone,
  UserPlus,
  RefreshCw,
  Share2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useContacts, ContactList, Contact } from "@/hooks/use-contacts";
import { ExcelImportDialog } from "@/components/contatos/ExcelImportDialog";
import { useConnections } from "@/hooks/use-connections";
import { evolutionApi } from "@/lib/evolution-api";
import { whatsappProvider } from "@/lib/whatsapp-provider";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNumberValidation } from "@/hooks/use-number-validation";

interface SyncConnection {
  id: string;
  name: string;
  status: string;
  phone_number: string | null;
  provider?: string;
  instance_id?: string | null;
}

const Contatos = () => {
  const {
    loading,
    getLists,
    createList,
    deleteList,
    getContacts,
    addContact,
    importContacts,
    deleteContact,
    updateContact,
  } = useContacts();

  const [lists, setLists] = useState<ContactList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConnectionId, setFilterConnectionId] = useState<string>("");
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIsPublic, setNewListIsPublic] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactValidated, setNewContactValidated] = useState<boolean | null>(null);
  const [isValidatingNewContact, setIsValidatingNewContact] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const { data: availableConnections = [] } = useConnections();
  const [validatingContact, setValidatingContact] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [syncConnections, setSyncConnections] = useState<SyncConnection[]>([]);
  const [selectedSyncConnectionId, setSelectedSyncConnectionId] = useState("");
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [allConnections, setAllConnections] = useState<SyncConnection[]>([]);
  // UAZAPI native phone-contacts sync
  const [uazapiConnections, setUazapiConnections] = useState<SyncConnection[]>([]);
  const [selectedUazapiConnId, setSelectedUazapiConnId] = useState<string>("");
  const [uazapiSyncing, setUazapiSyncing] = useState(false);
  const [uazapiTargetListId, setUazapiTargetListId] = useState<string>("");
  const [isValidatingList, setIsValidatingList] = useState(false);
  const { status: validationStatus, isValidating: isUazapiValidating, validateList: startUazapiValidation, resetStatus: resetValidationStatus } = useNumberValidation();


  // Load connected W-API connections
  useEffect(() => {
    const loadConnectionsData = () => {
      const connections = availableConnections;
      setAllConnections(connections);
      const connectedWapi = connections.filter(
        (c) => (c.provider === 'wapi' || !!c.instance_id) && c.status === 'connected'
      );

      const anyConnected = connections.find(c => c.status === 'connected');

      setSyncConnections(connectedWapi);
      setActiveConnectionId(anyConnected?.id || null);
      setSelectedSyncConnectionId((prev) => prev || connectedWapi[0]?.id || "");

      const uaz = connections.filter(
        (c) => String(c.provider || '').toLowerCase() === 'uazapi' && c.status === 'connected'
      );
      setUazapiConnections(uaz);
      setSelectedUazapiConnId((prev) => prev || uaz[0]?.id || "");
    };

    loadConnectionsData();
  }, [availableConnections]);

  const handleSyncUazapiContacts = async () => {
    if (!selectedUazapiConnId) {
      toast.error("Selecione uma conexão UAZAPI");
      return;
    }
    if (!uazapiTargetListId) {
      toast.error("Selecione a lista de destino");
      return;
    }
    setUazapiSyncing(true);
    try {
      const res = await api<{ success: boolean; total?: number; imported?: number; duplicates?: number; error?: string }>(
        `/api/uazapi/${selectedUazapiConnId}/sync-contacts-to-list`,
        {
          method: 'POST',
          body: { listId: uazapiTargetListId, onlyMyContacts: true },
        }
      );
      if (!res.success) {
        toast.error(res.error || "Falha ao sincronizar");
      } else {
        toast.success(
          `Sincronização concluída: ${res.imported} novos, ${res.duplicates} já existentes (de ${res.total} contatos da agenda)`
        );
        if (selectedList === uazapiTargetListId) loadContacts(uazapiTargetListId);
        loadLists();
      }
    } catch (err) {
      toast.error("Erro ao sincronizar contatos UAZAPI");
    } finally {
      setUazapiSyncing(false);
    }
  };

  // Load lists on mount and when connection filter changes
  useEffect(() => {
    loadLists();
  }, [filterConnectionId]);

  // Load contacts when list changes
  useEffect(() => {
    if (selectedList) {
      loadContacts(selectedList);
    } else {
      setContacts([]);
    }
  }, [selectedList]);

  const loadLists = async () => {
    try {
      const data = await getLists(filterConnectionId || undefined);
      setLists(data);
      // Reset selected list if it's no longer in the filtered results
      if (selectedList && !data.find(l => l.id === selectedList)) {
        setSelectedList(null);
      }
    } catch (err) {
      toast.error("Erro ao carregar listas");
    }
  };

  const loadContacts = async (listId: string) => {
    setIsLoadingContacts(true);
    try {
      const data = await getContacts(listId);
      setContacts(data);
    } catch (err) {
      toast.error("Erro ao carregar contatos");
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error("Digite um nome para a lista");
      return;
    }
    try {
      await createList(newListName, newListIsPublic);
      toast.success("Lista criada com sucesso!");
      setNewListName("");
      setNewListIsPublic(false);
      setIsCreateListOpen(false);
      loadLists();
    } catch (err) {
      toast.error("Erro ao criar lista");
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    if (!selectedList) {
      toast.error("Selecione uma lista primeiro");
      return;
    }

    // Normalize phone: add 55 if needed
    let phone = newContactPhone.replace(/\D/g, "");
    if (phone.length === 10 || phone.length === 11) {
      phone = "55" + phone;
    }

    try {
      // Use the hook's addContact but we need to also pass is_whatsapp
      const config = evolutionApi.getConfig();
      await api(`/api/contacts/lists/${selectedList}/contacts`, {
        method: 'POST',
        body: { 
          name: newContactName.trim(), 
          phone, 
          is_whatsapp: newContactValidated 
        },
      });
      toast.success("Contato adicionado com sucesso!");
      setNewContactName("");
      setNewContactPhone("");
      setNewContactValidated(null);
      setIsAddContactOpen(false);
      loadContacts(selectedList);
      loadLists();
    } catch (err) {
      toast.error("Erro ao adicionar contato");
    }
  };

  const handleValidateNewContact = async () => {
    if (!newContactPhone.trim()) {
      toast.error("Digite um telefone para validar");
      return;
    }

    const config = evolutionApi.getConfig();
    if (!config) {
      toast.error("Configure a conexão Evolution API primeiro");
      return;
    }

    // Normalize phone: add 55 if needed
    let phone = newContactPhone.replace(/\D/g, "");
    if (phone.length === 10 || phone.length === 11) {
      phone = "55" + phone;
    }

    setIsValidatingNewContact(true);
    try {
      const isValid = await evolutionApi.checkWhatsAppNumber(config, phone);
      setNewContactValidated(isValid);
      setNewContactPhone(phone); // Update with normalized phone
      if (isValid) {
        toast.success("Número é WhatsApp válido!");
      } else {
        toast.error("Número não é WhatsApp válido");
      }
    } catch (err) {
      toast.error("Erro ao validar número");
      setNewContactValidated(false);
    } finally {
      setIsValidatingNewContact(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    try {
      await deleteList(id);
      toast.success("Lista deletada com sucesso!");
      if (selectedList === id) setSelectedList(null);
      loadLists();
    } catch (err) {
      toast.error("Erro ao deletar lista");
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteContact(id);
      toast.success("Contato removido!");
      if (selectedList) loadContacts(selectedList);
    } catch (err) {
      toast.error("Erro ao remover contato");
    }
  };

  const handleUpdateContact = async (id: string, name: string, phone: string) => {
    try {
      await updateContact(id, { name, phone });
      toast.success("Contato atualizado!");
      setEditingContact(null);
      if (selectedList) loadContacts(selectedList);
    } catch (err) {
      toast.error("Erro ao atualizar contato");
    }
  };

  const handleValidateWhatsApp = async (contactId: string, phone: string) => {
    // Find a connection that can validate
    const validConn = allConnections?.find(c => 
      c.status === 'connected' && 
      (c.provider === 'evolution' || c.provider === 'wapi' || c.provider === 'meta' || c.provider === 'uazapi')
    );

    if (!validConn) {
      toast.error("Nenhuma conexão ativa disponível para validar o número");
      return;
    }

    setValidatingContact(contactId);
    try {
      const isValid = await whatsappProvider.checkNumber(validConn as any, phone);
      if (isValid) {
        toast.success("Número é WhatsApp válido!");
        await updateContact(contactId, { is_whatsapp: true });
      } else {
        toast.error("Número não é WhatsApp válido");
        await updateContact(contactId, { is_whatsapp: false });
      }
      if (selectedList) loadContacts(selectedList);
    } catch (err) {
      toast.error("Erro ao validar número");
    } finally {
      setValidatingContact(null);
    }
  };

  const handleValidateList = async () => {
    if (!selectedList) return;
    
    // Find a connection that can validate
    const validConn = allConnections?.find(c => 
      c.status === 'connected' && 
      (c.provider === 'evolution' || c.provider === 'wapi' || c.provider === 'meta' || c.provider === 'uazapi')
    );

    if (!validConn) {
      toast.error("Nenhuma conexão ativa disponível para validar a lista");
      return;
    }

    const unverifiedContacts = contacts.filter(c => c.is_whatsapp === null);
    if (unverifiedContacts.length === 0) {
      toast.info("Não há contatos não verificados nesta lista");
      return;
    }

    setIsValidatingList(true);
    toast.info(`Iniciando validação de ${unverifiedContacts.length} contatos...`);
    
    try {
      const phones = unverifiedContacts.map(c => c.phone);
      let results: { phone: string; exists: boolean }[] = [];
      let serverSideValidated = false;
      
      // Tentar validação otimizada pelo servidor (UAZAPI ou Evolution via Contacts API)
      try {
        const res = await api<{ success: boolean; validated: number }>(`/api/contacts/lists/${selectedList}/validate-all`, {
          method: 'POST',
          body: { connection_id: validConn.id }
        });
        
        if (res.success) {
          serverSideValidated = true;
          toast.success(`Validação concluída: ${res.validated} contatos processados!`);
          loadContacts(selectedList);
          return;
        }
      } catch (err) {
        console.warn("Validação otimizada falhou, tentando fallback local:", err);
      }

      // Fallback 1: Validação por lotes no provedor específico (W-API ou UAZAPI)
      if (validConn.provider === 'wapi' || validConn.provider === 'uazapi') {
        const endpoint = `/api/${validConn.provider}/${validConn.id}/validate-numbers`;
        try {
          const res = await api<{ success: boolean; results: { phone: string; exists: boolean }[] }>(endpoint, {
            method: 'POST',
            body: { phones }
          });
          if (res.success) results = res.results;
        } catch (err) {
          console.error(`Erro na validação bulk ${validConn.provider}:`, err);
        }
      }
      
      // Fallback 2: Validação individual em paralelo se bulk falhar ou não for suportado
      if (results.length === 0) {
        results = await validateWhatsAppBulk(phones);
      }

      if (results.length > 0) {
        // Atualizar no banco via endpoint de bulk update se validamos localmente
        await api(`/api/contacts/lists/${selectedList}/validate-bulk`, {
          method: 'POST',
          body: { results }
        });

        toast.success("Validação de lista concluída!");
        loadContacts(selectedList);
      } else {
        toast.error("Nenhum resultado de validação obtido");
      }
    } catch (err) {
      console.error("Erro na validação de lista:", err);
      toast.error("Erro ao validar lista de contatos");
    } finally {
      setIsValidatingList(false);
    }
  };

  const handleImportContacts = async (
    contactsToImport: { name: string; phone: string; is_whatsapp?: boolean | null; customFields?: Record<string, string> }[]
  ) => {
    if (!selectedList) {
      toast.error("Selecione uma lista primeiro");
      return;
    }

    try {
      const result = await importContacts(
        selectedList,
        contactsToImport.map((c) => ({
          name: c.name,
          phone: c.phone,
          is_whatsapp: c.is_whatsapp ?? null,
        }))
      );
      
      if (result.duplicates > 0) {
        toast.success(`${result.imported} contatos importados! (${result.duplicates} duplicados ignorados)`);
      } else {
        toast.success(`${result.imported} contatos importados com sucesso!`);
      }
      
      loadContacts(selectedList);
      loadLists();
    } catch (err) {
      toast.error("Erro ao importar contatos");
      throw err;
    }
  };

  const validateWhatsAppNumber = async (phone: string): Promise<boolean> => {
    const validConn = allConnections?.find(c => 
      c.status === 'connected' && 
      (c.provider === 'evolution' || c.provider === 'wapi' || c.provider === 'meta' || c.provider === 'uazapi')
    );
    
    if (!validConn) {
      throw new Error("Nenhuma conexão ativa disponível para validação");
    }
    
    return whatsappProvider.checkNumber(validConn as any, phone);
  };

  const validateWhatsAppBulk = async (phones: string[]): Promise<{ phone: string; exists: boolean }[]> => {
    const validConn = allConnections?.find(c => c.status === 'connected');
    
    if (!validConn) throw new Error("Nenhuma conexão ativa disponível para validação");

    // W-API tem endpoint de bulk real no backend
    if (validConn.provider === 'wapi') {
      try {
        const result = await api<{ success: boolean; results: { phone: string; exists: boolean }[] }>(
          `/api/wapi/${validConn.id}/validate-numbers`,
          { method: 'POST', body: { phones } }
        );
        if (result.success) return result.results;
      } catch (err) {
        console.error("Erro na validação bulk W-API, tentando individual:", err);
      }
    }
    
    // Fallback para validação individual em paralelo (funciona para Meta, Evolution, Uazapi)
    // Processamos em lotes pequenos para não sobrecarregar
    const results: { phone: string; exists: boolean }[] = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < phones.length; i += BATCH_SIZE) {
      const batch = phones.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (phone) => {
        try {
          const exists = await validateWhatsAppNumber(phone);
          return { phone, exists };
        } catch {
          return { phone, exists: false };
        }
      }));
      results.push(...batchResults);
    }
    
    return results;
  };

  const ensureConnectionReadyForSync = async (connection: SyncConnection): Promise<boolean> => {
    if (connection.status === 'connected') return true;

    try {
      const liveStatus = await api<{ status: string; phoneNumber?: string }>(`/api/evolution/${connection.id}/status`);

      setSyncConnections((prev) =>
        prev.map((item) =>
          item.id === connection.id
            ? { ...item, status: liveStatus.status, phone_number: liveStatus.phoneNumber || item.phone_number }
            : item
        )
      );

      return liveStatus.status === 'connected';
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao verificar status da conexão');
      return false;
    }
  };

  const handleToggleShareList = async (listId: string, isShared: boolean) => {
    try {
      await api(`/api/contacts/lists/${listId}`, {
        method: 'PATCH',
        body: { is_public: isShared },
      });
      toast.success(isShared ? "Lista compartilhada com a equipe" : "Lista privada");
      loadLists();
    } catch (err) {
      toast.error("Erro ao atualizar compartilhamento");
    }
  };

  const handleSyncConnectionContacts = async () => {
    if (!selectedSyncConnectionId) {
      toast.error('Selecione uma conexão para sincronizar');
      return;
    }

    const selectedConnection = syncConnections.find((c) => c.id === selectedSyncConnectionId);
    if (!selectedConnection) {
      toast.error('Conexão selecionada não encontrada');
      return;
    }

    const ready = await ensureConnectionReadyForSync(selectedConnection);
    if (!ready) {
      toast.warning('A conexão precisa estar conectada para sincronizar contatos');
      return;
    }

    setSyncingConnectionId(selectedConnection.id);
    try {
      const result = await api<{ success: boolean; total: number; imported: number; updated: number; skipped: number; error?: string }>(
        `/api/wapi/${selectedConnection.id}/sync-contacts`,
        { method: 'POST' }
      );

      if (result.success) {
        toast.success(`Sincronização concluída! ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados.`);
      } else {
        toast.error(result.error || 'Erro ao sincronizar contatos');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao sincronizar contatos');
    } finally {
      setSyncingConnectionId(null);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm)
  );

  const totalContacts = lists.reduce((sum, list) => sum + Number(list.contact_count || 0), 0);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie suas listas de contatos
            </p>
          </div>
          <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Nova Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Lista</DialogTitle>
                <DialogDescription>
                  Crie uma lista para organizar seus contatos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="listName">Nome da Lista</Label>
                  <Input
                    id="listName"
                    placeholder="Ex: Clientes Janeiro"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="listPublic">Compartilhar com a equipe</Label>
                    <p className="text-xs text-muted-foreground">
                      Permitir que outros usuários da organização vejam esta lista
                    </p>
                  </div>
                  <Switch
                    id="listPublic"
                    checked={newListIsPublic}
                    onCheckedChange={setNewListIsPublic}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateListOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="gradient" onClick={handleCreateList} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Lista"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connection Filter */}
        {allConnections.length > 1 && (
          <div className="flex items-center gap-3 animate-fade-in">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por conta:</Label>
            <Select value={filterConnectionId || "all"} onValueChange={(v) => setFilterConnectionId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {allConnections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name}{conn.phone_number ? ` (${conn.phone_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Sincronizar agenda da conexão</CardTitle>
            <CardDescription>
              Selecione uma conexão W-API conectada para importar contatos da agenda do WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={selectedSyncConnectionId} onValueChange={setSelectedSyncConnectionId}>
                <SelectTrigger className="sm:w-[320px]">
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {syncConnections.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma conexão W-API conectada
                    </SelectItem>
                  ) : (
                    syncConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.name}
                        {connection.phone_number ? ` (${connection.phone_number})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={handleSyncConnectionContacts}
                disabled={!selectedSyncConnectionId || syncingConnectionId === selectedSyncConnectionId || syncConnections.length === 0}
              >
                {syncingConnectionId === selectedSyncConnectionId ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar contatos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* UAZAPI: sincronizar contatos da AGENDA do celular */}
        {uazapiConnections.length > 0 && (
          <Card className="animate-fade-in border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Sincronizar agenda do celular (UAZAPI)
              </CardTitle>
              <CardDescription>
                Importa diretamente os contatos salvos no celular vinculado ao WhatsApp via UAZAPI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={selectedUazapiConnId} onValueChange={setSelectedUazapiConnId}>
                  <SelectTrigger className="sm:w-[260px]">
                    <SelectValue placeholder="Conexão UAZAPI" />
                  </SelectTrigger>
                  <SelectContent>
                    {uazapiConnections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone_number ? ` (${c.phone_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={uazapiTargetListId} onValueChange={setUazapiTargetListId}>
                  <SelectTrigger className="sm:w-[260px]">
                    <SelectValue placeholder="Lista de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Crie uma lista primeiro
                      </SelectItem>
                    ) : (
                      lists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} ({l.contact_count})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  variant="default"
                  onClick={handleSyncUazapiContacts}
                  disabled={!selectedUazapiConnId || !uazapiTargetListId || uazapiSyncing}
                >
                  {uazapiSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Importar da agenda
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lists Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
              selectedList === null ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedList(null)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Todas as Listas</p>
                <p className="text-sm text-muted-foreground">
                  {totalContacts} contatos em {lists.length} listas
                </p>
              </div>
            </CardContent>
          </Card>

          {loading && lists.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            lists.map((list, index) => (
              <Card
                key={list.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
                  selectedList === list.id ? "ring-2 ring-primary" : ""
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedList(list.id)}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{list.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {list.contact_count || 0} contatos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">
                        {format(new Date(list.created_at), "dd/MM/yy", { locale: ptBR })}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", list.organization_id ? "text-primary" : "text-muted-foreground")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleShareList(list.id, !list.organization_id);
                        }}
                        title={list.organization_id ? "Lista compartilhada (clique para tornar privada)" : "Lista privada (clique para compartilhar)"}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteList(list.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Contacts Table */}
        {selectedList && (
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{lists.find((l) => l.id === selectedList)?.name || "Contatos"}</CardTitle>
                  <CardDescription>{filteredContacts.length} contatos</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar contatos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleValidateList} 
                    disabled={isValidatingList || contacts.filter(c => c.is_whatsapp === null).length === 0}
                    className="gap-2"
                  >
                    {isValidatingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4 text-green-500" />}
                    Validar WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Importar Excel
                  </Button>
                  <Button variant="gradient" onClick={() => setIsAddContactOpen(true)}>
                    <UserPlus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {validationStatus && (
                <div className="mb-6 p-4 border rounded-lg bg-muted/30 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {validationStatus.isComplete ? (
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      <span className="font-medium">
                        {validationStatus.isComplete ? "Validação concluída!" : `Validando: ${validationStatus.currentPhone}`}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {validationStatus.processed} de {validationStatus.total}
                    </span>
                  </div>
                  
                  <Progress value={(validationStatus.processed / validationStatus.total) * 100} className="h-2 mb-4" />
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 rounded-md bg-green-500/10 border border-green-500/20">
                      <div className="text-xs text-green-600 font-medium uppercase">Válidos</div>
                      <div className="text-lg font-bold text-green-700">{validationStatus.valid}</div>
                    </div>
                    <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20">
                      <div className="text-xs text-red-600 font-medium uppercase">Inválidos</div>
                      <div className="text-lg font-bold text-red-700">{validationStatus.invalid}</div>
                    </div>
                    <div className="p-2 rounded-md bg-primary/10 border border-primary/20">
                      <div className="text-xs text-primary font-medium uppercase">Progresso</div>
                      <div className="text-lg font-bold text-primary">{Math.round((validationStatus.processed / validationStatus.total) * 100)}%</div>
                    </div>
                  </div>

                  {validationStatus.isComplete && (
                    <div className="mt-4 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={resetValidationStatus}>
                        Fechar painel
                      </Button>
                    </div>
                  )}

                  {validationStatus.error && (
                    <div className="mt-4 p-2 rounded bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{validationStatus.error}</span>
                    </div>
                  )}
                </div>
              )}

              {isLoadingContacts ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum contato nesta lista</p>
                  <p className="text-sm mb-4">Adicione contatos manualmente ou importe do Excel</p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                      <Upload className="h-4 w-4" />
                      Importar do Excel
                    </Button>
                    <Button variant="gradient" onClick={() => setIsAddContactOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                      Adicionar Contato
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          {editingContact === contact.id ? (
                            <Input
                              defaultValue={contact.name}
                              onBlur={(e) => handleUpdateContact(contact.id, e.target.value, contact.phone)}
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{contact.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingContact === contact.id ? (
                            <Input defaultValue={contact.phone} id={`phone-${contact.id}`} />
                          ) : (
                            <span className="font-mono text-sm">{contact.phone}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.is_whatsapp === true ? (
                            <Badge className="bg-green-500/10 text-green-500 border-0">
                              <Check className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          ) : contact.is_whatsapp === false ? (
                            <Badge className="bg-destructive/10 text-destructive border-0">
                              <X className="h-3 w-3 mr-1" />
                              Inválido
                            </Badge>
                          ) : (
                            <Badge variant="outline">Não verificado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleValidateWhatsApp(contact.id, contact.phone)}
                              disabled={validatingContact === contact.id}
                            >
                              {validatingContact === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Phone className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingContact(editingContact === contact.id ? null : contact.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(contact.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Excel Import Dialog */}
        <ExcelImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          onImport={handleImportContacts}
          validateWhatsApp={validateWhatsAppNumber}
          validateWhatsAppBulk={activeConnectionId ? validateWhatsAppBulk : undefined}
        />

        {/* Add Contact Dialog */}
        <Dialog open={isAddContactOpen} onOpenChange={(open) => {
          setIsAddContactOpen(open);
          if (!open) {
            setNewContactName("");
            setNewContactPhone("");
            setNewContactValidated(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Adicionar Contato
              </DialogTitle>
              <DialogDescription>
                Adicione um novo contato à lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Nome</Label>
                <Input
                  id="contactName"
                  placeholder="Nome do contato"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Telefone</Label>
                <div className="flex gap-2">
                  <Input
                    id="contactPhone"
                    placeholder="Ex: 65999999999"
                    value={newContactPhone}
                    onChange={(e) => {
                      setNewContactPhone(e.target.value);
                      setNewContactValidated(null);
                    }}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleValidateNewContact}
                    disabled={isValidatingNewContact || !newContactPhone.trim()}
                    title="Validar WhatsApp"
                  >
                    {isValidatingNewContact ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    O código 55 será adicionado automaticamente
                  </p>
                  {newContactValidated === true && (
                    <Badge className="bg-green-500/10 text-green-500 border-0">
                      <Check className="h-3 w-3 mr-1" />
                      WhatsApp válido
                    </Badge>
                  )}
                  {newContactValidated === false && (
                    <Badge className="bg-destructive/10 text-destructive border-0">
                      <X className="h-3 w-3 mr-1" />
                      WhatsApp inválido
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddContactOpen(false)}>
                Cancelar
              </Button>
              <Button variant="gradient" onClick={handleAddContact} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Contatos;
