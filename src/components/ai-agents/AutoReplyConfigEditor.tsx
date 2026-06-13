import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tag, X, Plus, Clock, Play, Pause, RefreshCw, Activity } from 'lucide-react';
import { useAutoReplyConfig, AutoReplyConfig } from '@/hooks/use-agent-modes';
import { useConnections } from '@/hooks/use-connections';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface OrgTag { id: string; name: string; color?: string }

function TagsPicker({
  label, values, onChange, availableTags,
}: { label: string; values: string[]; onChange: (v: string[]) => void; availableTags: OrgTag[] }) {
  const toggle = (name: string) => {
    if (values.includes(name)) onChange(values.filter((v) => v !== name));
    else onChange([...values, name]);
  };
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {availableTags.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mt-1">
          Nenhuma tag criada. Crie tags em <strong>Tags</strong> no menu lateral.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-40 overflow-y-auto">
          {availableTags.map((t) => {
            const active = values.includes(t.name);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.name)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70'
                }`}
                style={!active && t.color ? { borderColor: t.color } : undefined}
              >
                <Tag className="h-3 w-3" />
                {t.name}
                {active && <X className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      )}
      {values.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1">{values.length} selecionada(s)</p>
      )}
    </div>
  );
}

function TagsInput({
  label, values, onChange, placeholder,
}: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim(); if (!t) return;
    if (values.includes(t)) { setInput(''); return; }
    onChange([...values, t]); setInput('');
  };
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1 mb-1">
        <Input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            <Tag className="h-3 w-3" /> {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="ml-1"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function AutoReplyConfigEditor({ agentId }: { agentId: string }) {
  const { config, save, toggle, loading } = useAutoReplyConfig(agentId);
  const [local, setLocal] = useState<Partial<AutoReplyConfig>>({});
  const [duration, setDuration] = useState<string>('60');
  const [orgTags, setOrgTags] = useState<OrgTag[]>([]);
  const { data: orgConns = [] } = useConnections({ scope: 'organization' });
  const { data: userConns = [] } = useConnections({ scope: 'user' });
  const connections = (() => {
    const map = new Map<string, any>();
    [...orgConns, ...userConns].forEach((c) => { if (c?.id) map.set(c.id, c); });
    return Array.from(map.values());
  })();

  useEffect(() => {
    api<OrgTag[]>('/api/chat/tags', { auth: true })
      .then((data) => setOrgTags(data || []))
      .catch(() => setOrgTags([]));
  }, []);

  useEffect(() => {
    if (config) setLocal({
      filter_mode: config.filter_mode,
      included_tags: config.included_tags || [],
      excluded_tags: config.excluded_tags || [],
      included_groups: config.included_groups || [],
      excluded_groups: config.excluded_groups || [],
      included_contact_ids: config.included_contact_ids || [],
      excluded_contact_ids: config.excluded_contact_ids || [],
      connection_ids: config.connection_ids || [],
      schedule_enabled: config.schedule_enabled,
      schedule_windows: Array.isArray(config.schedule_windows) ? config.schedule_windows : [],
      response_template: config.response_template,
      max_responses_per_contact: config.max_responses_per_contact ?? 1,
      reply_mode: (config.reply_mode as any) || 'fixed',
      sdr_max_replies: config.sdr_max_replies ?? 5,
    });
  }, [config]);

  const set = (patch: Partial<AutoReplyConfig>) => setLocal((p) => ({ ...p, ...patch }));
  const windows = (local.schedule_windows as any[]) || [];

  const handleSave = async () => {
    try { await save(local); toast.success('Configuração salva'); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (active: boolean) => {
    try {
      const dur = parseInt(duration);
      await toggle(active, active && dur > 0 ? dur : undefined);
      toast.success(active ? 'Auto-resposta ativada' : 'Auto-resposta pausada');
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const isActive = config?.is_active;
  const until = config?.paused_until ? new Date(config.paused_until) : null;
  const replyMode = (local.reply_mode as any) || 'fixed';
  const selectedConnIds = local.connection_ids || [];
  const toggleConn = (id: string) => {
    if (selectedConnIds.includes(id)) set({ connection_ids: selectedConnIds.filter((x) => x !== id) });
    else set({ connection_ids: [...selectedConnIds, id] });
  };

  return (
    <div className="space-y-4">
      {/* Active state */}
      <Card className={`p-4 ${isActive ? 'border-primary bg-primary/5' : ''}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              {isActive ? <Play className="h-4 w-4 text-primary" /> : <Pause className="h-4 w-4 text-muted-foreground" />}
              {isActive ? 'Auto-resposta ATIVA' : 'Auto-resposta inativa'}
            </div>
            {until && <p className="text-xs text-muted-foreground mt-0.5">Até {until.toLocaleString('pt-BR')}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={5} max={1440}
              value={duration} onChange={(e) => setDuration(e.target.value)}
              className="w-20 h-8" placeholder="min"
            />
            <span className="text-xs text-muted-foreground">min</span>
            <Button size="sm" onClick={() => handleToggle(!isActive)} variant={isActive ? 'outline' : 'default'}>
              {isActive ? 'Pausar' : 'Ativar agora'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reply mode */}
      <Card className="p-3 space-y-3">
        <Label className="font-semibold">Tipo de resposta</Label>
        <Select value={replyMode} onValueChange={(v) => set({ reply_mode: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Resposta fixa (envia mensagem padrão)</SelectItem>
            <SelectItem value="sdr">SDR com IA (responde várias vezes, baseado no prompt)</SelectItem>
          </SelectContent>
        </Select>

        {replyMode === 'fixed' ? (
          <div>
            <Label>Mensagem que será enviada</Label>
            <Textarea
              rows={3}
              value={local.response_template ?? ''}
              onChange={(e) => set({ response_template: e.target.value })}
              placeholder='Ex: "Olá! Recebi sua mensagem e retorno em breve."'
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta mensagem é enviada exatamente como está, sem IA. Use o controle abaixo para escolher quantas vezes enviar para o mesmo contato.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs">Enviar no máximo</Label>
              <Input
                type="number" min={1} max={10}
                value={local.max_responses_per_contact ?? 1}
                onChange={(e) => set({ max_responses_per_contact: parseInt(e.target.value) || 1 })}
                className="w-20 h-8"
              />
              <span className="text-xs">vez(es) por contato</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <Label>Diretriz extra para o SDR (opcional)</Label>
              <Textarea
                rows={3}
                value={local.response_template ?? ''}
                onChange={(e) => set({ response_template: e.target.value })}
                placeholder='Ex: "Qualifique o lead perguntando sobre orçamento, prazo e decisor."'
              />
              <p className="text-xs text-muted-foreground mt-1">
                A IA usa o <strong>system prompt do agente</strong> + esta diretriz + histórico da conversa para responder o cliente como um SDR humano.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Limite de trocas com o cliente</Label>
              <Input
                type="number" min={1} max={50}
                value={local.sdr_max_replies ?? 5}
                onChange={(e) => set({ sdr_max_replies: parseInt(e.target.value) || 5 })}
                className="w-20 h-8"
              />
              <span className="text-xs">resposta(s) antes de parar</span>
            </div>
          </div>
        )}
      </Card>

      {/* Connections scope */}
      <Card className="p-3 space-y-2">
        <Label className="font-semibold">Conexões onde a auto-resposta vai funcionar</Label>
        <p className="text-xs text-muted-foreground">Selecione uma ou mais conexões. Se nenhuma for marcada, vale para <strong>todas</strong> da organização.</p>
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma conexão disponível.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
            {connections.map((c) => {
              const active = selectedConnIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleConn(c.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-2 ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${c.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {c.name}
                  {c.phone_number && <span className="opacity-70">· {c.phone_number}</span>}
                  {active && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}
        {selectedConnIds.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{selectedConnIds.length} conexão(ões) selecionada(s)</p>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <Label className="font-semibold">Quem recebe a resposta automática</Label>
        <Select value={local.filter_mode || 'all'} onValueChange={(v) => set({ filter_mode: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contatos</SelectItem>
            <SelectItem value="include">Somente os incluídos</SelectItem>
            <SelectItem value="exclude">Todos, exceto os excluídos</SelectItem>
          </SelectContent>
        </Select>

        {(local.filter_mode === 'include') && (
          <div className="space-y-3">
            <TagsPicker label="Tags incluídas" values={local.included_tags || []} onChange={(v) => set({ included_tags: v })} availableTags={orgTags} />
            <TagsInput label="Grupos incluídos (JID ou nome)" values={local.included_groups || []} onChange={(v) => set({ included_groups: v })} placeholder="Família, Vendas..." />
          </div>
        )}
        {(local.filter_mode === 'exclude') && (
          <div className="space-y-3">
            <TagsPicker label="Tags excluídas" values={local.excluded_tags || []} onChange={(v) => set({ excluded_tags: v })} availableTags={orgTags} />
            <TagsInput label="Grupos excluídos" values={local.excluded_groups || []} onChange={(v) => set({ excluded_groups: v })} placeholder="Família, Amigos..." />
          </div>
        )}
      </Card>

      {/* Schedule */}
      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Agendamento</Label>
          <Switch checked={!!local.schedule_enabled} onCheckedChange={(v) => set({ schedule_enabled: v })} />
        </div>
        {local.schedule_enabled && (
          <div className="space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap p-2 border rounded-md">
                <div className="flex gap-1">
                  {WEEK.map((d, di) => (
                    <button
                      key={d} type="button"
                      onClick={() => {
                        const days = new Set<number>(w.days || []);
                        if (days.has(di)) days.delete(di); else days.add(di);
                        const nw = [...windows]; nw[i] = { ...w, days: [...days].sort() };
                        set({ schedule_windows: nw });
                      }}
                      className={`text-xs px-2 py-1 rounded ${w.days?.includes(di) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    >{d}</button>
                  ))}
                </div>
                <Input type="time" value={w.start || '18:00'} onChange={(e) => { const nw = [...windows]; nw[i] = { ...w, start: e.target.value }; set({ schedule_windows: nw }); }} className="w-28 h-8" />
                <span>até</span>
                <Input type="time" value={w.end || '08:00'} onChange={(e) => { const nw = [...windows]; nw[i] = { ...w, end: e.target.value }; set({ schedule_windows: nw }); }} className="w-28 h-8" />
                <Button size="icon" variant="ghost" onClick={() => set({ schedule_windows: windows.filter((_, idx) => idx !== i) })}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set({ schedule_windows: [...windows, { days: [1,2,3,4,5], start: '18:00', end: '08:00' }] })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova janela
            </Button>
            <p className="text-xs text-muted-foreground">A auto-resposta liga/desliga automaticamente dentro das janelas (fuso São Paulo).</p>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar configurações</Button>
      </div>

      <AutoReplyDebugLogs />
    </div>
  );
}

function AutoReplyDebugLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ logs: any[] }>(`/api/agent-modes/debug/auto-reply-logs?limit=200`, { auth: true });
      setLogs(data?.logs || []);
    } catch (e: any) {
      toast.error('Erro ao buscar logs: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [auto]);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const s = (l.event || '') + ' ' + JSON.stringify(l);
    return s.toLowerCase().includes(filter.toLowerCase());
  });

  const levelColor = (lv: string) =>
    lv === 'error' ? 'text-destructive' : lv === 'warn' ? 'text-yellow-600' : 'text-muted-foreground';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" /> Logs de diagnóstico (tempo real)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrar (ex: tag, connection, skip)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-56"
          />
          <label className="flex items-center gap-1 text-xs">
            <Switch checked={auto} onCheckedChange={setAuto} /> auto
          </label>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mostra os eventos do processamento de auto-resposta vindos do webhook. Procure por <code>auto_reply.debug.start</code> (recebeu mensagem),
        <code> configs_loaded</code>, <code>filter_check</code>, <code>no_matching_config</code> ou <code>send_result</code>.
      </p>
      <div className="border rounded-md bg-muted/30 max-h-80 overflow-y-auto font-mono text-[11px]">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {loading ? 'Carregando...' : 'Nenhum log ainda. Envie uma mensagem de teste para a conexão configurada.'}
          </div>
        ) : (
          filtered.map((l, i) => (
            <div key={i} className="px-2 py-1 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>
                <span className={`uppercase ${levelColor(l.level)}`}>{l.level}</span>
                <span className="font-semibold">{l.event}</span>
              </div>
              <pre className="whitespace-pre-wrap break-all text-muted-foreground mt-0.5">
                {JSON.stringify(
                  Object.fromEntries(Object.entries(l).filter(([k]) => !['ts','level','event'].includes(k))),
                  null, 0
                )}
              </pre>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}