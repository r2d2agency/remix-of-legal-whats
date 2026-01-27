import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCRMFunnels, useCRMFunnel, useCRMCompanies, useCRMDealMutations, useCRMDealsSearch, CRMDeal, CRMFunnel, CRMStage } from "@/hooks/use-crm";
import { Building2, Plus, Search, Briefcase, DollarSign, User, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DealLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string;
  contactPhone?: string;
  linkedDeals?: CRMDeal[];
  onLinkDeal?: (dealId: string) => void;
  onUnlinkDeal?: (dealId: string) => void;
}

export function DealLinkDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  linkedDeals = [],
  onLinkDeal,
  onUnlinkDeal,
}: DealLinkDialogProps) {
  const [mode, setMode] = useState<"link" | "create">("link");
  const [searchDeal, setSearchDeal] = useState("");
  
  // New deal form
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companySearch, setCompanySearch] = useState("");

  const { data: funnels, isLoading: loadingFunnels } = useCRMFunnels();
  const { data: selectedFunnelData } = useCRMFunnel(selectedFunnelId || null);
  const { data: companies } = useCRMCompanies(companySearch);
  const { data: searchedDeals, isLoading: searchingDeals } = useCRMDealsSearch(searchDeal);
  const { createDeal } = useCRMDealMutations();

  // Get stages from the fetched funnel data
  const stages: CRMStage[] = selectedFunnelData?.stages || [];

  // Auto-select first stage when funnel data loads
  useEffect(() => {
    if (selectedFunnelData?.stages?.length && !selectedStageId) {
      setSelectedStageId(selectedFunnelData.stages[0].id || "");
    }
  }, [selectedFunnelData, selectedStageId]);

  const handleFunnelChange = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setSelectedStageId(""); // Reset stage when funnel changes
  };

  const handleCreateDeal = async () => {
    if (!title.trim() || !selectedFunnelId || !selectedStageId) {
      toast.error("Preencha o título, funil e etapa");
      return;
    }

    try {
      const dealData = {
        title: title.trim(),
        value: parseFloat(value) || 0,
        funnel_id: selectedFunnelId,
        stage_id: selectedStageId,
        company_id: selectedCompanyId || undefined,
        contact_name: contactName,
        contact_phone: contactPhone,
        probability: 50,
        status: "open",
      };
      
      console.log('[DealLinkDialog] Creating deal with data:', dealData);
      
      await createDeal.mutateAsync(dealData as any);

      toast.success("Negociação criada!");
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('[DealLinkDialog] Error creating deal:', error);
      toast.error(error?.message || "Erro ao criar negociação");
    }
  };

  const resetForm = () => {
    setTitle("");
    setValue("");
    setSelectedFunnelId("");
    setSelectedStageId("");
    setSelectedCompanyId("");
    setCompanySearch("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Negociações
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "link" | "create")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">
              <Search className="h-4 w-4 mr-2" />
              Vincular Existente
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="h-4 w-4 mr-2" />
              Nova Negociação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4">
            {/* Contact info */}
            {(contactName || contactPhone) && (
              <Card className="p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{contactName || "Contato"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contactPhone}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Linked deals */}
            {linkedDeals.length > 0 && (
              <div className="mb-4">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Negociações vinculadas ({linkedDeals.length})
                </Label>
                <div className="space-y-2">
                  {linkedDeals.map((deal) => (
                    <Card key={deal.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{deal.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                              {deal.stage_name}
                            </Badge>
                            <span>{formatCurrency(deal.value)}</span>
                          </div>
                        </div>
                        {onUnlinkDeal && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onUnlinkDeal(deal.id)}
                          >
                            Desvincular
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Search deals */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Buscar negociação</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o título ou empresa..."
                    value={searchDeal}
                    onChange={(e) => setSearchDeal(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Search results */}
              {searchDeal.length >= 2 && (
                <ScrollArea className="h-[200px]">
                  {searchingDeals ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchedDeals && searchedDeals.length > 0 ? (
                    <div className="space-y-2">
                      {searchedDeals.map((deal) => (
                        <Card 
                          key={deal.id} 
                          className={cn(
                            "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                            linkedDeals.some(d => d.id === deal.id) && "opacity-50"
                          )}
                          onClick={() => {
                            if (!linkedDeals.some(d => d.id === deal.id)) {
                              onLinkDeal?.(deal.id);
                              toast.success("Negociação vinculada!");
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{deal.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {deal.company_name && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {deal.company_name}
                                  </span>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px]"
                                  style={{ 
                                    borderColor: deal.stage_color,
                                    color: deal.stage_color 
                                  }}
                                >
                                  {deal.stage_name}
                                </Badge>
                                <span>{formatCurrency(deal.value)}</span>
                              </div>
                            </div>
                            {linkedDeals.some(d => d.id === deal.id) ? (
                              <Badge variant="secondary" className="text-[10px]">Vinculada</Badge>
                            ) : (
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma negociação encontrada</p>
                    </div>
                  )}
                </ScrollArea>
              )}

              {searchDeal.length < 2 && searchDeal.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Digite pelo menos 2 caracteres para buscar
                </p>
              )}

              {searchDeal.length === 0 && linkedDeals.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Busque uma negociação existente</p>
                  <p className="text-xs">ou crie uma nova na aba ao lado</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-4 space-y-4">
            {/* Contact info badge */}
            {(contactName || contactPhone) && (
              <Card className="p-3 bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>Contato: <strong>{contactName || contactPhone}</strong></span>
                </div>
              </Card>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label>Título da negociação *</Label>
              <Input
                placeholder="Ex: Proposta comercial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Funnel & Stage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Funil *</Label>
                <Select value={selectedFunnelId} onValueChange={handleFunnelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels?.filter(f => f.is_active).map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: funnel.color }}
                          />
                          {funnel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Etapa *</Label>
                <Select 
                  value={selectedStageId || "none"} 
                  onValueChange={(v) => setSelectedStageId(v === "none" ? "" : v)}
                  disabled={!selectedFunnelId || stages.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stages.length === 0 && selectedFunnelId ? "Carregando..." : "Selecione..."} />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="none" disabled>Selecione uma etapa</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id!}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label>Valor</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Company (optional) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa (opcional)
              </Label>
              <Command className="border rounded-md">
                <CommandInput
                  placeholder="Buscar empresa..."
                  value={companySearch}
                  onValueChange={setCompanySearch}
                />
                {companySearch && (
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa encontrada</CommandEmpty>
                    <CommandGroup>
                      {companies?.slice(0, 5).map((company) => (
                        <CommandItem
                          key={company.id}
                          value={company.name}
                          onSelect={() => {
                            setSelectedCompanyId(company.id);
                            setCompanySearch(company.name);
                          }}
                          className={cn(
                            selectedCompanyId === company.id && "bg-primary/10"
                          )}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          <div>
                            <p>{company.name}</p>
                            {company.cnpj && (
                              <p className="text-xs text-muted-foreground">{company.cnpj}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                )}
              </Command>
              {selectedCompanyId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCompanyId("");
                    setCompanySearch("");
                  }}
                >
                  Limpar empresa
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === "create" && (
            <Button 
              onClick={handleCreateDeal}
              disabled={!title.trim() || !selectedFunnelId || !selectedStageId || createDeal.isPending}
            >
              {createDeal.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Negociação
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
