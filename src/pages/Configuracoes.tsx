import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Database, Save } from "lucide-react";

const Configuracoes = () => {
  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* General Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Ajustes básicos do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar tema escuro na interface
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-refresh</Label>
                  <p className="text-sm text-muted-foreground">
                    Atualizar dados automaticamente
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure alertas e notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Campanha Concluída</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando uma campanha terminar
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Erros de Envio</Label>
                  <p className="text-sm text-muted-foreground">
                    Alertar sobre falhas de entrega
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Conexão Perdida</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar se a conexão cair
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança
              </CardTitle>
              <CardDescription>
                Proteções para sua conta WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxMessagesDay">Limite diário de mensagens</Label>
                <Input
                  id="maxMessagesDay"
                  type="number"
                  defaultValue="500"
                  placeholder="Ex: 500"
                />
                <p className="text-xs text-muted-foreground">
                  Número máximo de mensagens por dia para evitar bloqueio
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minPause">Pausa mínima entre mensagens (seg)</Label>
                <Input
                  id="minPause"
                  type="number"
                  defaultValue="30"
                  placeholder="Ex: 30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPause">Pausa máxima entre mensagens (seg)</Label>
                <Input
                  id="maxPause"
                  type="number"
                  defaultValue="120"
                  placeholder="Ex: 120"
                />
              </div>
            </CardContent>
          </Card>

          {/* Database Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Banco de Dados
              </CardTitle>
              <CardDescription>
                Configuração do PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dbHost">Host</Label>
                <Input
                  id="dbHost"
                  placeholder="localhost"
                  defaultValue="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbPort">Porta</Label>
                <Input
                  id="dbPort"
                  placeholder="5432"
                  defaultValue="5432"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbName">Nome do Banco</Label>
                <Input
                  id="dbName"
                  placeholder="zapflow"
                  defaultValue="zapflow"
                />
              </div>
              <Button variant="outline" className="w-full">
                Testar Conexão
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="gradient" size="lg">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
