import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { Plug, QrCode, RefreshCw, Settings2 } from "lucide-react";

const Conexao = () => {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simular conexão
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsConnecting(false);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground">Conexão</h1>
          <p className="mt-1 text-muted-foreground">
            Configure sua conexão com a Evolution API
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Connection Form */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Configuração da API
              </CardTitle>
              <CardDescription>
                Insira as credenciais da sua Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">URL da API</Label>
                <Input
                  id="apiUrl"
                  placeholder="https://sua-api.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Sua chave de API"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="minha-instancia"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleConnect}
                className="w-full"
                variant="gradient"
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Plug className="h-4 w-4" />
                    Conectar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* QR Code Area */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                QR Code
              </CardTitle>
              <CardDescription>
                Escaneie o QR Code com seu WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex h-64 w-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
                  <div className="text-center">
                    <QrCode className="mx-auto h-16 w-16 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      Configure a API para gerar o QR Code
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="mt-4">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connection Status */}
        <div className="animate-fade-in">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Status da Conexão
          </h2>
          <ConnectionStatus
            status="disconnected"
            instanceName={instanceName || "Não configurado"}
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default Conexao;
