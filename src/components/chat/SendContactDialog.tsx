import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Search, User as UserIcon, Send } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ChatContact {
  id: string;
  name: string;
  phone: string;
  connection_id?: string | null;
}

interface SendContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string | null;
  onSend: (contactName: string, contactPhone: string) => Promise<void>;
}

export function SendContactDialog({ open, onOpenChange, connectionId, onSend }: SendContactDialogProps) {
  const [tab, setTab] = useState<"agenda" | "manual">("agenda");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setManualName("");
    setManualPhone("");
    setTab("agenda");
    let cancelled = false;
    setLoading(true);
    const url = connectionId ? `/api/chat/contacts?connection=${connectionId}` : `/api/chat/contacts`;
    api<ChatContact[]>(url)
      .then((data) => { if (!cancelled) setContacts(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setContacts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, connectionId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts.slice(0, 200);
    return contacts.filter((c) =>
      (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)
    ).slice(0, 200);
  }, [contacts, search]);

  const initials = (name: string) =>
    (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const handlePick = async (c: ChatContact) => {
    if (sending) return;
    setSending(true);
    try {
      await onSend(c.name || c.phone, c.phone);
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao enviar contato");
    } finally {
      setSending(false);
    }
  };

  const handleManual = async () => {
    if (sending) return;
    const name = manualName.trim();
    const phone = manualPhone.replace(/\D/g, "");
    if (!name || phone.length < 8) {
      toast.error("Informe nome e telefone válidos");
      return;
    }
    setSending(true);
    try {
      await onSend(name, phone);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao enviar contato");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar contato</DialogTitle>
          <DialogDescription>
            Compartilhe um cartão de contato (vCard) — o destinatário poderá salvar direto no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "agenda" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agenda">Da Agenda</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[320px] border rounded-md">
              {loading ? (
                <div className="flex items-center justify-center h-full py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground py-10 text-sm gap-2">
                  <UserIcon className="h-6 w-6" />
                  Nenhum contato encontrado
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => handlePick(c)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">{initials(c.name || c.phone)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                        </div>
                        <Send className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nome</Label>
              <Input
                id="contact-name"
                placeholder="Nome do contato"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefone (com DDI/DDD)</Label>
              <Input
                id="contact-phone"
                placeholder="Ex: 5511999999999"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
              <Button onClick={handleManual} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
