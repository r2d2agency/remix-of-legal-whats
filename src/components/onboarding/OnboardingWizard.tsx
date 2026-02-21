import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  User, Wifi, Users, Briefcase, ChevronRight, ChevronLeft, 
  Check, Loader2, Sparkles, ExternalLink, Upload, Plus, 
  ArrowRight, Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: "welcome", title: "Boas-vindas", icon: Sparkles, description: "Vamos configurar seu sistema" },
  { id: "profile", title: "Perfil", icon: User, description: "Seus dados básicos" },
  { id: "whatsapp", title: "WhatsApp", icon: Wifi, description: "Conecte sua primeira instância" },
  { id: "contacts", title: "Contatos", icon: Users, description: "Importe sua base de contatos" },
  { id: "crm", title: "CRM", icon: Briefcase, description: "Configure seu funil de vendas" },
  { id: "done", title: "Pronto!", icon: Rocket, description: "Tudo configurado" },
];

export function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState(user?.name || "");

  // CRM state
  const [funnelName, setFunnelName] = useState("Funil de Vendas");
  const [funnelStages, setFunnelStages] = useState(["Novo Lead", "Qualificação", "Proposta", "Negociação", "Fechamento"]);
  const [newStageName, setNewStageName] = useState("");

  const totalSteps = STEPS.length;
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);
  const step = STEPS[currentStep];

  const next = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
  const prev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Preencha seu nome");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/profile", { method: "PATCH", body: { name: displayName.trim() }, auth: true });
      await refreshUser();
      toast.success("Perfil atualizado!");
      next();
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFunnel = async () => {
    if (!funnelName.trim() || funnelStages.length < 2) {
      toast.error("Nome do funil e ao menos 2 etapas são necessários");
      return;
    }
    setLoading(true);
    try {
      await api("/api/crm/funnels", {
        method: "POST",
        body: {
          name: funnelName.trim(),
          stages: funnelStages.map((name, i) => ({
            name,
            position: i,
            is_final: i === funnelStages.length - 1,
          })),
        },
        auth: true,
      });
      toast.success("Funil criado com sucesso!");
      next();
    } catch {
      toast.error("Erro ao criar funil. Talvez já exista um com esse nome.");
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => {
    if (newStageName.trim() && !funnelStages.includes(newStageName.trim())) {
      setFunnelStages(prev => [...prev, newStageName.trim()]);
      setNewStageName("");
    }
  };

  const removeStage = (index: number) => {
    if (funnelStages.length > 2) {
      setFunnelStages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const renderStepContent = () => {
    switch (step.id) {
      case "welcome":
        return (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Bem-vindo ao Glee-go Whats!</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Vamos configurar tudo para você começar a usar o sistema. São apenas alguns passos rápidos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
              {STEPS.slice(1, -1).map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-xs text-foreground">{s.title}</span>
                  </div>
                );
              })}
            </div>
            <Button onClick={next} size="lg" className="gap-2">
              Começar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        );

      case "profile":
        return (
          <div className="space-y-6 py-2">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Configure seu perfil</h2>
              <p className="text-sm text-muted-foreground mt-1">Como você quer ser identificado no sistema?</p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="space-y-2">
                <Label>Nome de exibição</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="text-center text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={user?.email || ""} disabled className="text-center bg-muted" />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button onClick={handleUpdateProfile} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar e Continuar
              </Button>
            </div>
          </div>
        );

      case "whatsapp":
        return (
          <div className="space-y-6 py-2">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Conecte seu WhatsApp</h2>
              <p className="text-sm text-muted-foreground mt-1">Vincule uma instância para começar a atender</p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center space-y-3">
                <Wifi className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Acesse a página de Conexões para configurar sua instância do WhatsApp
                </p>
                <Button variant="outline" className="gap-2" onClick={() => { onClose(); navigate("/conexao"); }}>
                  <ExternalLink className="h-4 w-4" />
                  Ir para Conexões
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Você pode pular este passo e configurar depois.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button onClick={next} variant="outline" className="gap-2">
                Pular <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "contacts":
        return (
          <div className="space-y-6 py-2">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Importe seus contatos</h2>
              <p className="text-sm text-muted-foreground mt-1">Traga sua base de contatos para o sistema</p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center space-y-3">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Importe contatos via Excel/CSV na página de Contatos
                </p>
                <Button variant="outline" className="gap-2" onClick={() => { onClose(); navigate("/contatos"); }}>
                  <ExternalLink className="h-4 w-4" />
                  Ir para Contatos
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Você pode pular e importar contatos quando quiser.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button onClick={next} variant="outline" className="gap-2">
                Pular <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "crm":
        return (
          <div className="space-y-5 py-2">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Configure seu CRM</h2>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro funil de vendas</p>
            </div>
            <div className="max-w-md mx-auto space-y-4">
              <div className="space-y-2">
                <Label>Nome do funil</Label>
                <Input
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  placeholder="Ex: Funil de Vendas"
                />
              </div>
              <div className="space-y-2">
                <Label>Etapas</Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {funnelStages.map((stage, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <Badge variant="secondary" className="text-[10px] w-5 h-5 flex items-center justify-center p-0">{i + 1}</Badge>
                      <span className="text-sm flex-1">{stage}</span>
                      {funnelStages.length > 2 && (
                        <button onClick={() => removeStage(i)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="Nova etapa..."
                    className="text-sm"
                    onKeyDown={(e) => e.key === "Enter" && addStage()}
                  />
                  <Button variant="outline" size="icon" onClick={addStage} disabled={!newStageName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <div className="flex gap-2">
                <Button onClick={next} variant="outline">Pular</Button>
                <Button onClick={handleCreateFunnel} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Criar Funil
                </Button>
              </div>
            </div>
          </div>
        );

      case "done":
        return (
          <div className="text-center space-y-6 py-6">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Rocket className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Tudo pronto!</h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Seu sistema está configurado. Explore as funcionalidades e comece a usar!
              </p>
            </div>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => { onClose(); navigate("/chat"); }} className="gap-2">
                <Wifi className="h-4 w-4" /> Ir para o Chat
              </Button>
              <Button variant="outline" onClick={() => { onClose(); navigate("/dashboard"); }} className="gap-2">
                <Sparkles className="h-4 w-4" /> Ir para o Dashboard
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Wizard de Onboarding</DialogTitle>
        
        {/* Progress header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                      isActive && "bg-primary text-primary-foreground scale-110",
                      isDone && "bg-success/20 text-success",
                      !isActive && !isDone && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">{currentStep + 1}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[320px] flex flex-col justify-center">
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
