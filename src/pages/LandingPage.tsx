import { useState } from "react";
import { ScrollReveal } from "@/hooks/use-scroll-animation";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/hooks/use-branding";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  MessageSquare,
  Users,
  Zap,
  Send,
  BarChart3,
  Clock,
  Shield,
  Headphones,
  Bot,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Loader2,
  Building2,
  Brain,
  Target,
  Calendar,
  TrendingUp,
  Star,
  Sparkles,
  FileText,
  Globe,
  Bell,
  RefreshCw,
  Scale,
  Gavel,
  Briefcase,
  FolderOpen,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  Lock,
  Search,
  Layers,
  ArrowLeftRight,
  Database,
  MessageCircle,
  Cpu,
  Ghost,
  Eye,
  ShieldCheck,
  Activity,
  PenTool,
  QrCode,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/system-preview-crm-kanban.png";
import gleegoLogo from "@/assets/gleego-logo.png";

const featureCategories = [
  {
    category: "WhatsApp Organizado",
    icon: MessageSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    features: [
      {
        icon: MessageSquare,
        title: "Chat Centralizado",
        description: "Todas as conversas de clientes em um único painel, sem perder nenhuma mensagem.",
      },
      {
        icon: Users,
        title: "Multi-Atendentes",
        description: "Cada vendedor ou atendente cuida dos seus clientes com filas organizadas e transferências.",
      },
      {
        icon: Bell,
        title: "Notificações Inteligentes",
        description: "Receba alertas quando clientes enviam mensagens, pedidos ou novas solicitações.",
      },
      {
        icon: Building2,
        title: "Setores e Departamentos",
        description: "Separe atendimento por área: comercial, suporte, financeiro, pós-venda.",
      },
    ],
  },
  {
    category: "Organização Interna",
    icon: FolderOpen,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    features: [
      {
        icon: FolderOpen,
        title: "Kanban de Negociações",
        description: "Organize negociações e oportunidades em quadros visuais por etapa do funil.",
      },
      {
        icon: ClipboardList,
        title: "Tarefas da Equipe",
        description: "Atribua e acompanhe tarefas entre vendedores, gestores e equipe de suporte.",
      },
      {
        icon: Bot,
        title: "Secretária IA nos Grupos",
        description: "IA inteligente monitora grupos do WhatsApp, identifica solicitações, cria tarefas automaticamente e envia alertas para os responsáveis.",
      },
      {
        icon: Users,
        title: "Gestão de Grupos",
        description: "Grupos internos por projeto ou área para comunicação rápida da equipe.",
      },
      {
        icon: Lock,
        title: "Permissões por Cargo",
        description: "Controle quem vê o quê: diretores, gerentes, vendedores e atendentes.",
      },
    ],
  },
  {
    category: "Lembretes & Agenda",
    icon: Clock,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    features: [
      {
        icon: Bell,
        title: "Lembretes Automáticos",
        description: "Crie lembretes para reuniões, follow-ups e retornos a clientes.",
      },
      {
        icon: Clock,
        title: "Mensagens Agendadas",
        description: "Programe mensagens para clientes em datas e horários específicos.",
      },
      {
        icon: Calendar,
        title: "Agenda da Empresa",
        description: "Visualize compromissos de toda a equipe em um calendário integrado.",
      },
      {
        icon: RefreshCw,
        title: "Follow-up Automático",
        description: "Sequências de acompanhamento para leads que não responderam.",
      },
    ],
  },
  {
    category: "IA Comercial",
    icon: Brain,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    features: [
      {
        icon: Brain,
        title: "Assistente de Vendas",
        description: "IA que ajuda a criar propostas, scripts de vendas e respostas comerciais.",
      },
      {
        icon: ArrowLeftRight,
        title: "Transferir para IA",
        description: "Transfira o atendimento de um cliente diretamente para um agente de IA especializado.",
      },
      {
        icon: MessageCircle,
        title: "Consulta IA no Chat",
        description: "Peça ajuda à IA durante o atendimento: análise da conversa, sugestões de resposta e fechamento.",
      },
      {
        icon: Database,
        title: "Base de Conhecimento",
        description: "Alimente a IA com catálogos, manuais e documentos da empresa para respostas precisas (RAG).",
      },
      {
        icon: Bot,
        title: "Chatbot para Clientes",
        description: "Atenda clientes 24h com triagem automática e coleta de informações.",
      },
      {
        icon: FileText,
        title: "Resumos de Conversas",
        description: "IA resume conversas longas com clientes destacando os pontos importantes.",
      },
      {
        icon: Cpu,
        title: "Múltiplos Agentes IA",
        description: "Crie agentes especializados: qualificação, fechamento, suporte técnico, cada um com seu conhecimento.",
      },
      {
        icon: Sparkles,
        title: "Insights Comerciais",
        description: "Análise inteligente de conversas para identificar oportunidades e melhorar o atendimento.",
      },
    ],
  },
  {
    category: "Automação",
    icon: Zap,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    features: [
      {
        icon: Bot,
        title: "Fluxos de Atendimento",
        description: "Crie menus automáticos para triagem: tipo de produto, urgência e departamento.",
      },
      {
        icon: Send,
        title: "Disparos em Massa",
        description: "Envie promoções, novidades e comunicados para toda sua base de clientes.",
      },
      {
        icon: UserCheck,
        title: "Distribuição Automática",
        description: "Novos leads são distribuídos automaticamente entre os vendedores.",
      },
      {
        icon: Target,
        title: "Tags e Segmentação",
        description: "Classifique clientes por interesse, etapa do funil e prioridade.",
      },
    ],
  },
  {
    category: "Relatórios",
    icon: BarChart3,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    features: [
      {
        icon: BarChart3,
        title: "Dashboard Gerencial",
        description: "Visão geral de vendas, atendimentos e performance da equipe comercial.",
      },
      {
        icon: TrendingUp,
        title: "Métricas de Atendimento",
        description: "Tempo de resposta, volume de conversas e taxa de conversão.",
      },
      {
        icon: Search,
        title: "Busca de Conversas",
        description: "Encontre qualquer conversa, cliente ou mensagem em segundos.",
      },
      {
        icon: Globe,
        title: "Formulários de Captação",
        description: "Capte novos leads com formulários online integrados ao WhatsApp.",
      },
    ],
  },
  {
    category: "Modo Fantasma",
    icon: Ghost,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    features: [
      {
        icon: Ghost,
        title: "IA de Monitoramento",
        description: "Inteligência artificial que analisa a qualidade das conversas automaticamente, sem interferir no fluxo de atendimento.",
      },
      {
        icon: Eye,
        title: "Auditoria de Qualidade",
        description: "Avalie a qualidade do atendimento com IA: tom, agilidade, assertividade e postura.",
      },
      {
        icon: ShieldCheck,
        title: "Análise de Risco e Conduta",
        description: "Detecte comportamentos inadequados, promessas indevidas ou riscos de compliance.",
      },
      {
        icon: Activity,
        title: "Métricas Operacionais",
        description: "Tempo médio de resposta, taxa de resolução, horários de pico e ranking de desempenho.",
      },
    ],
  },
  {
    category: "Assinatura Digital",
    icon: PenTool,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    features: [
      {
        icon: PenTool,
        title: "Assinatura Eletrônica",
        description: "Envie documentos PDF para assinatura com validade jurídica (MP 2.200-2/2001 e Lei 14.063/2020).",
      },
      {
        icon: QrCode,
        title: "Verificação por QR Code",
        description: "Cada documento assinado possui um QR Code de verificação de autenticidade acessível publicamente.",
      },
      {
        icon: Mail,
        title: "Verificação por E-mail (OTP)",
        description: "Identidade do signatário validada por código de verificação enviado ao e-mail cadastrado.",
      },
      {
        icon: MapPin,
        title: "Geolocalização Obrigatória",
        description: "Registro de localização do signatário para garantir rastreabilidade e segurança jurídica.",
      },
      {
        icon: ShieldCheck,
        title: "Trilha de Auditoria Completa",
        description: "IP, geolocalização, User-Agent e timestamps registrados para cada ação no documento.",
      },
      {
        icon: MessageSquare,
        title: "Envio via WhatsApp",
        description: "Envie o link de assinatura diretamente pelo WhatsApp do contato, integrado ao Chat e CRM.",
      },
    ],
  },
];

const pricingPlans = [
  {
    name: "Starter",
    description: "Para pequenas empresas e empreendedores",
    price: "R$ 380",
    period: "/mês",
    popular: false,
    cta: "Começar Agora",
    features: [
      { text: "1 conexão WhatsApp", included: true },
      { text: "4 usuários", included: true },
      { text: "Chat centralizado", included: true },
      { text: "CRM com Kanban", included: true },
      { text: "Lembretes e agendamentos", included: true },
      { text: "Chatbot de triagem", included: true },
      { text: "IA à parte (OpenAI/Gemini)", included: true },
      { text: "Assinatura de documentos (30/mês)", included: true },
      { text: "Transferir para IA", included: false },
      { text: "Base de conhecimento IA", included: false },
    ],
    color: "border-border",
  },
  {
    name: "Business",
    description: "Para empresas com equipe comercial estruturada",
    price: "Sob consulta",
    period: "",
    popular: true,
    cta: "Falar com Consultor",
    features: [
      { text: "3 conexões WhatsApp", included: true },
      { text: "8 usuários", included: true },
      { text: "Tudo do Starter +", included: true },
      { text: "Departamentos e setores", included: true },
      { text: "Distribuição de leads", included: true },
      { text: "Gestão de grupos internos", included: true },
      { text: "Secretária IA nos grupos", included: true },
      { text: "Disparos em massa", included: true },
      { text: "Consulta IA no chat", included: true },
      { text: "Assinatura de documentos (30/mês)", included: true },
      { text: "Transferir para IA", included: false },
      { text: "Base de conhecimento IA", included: false },
    ],
    color: "border-primary ring-2 ring-primary/20",
  },
  {
    name: "Premium",
    description: "Para empresas que querem IA e automação total",
    price: "Sob consulta",
    period: "",
    popular: false,
    cta: "Falar com Consultor",
    features: [
      { text: "6 conexões WhatsApp", included: true },
      { text: "20 usuários", included: true },
      { text: "Tudo do Business +", included: true },
      { text: "IA comercial ilimitada", included: true },
      { text: "Transferir para IA", included: true },
      { text: "Base de conhecimento IA (RAG)", included: true },
      { text: "Múltiplos agentes especializados", included: true },
      { text: "Assistente de vendas IA", included: true },
      { text: "Resumos de conversas por IA", included: true },
      { text: "Assinatura de documentos ilimitada", included: true },
      { text: "Análise fantasma de conversas", included: true },
      { text: "Relatórios gerenciais", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    color: "border-border",
  },
  {
    name: "Enterprise",
    description: "Para grandes empresas e operações complexas",
    price: "Sob consulta",
    period: "",
    popular: false,
    cta: "Falar com Consultor",
    features: [
      { text: "WhatsApps ilimitados", included: true },
      { text: "Usuários ilimitados", included: true },
      { text: "Tudo do Premium +", included: true },
      { text: "Assinatura de documentos ilimitada", included: true },
      { text: "Análise fantasma de conversas", included: true },
      { text: "Onboarding dedicado", included: true },
      { text: "SLA garantido", included: true },
      { text: "Suporte 24/7", included: true },
      { text: "Multi-filiais", included: true },
    ],
    color: "border-border bg-gradient-to-br from-background to-muted/50",
  },
];

const stats = [
  { value: "100%", label: "Focado em resultados" },
  { value: "99.9%", label: "Uptime garantido" },
  { value: "24/7", label: "IA atendendo seus clientes" },
  { value: "<3s", label: "Tempo de resposta" },
];

const testimonials = [
  {
    name: "Ricardo Almeida",
    role: "Diretor Comercial - Tech Solutions",
    text: "Organizamos todo o WhatsApp da empresa. Cada vendedor atende seus leads sem confusão e a IA ajuda no fechamento.",
  },
  {
    name: "Camila Santos",
    role: "CEO - Santos Distribuidora",
    text: "Os lembretes automáticos e o chatbot de triagem mudaram nossa operação. Nunca mais perdemos um follow-up.",
  },
  {
    name: "Fernando Costa",
    role: "Gerente de Vendas - Costa Importações",
    text: "A distribuição automática de leads entre 15 vendedores e o CRM integrado ao WhatsApp ficou impecável.",
  },
];

export default function LandingPage() {
  const { branding } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("WhatsApp Organizado");

  const [showPreRegister, setShowPreRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
  });

  const handlePreRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.whatsapp.trim()) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    const phone = formData.whatsapp.replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Por favor, insira um WhatsApp válido");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/public/pre-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          whatsapp: phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao enviar cadastro");
      }

      toast.success("Cadastro recebido! Entraremos em contato em breve.");
      setShowPreRegister(false);
      setFormData({ name: "", email: "", whatsapp: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar cadastro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeFeatures = featureCategories.find(c => c.category === activeCategory)?.features || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left - Nav Links */}
            <div className="hidden md:flex items-center gap-6 flex-1">
              <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition">
                Funcionalidades
              </a>
              <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground transition">
                Planos
              </a>
              <a href="#depoimentos" className="text-sm text-muted-foreground hover:text-foreground transition">
                Depoimentos
              </a>
            </div>

            {/* Center - Logo */}
            <div className="flex items-center justify-center gap-2">
              <img src={branding.logo_topbar || gleegoLogo} alt={branding.company_name || "Glee-go Whats"} className="h-10 w-10 object-contain" />
              <span className="font-bold text-lg">{branding.company_name || "Glee-go Whats"}</span>
            </div>

            {/* Right - Buttons */}
            <div className="hidden md:flex items-center gap-4 flex-1 justify-end">
              <Link to="/login">
                <Button variant="ghost" size="sm">Entrar</Button>
              </Link>
              <Button size="sm" className="gap-2" onClick={() => setShowPreRegister(true)}>
                Testar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t">
              <div className="flex flex-col gap-4">
                <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Funcionalidades</a>
                <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Planos</a>
                <a href="#depoimentos" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Depoimentos</a>
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" className="w-full">Entrar</Button>
                  </Link>
                  <Button className="flex-1" onClick={() => { setMobileMenuOpen(false); setShowPreRegister(true); }}>Testar Grátis</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 px-4 py-1.5" variant="secondary">
              <Building2 className="h-3 w-3 mr-1" />
              Plataforma completa para empresas
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Organize seu{" "}
              <span className="bg-gradient-to-r from-[hsl(217,75%,55%)] via-[hsl(152,55%,48%)] to-[hsl(24,92%,55%)] bg-clip-text text-transparent">WhatsApp comercial</span>{" "}
              com CRM e IA{" "}
              <span className="bg-gradient-to-r from-[hsl(24,92%,55%)] via-[hsl(340,70%,55%)] to-[hsl(217,75%,55%)] bg-clip-text text-transparent">inteligente</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Centralize conversas, gerencie seu funil de vendas, transfira atendimentos para agentes de IA,
              organize sua equipe comercial e use inteligência artificial com base de conhecimento da sua empresa.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="gap-2 px-8 h-12 text-base w-full sm:w-auto"
                onClick={() => setShowPreRegister(true)}
              >
                Testar 7 Dias Grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
              <a href="#funcionalidades">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 px-8 h-12 text-base w-full sm:w-auto"
                >
                  Conhecer Funcionalidades
                </Button>
              </a>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Sem cartão de crédito • Para qualquer segmento • Suporte especializado
            </p>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-4">
                <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs md:text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Hero Image */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border shadow-2xl bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center text-xs text-muted-foreground">
                  {branding.company_name || "Glee-go Whats"} — Gestão Comercial Inteligente
                </div>
              </div>
              <img src={heroImage} alt="Plataforma de gestão comercial com WhatsApp e CRM integrado" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Dores Section */}
      <ScrollReveal><section className="py-20 px-4 sm:px-6 lg:px-8 border-y bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-destructive bg-destructive/10 border-destructive/20">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Você se identifica?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              As dores que <span className="text-destructive">travam</span> o crescimento da sua empresa
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Se sua equipe comercial sofre com algum desses problemas, você está perdendo dinheiro todos os dias.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "WhatsApp caótico", desc: "Conversas misturadas, clientes sem resposta, vendedores usando celular pessoal. Impossível saber quem atendeu quem." },
              { icon: Clock, title: "Leads esfriando", desc: "Ninguém lembra de retornar. O cliente que pediu orçamento ontem já comprou do concorrente." },
              { icon: FolderOpen, title: "Pipeline invisível", desc: "Ninguém sabe quantas negociações estão abertas, em que fase estão ou quando vão fechar." },
              { icon: Users, title: "Equipe desalinhada", desc: "Dois vendedores atendem o mesmo lead. Outro lead fica sem resposta. Sem distribuição justa." },
              { icon: Brain, title: "Sem padrão de atendimento", desc: "Cada vendedor responde de um jeito. Sem scripts, sem propostas padronizadas, sem controle de qualidade." },
              { icon: Shield, title: "Zero visibilidade gerencial", desc: "Gestor não sabe o volume de conversas, tempo de resposta nem taxa de conversão da equipe." },
            ].map((item, i) => (
              <div key={i} className="group p-5 rounded-xl bg-background border border-destructive/20 hover:border-destructive/40 transition-all hover:shadow-lg">
                <div className="w-11 h-11 rounded-lg bg-destructive/10 flex items-center justify-center mb-3">
                  <item.icon className="h-5 w-5 text-destructive" />
                </div>
                <h4 className="font-semibold mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section></ScrollReveal>

      {/* Gatilhos / Urgência Section */}
      <ScrollReveal><section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 px-3 py-1">
              <Zap className="h-3 w-3 mr-1" />
              Por que agir agora?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Cada dia sem organização é{" "}
              <span className="bg-gradient-to-r from-[hsl(24,92%,55%)] to-[hsl(340,70%,55%)] bg-clip-text text-transparent">
                dinheiro perdido
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                emoji: "💸",
                trigger: "Você perde 30% dos leads por demora na resposta",
                detail: "Pesquisas mostram que responder em até 5 minutos aumenta 21x a chance de conversão. Quanto tempo seu time demora?",
              },
              {
                emoji: "📉",
                trigger: "Seu concorrente já automatizou o atendimento",
                detail: "Enquanto sua equipe responde manualmente, empresas do seu mercado já usam IA para qualificar e atender 24h.",
              },
              {
                emoji: "🔥",
                trigger: "Sua equipe trabalha mais, mas vende menos",
                detail: "Sem processo, sem CRM e sem automação, seus vendedores gastam 60% do tempo em tarefas operacionais.",
              },
              {
                emoji: "⏰",
                trigger: "Crescer sem controle é receita para o caos",
                detail: "Mais vendedores sem sistema = mais confusão. A hora de organizar é antes de escalar, não depois.",
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <span className="text-3xl shrink-0">{item.emoji}</span>
                <div>
                  <h4 className="font-bold text-lg mb-2">{item.trigger}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button size="lg" className="gap-2 px-8 h-12 text-base" onClick={() => setShowPreRegister(true)}>
              Quero parar de perder vendas
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section></ScrollReveal>

      {/* Como Resolvemos Section */}
      <ScrollReveal><section className="py-20 px-4 sm:px-6 lg:px-8 border-y bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-primary bg-primary/10 border-primary/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              A solução
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Como o{" "}
              <span className="bg-gradient-to-r from-[hsl(217,75%,55%)] via-[hsl(152,55%,48%)] to-[hsl(24,92%,55%)] bg-clip-text text-transparent">
                Glee-go Whats
              </span>{" "}
              resolve cada problema
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Cada dor da sua operação tem uma funcionalidade específica para resolver. Veja o antes e depois:
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                pain: "WhatsApp caótico",
                solution: "Chat centralizado com multi-atendentes",
                desc: "Todas as conversas em um painel único. Cada vendedor vê apenas seus clientes, com filas organizadas e transferências entre departamentos.",
                icon: MessageSquare,
              },
              {
                pain: "Leads esfriando sem retorno",
                solution: "Lembretes + Follow-up automático",
                desc: "Crie lembretes para cada cliente. Configure sequências automáticas de acompanhamento para leads que não responderam. Nunca mais esqueça um follow-up.",
                icon: Bell,
              },
              {
                pain: "Pipeline invisível",
                solution: "CRM Kanban integrado ao WhatsApp",
                desc: "Veja todas as negociações em um quadro visual por etapa. Arraste cards entre colunas, adicione tarefas e acompanhe o valor total do funil em tempo real.",
                icon: FolderOpen,
              },
              {
                pain: "Equipe desalinhada",
                solution: "Distribuição automática de leads",
                desc: "Novos leads são distribuídos automaticamente entre vendedores por rodízio, área ou regra personalizada. Fim do conflito e dos leads perdidos.",
                icon: UserCheck,
              },
              {
                pain: "Sem padrão de atendimento",
                solution: "IA comercial com base de conhecimento",
                desc: "Alimente a IA com catálogos e manuais da empresa. Ela sugere respostas, cria propostas e ajuda no fechamento usando informações reais do seu negócio.",
                icon: Brain,
              },
              {
                pain: "Atendimento fora do horário",
                solution: "Agentes IA atendem 24h por você",
                desc: "Transfira conversas para agentes IA especializados que atendem, qualificam e agendam reuniões automaticamente — mesmo de madrugada.",
                icon: Bot,
              },
            ].map((item, i) => (
              <div key={i} className="flex flex-col md:flex-row items-start gap-4 p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-destructive bg-destructive/10 px-2.5 py-0.5 rounded-full">
                      ❌ {item.pain}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      ✅ {item.solution}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" variant="outline" className="gap-2 px-8 h-12 text-base" onClick={() => setShowPreRegister(true)}>
              <Sparkles className="h-5 w-5" />
              Quero essa solução para minha empresa
            </Button>
          </div>
        </div>
      </section></ScrollReveal>

      {/* Features Section */}
      <ScrollReveal><section id="funcionalidades" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">+30 Funcionalidades</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tudo que sua empresa precisa no WhatsApp
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Da organização de conversas à IA com base de conhecimento, CRM integrado, transferência para agentes inteligentes e automação comercial.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {featureCategories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeCategory === cat.category
                    ? `${cat.bgColor} ${cat.color} ring-2 ring-current/20`
                    : "bg-muted border text-muted-foreground hover:text-foreground"
                )}
              >
                <cat.icon className="h-4 w-4" />
                {cat.category}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeFeatures.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-background">
                <CardContent className="p-5">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                    featureCategories.find(c => c.category === activeCategory)?.bgColor
                  )}>
                    <feature.icon className={cn(
                      "h-5 w-5",
                      featureCategories.find(c => c.category === activeCategory)?.color
                    )} />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Grid */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {featureCategories.map((cat, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", cat.bgColor)}>
                  <cat.icon className={cn("h-5 w-5", cat.color)} />
                </div>
                <div>
                  <h4 className="font-medium mb-1">{cat.category}</h4>
                  <p className="text-sm text-muted-foreground">
                    {cat.features.map(f => f.title).join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section></ScrollReveal>

      {/* Testimonials */}
      <ScrollReveal><section id="depoimentos" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-background">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section></ScrollReveal>

      {/* Pricing */}
      <ScrollReveal><section id="precos" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Planos pensados para sua empresa crescer
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece pequeno e escale conforme sua operação cresce. Teste grátis por 7 dias.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={cn("relative flex flex-col", plan.color)}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 px-3 py-1">
                      <Star className="h-3 w-3 fill-current" />
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? "" : "text-muted-foreground/60"}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setShowPreRegister(true)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section></ScrollReveal>

      {/* Trust Section */}
      <ScrollReveal><section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-12">
            Por que empresas confiam na nossa plataforma?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <Shield className="h-8 w-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Segurança Total</h3>
              <p className="text-sm text-muted-foreground">Criptografia ponta a ponta e conformidade com LGPD</p>
            </Card>
            <Card className="p-6">
              <TrendingUp className="h-8 w-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Foco em Resultados</h3>
              <p className="text-sm text-muted-foreground">CRM e métricas para aumentar suas vendas e conversões</p>
            </Card>
            <Card className="p-6">
              <Headphones className="h-8 w-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Suporte Dedicado</h3>
              <p className="text-sm text-muted-foreground">Equipe que entende as necessidades do seu negócio</p>
            </Card>
            <Card className="p-6">
              <Zap className="h-8 w-8 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Setup Personalizado</h3>
              <p className="text-sm text-muted-foreground">Configuração sob medida para a realidade da sua empresa</p>
            </Card>
          </div>
        </div>
      </section></ScrollReveal>

      {/* FAQ Section */}
      <ScrollReveal><section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Perguntas frequentes
            </h2>
            <p className="text-muted-foreground">
              Tire suas dúvidas antes de começar
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "Preciso trocar meu número de WhatsApp?",
                a: "Não. Você conecta o WhatsApp que já usa na empresa. A plataforma funciona em paralelo ao app do celular sem interferir.",
              },
              {
                q: "Quantos atendentes podem usar ao mesmo tempo?",
                a: "Depende do plano. No Starter são 2 usuários, Business até 8, Premium até 20 e no Enterprise é ilimitado. Todos acessam simultaneamente.",
              },
              {
                q: "A IA responde sozinha para os clientes?",
                a: "Sim, se você quiser. Você pode configurar agentes IA especializados que atendem automaticamente usando a base de conhecimento da sua empresa. Mas o controle é sempre seu — pode ativar/desativar a qualquer momento.",
              },
              {
                q: "Meus dados e conversas ficam seguros?",
                a: "Sim. Utilizamos criptografia, servidores seguros e somos compatíveis com a LGPD. Seus dados nunca são compartilhados com terceiros.",
              },
              {
                q: "Funciona no celular?",
                a: "Sim. A plataforma é responsiva e funciona em qualquer navegador, tanto no computador quanto no celular ou tablet.",
              },
              {
                q: "Consigo enviar mensagens em massa?",
                a: "Sim. Você pode criar campanhas de disparos em massa para toda sua base de contatos ou segmentos específicos com tags.",
              },
              {
                q: "Como funciona o período de teste?",
                a: "Você testa por 7 dias com todas as funcionalidades do plano escolhido, sem precisar de cartão de crédito. Nossa equipe ajuda na configuração.",
              },
              {
                q: "Posso integrar com outros sistemas?",
                a: "Sim. Oferecemos webhooks, API e integrações com ferramentas como Google Calendar, sistemas de cobrança e formulários externos.",
              },
            ].map((item, i) => (
              <details key={i} className="group border rounded-xl bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-5 font-medium text-sm sm:text-base list-none">
                  {item.q}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0 ml-4" />
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t pt-4">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section></ScrollReveal>

      {/* Final CTA */}
      <ScrollReveal><section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Pronto para escalar suas vendas?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Comece agora e descubra como a IA e o CRM podem transformar o comercial da sua empresa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 px-8 h-12 text-base w-full sm:w-auto"
              onClick={() => setShowPreRegister(true)}
            >
              Começar Teste Grátis
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Link to="/login">
              <Button size="lg" variant="ghost" className="gap-2 px-8 h-12 text-base w-full sm:w-auto border-2 border-white/40 text-white hover:bg-white/10 hover:text-white">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section></ScrollReveal>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              {branding.logo_topbar ? (
                <img src={branding.logo_topbar} alt={branding.company_name || "Logo"} className="h-8 object-contain" />
              ) : (
                <>
                  <img src={gleegoLogo} alt="Glee-go Whats" className="h-8 w-8 object-contain" />
                  <span className="font-semibold text-lg">{branding.company_name || "Glee-go Whats"}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/politica-privacidade" className="hover:text-foreground transition">Política de Privacidade</Link>
              <a href="#funcionalidades" className="hover:text-foreground transition">Funcionalidades</a>
              <a href="#precos" className="hover:text-foreground transition">Planos</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>CNPJ: 04.609.030/0001-29</span>
            </div>
            <span>© {new Date().getFullYear()} {branding.company_name || "Glee-go Whats"}. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>

      {/* Pre-registration Dialog */}
      <Dialog open={showPreRegister} onOpenChange={setShowPreRegister}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Teste Grátis por 7 Dias
            </DialogTitle>
            <DialogDescription>
              Preencha seus dados e nossa equipe entrará em contato para ativar seu acesso.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePreRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Dr(a). Nome Sobrenome"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail profissional</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@escritorio.com.br"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(11) 99999-9999"
                value={formData.whatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Solicitar Acesso
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
