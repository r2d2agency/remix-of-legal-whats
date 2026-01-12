import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Timer,
  Users,
  MessageSquare,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  status: "scheduled" | "running" | "completed" | "paused";
  listName: string;
  messageName: string;
  totalContacts: number;
  sentMessages: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

interface SendLog {
  id: string;
  campaignId: string;
  contactName: string;
  phone: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
}

const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Promoção Black Friday",
    status: "completed",
    listName: "Clientes VIP",
    messageName: "Promoção",
    totalContacts: 250,
    sentMessages: 250,
    startDate: "10/01/2026",
    endDate: "11/01/2026",
    startTime: "08:00",
    endTime: "18:00",
  },
  {
    id: "2",
    name: "Lançamento Novo Produto",
    status: "running",
    listName: "Leads Janeiro",
    messageName: "Boas-vindas",
    totalContacts: 180,
    sentMessages: 117,
    startDate: "12/01/2026",
    endDate: "13/01/2026",
    startTime: "08:00",
    endTime: "18:00",
  },
  {
    id: "3",
    name: "Reativação de Clientes",
    status: "scheduled",
    listName: "Reativação",
    messageName: "Lembrete",
    totalContacts: 420,
    sentMessages: 0,
    startDate: "15/01/2026",
    endDate: "16/01/2026",
    startTime: "09:00",
    endTime: "17:00",
  },
];

const mockLogs: SendLog[] = [
  { id: "1", campaignId: "2", contactName: "João Silva", phone: "+55 11 99999-1111", status: "sent", sentAt: "12/01 10:23" },
  { id: "2", campaignId: "2", contactName: "Maria Santos", phone: "+55 11 99999-2222", status: "sent", sentAt: "12/01 10:35" },
  { id: "3", campaignId: "2", contactName: "Pedro Oliveira", phone: "+55 11 99999-3333", status: "failed", sentAt: "12/01 10:47" },
  { id: "4", campaignId: "2", contactName: "Ana Costa", phone: "+55 11 99999-4444", status: "sent", sentAt: "12/01 10:59" },
  { id: "5", campaignId: "2", contactName: "Carlos Lima", phone: "+55 11 99999-5555", status: "pending", sentAt: "-" },
];

const statusConfig = {
  scheduled: { icon: CalendarIcon, label: "Agendada", color: "text-muted-foreground", bgColor: "bg-muted" },
  running: { icon: Play, label: "Em Execução", color: "text-warning", bgColor: "bg-warning/10" },
  completed: { icon: CheckCircle2, label: "Concluída", color: "text-success", bgColor: "bg-success/10" },
  paused: { icon: Pause, label: "Pausada", color: "text-destructive", bgColor: "bg-destructive/10" },
};

const Campanhas = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [pauseInterval, setPauseInterval] = useState("10");

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campanhas</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie e acompanhe seus disparos de mensagens
            </p>
          </div>
          <Button variant="gradient" onClick={() => setActiveTab("create")}>
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">Campanhas</TabsTrigger>
            <TabsTrigger value="create">Criar Campanha</TabsTrigger>
            {selectedCampaign && (
              <TabsTrigger value="monitor">Monitorar Envios</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-6">
            {mockCampaigns.map((campaign, index) => {
              const config = statusConfig[campaign.status];
              const StatusIcon = config.icon;
              const progress = (campaign.sentMessages / campaign.totalContacts) * 100;

              return (
                <Card
                  key={campaign.id}
                  className="transition-all duration-200 hover:shadow-elevated animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">
                            {campaign.name}
                          </h3>
                          <Badge className={cn(config.bgColor, config.color, "border-0")}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.listName}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {campaign.messageName}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {campaign.startDate} - {campaign.endDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {campaign.startTime} - {campaign.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">
                            {campaign.sentMessages}/{campaign.totalContacts}
                          </p>
                          <p className="text-sm text-muted-foreground">mensagens enviadas</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCampaign(campaign.id);
                              setActiveTab("monitor");
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            Monitorar
                          </Button>
                          {campaign.status === "running" && (
                            <Button variant="outline" size="sm">
                              <Pause className="h-4 w-4" />
                              Pausar
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button variant="outline" size="sm">
                              <Play className="h-4 w-4" />
                              Retomar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {campaign.status !== "scheduled" && (
                      <div className="mt-4">
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Nova Campanha
                  </CardTitle>
                  <CardDescription>
                    Configure os detalhes da sua campanha de envio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Nome da Campanha</Label>
                    <Input
                      id="campaignName"
                      placeholder="Ex: Promoção de Verão"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Lista de Contatos</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Clientes VIP (250)</SelectItem>
                        <SelectItem value="2">Leads Janeiro (180)</SelectItem>
                        <SelectItem value="3">Reativação (420)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma mensagem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Boas-vindas</SelectItem>
                        <SelectItem value="2">Promoção</SelectItem>
                        <SelectItem value="3">Lembrete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    Agendamento
                  </CardTitle>
                  <CardDescription>
                    Configure quando e como os envios serão feitos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Hora Início</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Hora Fim</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pauseInterval">Pausa Aleatória (minutos)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="pauseInterval"
                        type="number"
                        min="1"
                        max="60"
                        value={pauseInterval}
                        onChange={(e) => setPauseInterval(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        min entre mensagens
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-accent/50 p-4">
                    <div className="flex items-start gap-3">
                      <Shuffle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Envio Aleatório Ativo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          As mensagens serão enviadas em horários aleatórios entre{" "}
                          {startTime} e {endTime}, com pausas de até {pauseInterval}{" "}
                          minutos entre cada envio para proteger sua conta.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button variant="gradient" className="w-full">
                    <Send className="h-4 w-4" />
                    Agendar Campanha
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monitor" className="mt-6">
            <Card className="animate-fade-in shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Monitoramento de Envios</CardTitle>
                    <CardDescription>
                      Acompanhe cada mensagem enviada em tempo real
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enviadas: 3
                    </Badge>
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Falhas: 1
                    </Badge>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendentes: 1
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.contactName}</TableCell>
                        <TableCell>{log.phone}</TableCell>
                        <TableCell>
                          {log.status === "sent" && (
                            <Badge className="bg-success/10 text-success border-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Enviada
                            </Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge className="bg-destructive/10 text-destructive border-0">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Falha
                            </Badge>
                          )}
                          {log.status === "pending" && (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{log.sentAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Campanhas;
