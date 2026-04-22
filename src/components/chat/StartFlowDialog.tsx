import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GitBranch, Loader2, Play, Tag, Zap, Search, ChevronRight, ChevronDown, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Flow } from "@/hooks/use-flows";
import { api } from "@/lib/api";

interface FlowWithCategory extends Omit<Flow, 'node_count'> {
  node_count?: number;
  category_name?: string | null;
  category_color?: string | null;
}

interface StartFlowDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  connectionId: string;
  onFlowStarted?: () => void;
}

export function StartFlowDialog({
  open,
  onClose,
  conversationId,
  connectionId,
  onFlowStarted,
}: StartFlowDialogProps) {
  const [flows, setFlows] = useState<FlowWithCategory[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && connectionId) {
      loadFlows();
      setSearchQuery("");
    }
  }, [open, connectionId]);

  const loadFlows = async () => {
    setLoadingFlows(true);
    try {
      const result = await api<FlowWithCategory[]>(
        `/api/flows/available/${connectionId}`,
        { auth: true }
      );
      setFlows(result);
      // Expand all categories by default
      const cats = new Set(result.map(f => f.category_name || '__uncategorized__'));
      setExpandedCategories(cats);
    } catch (error) {
      console.error("Error loading flows:", error);
      setFlows([]);
    }
    setLoadingFlows(false);
  };

  const filteredFlows = useMemo(() => {
    if (!searchQuery.trim()) return flows;
    const q = searchQuery.toLowerCase();
    return flows.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.category_name?.toLowerCase().includes(q)
    );
  }, [flows, searchQuery]);

  const groupedFlows = useMemo(() => {
    const groups: Record<string, { name: string; color: string; flows: FlowWithCategory[] }> = {};
    for (const flow of filteredFlows) {
      const key = flow.category_name || '__uncategorized__';
      if (!groups[key]) {
        groups[key] = {
          name: flow.category_name || 'Sem categoria',
          color: flow.category_color || '#6b7280',
          flows: []
        };
      }
      groups[key].flows.push(flow);
    }
    return groups;
  }, [filteredFlows]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleStartFlow = async (flow: FlowWithCategory) => {
    setStarting(flow.id);
    try {
      const result = await api<{ success: boolean; execution?: { success: boolean; error?: string; nodesProcessed?: number } }>(
        `/api/flows/conversation/${conversationId}/start`,
        { method: 'POST', body: { flow_id: flow.id }, auth: true }
      );
      if (result.execution?.nodesProcessed) {
        toast.success(`Fluxo "${flow.name}" iniciado! (${result.execution.nodesProcessed} nós processados)`);
      } else {
        toast.success(`Fluxo "${flow.name}" iniciado!`);
      }
      onFlowStarted?.();
      onClose();
    } catch (error: any) {
      const errorMsg = error?.message || "Erro ao iniciar fluxo";
      toast.error(errorMsg);
    }
    setStarting(null);
  };

  const categoryKeys = Object.keys(groupedFlows);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Iniciar Fluxo
          </DialogTitle>
          <DialogDescription>
            Selecione um fluxo para executar nesta conversa
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fluxo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loadingFlows ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum fluxo disponível para esta conexão</p>
            <p className="text-sm mt-1">Configure fluxos em Atendimento → Fluxos</p>
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum fluxo encontrado para "{searchQuery}"</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-[300px]">
            <div className="space-y-1">
              {categoryKeys.map((catKey) => {
                const group = groupedFlows[catKey];
                const isExpanded = expandedCategories.has(catKey);

                return (
                  <div key={catKey}>
                    {/* Category header */}
                    <button
                      className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleCategory(catKey)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FolderOpen className="h-4 w-4" style={{ color: group.color }} />
                      <span className="font-medium text-sm flex-1">{group.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.flows.length}
                      </Badge>
                    </button>

                    {/* Flows in category */}
                    {isExpanded && (
                      <div className="ml-4 space-y-1 mb-2">
                        {group.flows.map((flow) => (
                          <Card
                            key={flow.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleStartFlow(flow)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm truncate">{flow.name}</h4>
                                    {flow.trigger_enabled && (
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        <Zap className="h-3 w-3 mr-1" />
                                        Auto
                                      </Badge>
                                    )}
                                  </div>
                                  {flow.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {flow.description}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={starting === flow.id}
                                  onClick={(e) => { e.stopPropagation(); handleStartFlow(flow); }}
                                  className="shrink-0"
                                >
                                  {starting === flow.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
