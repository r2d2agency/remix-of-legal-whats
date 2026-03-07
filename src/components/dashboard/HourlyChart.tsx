import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, Clock, CalendarIcon, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HourlyData {
  hour: number;
  label: string;
  count: number;
}

interface Connection {
  id: string;
  name: string;
  status?: string;
}

interface HourlyChartProps {
  className?: string;
  connections?: Connection[];
}

export function HourlyChart({ className, connections = [] }: HourlyChartProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [data, setData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedConnection]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', format(selectedDate, 'yyyy-MM-dd'));
      if (selectedConnection !== 'all') params.append('connection_id', selectedConnection);

      const result = await api<{ hourly_stats: HourlyData[] }>(
        `/api/chat/conversations/hourly-stats?${params.toString()}`
      ).catch(() => ({ hourly_stats: [] }));

      setData(result.hourly_stats || []);
    } catch (error) {
      console.error('Error loading hourly stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const peakHour = data.reduce((max, d) => (d.count > max.count ? d : max), { hour: 0, label: '00:00', count: 0 });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-foreground mb-1">{label}</p>
        <p className="text-muted-foreground">
          {selectedDate ? 'Conversas' : 'Média'}: <span className="font-semibold text-foreground">{payload[0].value}</span>
        </p>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Horários de Pico
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? `Conversas em ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}`
                : 'Média de conversas por hora (últimos 30 dias)'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {connections.length > 1 && (
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="h-7 text-xs w-[130px]">
                  <Smartphone className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Conexão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {selectedDate ? format(selectedDate, "dd/MM", { locale: ptBR }) : 'Média 30d'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  disabled={{ after: new Date() }}
                  className={cn("p-3 pointer-events-auto")}
                />
                {selectedDate && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSelectedDate(undefined)}>
                      Ver média dos últimos 30 dias
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Peak hour indicator */}
        {peakHour.count > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              Horário de pico: <span className="font-bold text-primary">{peakHour.label}</span>
              <span className="text-muted-foreground ml-1">({peakHour.count} {selectedDate ? 'conversas' : 'média'})</span>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  interval={2}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={800}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={entry.count >= maxCount * 0.8
                        ? 'hsl(var(--primary))'
                        : entry.count >= maxCount * 0.5
                          ? 'hsl(var(--primary) / 0.6)'
                          : 'hsl(var(--primary) / 0.3)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
