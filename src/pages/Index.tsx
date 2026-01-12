import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { Users, MessageSquare, Send, CheckCircle2 } from "lucide-react";

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Visão geral do seu sistema de disparo de mensagens
          </p>
        </div>

        {/* Connection Status */}
        <ConnectionStatus
          status="connected"
          instanceName="minha-instancia"
          phoneNumber="+55 11 99999-9999"
        />

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total de Contatos"
            value="2.458"
            description="Em todas as listas"
            icon={<Users className="h-6 w-6 text-primary" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Mensagens Enviadas"
            value="15.234"
            description="Este mês"
            icon={<Send className="h-6 w-6 text-primary" />}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Campanhas Ativas"
            value="3"
            description="Em execução agora"
            icon={<MessageSquare className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Taxa de Entrega"
            value="98.5%"
            description="Média geral"
            icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
            trend={{ value: 2, isPositive: true }}
          />
        </div>

        {/* Recent Campaigns */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentCampaigns />
          
          {/* Quick Actions */}
          <div className="rounded-xl bg-card p-6 shadow-card border border-border animate-fade-in">
            <h3 className="mb-6 text-lg font-semibold text-foreground">
              Ações Rápidas
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href="/contatos"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Importar Contatos
                </span>
              </a>
              <a
                href="/mensagens"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Criar Mensagem
                </span>
              </a>
              <a
                href="/campanhas"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent sm:col-span-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Nova Campanha
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
