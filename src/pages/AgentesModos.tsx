import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Plus, Sparkles, Reply, Loader2 } from 'lucide-react';
import { useAIAgents, AIAgent } from '@/hooks/use-ai-agents';
import { CopilotActionsEditor } from '@/components/ai-agents/CopilotActionsEditor';
import { AutoReplyConfigEditor } from '@/components/ai-agents/AutoReplyConfigEditor';
import { AUTOREPLY_TEMPLATES } from '@/lib/agent-mode-templates';
import { toast } from 'sonner';

type Mode = 'copilot' | 'autoreply';

export default function AgentesModos() {
  const { getAgents, createAgent, updateAgent } = useAIAgents();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Mode>('copilot');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newDialog, setNewDialog] = useState<{ open: boolean; mode: Mode }>({ open: false, mode: 'copilot' });
  const [form, setForm] = useState({ name: '', description: '', system_prompt: '' });

  const load = async () => {
    setLoading(true);
    try { setAgents(await getAgents()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => agents.filter((a: any) => (a.agent_mode || 'standard') === tab),
    [agents, tab]
  );

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    const defaultPrompt = newDialog.mode === 'copilot'
      ? 'Você é um copiloto interno de vendas. Suas respostas vão direto para o vendedor (não para o cliente). Seja prático, em português, baseado no contexto da conversa.'
      : 'Você é uma secretária virtual cordial. Responda o cliente em português, breve, gentil, sempre indicando que retornarei em breve.';
    const a = await createAgent({
      name: form.name,
      description: form.description || undefined,
      system_prompt: form.system_prompt || defaultPrompt,
      ai_provider: 'gemini',
      ai_model: 'gemini-1.5-flash',
      // @ts-ignore - novo campo
      agent_mode: newDialog.mode,
      is_active: true,
    } as any);
    if (a) {
      toast.success('Agente criado');
      setNewDialog({ open: false, mode: newDialog.mode });
      setForm({ name: '', description: '', system_prompt: '' });
      await load();
      setOpenId(a.id);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Agentes IA — Modos
            </h1>
            <p className="text-sm text-muted-foreground">Crie copilotos para auxiliar o time e secretárias para responder automaticamente.</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="copilot" className="gap-2"><Sparkles className="h-4 w-4" /> Copiloto de Vendas</TabsTrigger>
            <TabsTrigger value="autoreply" className="gap-2"><Reply className="h-4 w-4" /> Auto-Resposta</TabsTrigger>
          </TabsList>

          <TabsContent value="copilot" className="space-y-3 mt-4">
            <ModeHeader
              title="Copiloto de Vendas"
              description="Agentes que sugerem respostas, análises e próximos passos. Aparecem no chat com até 4 ações cada."
              onCreate={() => setNewDialog({ open: true, mode: 'copilot' })}
            />
            {renderList(filtered, loading, openId, setOpenId, 'copilot')}
          </TabsContent>

          <TabsContent value="autoreply" className="space-y-3 mt-4">
            <ModeHeader
              title="Auto-Resposta"
              description="Responde automaticamente como uma secretária. Funciona com tags, contatos e janelas de horário."
              onCreate={() => setNewDialog({ open: true, mode: 'autoreply' })}
              extraTemplates
              onTemplate={(t) => { setForm({ name: t.name, description: t.description, system_prompt: 'Você é uma secretária virtual. Use esta diretriz: ' + t.message }); setNewDialog({ open: true, mode: 'autoreply' }); }}
            />
            {renderList(filtered, loading, openId, setOpenId, 'autoreply')}
          </TabsContent>
        </Tabs>

        {/* New Agent dialog */}
        <Dialog open={newDialog.open} onOpenChange={(o) => setNewDialog({ ...newDialog, open: o })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agente {newDialog.mode === 'copilot' ? 'Copiloto' : 'Auto-Resposta'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={newDialog.mode === 'copilot' ? 'Ex: Copiloto Vendas SDR' : 'Ex: Secretária Em Reunião'} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Personalidade / instrução principal</Label>
                <Textarea rows={4} value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} placeholder="Deixe em branco para usar o padrão" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewDialog({ ...newDialog, open: false })}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar agente</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function ModeHeader({ title, description, onCreate, extraTemplates, onTemplate }: { title: string; description: string; onCreate: () => void; extraTemplates?: boolean; onTemplate?: (t: typeof AUTOREPLY_TEMPLATES[0]) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="text-sm text-muted-foreground max-w-xl">{description}</div>
      <div className="flex gap-2">
        {extraTemplates && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5 mr-1" /> Templates</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Templates de Auto-Resposta</DialogTitle></DialogHeader>
              <div className="grid gap-2">
                {AUTOREPLY_TEMPLATES.map((t) => (
                  <button key={t.name} onClick={() => onTemplate?.(t)} className="p-3 border rounded-md text-left hover:bg-muted/50">
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.message}</div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Button size="sm" onClick={onCreate}><Plus className="h-4 w-4 mr-1" /> Novo {title}</Button>
      </div>
    </div>
  );
}

function renderList(items: AIAgent[], loading: boolean, openId: string | null, setOpenId: (id: string | null) => void, mode: Mode) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        Nenhum agente {mode === 'copilot' ? 'Copiloto' : 'Auto-Resposta'} ainda. Clique em "Novo" acima.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {mode === 'copilot' ? <Sparkles className="h-4 w-4 text-primary" /> : <Reply className="h-4 w-4 text-primary" />}
                {a.name}
                {!a.is_active && <Badge variant="outline">Inativo</Badge>}
              </CardTitle>
              <Button variant="ghost" size="sm">{openId === a.id ? 'Fechar' : 'Configurar'}</Button>
            </div>
            {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
          </CardHeader>
          {openId === a.id && (
            <CardContent>
              {mode === 'copilot' ? <CopilotActionsEditor agentId={a.id} /> : <AutoReplyConfigEditor agentId={a.id} />}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}