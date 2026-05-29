import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  Map as MapIcon, 
  Search, 
  Download, 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Users, 
  Package, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Clock
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

// Mock Data
const MOCK_BRANDS = [
  { id: "1", name: "Nestlé", routes: 12, executions: 85, health: 92, lastSync: "2024-05-20" },
  { id: "2", name: "Unilever", routes: 8, executions: 64, health: 78, lastSync: "2024-05-19" },
  { id: "3", name: "P&G", routes: 15, executions: 112, health: 88, lastSync: "2024-05-20" },
  { id: "4", name: "Coca-Cola", routes: 20, executions: 145, health: 95, lastSync: "2024-05-20" },
  { id: "5", name: "Ambev", routes: 18, executions: 130, health: 82, lastSync: "2024-05-18" },
];

const MOCK_PDVS = [
  { id: "p1", name: "Carrefour Marginal", city: "São Paulo", state: "SP", lat: -23.5505, lng: -46.6333, products: 45, lastPromoter: "João Silva", nextAppointment: "2024-05-22 09:00" },
  { id: "p2", name: "Pão de Açúcar Jardins", city: "São Paulo", state: "SP", lat: -23.5611, lng: -46.6631, products: 32, lastPromoter: "Maria Souza", nextAppointment: "2024-05-21 14:30" },
  { id: "p3", name: "Assaí Atacadista", city: "Osasco", state: "SP", lat: -23.5325, lng: -46.7917, products: 120, lastPromoter: "Ricardo Lima", nextAppointment: "2024-05-23 08:00" },
];

const MOCK_PRODUCTS = [
  { id: "pr1", name: "Leite Ninho 400g", status: "ok", stock: 45, price: 18.90 },
  { id: "pr2", name: "Nescau 2.0 400g", status: "ruptura", stock: 0, price: 9.90 },
  { id: "pr3", name: "Leite Condensado Moça", status: "avaria", stock: 5, price: 7.50 },
  { id: "pr4", name: "Kit Kat 45g", status: "ok", stock: 120, price: 3.50 },
];

function BrandMap({ locations }: { locations: typeof MOCK_PDVS }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([-23.5505, -46.6333], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    locations.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lng]).addTo(mapRef.current!);
      marker.bindPopup(`
        <div class="p-2">
          <p class="font-bold text-sm">${loc.name}</p>
          <p class="text-xs text-muted-foreground">${loc.city}, ${loc.state}</p>
          <div class="mt-2 text-xs">
            <p>📦 <strong>${loc.products} produtos</strong></p>
            <p>👤 Úitimo: ${loc.lastPromoter}</p>
            <p>📅 Próx: ${loc.nextAppointment}</p>
          </div>
        </div>
      `);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [locations]);

  return <div ref={containerRef} className="h-[400px] w-full rounded-lg border overflow-hidden z-0" />;
}

export default function RelatorioMarcas() {
  const [selectedBrand, setSelectedBrand] = useState<typeof MOCK_BRANDS[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdvFilter, setPdvFilter] = useState("all");

  const filteredBrands = useMemo(() => {
    return MOCK_BRANDS.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm]);

  const filteredPdvs = useMemo(() => {
    if (pdvFilter === "all") return MOCK_PDVS;
    return MOCK_PDVS.filter(p => p.id === pdvFilter);
  }, [pdvFilter]);

  if (selectedBrand) {
    return (
      <MainLayout>
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedBrand(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  Prontuário: {selectedBrand.name}
                </h1>
                <p className="text-muted-foreground">Visão detalhada de execução e presença em PDVs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar Dados
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1 text-primary">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">PDVs Ativos</span>
                </div>
                <p className="text-2xl font-bold">{MOCK_PDVS.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">Execuções / Semana</span>
                </div>
                <p className="text-2xl font-bold">{selectedBrand.executions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1 text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">Rupturas Ativas</span>
                </div>
                <p className="text-2xl font-bold">12</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1 text-amber-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">Próximas Rotas</span>
                </div>
                <p className="text-2xl font-bold">5</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral & Mapa</TabsTrigger>
              <TabsTrigger value="products">Produtos & Auditoria</TabsTrigger>
              <TabsTrigger value="routes">Rotas & Promotores</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Localização dos PDVs</CardTitle>
                    <CardDescription>Visualização geográfica de presença da marca</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BrandMap locations={MOCK_PDVS} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Próximos Agendamentos</CardTitle>
                    <CardDescription>Rotas programadas para esta semana</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[340px] pr-4">
                      <div className="space-y-4">
                        {MOCK_PDVS.map(pdv => (
                          <div key={pdv.id} className="flex flex-col gap-1 p-3 rounded-lg border bg-muted/30">
                            <p className="font-semibold text-sm">{pdv.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {pdv.nextAppointment}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {pdv.lastPromoter}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Select value={pdvFilter} onValueChange={setPdvFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por PDV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os PDVs</SelectItem>
                      {MOCK_PDVS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_PRODUCTS.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.status === "ok" && <Badge className="bg-green-500">Normal</Badge>}
                          {product.status === "ruptura" && <Badge variant="destructive">Ruptura</Badge>}
                          {product.status === "avaria" && <Badge className="bg-amber-500">Avaria</Badge>}
                        </TableCell>
                        <TableCell>{product.stock} un</TableCell>
                        <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Ver Detalhes</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="routes" className="space-y-4">
               <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Histórico de Rotas Semanais</CardTitle>
                    <CardDescription>Execuções realizadas nos últimos 7 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Promotor</TableHead>
                          <TableHead>PDV</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Produtos</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">João Silva</TableCell>
                          <TableCell>Carrefour Marginal</TableCell>
                          <TableCell>20/05/2024 10:30</TableCell>
                          <TableCell>45</TableCell>
                          <TableCell><Badge className="bg-green-500">Concluída</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Maria Souza</TableCell>
                          <TableCell>Pão de Açúcar Jardins</TableCell>
                          <TableCell>20/05/2024 14:15</TableCell>
                          <TableCell>32</TableCell>
                          <TableCell><Badge className="bg-green-500">Concluída</Badge></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Relatório por Marca
          </h1>
          <p className="text-muted-foreground">Monitore o desempenho e rotas por marca em tempo real</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar marcas..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Geral
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Rotas na Semana</TableHead>
                <TableHead>Execuções</TableHead>
                <TableHead>Saúde da Marca</TableHead>
                <TableHead>Última Sincronização</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.map((brand) => (
                <TableRow key={brand.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBrand(brand)}>
                  <TableCell className="font-bold text-primary">{brand.name}</TableCell>
                  <TableCell>{brand.routes}</TableCell>
                  <TableCell>{brand.executions}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 w-full max-w-[100px]">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            brand.health > 90 ? "bg-green-500" : brand.health > 80 ? "bg-blue-500" : "bg-amber-500"
                          )}
                          style={{ width: `${brand.health}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{brand.health}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{brand.lastSync}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1">
                      Ver Prontuário
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </MainLayout>
  );
}
