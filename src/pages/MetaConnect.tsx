import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Facebook, Instagram, Phone, Wrench, CheckCircle2, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";

const META_SAAS_ENABLED = import.meta.env.VITE_META_SAAS_ENABLED === "true";

const previewSteps = [
  {
    icon: Facebook,
    title: "1. Clique em conectar",
    body: "Você será redirecionado ao login oficial do Facebook. Use a conta que administra sua Página, Instagram Business e/ou WhatsApp Business.",
  },
  {
    icon: ArrowRight,
    title: "2. Escolha o que deseja conectar",
    body: "Selecione sua Página do Facebook, conta Instagram Business e/ou número WhatsApp Business. Tudo na mesma tela.",
  },
  {
    icon: CheckCircle2,
    title: "3. Pronto — sua conta está integrada",
    body: "A Gleego cuida do resto: webhook, renovação de token e roteamento de mensagens. Você já pode atender pelo painel.",
  },
];

export default function MetaConnect() {
  const { user } = useAuth();
  const [starting, setStarting] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string>("");

  useEffect(() => {
    const orgId = user?.organization_id || sessionStorage.getItem("user_org_id") || "";
    setCurrentOrgId(orgId);
  }, [user]);

  const startOAuth = async (provider: "facebook" | "instagram" | "whatsapp") => {
    if (!currentOrgId) {
      toast.error("Selecione uma organização antes de conectar.");
      return;
    }
    if (!META_SAAS_ENABLED) {
      toast.info("A conexão simplificada ainda está em desenvolvimento.");
      return;
    }

    setStarting(provider);
    try {
      const data = await api<{ url: string }>("/api/meta/oauth/start", {
        method: "POST",
        body: {
          provider,
          organization_id: currentOrgId,
          redirect_uri: `${window.location.origin}/api/meta/oauth/callback`,
        },
      });
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar conexão");
    } finally {
      setStarting(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto max-w-4xl py-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Facebook className="h-6 w-6 text-primary" />
            Conectar Meta
          </h1>
          <p className="text-muted-foreground">
            Integre Página do Facebook, Instagram Business e WhatsApp Business à Gleego em poucos cliques.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-primary" />
              Conexão simplificada
              <Badge variant="secondary">Em desenvolvimento</Badge>
            </CardTitle>
            <CardDescription>
              Em breve você poderá conectar suas contas Meta diretamente por aqui, sem precisar criar App ou copiar tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {previewSteps.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm flex gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Enquanto isso não é liberado</p>
                <p className="text-muted-foreground">
                  Fale com o suporte da Gleego para que sua conta Meta seja ativada manualmente. Seu fluxo atual continua funcionando normalmente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {META_SAAS_ENABLED && (
          <Tabs defaultValue="whatsapp" className="space-y-4">
            <TabsList>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="facebook">Facebook / Messenger</TabsTrigger>
              <TabsTrigger value="instagram">Instagram</TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp">
              <ConnectCard
                icon={Phone}
                title="WhatsApp Business"
                description="Conecte seu número WhatsApp Business Cloud API."
                onConnect={() => startOAuth("whatsapp")}
                loading={starting === "whatsapp"}
              />
            </TabsContent>
            <TabsContent value="facebook">
              <ConnectCard
                icon={Facebook}
                title="Página do Facebook"
                description="Conecte sua Página para receber mensagens do Messenger."
                onConnect={() => startOAuth("facebook")}
                loading={starting === "facebook"}
              />
            </TabsContent>
            <TabsContent value="instagram">
              <ConnectCard
                icon={Instagram}
                title="Instagram Business"
                description="Conecte sua conta Instagram Business para receber DMs."
                onConnect={() => startOAuth("instagram")}
                loading={starting === "instagram"}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

function ConnectCard({
  icon: Icon,
  title,
  description,
  onConnect,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onConnect: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onConnect} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          Conectar com Facebook
        </Button>
      </CardContent>
    </Card>
  );
}
