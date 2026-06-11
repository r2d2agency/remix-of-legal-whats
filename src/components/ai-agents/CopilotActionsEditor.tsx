import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { useAgentActions, AgentAction } from '@/hooks/use-agent-modes';
import { COPILOT_ACTION_TEMPLATES } from '@/lib/agent-mode-templates';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function CopilotActionsEditor({ agentId }: { agentId: string }) {
  const { actions, create, update, remove, loading } = useAgentActions(agentId);
  const [draft, setDraft] = useState<Record<string, Partial<AgentAction>>>({});

  const addTemplate = async (t: typeof COPILOT_ACTION_TEMPLATES[0]) => {
    if (actions.length >= 4) { toast.error('Máximo de 4 ações'); return; }
    try {
      await create({ name: t.name, icon: t.icon, prompt: t.prompt, order_index: actions.length });
      toast.success('Ação adicionada');
    } catch (e: any) { toast.error(e.message); }
  };

  const addBlank = async () => {
    if (actions.length >= 4) { toast.error('Máximo de 4 ações'); return; }
    try {
      await create({ name: 'Nova ação', icon: 'Sparkles', prompt: 'Descreva o que essa ação deve fazer...' });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Ações do Copiloto ({actions.length}/4)</h3>
          <p className="text-xs text-muted-foreground">O vendedor clica em uma ação no chat e a IA responde no contexto da conversa.</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={actions.length >= 4}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Usar template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Templates de ação</DialogTitle></DialogHeader>
              <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
                {COPILOT_ACTION_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => addTemplate(t)}
                    className="text-left p-3 border rounded-md hover:bg-muted/50 transition"
                  >
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.prompt}</div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={addBlank} disabled={actions.length >= 4}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {actions.map((a) => {
        const d = draft[a.id] ?? {};
        const dirty = Object.keys(d).length > 0;
        return (
          <Card key={a.id} className="p-3 space-y-2">
            <div className="flex gap-2 items-start">
              <Input
                className="flex-1 font-medium"
                value={d.name ?? a.name}
                onChange={(e) => setDraft({ ...draft, [a.id]: { ...d, name: e.target.value } })}
                maxLength={80}
                placeholder="Nome da ação"
              />
              <Input
                className="w-32"
                value={d.icon ?? a.icon}
                onChange={(e) => setDraft({ ...draft, [a.id]: { ...d, icon: e.target.value } })}
                placeholder="Ícone (lucide)"
              />
              <Button
                variant="ghost" size="icon"
                onClick={async () => { await remove(a.id); }}
                title="Remover"
              ><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <Textarea
              value={d.prompt ?? a.prompt}
              onChange={(e) => setDraft({ ...draft, [a.id]: { ...d, prompt: e.target.value } })}
              rows={3}
              placeholder="Instrução para a IA quando esta ação for clicada"
            />
            {dirty && (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { const c = { ...draft }; delete c[a.id]; setDraft(c); }}>Cancelar</Button>
                <Button size="sm" onClick={async () => {
                  await update(a.id, d);
                  const c = { ...draft }; delete c[a.id]; setDraft(c);
                  toast.success('Ação salva');
                }}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
              </div>
            )}
          </Card>
        );
      })}

      {actions.length === 0 && !loading && (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          Nenhuma ação ainda. Use um template ou crie uma nova (até 4).
        </Card>
      )}
    </div>
  );
}