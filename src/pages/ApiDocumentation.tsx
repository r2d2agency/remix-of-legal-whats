import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useLeadWebhooks, useLeadWebhookMutations, useWebhookLogs, getWebhookUrl, LeadWebhook } from "@/hooks/use-lead-webhooks";
import { useCRMFunnels } from "@/hooks/use-crm";
import { toast } from "sonner";
import {
  BookOpen,
  Code,
  Copy,
  Key,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Webhook,
  ArrowRight,
  Terminal,
  FileJson,
  Shield,
  Zap,
  Activity,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function CodeBlock({ language, code, title }: { language: string; code: string; title?: string }) {
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  return (
    <div className="rounded-lg border border-border bg-muted/50 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Button variant="ghost" size="sm" onClick={copyCode} className="h-6 px-2">
            <Copy className="h-3 w-3 mr-1" />
            Copiar
          </Button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-foreground">{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocumentation() {
  const { isAuthenticated } = useAuth();
  const { data: webhooks = [], isLoading } = useLeadWebhooks();
  const { data: funnels = [] } = useCRMFunnels();
  const { createWebhook, deleteWebhook, regenerateToken } = useLeadWebhookMutations();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [newToken, setNewToken] = useState({
    name: "",
    description: "",
    funnel_id: "",
    stage_id: "",
  });

  const selectedFunnel = funnels.find((f: any) => f.id === newToken.funnel_id);
  const stages = selectedFunnel?.stages || [];

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateToken = async () => {
    if (!newToken.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      await createWebhook.mutateAsync({
        name: newToken.name,
        description: newToken.description,
        funnel_id: newToken.funnel_id || undefined,
        stage_id: newToken.stage_id || undefined,
      });
      setShowCreateDialog(false);
      setNewToken({ name: "", description: "", funnel_id: "", stage_id: "" });
    } catch {}
  };

  const handleCopyUrl = (token: string) => {
    navigator.clipboard.writeText(getWebhookUrl(token));
    toast.success("URL copiada!");
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const handleRegenerateToken = async (id: string) => {
    if (!confirm("Regenerar o token invalidará o anterior. Continuar?")) return;
    try {
      await regenerateToken.mutateAsync(id);
    } catch {}
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm("Excluir este token API? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteWebhook.mutateAsync(id);
    } catch {}
  };

  const samplePayload = `{
  "name": "João Silva",
  "phone": "5511999999999",
  "email": "joao@empresa.com",
  "company": "Empresa ABC",
  "value": 5000,
  "description": "Lead interessado no plano premium"
}`;

  const curlExample = (token: string) =>
    `curl -X POST "${getWebhookUrl(token)}" \\
  -H "Content-Type: application/json" \\
  -d '${samplePayload}'`;

  const jsExample = (token: string) =>
    `fetch("${getWebhookUrl(token)}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "João Silva",
    phone: "5511999999999",
    email: "joao@empresa.com",
    company: "Empresa ABC",
    value: 5000
  })
})
.then(res => res.json())
.then(data => console.log("Lead criado:", data))
.catch(err => console.error("Erro:", err));`;

  const phpExample = (token: string) =>
    `<?php
$url = "${getWebhookUrl(token)}";
$data = [
    "name" => "João Silva",
    "phone" => "5511999999999",
    "email" => "joao@empresa.com",
    "company" => "Empresa ABC",
    "value" => 5000
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`;

  const pythonExample = (token: string) =>
    `import requests

url = "${getWebhookUrl(token)}"
payload = {
    "name": "João Silva",
    "phone": "5511999999999",
    "email": "joao@empresa.com",
    "company": "Empresa ABC",
    "value": 5000
}

response = requests.post(url, json=payload)
print(response.json())`;

  const firstWebhook = webhooks[0];
  const exampleToken = firstWebhook?.webhook_token || "SEU_TOKEN_AQUI";

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              API de Integração
            </h1>
            <p className="text-muted-foreground mt-1">
              Documentação e tokens para integrar sistemas externos ao seu CRM
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Gerar Novo Token
          </Button>
        </div>

        <Tabs defaultValue="tokens" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tokens" className="gap-2">
              <Key className="h-4 w-4" />
              Tokens API
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Documentação
            </TabsTrigger>
            <TabsTrigger value="examples" className="gap-2">
              <Code className="h-4 w-4" />
              Exemplos
            </TabsTrigger>
          </TabsList>

          {/* ========== TOKENS TAB ========== */}
          <TabsContent value="tokens" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Seus Tokens API</CardTitle>
                <CardDescription>
                  Cada token permite que um sistema externo envie leads diretamente para o seu CRM.
                  Cada token pode ser direcionado para um funil e etapa específicos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <Key className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="text-foreground font-medium">Nenhum token criado</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Crie seu primeiro token para começar a receber leads via API
                      </p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Primeiro Token
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((wh) => (
                      <Card key={wh.id} className="border border-border">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">{wh.name}</h3>
                                <Badge variant={wh.is_active ? "default" : "secondary"}>
                                  {wh.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>

                              {wh.description && (
                                <p className="text-sm text-muted-foreground">{wh.description}</p>
                              )}

                              {/* Token display */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground shrink-0">Token:</Label>
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                  {visibleTokens.has(wh.id) ? wh.webhook_token : "••••••••••••••••"}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleTokenVisibility(wh.id)}
                                >
                                  {visibleTokens.has(wh.id) ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleCopyToken(wh.webhook_token)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* URL */}
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground shrink-0">URL:</Label>
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[400px]">
                                  {getWebhookUrl(wh.webhook_token)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleCopyUrl(wh.webhook_token)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Meta info */}
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {wh.funnel_name && (
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" />
                                    {wh.funnel_name} {wh.stage_name && `→ ${wh.stage_name}`}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {wh.total_leads} leads recebidos
                                </span>
                                {wh.last_lead_at && (
                                  <span>
                                    Último: {formatDistanceToNow(new Date(wh.last_lead_at), { addSuffix: true, locale: ptBR })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWebhookId(wh.id);
                                  setShowLogsDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Activity className="h-3 w-3" />
                                Logs
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRegenerateToken(wh.id)}
                                className="gap-1"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Regenerar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteToken(wh.id)}
                                className="gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== DOCS TAB ========== */}
          <TabsContent value="docs" className="space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Visão Geral
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  A API de integração permite que qualquer sistema externo (landing pages, formulários, CRMs, ERPs, etc.)
                  envie leads automaticamente para o seu CRM através de uma simples requisição HTTP POST.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border border-border">
                    <CardContent className="p-4 text-center space-y-2">
                      <Key className="h-8 w-8 mx-auto text-primary" />
                      <h4 className="font-medium text-foreground">1. Gere um Token</h4>
                      <p className="text-xs text-muted-foreground">
                        Crie um token API na aba "Tokens" e direcione para um funil
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-border">
                    <CardContent className="p-4 text-center space-y-2">
                      <Terminal className="h-8 w-8 mx-auto text-primary" />
                      <h4 className="font-medium text-foreground">2. Envie um POST</h4>
                      <p className="text-xs text-muted-foreground">
                        Faça uma requisição POST com os dados do lead no corpo JSON
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-border">
                    <CardContent className="p-4 text-center space-y-2">
                      <CheckCircle className="h-8 w-8 mx-auto text-primary" />
                      <h4 className="font-medium text-foreground">3. Lead Criado</h4>
                      <p className="text-xs text-muted-foreground">
                        O lead é criado automaticamente no funil/etapa configurados
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Endpoint */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  Endpoint
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white">POST</Badge>
                  <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono text-foreground">
                    {getWebhookUrl("{TOKEN}")}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Substitua <code className="bg-muted px-1 rounded">{"{TOKEN}"}</code> pelo token gerado na aba "Tokens API".
                </p>
              </CardContent>
            </Card>

            {/* Request Body */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-primary" />
                  Corpo da Requisição (JSON)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Envie os dados do lead no corpo da requisição como JSON. Os campos são automaticamente
                  mapeados para o CRM.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Obrigatório</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { campo: "name", tipo: "string", obrigatorio: "Sim", desc: "Nome do lead / prospect" },
                      { campo: "phone", tipo: "string", obrigatorio: "Recomendado", desc: "Telefone com DDD (ex: 5511999999999)" },
                      { campo: "email", tipo: "string", obrigatorio: "Não", desc: "E-mail do lead" },
                      { campo: "company", tipo: "string", obrigatorio: "Não", desc: "Nome da empresa" },
                      { campo: "value", tipo: "number", obrigatorio: "Não", desc: "Valor estimado do negócio" },
                      { campo: "description", tipo: "string", obrigatorio: "Não", desc: "Descrição ou observações" },
                      { campo: "city", tipo: "string", obrigatorio: "Não", desc: "Cidade do lead" },
                      { campo: "state", tipo: "string", obrigatorio: "Não", desc: "Estado (UF)" },
                      { campo: "source", tipo: "string", obrigatorio: "Não", desc: "Origem do lead (ex: Google Ads, Facebook)" },
                      { campo: "custom_fields", tipo: "object", obrigatorio: "Não", desc: "Campos personalizados do CRM (JSON)" },
                    ].map((row) => (
                      <TableRow key={row.campo}>
                        <TableCell className="font-mono text-sm">{row.campo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.obrigatorio === "Sim" ? (
                            <Badge variant="destructive" className="text-xs">Sim</Badge>
                          ) : row.obrigatorio === "Recomendado" ? (
                            <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Não</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Separator />

                <div>
                  <h4 className="font-medium text-foreground mb-2">Exemplo de Payload</h4>
                  <CodeBlock language="json" code={samplePayload} title="request.json" />
                </div>
              </CardContent>
            </Card>

            {/* Response */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Resposta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-600 text-white">200</Badge>
                      <span className="text-sm font-medium text-foreground">Sucesso</span>
                    </div>
                    <CodeBlock
                      language="json"
                      code={`{
  "success": true,
  "message": "Lead criado com sucesso",
  "deal_id": "uuid-do-negocio",
  "prospect_id": "uuid-do-prospect"
}`}
                      title="Resposta de sucesso"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">404</Badge>
                      <span className="text-sm font-medium text-foreground">Token inválido</span>
                    </div>
                    <CodeBlock
                      language="json"
                      code={`{
  "error": "Webhook não encontrado ou inativo"
}`}
                      title="Erro - Token não encontrado"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">500</Badge>
                      <span className="text-sm font-medium text-foreground">Erro interno</span>
                    </div>
                    <CodeBlock
                      language="json"
                      code={`{
  "error": "Erro ao processar lead",
  "details": "Mensagem de erro detalhada"
}`}
                      title="Erro interno"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Field Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Mapeamento Automático de Campos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  A API reconhece automaticamente campos com nomes comuns em diferentes idiomas e formatos.
                  Por exemplo:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { target: "name", aliases: "nome, full_name, nome_completo, first_name" },
                    { target: "phone", aliases: "telefone, celular, whatsapp, tel, mobile" },
                    { target: "email", aliases: "e-mail, correo, mail" },
                    { target: "company", aliases: "empresa, company_name, razao_social" },
                    { target: "value", aliases: "valor, amount, price, preco" },
                    { target: "city", aliases: "cidade, municipio" },
                  ].map((m) => (
                    <div key={m.target} className="flex items-start gap-2 bg-muted p-2 rounded">
                      <code className="font-mono text-xs text-primary shrink-0">{m.target}</code>
                      <ArrowRight className="h-3 w-3 mt-1 shrink-0" />
                      <span className="text-xs">{m.aliases}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs">
                  Além disso, você pode configurar mapeamentos personalizados na página de{" "}
                  <a href="/lead-webhooks" className="text-primary hover:underline">
                    Lead Webhooks
                  </a>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== EXAMPLES TAB ========== */}
          <TabsContent value="examples" className="space-y-6">
            {webhooks.length === 0 && (
              <Card className="border-dashed border-2 border-primary/30">
                <CardContent className="p-6 text-center space-y-2">
                  <AlertCircle className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-foreground font-medium">
                    Crie um token primeiro para ver exemplos com sua URL real
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)} variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Token
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>cURL</CardTitle>
                <CardDescription>Exemplo para terminal / linha de comando</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock language="bash" code={curlExample(exampleToken)} title="Terminal" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>JavaScript / Fetch</CardTitle>
                <CardDescription>Para landing pages, sites e aplicações web</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock language="javascript" code={jsExample(exampleToken)} title="script.js" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PHP</CardTitle>
                <CardDescription>Para sites WordPress, sistemas legados e APIs PHP</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock language="php" code={phpExample(exampleToken)} title="webhook.php" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Python</CardTitle>
                <CardDescription>Para scripts de automação e integrações</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock language="python" code={pythonExample(exampleToken)} title="send_lead.py" />
              </CardContent>
            </Card>

            {/* Integration Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Dicas de Integração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    title: "WordPress / Elementor",
                    desc: "Use o plugin 'WPWebhooks' ou adicione um script JS no evento de submit do formulário.",
                  },
                  {
                    title: "Google Forms",
                    desc: "Use o Google Apps Script para enviar um POST quando uma resposta for submetida.",
                  },
                  {
                    title: "Typeform",
                    desc: "Configure um webhook nas configurações do formulário apontando para sua URL de token.",
                  },
                  {
                    title: "Zapier / Make",
                    desc: "Use a ação 'Webhook' do Zapier ou módulo HTTP do Make para enviar os dados.",
                  },
                  {
                    title: "RD Station / HubSpot",
                    desc: "Configure webhooks de conversão apontando para sua URL com mapeamento de campos.",
                  },
                ].map((tip) => (
                  <div key={tip.title} className="flex gap-3 items-start">
                    <ExternalLink className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{tip.title}: </span>
                      <span className="text-muted-foreground text-sm">{tip.desc}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ========== CREATE TOKEN DIALOG ========== */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar Novo Token API</DialogTitle>
              <DialogDescription>
                Crie um token para receber leads de sistemas externos no seu CRM
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Formulário do Site, Landing Page Google Ads"
                  value={newToken.name}
                  onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  placeholder="Descrição opcional"
                  value={newToken.description}
                  onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Funil de Destino</Label>
                <Select
                  value={newToken.funnel_id}
                  onValueChange={(v) => setNewToken({ ...newToken, funnel_id: v, stage_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stages.length > 0 && (
                <div>
                  <Label>Etapa Inicial</Label>
                  <Select
                    value={newToken.stage_id}
                    onValueChange={(v) => setNewToken({ ...newToken, stage_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Primeira etapa do funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateToken} disabled={createWebhook.isPending} className="gap-2">
                {createWebhook.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Gerar Token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== LOGS DIALOG ========== */}
        <WebhookLogsPanel
          webhookId={selectedWebhookId}
          open={showLogsDialog}
          onOpenChange={setShowLogsDialog}
        />
      </div>
    </MainLayout>
  );
}

function WebhookLogsPanel({
  webhookId,
  open,
  onOpenChange,
}: {
  webhookId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: logs = [], isLoading } = useWebhookLogs(webhookId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Logs de Requisições</DialogTitle>
          <DialogDescription>Histórico de leads recebidos via API</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.response_status === 200 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {log.response_message}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{log.source_ip}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
