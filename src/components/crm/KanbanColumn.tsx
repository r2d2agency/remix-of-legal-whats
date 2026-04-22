import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DealCard } from "./DealCard";
import { CRMDeal, CRMStage } from "@/hooks/use-crm";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface KanbanColumnProps {
  stage: CRMStage;
  deals: CRMDeal[];
  totalValue: number;
  onDealClick: (deal: CRMDeal) => void;
   onStatusChange?: (dealId: string, status: 'won' | 'lost' | 'paused' | 'open', dealTitle?: string, stageId?: string) => void;
  newWinDealId?: string | null;
  activeId?: string | null;
  overId?: string | null;
  selectedDeals?: Set<string>;
  onToggleSelect?: (dealId: string) => void;
  selectionMode?: boolean;
}

// Sortable Deal Item wrapper for smooth animations
function SortableDealItem({ 
  deal, 
  onDealClick, 
  onStatusChange, 
  isNewWin,
  isActive,
  isOver,
  activeId,
  isSelected,
  onToggleSelect,
  selectionMode
}: { 
  deal: CRMDeal; 
  onDealClick: (deal: CRMDeal) => void;
   onStatusChange?: (dealId: string, status: 'won' | 'lost' | 'paused' | 'open', dealTitle?: string, stageId?: string) => void;
  isNewWin?: boolean;
  isActive?: boolean;
  isOver?: boolean;
  activeId?: string | null;
  isSelected?: boolean;
  onToggleSelect?: (dealId: string) => void;
  selectionMode?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ 
    id: deal.id,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  // Show drop indicator line when another item is being dragged over this one
  const showDropIndicator = isOver && !isDragging && activeId && activeId !== deal.id;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...(selectionMode ? {} : { ...attributes, ...listeners })}
      className={cn(
        "relative group touch-manipulation",
        "transition-all duration-200 ease-out",
        isDragging && "opacity-30 scale-95",
        isSorting && !isDragging && "transition-transform",
        isSelected && "ring-2 ring-primary rounded-lg"
      )}
    >
      {/* Drop indicator line above */}
      {showDropIndicator && (
        <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full animate-pulse z-20" aria-hidden="true" />
      )}
      
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-2 left-2 z-20">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(deal.id)}
            onClick={(e) => e.stopPropagation()}
            className="bg-background"
          />
        </div>
      )}
      
      <DealCard
        deal={deal}
        onClick={(e) => {
          e.stopPropagation();
          if (selectionMode) {
            onToggleSelect?.(deal.id);
            return;
          }
          if (!isDragging) {
            onDealClick(deal);
          }
        }}
        isNewWin={isNewWin}
        isDragging={isDragging}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

export function KanbanColumn({ 
  stage, 
  deals, 
  totalValue, 
  onDealClick, 
  onStatusChange, 
  newWinDealId,
  activeId,
  overId,
  selectedDeals,
  onToggleSelect,
  selectionMode
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id!,
  });

  // Check if dragging over this column (either the column itself or a card in it)
  const isDraggingOverColumn = isOver || deals.some(d => d.id === overId);
  
  // Check if the active item belongs to this column
  const hasActiveItem = deals.some(d => d.id === activeId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      aria-label={`Etapa ${stage.name}, ${deals.length} negociações, total ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}`}
      className={cn(
        "flex flex-col w-[300px] min-w-[300px] max-w-[300px] bg-muted/50 rounded-lg border overflow-hidden",
        "transition-all duration-300 ease-out",
        isDraggingOverColumn && !hasActiveItem && "ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]",
        hasActiveItem && "opacity-90"
      )}
    >
      {/* Header */}
      <div 
        className="p-3 border-b flex items-center justify-between"
        style={{ borderTopColor: stage.color, borderTopWidth: 4, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {deals.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
        <div className="p-2 space-y-2" role="list" aria-label={`Negociações em ${stage.name}`}>
          {/* Drop indicator when hovering over empty column */}
          {isDraggingOverColumn && deals.length === 0 && !hasActiveItem && (
            <div 
              className={cn(
                "h-28 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10",
                "flex items-center justify-center",
                "transition-all duration-300 ease-out",
                "animate-pulse"
              )}
            >
              <span className="text-sm text-primary font-medium">Soltar aqui</span>
            </div>
          )}
          
          {deals.length === 0 && !isDraggingOverColumn ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhuma negociação
            </div>
          ) : (
            deals.map((deal) => (
              <SortableDealItem
                key={deal.id}
                deal={deal}
                onDealClick={onDealClick}
                onStatusChange={onStatusChange}
                isNewWin={newWinDealId === deal.id}
                isActive={activeId === deal.id}
                isOver={overId === deal.id}
                activeId={activeId}
                isSelected={selectedDeals?.has(deal.id)}
                onToggleSelect={onToggleSelect}
                selectionMode={selectionMode}
              />
            ))
          )}
          
          {/* Drop indicator at the bottom when dragging over column with cards */}
          {isDraggingOverColumn && deals.length > 0 && !hasActiveItem && !deals.some(d => d.id === overId) && (
            <div 
              className={cn(
                "h-20 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5",
                "flex items-center justify-center mt-2",
                "transition-all duration-300 ease-out"
              )}
            >
              <span className="text-xs text-primary/70">Soltar aqui</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {stage.is_final && (
        <div className="p-2 border-t bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">
            {stage.name === "Ganho" ? "🎉" : "❌"} Etapa final
          </span>
        </div>
      )}
    </div>
  );
}
