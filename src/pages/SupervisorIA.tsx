import { useState, useEffect } from "react";
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
  DollarSign
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
      toast.success("Configurações atualizadas com sucesso");
    }
  });

  const COLORS = ['#22c55e', '#eab308', '#ef4444'];
  const PIE_DATA = [
    { name: 'Verde', value: semaphore?.GREEN || 0 },
    { name: 'Amarelo', value: semaphore?.YELLOW || 0 },
    { name: 'Vermelho', value: semaphore?.RED || 0 },
  ];

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

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Regras de Monitoramento</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Lead novo sem abordagem após (minutos)</Label>
                    <Input 
                      type="number" 
                      defaultValue={settings?.new_lead_sla_minutes || 30} 
                      onChange={(e) => updateSettingsMutation.mutate({ ...settings, new_lead_sla_minutes: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Lead sem follow-up após (horas)</Label>
                    <Input 
                      type="number" 
                      defaultValue={settings?.no_followup_sla_hours || 24}
                      onChange={(e) => updateSettingsMutation.mutate({ ...settings, no_followup_sla_hours: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Lead sem resposta há (dias)</Label>
                    <Input 
                      type="number" 
                      defaultValue={settings?.no_response_sla_days || 2}
                      onChange={(e) => updateSettingsMutation.mutate({ ...settings, no_response_sla_days: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="sellers">Vendedores</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
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

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
