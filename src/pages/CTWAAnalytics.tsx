import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Clock,
  Loader2,
  Copy,
  ExternalLink,
  BarChart3,
  MousePointerClick,
  Megaphone,
  Filter,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useCTWACampaigns,
  useCTWAOverview,
  useCTWALeads,
  useCTWAMutations,
  CTWACampaign,
  CTWALead,
} from "@/hooks/use-ctwa-analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const platformConfig = {
  meta: { label: "Meta Ads", color: "bg-blue-500" },
  google: { label: "Google Ads", color: "bg-red-500" },
  tiktok: { label: "TikTok Ads", color: "bg-black" },
  other: { label: "Outro", color: "bg-gray-500" },
};

const statusConfig = {
  new: { label: "Novo", color: "bg-blue-100 text-blue-700" },
  engaged: { label: "Engajado", color: "bg-amber-100 text-amber-700" },
  qualified: { label: "Qualificado", color: "bg-purple-100 text-purple-700" },
  converted: { label: "Convertido", color: "bg-green-100 text-green-700" },
  lost: { label: "Perdido", color: "bg-red-100 text-red-700" },
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function CTWAAnalytics() {
  const [dateRange, setDateRange] = useState("30");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const startDate = format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");

  const { data: campaigns, isLoading: loadingCampaigns } = useCTWACampaigns();
  const { data: overview, isLoading: loadingOverview } = useCTWAOverview(startDate, endDate);
  const { data: leads, isLoading: loadingLeads } = useCTWALeads({
    campaign_id: selectedCampaign || undefined,
    start_date: startDate,
    end_date: endDate,
  });
  const { createCampaign, deleteCampaign } = useCTWAMutations();

  const stats = overview?.stats;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MousePointerClick className="h-6 w-6 text-primary" />
              Click-to-WhatsApp Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rastreie origem de leads e métricas de conversão por campanha
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        {loadingOverview ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_leads || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.new_leads || 0} novos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Taxa de Conversão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {stats?.conversion_rate || 0}%
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.converted_leads || 0} convertidos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Receita Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    R$ {(stats?.total_revenue || 0).toLocaleString("pt-BR")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    De leads convertidos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Qualificados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats?.qualified_leads || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prontos para venda
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tempo de Resposta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.avg_response_time ? `${Math.round(stats.avg_response_time / 60)}min` : "--"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Média de resposta
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Leads Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Leads por Dia</CardTitle>
                  <CardDescription>Evolução de leads e conversões</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview?.by_day || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => format(new Date(v), "dd/MM")}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Leads"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="converted"
                          name="Convertidos"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* By Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por Origem</CardTitle>
                  <CardDescription>Distribuição de leads por fonte</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview?.by_source || []}
                          dataKey="leads"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {(overview?.by_source || []).map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Tabs: Campaigns / Leads */}
        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">
              <Megaphone className="h-4 w-4 mr-2" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Leads
              {leads && leads.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {leads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            {loadingCampaigns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(campaigns || []).map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onDelete={() => deleteCampaign.mutate(campaign.id)}
                  />
                ))}

                {(!campaigns || campaigns.length === 0) && (
                  <Card className="col-span-full p-8 text-center">
                    <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Nenhuma campanha cadastrada</p>
                    <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Campanha
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* Campaign ROI Table */}
            {overview?.by_campaign && overview.by_campaign.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance por Campanha</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Campanha</th>
                          <th className="text-center py-2 font-medium">Leads</th>
                          <th className="text-center py-2 font-medium">Conversões</th>
                          <th className="text-right py-2 font-medium">Investido</th>
                          <th className="text-right py-2 font-medium">Receita</th>
                          <th className="text-right py-2 font-medium">CPL</th>
                          <th className="text-right py-2 font-medium">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.by_campaign.map((c) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", platformConfig[c.platform as keyof typeof platformConfig]?.color || "bg-gray-500")} />
                                {c.name}
                              </div>
                            </td>
                            <td className="text-center py-3">{c.leads}</td>
                            <td className="text-center py-3">{c.conversions}</td>
                            <td className="text-right py-3">R$ {c.total_spend.toLocaleString("pt-BR")}</td>
                            <td className="text-right py-3">R$ {c.revenue.toLocaleString("pt-BR")}</td>
                            <td className="text-right py-3">R$ {c.cost_per_lead.toLocaleString("pt-BR")}</td>
                            <td className="text-right py-3">
                              <span className={cn(
                                "font-medium",
                                c.roi > 0 ? "text-green-600" : c.roi < 0 ? "text-red-600" : ""
                              )}>
                                {c.roi > 0 ? "+" : ""}{c.roi}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select
                value={selectedCampaign || "all"}
                onValueChange={(v) => setSelectedCampaign(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-60">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {(campaigns || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingLeads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Contato</th>
                          <th className="text-left p-3 font-medium">Campanha</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Origem</th>
                          <th className="text-right p-3 font-medium">Valor</th>
                          <th className="text-right p-3 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(leads || []).map((lead) => (
                          <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="p-3">
                              <div className="font-medium">{lead.contact_name || lead.phone}</div>
                              <div className="text-xs text-muted-foreground">{lead.phone}</div>
                            </td>
                            <td className="p-3">
                              {lead.campaign_name || (
                                <span className="text-muted-foreground">Direto</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge className={cn("text-[10px]", statusConfig[lead.status]?.color)}>
                                {statusConfig[lead.status]?.label || lead.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {lead.utm_source || lead.source_platform || "direct"}
                            </td>
                            <td className="p-3 text-right">
                              {lead.conversion_value
                                ? `R$ ${lead.conversion_value.toLocaleString("pt-BR")}`
                                : "--"}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </td>
                          </tr>
                        ))}

                        {(!leads || leads.length === 0) && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                              Nenhum lead encontrado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={(data) => {
          createCampaign.mutate(data, {
            onSuccess: () => setShowCreateDialog(false),
          });
        }}
        isPending={createCampaign.isPending}
      />
    </MainLayout>
  );
}

// Campaign Card Component
function CampaignCard({
  campaign,
  onDelete,
}: {
  campaign: CTWACampaign;
  onDelete: () => void;
}) {
  const conversionRate = campaign.total_leads
    ? ((campaign.converted_leads || 0) / campaign.total_leads * 100).toFixed(1)
    : "0";

  const copyTrackingCode = () => {
    navigator.clipboard.writeText(campaign.tracking_code);
    toast.success("Código copiado!");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              platformConfig[campaign.platform]?.color || "bg-gray-500"
            )} />
            <CardTitle className="text-base">{campaign.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyTrackingCode}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Tracking Code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription>
          {platformConfig[campaign.platform]?.label}
          {campaign.utm_campaign && ` • ${campaign.utm_campaign}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Leads</div>
            <div className="text-xl font-bold">{campaign.total_leads || 0}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Conversões</div>
            <div className="text-xl font-bold text-green-600">{campaign.converted_leads || 0}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Taxa</div>
            <div className="font-medium">{conversionRate}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Receita</div>
            <div className="font-medium">R$ {(campaign.total_revenue || 0).toLocaleString("pt-BR")}</div>
          </div>
        </div>

        {campaign.tracking_code && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground mb-1">Tracking Code</div>
            <code className="text-xs bg-muted px-2 py-1 rounded">{campaign.tracking_code}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Create Campaign Dialog
function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: Partial<CTWACampaign>) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<string>("meta");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [totalSpend, setTotalSpend] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      platform: platform as any,
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      total_spend: totalSpend ? parseFloat(totalSpend) : 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Campanha de Ads</DialogTitle>
          <DialogDescription>
            Cadastre uma campanha para rastrear leads de Click-to-WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome da Campanha</Label>
            <Input
              placeholder="Ex: Black Friday 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta Ads (Facebook/Instagram)</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="tiktok">TikTok Ads</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>UTM Source</Label>
              <Input
                placeholder="facebook"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>UTM Medium</Label>
              <Input
                placeholder="cpc"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>UTM Campaign</Label>
              <Input
                placeholder="blackfriday"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Investimento Total (R$)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={totalSpend}
              onChange={(e) => setTotalSpend(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
