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
import { useLeadWebhooks, useLeadWebhookMutations, useWebhookLogs, useWebhookDistribution, getWebhookUrl, LeadWebhook } from "@/hooks/use-lead-webhooks";
import { useCRMFunnels, useCRMFunnel } from "@/hooks/use-crm";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  Settings,
  Users,
  UserPlus,
  AlertTriangle,
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
  const { isAuthenticated, user } = useAuth();
  const { data: webhooks = [], isLoading } = useLeadWebhooks();
  const { data: funnels = [] } = useCRMFunnels();
  const { data: members = [] } = useQuery({
    queryKey: ["org-members-for-api-tokens", user?.organization_id],
    queryFn: async () => {
      return api<Array<{ user_id: string; name: string; email: string; role: string }>>(`/api/organizations/${user?.organization_id}/members`);
    },
    enabled: !!user?.organization_id,
  });
  const { createWebhook, updateWebhook, deleteWebhook, regenerateToken, toggleDistribution, addDistributionMember, removeDistributionMember } = useLeadWebhookMutations();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showDistribution, setShowDistribution] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<LeadWebhook | null>(null);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
  const [newToken, setNewToken] = useState({
    name: "",
    description: "",
    funnel_id: "",
    stage_id: "",
    owner_id: "",
  });

  const { data: selectedFunnelData } = useCRMFunnel(newToken.funnel_id || null);
  const stages = selectedFunnelData?.stages || [];

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
      if (editingWebhook) {
        await updateWebhook.mutateAsync({
          id: editingWebhook.id,
          name: newToken.name,
          description: newToken.description,
          funnel_id: newToken.funnel_id || undefined,
          stage_id: newToken.stage_id || undefined,
          owner_id: newToken.owner_id || undefined,
        });
      } else {
        await createWebhook.mutateAsync({
          name: newToken.name,
          description: newToken.description,
          funnel_id: newToken.funnel_id || undefined,
          stage_id: newToken.stage_id || undefined,
          owner_id: newToken.owner_id || undefined,
        });
      }
      setShowCreateDialog(false);
      setEditingWebhook(null);
      setNewToken({ name: "", description: "", funnel_id: "", stage_id: "", owner_id: "" });
    } catch {}
  };

  const handleEditToken = (wh: LeadWebhook) => {
    setEditingWebhook(wh);
    setNewToken({
      name: wh.name,
      description: wh.description || "",
      funnel_id: wh.funnel_id || "",
      stage_id: wh.stage_id || "",
      owner_id: wh.owner_id || "",
    });
    setShowCreateDialog(true);
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

  const Wrapper = isAuthenticated ? MainLayout : ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">{children}</div>
  );

  return (
    <Wrapper>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
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
          {isAuthenticated && (
            <Button onClick={() => { setEditingWebhook(null); setNewToken({ name: "", description: "", funnel_id: "", stage_id: "", owner_id: "" }); setShowCreateDialog(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Gerar Novo Token
            </Button>
          )}
        </div>

        <Tabs defaultValue={isAuthenticated ? "tokens" : "docs"} className="space-y-6">
          <TabsList>
            {isAuthenticated && (
              <TabsTrigger value="tokens" className="gap-2">
                <Key className="h-4 w-4" />
                Tokens API
              </TabsTrigger>
            )}
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
          {isAuthenticated && (
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
            <Button onClick={() => { setEditingWebhook(null); setNewToken({ name: "", description: "", funnel_id: "", stage_id: "", owner_id: "" }); setShowCreateDialog(true); }} variant="outline" className="gap-2">
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
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
                                {wh.funnel_name ? (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                    {wh.funnel_name} {wh.stage_name && `→ ${wh.stage_name}`}
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    Sem funil (Prospect)
                                  </Badge>
                                )}
                                {wh.distribution_enabled && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Users className="h-3 w-3" />
                                    Round-robin
                                  </Badge>
                                )}
                                {!wh.distribution_enabled && wh.owner_name && (
                                  <span>Responsável: {wh.owner_name}</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {wh.total_leads} leads
                                </span>
                                {wh.last_lead_at && (
                                  <span>
                                    Último: {formatDistanceToNow(new Date(wh.last_lead_at), { addSuffix: true, locale: ptBR })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditToken(wh)}
                                className="gap-1"
                                title="Editar configurações"
                              >
                                <Settings className="h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                variant={wh.distribution_enabled ? "default" : "outline"}
                                size="sm"
                                onClick={() => { setSelectedWebhookId(wh.id); setShowDistribution(true); }}
                                className="gap-1"
                                title="Distribuição round-robin"
                              >
                                <Users className="h-3 w-3" />
                                Distribuição
                              </Button>
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
          )}

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
        <Dialog open={showCreateDialog} onOpenChange={(v) => { setShowCreateDialog(v); if (!v) setEditingWebhook(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? "Editar Token API" : "Gerar Novo Token API"}</DialogTitle>
              <DialogDescription>
                {editingWebhook ? "Edite as configurações do token" : "Crie um token para receber leads de sistemas externos no seu CRM"}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Funil de Destino *</Label>
                  <Select
                    value={newToken.funnel_id}
                    onValueChange={(v) => setNewToken({ ...newToken, funnel_id: v === "none" ? "" : v, stage_id: "" })}
                  >
                    <SelectTrigger className={!newToken.funnel_id ? "border-yellow-500" : ""}>
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (Prospect)</SelectItem>
                      {funnels.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Etapa Inicial *</Label>
                  <Select
                    value={newToken.stage_id}
                    onValueChange={(v) => setNewToken({ ...newToken, stage_id: v })}
                    disabled={!newToken.funnel_id}
                  >
                    <SelectTrigger className={newToken.funnel_id && !newToken.stage_id ? "border-yellow-500" : ""}>
                      <SelectValue placeholder={newToken.funnel_id ? "Selecione a etapa" : "Selecione um funil primeiro"} />
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
              </div>

              {!newToken.funnel_id && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span><strong>Atenção:</strong> Sem funil, os leads serão criados como <strong>Prospect</strong> e NÃO aparecerão no Kanban.</span>
                </div>
              )}

              {newToken.funnel_id && newToken.stage_id && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Leads serão criados no <strong>CRM (Kanban)</strong> e terão conversa atribuída no <strong>Chat</strong>.</span>
                </div>
              )}

              <div>
                <Label>Responsável padrão</Label>
                <Select
                  value={newToken.owner_id}
                  onValueChange={(v) => setNewToken({ ...newToken, owner_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Se a distribuição round-robin estiver ativa, este campo é ignorado.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingWebhook(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateToken} disabled={createWebhook.isPending || updateWebhook.isPending} className="gap-2">
                {(createWebhook.isPending || updateWebhook.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingWebhook ? "Salvar" : "Gerar Token"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DISTRIBUTION DIALOG ========== */}
        <DistributionPanel
          webhookId={selectedWebhookId}
          webhook={webhooks.find(w => w.id === selectedWebhookId) || null}
          open={showDistribution}
          onOpenChange={setShowDistribution}
          members={members}
          toggleDistribution={toggleDistribution}
          addMember={addDistributionMember}
          removeMember={removeDistributionMember}
        />

        {/* ========== LOGS DIALOG ========== */}
        <WebhookLogsPanel
          webhookId={selectedWebhookId}
          open={showLogsDialog}
          onOpenChange={setShowLogsDialog}
        />
      </div>
    </Wrapper>
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

function DistributionPanel({
  webhookId,
  webhook,
  open,
  onOpenChange,
  members,
  toggleDistribution,
  addMember,
  removeMember,
}: {
  webhookId: string | null;
  webhook: LeadWebhook | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: Array<{ user_id: string; name: string; email: string; role: string }>;
  toggleDistribution: any;
  addMember: any;
  removeMember: any;
}) {
  const { data: distribution, isLoading } = useWebhookDistribution(open ? webhookId : null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const handleToggle = async (enabled: boolean) => {
    if (!webhookId) return;
    await toggleDistribution.mutateAsync({ id: webhookId, enabled });
  };

  const handleAddMember = async () => {
    if (!webhookId || !selectedUserId) return;
    await addMember.mutateAsync({ webhookId, userId: selectedUserId });
    setSelectedUserId("");
  };

  const handleRemoveMember = async (userId: string) => {
    if (!webhookId) return;
    await removeMember.mutateAsync({ webhookId, userId });
  };

  const availableMembers = members.filter(
    (m) => !distribution?.members?.some((dm: any) => dm.user_id === m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuição de Leads (Round-Robin)
          </DialogTitle>
          <DialogDescription>
            Distribua os leads automaticamente entre os vendedores. O lead aparece no CRM e no Chat do mesmo vendedor.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-sm">Distribuição automática</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, os leads são distribuídos entre os membros abaixo
                </p>
              </div>
              <Switch
                checked={distribution?.distribution_enabled || false}
                onCheckedChange={handleToggle}
                disabled={toggleDistribution.isPending}
              />
            </div>

            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.length === 0 ? (
                    <SelectItem value="__empty" disabled>Todos já adicionados</SelectItem>
                  ) : (
                    availableMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddMember}
                disabled={!selectedUserId || addMember.isPending}
                className="gap-1"
              >
                <UserPlus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Membros da distribuição</Label>
              {distribution?.members?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm bg-muted/50 rounded-lg">
                  Nenhum membro adicionado
                </div>
              ) : (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {distribution?.members?.map((member: any) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{member.user_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{member.user_email}</span>
                            <Badge variant="outline" className="text-xs">
                              {member.leads_today} leads hoje
                            </Badge>
                            {!member.is_active && (
                              <Badge variant="secondary">Pausado</Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {distribution?.distribution_enabled && distribution?.members?.length === 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 text-yellow-600 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4" />
                Adicione membros para a distribuição funcionar
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
