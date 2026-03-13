import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { API_URL, getAuthToken } from '@/lib/api';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Loader2, Pencil, Building2, X, Brain, MessageSquare, Send, Sparkles, FileText, BookOpen, Shield, Clock, Headphones, Target, Upload, BarChart3, Mic, Image, Eye, Users, Zap, ArrowRightLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface GlobalAgent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  ai_provider: string;
  ai_model: string;
  ai_api_key?: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  context_window: number;
  custom_fields: any[];
  capabilities: string[];
  handoff_message: string;
  handoff_keywords: string[];
  greeting_message?: string;
  fallback_message?: string;
  is_active: boolean;
  has_knowledge_base: boolean;
  org_count?: number;
  active_count?: number;
  created_at: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface KnowledgeSource {
  id: string;
  source_type: string;
  name: string;
  description?: string;
  source_content: string;
  file_type?: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

interface TestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// =============================================
// AGENT TEMPLATES
// =============================================
const AGENT_TEMPLATES = [
  {
    id: 'sdr',
    name: 'SDR (Pré-vendas)',
    icon: Target,
    description: 'Qualifica leads, coleta informações e agenda reuniões',
    config: {
      name: 'SDR Inteligente',
      description: 'Agente de pré-vendas para qualificação de leads',
      system_prompt: `Você é um SDR (Sales Development Representative) virtual especializado em qualificação de leads.

Sua missão:
1. Recepcionar o contato com cordialidade
2. Identificar o interesse e necessidade do lead
3. Coletar informações importantes: nome, empresa, cargo, necessidade principal
4. Qualificar o lead usando metodologia BANT (Budget, Authority, Need, Timeline)
5. Se qualificado, agendar uma reunião com o time comercial
6. Se não qualificado, registrar as informações e encerrar educadamente

Informações da empresa:
- Nome: {{company_name}}
- Produtos/Serviços: {{products}}
- Diferenciais: {{differentials}}

Regras:
- Seja natural e conversacional, sem parecer robótico
- Faça uma pergunta por vez
- Não pressione o lead
- Se pedirem para falar com humano, transfira imediatamente`,
      capabilities: ['respond_messages', 'qualify_leads', 'schedule_meetings', 'create_deals', 'suggest_actions'],
      greeting_message: 'Olá! 👋 Que bom ter você aqui! Sou o assistente virtual da {{company_name}}. Como posso ajudar você hoje?',
      handoff_message: 'Entendi! Vou conectar você com um dos nossos especialistas. Aguarde um momento! 😊',
      temperature: 0.7,
      max_tokens: 800,
      custom_fields: [
        { key: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, placeholder: 'Ex: Acme Corp' },
        { key: 'products', label: 'Produtos/Serviços', type: 'textarea', required: true, placeholder: 'Descreva seus produtos ou serviços...' },
        { key: 'differentials', label: 'Diferenciais', type: 'textarea', required: false, placeholder: 'O que diferencia sua empresa...' },
      ],
    },
  },
  {
    id: 'secretary',
    name: 'Secretária Virtual',
    icon: Headphones,
    description: 'Atendimento 24h, triagem e encaminhamento inteligente',
    config: {
      name: 'Secretária Virtual',
      description: 'Atendimento inteligente fora do horário comercial',
      system_prompt: `Você é uma secretária virtual profissional e cordial.

Sua missão:
1. Recepcionar todos os contatos com simpatia
2. Identificar o motivo do contato
3. Coletar nome e informações básicas
4. Informar horários de atendimento humano
5. Registrar a mensagem para retorno
6. Para urgências, transferir para atendente de plantão

Informações da empresa:
- Nome: {{company_name}}
- Horário de atendimento: {{business_hours}}
- Endereço: {{address}}

Regras:
- Seja sempre educada e profissional
- Informe que a mensagem será repassada ao time
- Não invente informações sobre produtos ou serviços
- Para dúvidas técnicas, anote e encaminhe`,
      capabilities: ['respond_messages', 'suggest_actions', 'summarize_history'],
      greeting_message: 'Olá! 😊 Obrigada por entrar em contato com a {{company_name}}. Sou a assistente virtual. Como posso ajudar?',
      handoff_message: 'Vou transferir você para um dos nossos atendentes. Um momento, por favor!',
      temperature: 0.6,
      max_tokens: 600,
      custom_fields: [
        { key: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, placeholder: 'Ex: Clínica Saúde' },
        { key: 'business_hours', label: 'Horário de Atendimento', type: 'text', required: true, placeholder: 'Ex: Seg a Sex, 8h às 18h' },
        { key: 'address', label: 'Endereço', type: 'text', required: false, placeholder: 'Endereço da empresa...' },
      ],
    },
  },
  {
    id: 'pre_service',
    name: 'Pré-Atendimento',
    icon: Shield,
    description: 'Triagem inicial, coleta dados e direciona ao setor correto',
    config: {
      name: 'Pré-Atendimento',
      description: 'Triagem e coleta de dados antes do atendimento humano',
      system_prompt: `Você é um assistente de pré-atendimento. Seu papel é fazer a triagem inicial antes de transferir para o atendimento humano.

Sua missão:
1. Cumprimentar o cliente
2. Coletar: nome completo, motivo do contato
3. Classificar o atendimento (suporte, vendas, financeiro, outros)
4. Coletar informações relevantes para o setor
5. Transferir para o atendente apropriado com um resumo

Informações da empresa:
- Nome: {{company_name}}
- Setores disponíveis: {{departments}}

Regras:
- Seja objetivo mas gentil
- Colete as informações essenciais ANTES de transferir
- Faça no máximo 3-4 perguntas
- Sempre confirme os dados antes de transferir
- Gere um resumo claro para o atendente`,
      capabilities: ['respond_messages', 'suggest_actions', 'summarize_history', 'generate_content'],
      greeting_message: 'Olá! 👋 Bem-vindo à {{company_name}}! Para agilizar seu atendimento, preciso de algumas informações. Qual o seu nome?',
      handoff_message: 'Perfeito! Já tenho todas as informações. Vou transferir você para o setor responsável. Aguarde um momento!',
      temperature: 0.5,
      max_tokens: 500,
      custom_fields: [
        { key: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, placeholder: 'Ex: Tech Solutions' },
        { key: 'departments', label: 'Setores/Departamentos', type: 'textarea', required: true, placeholder: 'Ex: Suporte Técnico, Vendas, Financeiro' },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Personalizado',
    icon: Sparkles,
    description: 'Comece do zero com configuração totalmente customizada',
    config: {
      name: '',
      description: '',
      system_prompt: 'Você é um assistente virtual profissional.\n\nInformações da empresa:\n- Nome: {{company_name}}\n- Produtos: {{products}}',
      capabilities: ['respond_messages'],
      greeting_message: 'Olá! Sou o assistente virtual. Como posso ajudar?',
      handoff_message: 'Vou transferir você para um atendente humano. Aguarde um momento.',
      temperature: 0.7,
      max_tokens: 1000,
      custom_fields: [
        { key: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, placeholder: 'Ex: Acme Corp' },
        { key: 'products', label: 'Produtos/Serviços', type: 'textarea', required: false, placeholder: 'Descreva seus produtos...' },
      ],
    },
  },
];

const ALL_CAPABILITIES = [
  { id: 'respond_messages', label: 'Responder mensagens', icon: MessageSquare },
  { id: 'qualify_leads', label: 'Qualificar leads', icon: Target },
  { id: 'schedule_meetings', label: 'Agendar reuniões', icon: Clock },
  { id: 'create_deals', label: 'Criar negociações CRM', icon: Target },
  { id: 'suggest_actions', label: 'Sugerir ações', icon: Sparkles },
  { id: 'generate_content', label: 'Gerar conteúdo', icon: FileText },
  { id: 'summarize_history', label: 'Resumir histórico', icon: BookOpen },
  { id: 'transcribe_audio', label: 'Ouvir áudios', icon: Headphones },
  { id: 'analyze_images', label: 'Analisar imagens', icon: Brain },
  { id: 'read_files', label: 'Ler arquivos', icon: FileText },
];

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export function GlobalAgentsTab() {
  const [agents, setAgents] = useState<GlobalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<GlobalAgent | null>(null);
  const [orgsDialogOpen, setOrgsDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [allOrgs, setAllOrgs] = useState<Org[]>([]);
  const [assignedOrgIds, setAssignedOrgIds] = useState<string[]>([]);
  const [savingOrgs, setSavingOrgs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Knowledge base state
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [addKnowledgeMode, setAddKnowledgeMode] = useState<'text' | 'url' | 'file' | null>(null);
  const [newKnowledgeName, setNewKnowledgeName] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [addingKnowledge, setAddingKnowledge] = useState(false);

  // Test chat state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    ai_api_key: '',
    system_prompt: 'Você é um assistente virtual profissional.',
    temperature: 0.7,
    max_tokens: 1000,
    context_window: 20,
    greeting_message: '',
    handoff_message: 'Vou transferir você para um atendente humano. Aguarde um momento.',
    handoff_keywords: 'humano,atendente,pessoa',
    fallback_message: 'Desculpe, não consegui entender. Pode reformular sua pergunta?',
    is_active: true,
    has_knowledge_base: false,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(['respond_messages']);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/list`, { headers: headers() });
      if (res.ok) setAgents(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleEdit = (agent: GlobalAgent) => {
    setEditingAgent(agent);
    const caps = Array.isArray(agent.capabilities) ? agent.capabilities : ['respond_messages'];
    setFormData({
      name: agent.name,
      description: agent.description || '',
      ai_provider: agent.ai_provider,
      ai_model: agent.ai_model,
      ai_api_key: agent.ai_api_key || '',
      system_prompt: agent.system_prompt,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      context_window: agent.context_window,
      greeting_message: agent.greeting_message || '',
      handoff_message: agent.handoff_message,
      handoff_keywords: Array.isArray(agent.handoff_keywords) ? agent.handoff_keywords.join(',') : '',
      fallback_message: agent.fallback_message || 'Desculpe, não consegui entender.',
      is_active: agent.is_active,
      has_knowledge_base: agent.has_knowledge_base || false,
    });
    setCustomFields(agent.custom_fields || []);
    setSelectedCapabilities(caps);
    setEditorOpen(true);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    const template = AGENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    setEditingAgent(null);
    setFormData({
      name: template.config.name,
      description: template.config.description,
      ai_provider: 'openai',
      ai_model: 'gpt-4o-mini',
      ai_api_key: '',
      system_prompt: template.config.system_prompt,
      temperature: template.config.temperature,
      max_tokens: template.config.max_tokens,
      context_window: 20,
      greeting_message: template.config.greeting_message,
      handoff_message: template.config.handoff_message,
      handoff_keywords: 'humano,atendente,pessoa',
      fallback_message: 'Desculpe, não consegui entender. Pode reformular?',
      is_active: true,
      has_knowledge_base: false,
    });
    setCustomFields(template.config.custom_fields as CustomField[]);
    setSelectedCapabilities(template.config.capabilities);
    setTemplateDialogOpen(false);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        handoff_keywords: formData.handoff_keywords.split(',').map(k => k.trim()).filter(Boolean),
        custom_fields: customFields,
        capabilities: selectedCapabilities,
      };
      const url = editingAgent
        ? `${API_URL}/api/global-agents/admin/${editingAgent.id}`
        : `${API_URL}/api/global-agents/admin`;
      const res = await fetch(url, {
        method: editingAgent ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
      toast.success(editingAgent ? 'Agente atualizado!' : 'Agente criado!');
      setEditorOpen(false);
      loadAgents();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso removerá o agente de todas as organizações.')) return;
    try {
      await fetch(`${API_URL}/api/global-agents/admin/${id}`, { method: 'DELETE', headers: headers() });
      toast.success('Agente removido');
      loadAgents();
    } catch { toast.error('Erro ao remover'); }
  };

  const handleOpenOrgs = async (agentId: string) => {
    setSelectedAgentId(agentId);
    try {
      const [orgsRes, assignedRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/organizations`, { headers: headers() }),
        fetch(`${API_URL}/api/global-agents/admin/${agentId}/organizations`, { headers: headers() }),
      ]);
      if (orgsRes.ok) setAllOrgs(await orgsRes.json());
      if (assignedRes.ok) {
        const assigned = await assignedRes.json();
        setAssignedOrgIds(assigned.map((o: any) => o.id));
      }
    } catch { /* ignore */ }
    setOrgsDialogOpen(true);
  };

  const handleSaveOrgs = async () => {
    if (!selectedAgentId) return;
    setSavingOrgs(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/organizations`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ organization_ids: assignedOrgIds }),
      });
      if (!res.ok) throw new Error('Erro');
      toast.success('Organizações atualizadas!');
      setOrgsDialogOpen(false);
      loadAgents();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingOrgs(false); }
  };

  const toggleOrg = (orgId: string) => {
    setAssignedOrgIds(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  };

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', label: '', type: 'text', required: false }]);
  };

  const updateCustomField = (idx: number, field: Partial<CustomField>) => {
    const updated = [...customFields];
    updated[idx] = { ...updated[idx], ...field };
    if (field.label && !customFields[idx].key) {
      updated[idx].key = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    setCustomFields(updated);
  };

  const removeCustomField = (idx: number) => {
    setCustomFields(customFields.filter((_, i) => i !== idx));
  };

  // Knowledge base functions
  const loadKnowledge = async (agentId: string) => {
    setKnowledgeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${agentId}/knowledge`, { headers: headers() });
      if (res.ok) setKnowledgeSources(await res.json());
    } catch { /* ignore */ }
    finally { setKnowledgeLoading(false); }
  };

  const handleOpenKnowledge = (agent: GlobalAgent) => {
    setSelectedAgentId(agent.id);
    setKnowledgeSources([]);
    setAddKnowledgeMode(null);
    loadKnowledge(agent.id);
    setKnowledgeDialogOpen(true);
  };

  const handleAddKnowledge = async () => {
    if (!selectedAgentId || !newKnowledgeName.trim() || !newKnowledgeContent.trim()) {
      toast.error('Nome e conteúdo são obrigatórios');
      return;
    }
    setAddingKnowledge(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/knowledge`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          source_type: addKnowledgeMode || 'text',
          name: newKnowledgeName,
          source_content: newKnowledgeContent,
        }),
      });
      if (!res.ok) throw new Error('Erro ao adicionar');
      toast.success('Fonte de conhecimento adicionada!');
      setAddKnowledgeMode(null);
      setNewKnowledgeName('');
      setNewKnowledgeContent('');
      loadKnowledge(selectedAgentId);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setAddingKnowledge(false); }
  };

  const handleUploadKnowledgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;
    
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use PDF, DOCX ou TXT.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 20MB.');
      return;
    }

    setAddingKnowledge(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/knowledge/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao enviar arquivo');
      }
      toast.success(`Arquivo "${file.name}" processado com sucesso!`);
      loadKnowledge(selectedAgentId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingKnowledge(false);
      e.target.value = '';
    }
  };

  const handleDeleteKnowledge = async (sourceId: string) => {
    if (!selectedAgentId) return;
    try {
      await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/knowledge/${sourceId}`, {
        method: 'DELETE', headers: headers()
      });
      toast.success('Fonte removida');
      loadKnowledge(selectedAgentId);
    } catch { toast.error('Erro ao remover'); }
  };

  // Test chat functions
  const handleOpenTest = (agent: GlobalAgent) => {
    setSelectedAgentId(agent.id);
    setTestMessages([{ role: 'system', content: `Testando agente: ${agent.name}` }]);
    setTestInput('');
    setTestDialogOpen(true);
  };

  const handleSendTest = async () => {
    if (!testInput.trim() || !selectedAgentId) return;
    const userMsg: TestMessage = { role: 'user', content: testInput };
    setTestMessages(prev => [...prev, userMsg]);
    setTestInput('');
    setTestLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/test`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          message: userMsg.content,
          history: testMessages.filter(m => m.role !== 'system'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setTestMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err: any) {
      setTestMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${err.message}` }]);
    } finally { setTestLoading(false); }
  };

  if (loading) {
    return (
      <TabsContent value="global-agents" className="space-y-4">
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="global-agents" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Agentes IA Globais</h2>
        <Button onClick={() => setTemplateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agente Global
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Crie agentes de IA a partir de templates e disponibilize para organizações. Os clientes podem ativar nas conexões e configurar horários.
      </p>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum agente global criado</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Criar a partir de template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    {agent.description && <CardDescription className="text-xs">{agent.description}</CardDescription>}
                  </div>
                  <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                    {agent.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{agent.ai_provider}/{agent.ai_model}</span>
                  {agent.has_knowledge_base && (
                    <Badge variant="outline" className="text-[10px] h-4 gap-1">
                      <Brain className="h-2.5 w-2.5" /> RAG
                    </Badge>
                  )}
                </div>
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.slice(0, 4).map(cap => (
                      <Badge key={cap} variant="outline" className="text-[10px] h-4">
                        {ALL_CAPABILITIES.find(c => c.id === cap)?.label || cap}
                      </Badge>
                    ))}
                    {agent.capabilities.length > 4 && (
                      <Badge variant="outline" className="text-[10px] h-4">+{agent.capabilities.length - 4}</Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {agent.org_count || 0} orgs
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Bot className="h-3 w-3" />
                    {agent.active_count || 0} ativas
                  </Badge>
                </div>
                <div className="flex gap-1.5 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(agent)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenKnowledge(agent)}>
                    <Brain className="h-3.5 w-3.5 mr-1" /> Cérebro
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenTest(agent)}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Testar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenOrgs(agent.id)}>
                    <Building2 className="h-3.5 w-3.5 mr-1" /> Orgs
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(agent.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escolha um Template</DialogTitle>
            <DialogDescription>Selecione um modelo de agente para começar</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {AGENT_TEMPLATES.map(template => {
              const Icon = template.icon;
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleCreateFromTemplate(template.id)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Editar' : 'Criar'} Agente Global</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-5 shrink-0">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="capabilities">Ações</TabsTrigger>
              <TabsTrigger value="fields">Campos</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              <TabsContent value="basic" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="SDR Noturno" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Agente para atendimento fora do horário comercial" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_active} onCheckedChange={v => setFormData({...formData, is_active: v})} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.has_knowledge_base} onCheckedChange={v => setFormData({...formData, has_knowledge_base: v})} />
                  <Label>Habilitar Base de Conhecimento (RAG)</Label>
                  <Badge variant="outline" className="text-[10px]">Cérebro da IA</Badge>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="m-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select value={formData.ai_provider} onValueChange={v => setFormData({...formData, ai_provider: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input value={formData.ai_model} onChange={e => setFormData({...formData, ai_model: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>API Key do Superadmin</Label>
                  <Input type="password" value={formData.ai_api_key} onChange={e => setFormData({...formData, ai_api_key: e.target.value})} placeholder="sk-..." />
                  <p className="text-xs text-muted-foreground">Se vazio, o cliente precisará informar a própria chave na ativação.</p>
                </div>
                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Textarea rows={10} value={formData.system_prompt} onChange={e => setFormData({...formData, system_prompt: e.target.value})}
                    placeholder="Use {{campo}} para injetar valores dos campos personalizados" />
                  <p className="text-xs text-muted-foreground">Use {'{{nome_do_campo}}'} para inserir valores preenchidos pelo cliente.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura</Label>
                    <Input type="number" step="0.1" min="0" max="2" value={formData.temperature}
                      onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input type="number" value={formData.max_tokens}
                      onChange={e => setFormData({...formData, max_tokens: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contexto</Label>
                    <Input type="number" value={formData.context_window}
                      onChange={e => setFormData({...formData, context_window: parseInt(e.target.value)})} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="capabilities" className="m-0 space-y-4">
                <div>
                  <Label>Capacidades do Agente</Label>
                  <p className="text-xs text-muted-foreground mb-3">Selecione as ações que este agente pode realizar na conta do cliente</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {ALL_CAPABILITIES.map(cap => {
                    const Icon = cap.icon;
                    return (
                      <div
                        key={cap.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedCapabilities.includes(cap.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleCapability(cap.id)}
                      >
                        <Checkbox checked={selectedCapabilities.includes(cap.id)} />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{cap.label}</span>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="fields" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Campos personalizáveis pelo cliente</Label>
                    <p className="text-xs text-muted-foreground">Defina campos que o cliente preencherá (ex: nome da empresa, produtos)</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addCustomField} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Campo
                  </Button>
                </div>

                {customFields.map((field, idx) => (
                  <Card key={idx} className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Campo {idx + 1}</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCustomField(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Label" value={field.label} onChange={e => updateCustomField(idx, { label: e.target.value })} />
                      <Input placeholder="Chave (auto)" value={field.key} onChange={e => updateCustomField(idx, { key: e.target.value })} />
                      <Select value={field.type} onValueChange={v => updateCustomField(idx, { type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="select">Seleção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input placeholder="Placeholder" value={field.placeholder || ''} onChange={e => updateCustomField(idx, { placeholder: e.target.value })} className="flex-1" />
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={field.required} onCheckedChange={v => updateCustomField(idx, { required: !!v })} />
                        <Label className="text-xs">Obrigatório</Label>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="messages" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label>Mensagem de boas-vindas</Label>
                  <Textarea rows={3} value={formData.greeting_message} onChange={e => setFormData({...formData, greeting_message: e.target.value})}
                    placeholder="Olá! Sou o assistente virtual..." />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem de fallback (quando não entende)</Label>
                  <Textarea rows={2} value={formData.fallback_message} onChange={e => setFormData({...formData, fallback_message: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem de handoff (transferência)</Label>
                  <Textarea rows={3} value={formData.handoff_message} onChange={e => setFormData({...formData, handoff_message: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Palavras-chave de handoff (separadas por vírgula)</Label>
                  <Input value={formData.handoff_keywords} onChange={e => setFormData({...formData, handoff_keywords: e.target.value})} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAgent ? 'Salvar' : 'Criar Agente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Base Dialog */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> Cérebro da IA (Base de Conhecimento)
            </DialogTitle>
            <DialogDescription>Adicione textos, URLs ou documentos para enriquecer as respostas do agente</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Add buttons */}
            {!addKnowledgeMode && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setAddKnowledgeMode('text')} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Texto
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddKnowledgeMode('url')} className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> URL
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 relative" disabled={addingKnowledge} asChild>
                  <label>
                    <Upload className="h-3.5 w-3.5" />
                    {addingKnowledge ? 'Processando...' : 'PDF / DOCX / TXT'}
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      className="sr-only"
                      onChange={handleUploadKnowledgeFile}
                    />
                  </label>
                </Button>
              </div>
            )}

            {/* Add form */}
            {addKnowledgeMode && (
              <Card className="p-4 space-y-3 border-primary/30">
                <div className="flex justify-between items-center">
                  <Label>Adicionar {addKnowledgeMode === 'text' ? 'Texto' : 'URL'}</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddKnowledgeMode(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  placeholder="Nome da fonte (ex: FAQ, Tabela de preços)"
                  value={newKnowledgeName}
                  onChange={e => setNewKnowledgeName(e.target.value)}
                />
                {addKnowledgeMode === 'text' ? (
                  <Textarea
                    placeholder="Cole o conteúdo aqui... Pode ser texto de FAQ, políticas, informações de produtos, etc."
                    rows={6}
                    value={newKnowledgeContent}
                    onChange={e => setNewKnowledgeContent(e.target.value)}
                  />
                ) : (
                  <Input
                    placeholder="https://seu-site.com/pagina"
                    value={newKnowledgeContent}
                    onChange={e => setNewKnowledgeContent(e.target.value)}
                  />
                )}
                <Button size="sm" onClick={handleAddKnowledge} disabled={addingKnowledge} className="gap-1.5">
                  {addingKnowledge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </Card>
            )}

            {/* Sources list */}
            {knowledgeLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : knowledgeSources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma fonte de conhecimento adicionada</p>
                <p className="text-xs mt-1">Adicione textos ou URLs para enriquecer as respostas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {knowledgeSources.map(source => (
                  <div key={source.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{source.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] h-4">{source.source_type}</Badge>
                          <Badge variant={source.status === 'completed' ? 'default' : source.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                            {source.status}
                          </Badge>
                          {source.chunk_count > 0 && <span>{source.chunk_count} chunks</span>}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteKnowledge(source.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Chat Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Testar Agente
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh] border rounded-lg p-3">
            <div className="space-y-3">
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' :
                    msg.role === 'system' ? 'bg-muted text-muted-foreground text-xs italic' :
                    'bg-muted'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-2.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Digite uma mensagem..."
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendTest()}
              disabled={testLoading}
            />
            <Button size="icon" onClick={handleSendTest} disabled={testLoading || !testInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Organization Assignment Dialog */}
      <Dialog open={orgsDialogOpen} onOpenChange={setOrgsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Distribuir para Organizações</DialogTitle>
            <DialogDescription>Selecione quais organizações podem usar este agente</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2">
            {allOrgs.map(org => (
              <div key={org.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => toggleOrg(org.id)}>
                <Checkbox checked={assignedOrgIds.includes(org.id)} />
                <div>
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setOrgsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveOrgs} disabled={savingOrgs}>
              {savingOrgs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar ({assignedOrgIds.length} selecionadas)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
