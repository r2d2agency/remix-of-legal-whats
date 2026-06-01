import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Search,
  Filter,
  Settings as SettingsIcon,
  ChevronRight,
  UserCheck,
  MessageSquare,
  DollarSign,
  Save,
  Eye,
  History
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, getAuthToken } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SupervisorIA() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [period, setPeriod] = useState("30d");
  const queryClient = useQueryClient();

  // Fetch Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['supervisor-stats', period],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/supervisor/stats?period=${period}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      return res.json();
    }
  });

  // Fetch Semaphore
  const { data: semaphore, isLoading: semaphoreLoading } = useQuery({
    queryKey: ['supervisor-semaphore'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/supervisor/semaphore`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      return res.json();
    }
  });

  // Fetch Sellers
  const { data: sellers, isLoading: sellersLoading } = useQuery({
    queryKey: ['supervisor-sellers'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/supervisor/sellers`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      return res.json();
    }
  });

  // Fetch Settings
  const { data: settings } = useQuery({
    queryKey: ['supervisor-settings'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/supervisor/settings`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      return res.json();
    }
  });

  // Fetch Audits
  const { data: audits, isLoading: auditsLoading } = useQuery({
    queryKey: ['supervisor-audits'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/supervisor/audits`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      return res.json();
    }
  });


  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async (tempSettings: any) => {
      const res = await fetch(`${API_URL}/supervisor/preview-settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}` 
        },
        body: JSON.stringify(tempSettings)
      });
      return res.json();
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const res = await fetch(`${API_URL}/supervisor/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}` 
        },
        body: JSON.stringify(newSettings)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-settings'] });
      queryClient.invalidateQueries({ queryKey: ['supervisor-semaphore'] });
      toast.success("Configurações de SLA atualizadas com sucesso");
    }
  });

  const handlePreview = () => {
    if (localSettings) {
      previewMutation.mutate(localSettings);
    }
  };

  const COLORS = ['#22c55e', '#eab308', '#ef4444'];
  const PIE_DATA = [
    { name: 'Verde', value: semaphore?.GREEN || 0 },
    { name: 'Amarelo', value: semaphore?.YELLOW || 0 },
    { name: 'Vermelho', value: semaphore?.RED || 0 },
  ];

  const PREVIEW_DATA = previewMutation.data ? [
    { name: 'Verde', value: previewMutation.data.GREEN || 0 },
    { name: 'Amarelo', value: previewMutation.data.YELLOW || 0 },
    { name: 'Vermelho', value: previewMutation.data.RED || 0 },
  ] : null;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Supervisor IA
            </h1>
            <p className="text-muted-foreground">Monitoramento inteligente da operação comercial</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="15d">Últimos 15 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Dialog onOpenChange={(open) => { if (open) setLocalSettings(settings); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Regras SLA
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Configurar Regras de SLA
                  </DialogTitle>
                  <CardDescription>
                    Ajuste os tempos de resposta e monitoramento. As mudanças afetam o semáforo em tempo real.
                  </CardDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new_lead">Lead novo sem abordagem (minutos)</Label>
                      <Input 
                        id="new_lead"
                        type="number" 
                        value={localSettings?.new_lead_sla_minutes || ""} 
                        onChange={(e) => setLocalSettings({...localSettings, new_lead_sla_minutes: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="no_followup">Lead sem follow-up (horas)</Label>
                      <Input 
                        id="no_followup"
                        type="number" 
                        value={localSettings?.no_followup_sla_hours || ""}
                        onChange={(e) => setLocalSettings({...localSettings, no_followup_sla_hours: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="no_response">Lead sem resposta (dias)</Label>
                      <Input 
                        id="no_response"
                        type="number" 
                        value={localSettings?.no_response_sla_days || ""}
                        onChange={(e) => setLocalSettings({...localSettings, no_response_sla_days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="proposal">Aguardando proposta (horas)</Label>
                      <Input 
                        id="proposal"
                        type="number" 
                        value={localSettings?.proposal_sla_hours || ""}
                        onChange={(e) => setLocalSettings({...localSettings, proposal_sla_hours: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payment">Aguardando pagamento (dias)</Label>
                      <Input 
                        id="payment"
                        type="number" 
                        value={localSettings?.payment_sla_days || ""}
                        onChange={(e) => setLocalSettings({...localSettings, payment_sla_days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reactivation">Reativação de Leads Perdidos (dias)</Label>
                      <Input 
                        id="reactivation"
                        type="number" 
                        value={localSettings?.reactivation_days || ""}
                        onChange={(e) => setLocalSettings({...localSettings, reactivation_days: parseInt(e.target.value)})}
                      />
                    </div>
                    
                    <Button 
                      variant="secondary" 
                      className="w-full gap-2" 
                      onClick={handlePreview}
                      disabled={previewMutation.isPending}
                    >
                      <Eye className="h-4 w-4" />
                      {previewMutation.isPending ? "Calculando..." : "Pré-visualizar Impacto"}
                    </Button>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-4 flex flex-col items-center justify-center border">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Impacto no Semáforo
                    </h4>
                    
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={PREVIEW_DATA || PIE_DATA}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {(PREVIEW_DATA || PIE_DATA).map((entry, index) => (
                              <Cell key={`cell-preview-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full mt-2">
                      <div className="text-center">
                        <div className="text-sm font-bold text-green-500">{(PREVIEW_DATA || PIE_DATA)[0].value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Verde</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-yellow-500">{(PREVIEW_DATA || PIE_DATA)[1].value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Amarelo</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-red-500">{(PREVIEW_DATA || PIE_DATA)[2].value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Vermelho</div>
                      </div>
                    </div>

                    {PREVIEW_DATA && (
                      <div className="mt-4 text-[11px] text-center text-muted-foreground">
                        Exibindo projeção baseada nas novas regras.
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogTrigger asChild>
                    <Button variant="ghost">Cancelar</Button>
                  </DialogTrigger>
                  <Button 
                    className="gap-2" 
                    onClick={() => updateSettingsMutation.mutate(localSettings)}
                    disabled={updateSettingsMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {updateSettingsMutation.isPending ? "Salvando..." : "Salvar e Aplicar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="sellers">Vendedores</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="audits">Auditoria</TabsTrigger>
            <TabsTrigger value="charges">Cobranças</TabsTrigger>
          </TabsList>


          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard title="Total Leads" value={stats?.total_leads} icon={Users} color="blue" />
              <StatCard title="Novos" value={stats?.leads_novos} icon={TrendingUp} color="emerald" />
              <StatCard title="Sem Abordagem" value={stats?.leads_sem_abordagem} icon={AlertTriangle} color="red" />
              <StatCard title="Sem Resposta" value={stats?.leads_sem_resposta} icon={MessageSquare} color="amber" />
              <StatCard title="Em Atendimento" value={stats?.leads_em_atendimento} icon={UserCheck} color="indigo" />
              <StatCard title="Convertidos" value={stats?.leads_convertidos} icon={CheckCircle2} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Semáforo Pie Chart */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Semáforo Comercial</CardTitle>
                  <CardDescription>Status de priorização em tempo real</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={PIE_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {PIE_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{semaphore?.GREEN || 0}</div>
                      <div className="text-xs text-muted-foreground uppercase">Verde</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-500">{semaphore?.YELLOW || 0}</div>
                      <div className="text-xs text-muted-foreground uppercase">Amarelo</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">{semaphore?.RED || 0}</div>
                      <div className="text-xs text-muted-foreground uppercase">Vermelho</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Vendedores Bar Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Ranking de Vendedores</CardTitle>
                  <CardDescription>Leads e Conversões por membro da equipe</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sellers}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="total_leads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="conversions" name="Conversões" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alertas Críticos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Leads que exigem ação</CardTitle>
                  <CardDescription>Leads em risco ou aguardando retorno imediato</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("alerts")}>
                  Ver todos <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {semaphore?.leads?.filter((l: any) => l.semaphore_color === 'RED').slice(0, 5).map((lead: any) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">{lead.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Última interação: {lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleString() : 'Nunca'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="destructive" className="animate-pulse">Crítico</Badge>
                        <Button size="sm">Resolver</Button>
                      </div>
                    </div>
                  ))}
                  {semaphore?.leads?.filter((l: any) => l.semaphore_color === 'RED').length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      Nenhum lead em estado crítico no momento. Parabéns!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {sellers?.map((seller: any) => (
                 <Card key={seller.id} className="overflow-hidden">
                   <CardHeader className="bg-muted/30 pb-4">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {seller.name.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{seller.name}</CardTitle>
                            <CardDescription className="text-xs">Score: {Math.round(seller.conversion_rate || 0)}/100</CardDescription>
                          </div>
                        </div>
                        <Badge variant={seller.conversion_rate > 20 ? "default" : "outline"}>
                          Rank #{sellers.indexOf(seller) + 1}
                        </Badge>
                     </div>
                   </CardHeader>
                   <CardContent className="p-0">
                     <div className="grid grid-cols-2 border-b">
                        <div className="p-4 border-r text-center">
                          <div className="text-xl font-bold">{seller.total_leads}</div>
                          <div className="text-xs text-muted-foreground uppercase">Leads</div>
                        </div>
                        <div className="p-4 text-center">
                          <div className="text-xl font-bold text-green-600">{seller.conversions}</div>
                          <div className="text-xs text-muted-foreground uppercase">Convertidos</div>
                        </div>
                     </div>
                     <div className="p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tempo médio resp.</span>
                          <span className="font-medium">{Math.round((seller.avg_response_time || 0) / 60)} min</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Taxa Conversão</span>
                          <span className="font-medium">{Math.round(seller.conversion_rate || 0)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Sem abordagem</span>
                          <span className={cn("font-medium", seller.no_approach > 0 ? "text-red-500" : "")}>
                            {seller.no_approach}
                          </span>
                        </div>
                        <Button className="w-full mt-2" variant="outline" size="sm">Ver Leads</Button>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </TabsContent>

          <TabsContent value="alerts" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Nome do Lead</th>
                      <th className="px-4 py-3 text-left font-medium">Responsável</th>
                      <th className="px-4 py-3 text-left font-medium">Última Interação</th>
                      <th className="px-4 py-3 text-left font-medium">Prioridade</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {semaphore?.leads?.map((lead: any) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{lead.title}</td>
                        <td className="px-4 py-3">
                          {sellers?.find((s: any) => s.id === lead.owner_id)?.name || 'Não atribuído'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleString() : 'Nunca'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={
                            lead.semaphore_color === 'RED' ? 'destructive' : 
                            lead.semaphore_color === 'YELLOW' ? 'secondary' : 'default'
                          }>
                            {lead.semaphore_color === 'RED' ? 'Alta' : lead.semaphore_color === 'YELLOW' ? 'Média' : 'Normal'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">Audit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="audits" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Lead</th>
                      <th className="px-4 py-3 text-left font-medium">Vendedor</th>
                      <th className="px-4 py-3 text-left font-medium">Data Análise</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Motivo</th>
                      <th className="px-4 py-3 text-left font-medium">Urgência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {audits?.map((audit: any) => (
                      <tr key={audit.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{audit.lead_name}</td>
                        <td className="px-4 py-3">{audit.seller_name}</td>
                        <td className="px-4 py-3">{new Date(audit.analysis_date).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{audit.status_found}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{audit.reason}</td>
                        <td className="px-4 py-3">
                          <Badge variant={audit.urgency === 'high' ? 'destructive' : 'secondary'}>
                            {audit.urgency}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {audits?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground">
                          Nenhuma auditoria realizada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="charges" className="mt-6">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Central de Cobranças</CardTitle>
                  <CardDescription>Gerencie pendências e envie lembretes para os vendedores</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Vendedor</th>
                        <th className="px-4 py-3 text-center font-medium">Leads em Atraso</th>
                        <th className="px-4 py-3 text-center font-medium">Pendências</th>
                        <th className="px-4 py-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sellers?.map((seller: any) => (
                        <tr key={seller.id}>
                          <td className="px-4 py-3 font-medium">{seller.name}</td>
                          <td className="px-4 py-3 text-center text-red-500 font-bold">{seller.no_approach}</td>
                          <td className="px-4 py-3 text-center">{seller.total_leads}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" className="mr-2">Histórico</Button>
                            <Button size="sm">Cobrar Agora</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </MainLayout>
  );
}


function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase truncate">{title}</p>
          <p className="text-2xl font-bold">{value || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}


