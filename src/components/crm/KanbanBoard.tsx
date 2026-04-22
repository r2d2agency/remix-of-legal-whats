import { useState, useMemo } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  DragStartEvent, 
  DragEndEvent, 
  DragOverEvent,
  PointerSensor, 
  useSensor, 
  useSensors,
  MeasuringStrategy
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import { CRMDeal, CRMStage, useCRMDealMutations } from "@/hooks/use-crm";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  stages: CRMStage[];
  dealsByStage: Record<string, CRMDeal[]>;
  onDealClick: (deal: CRMDeal) => void;
   onStatusChange?: (dealId: string, status: 'won' | 'lost' | 'paused' | 'open', dealTitle?: string, stageId?: string) => void;
  newWinDealId?: string | null;
  selectedDeals?: Set<string>;
  onToggleSelect?: (dealId: string) => void;
  selectionMode?: boolean;
}

export function KanbanBoard({ stages, dealsByStage, onDealClick, onStatusChange, newWinDealId, selectedDeals, onToggleSelect, selectionMode }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const { moveDeal } = useCRMDealMutations();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const activeDeal = useMemo(() => {
    if (!activeId) return null;
    for (const deals of Object.values(dealsByStage)) {
      const deal = deals.find((d) => d.id === activeId);
      if (deal) return deal;
    }
    return null;
  }, [activeId, dealsByStage]);

  const findStageForDeal = (dealId: string): string | null => {
    for (const [stageId, deals] of Object.entries(dealsByStage)) {
      if (deals.some((d) => d.id === dealId)) {
        return stageId;
      }
    }
    return null;
  };

  function handleDragStart(event: DragStartEvent) {
    if (selectionMode) return; // disable drag in selection mode
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over?.id as string || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const dealId = active.id as string;
    const targetId = over.id as string;

    if (dealId === targetId) return;

    const currentStageId = findStageForDeal(dealId);
    if (!currentStageId) return;

    const isStageColumn = stages.some((s) => s.id === targetId);
    
    let targetStageId: string | null = null;
    let targetDealId: string | null = null;
    
    if (isStageColumn) {
      targetStageId = targetId;
    } else {
      targetStageId = findStageForDeal(targetId);
      targetDealId = targetId;
    }

    if (!targetStageId) return;

     if (currentStageId === targetStageId && targetDealId) {
       moveDeal.mutate({ id: dealId, over_deal_id: targetDealId });
     } else if (currentStageId !== targetStageId) {
       const targetStage = stages.find(s => s.id === targetStageId);
       const isLostStage = targetStage?.is_final && targetStage.name.toLowerCase().includes('perdido');
       
       if (isLostStage && onStatusChange) {
         onStatusChange(dealId, 'lost', undefined, targetStageId);
       } else {
         moveDeal.mutate({ id: dealId, stage_id: targetStageId });
       }
     }
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
  }

  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={measuringConfig}
    >
      <ScrollArea className="w-full" role="region" aria-label="Quadro Kanban de negociações">
        <div className="flex gap-4 p-4 min-w-max" role="list" aria-label="Etapas do funil">
          {stages.map((stage) => {
            const deals = dealsByStage[stage.id!] || [];
            const stageValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);

            return (
              <SortableContext
                key={stage.id}
                items={deals.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <KanbanColumn
                  stage={stage}
                  deals={deals}
                  totalValue={stageValue}
                  onDealClick={onDealClick}
                  onStatusChange={onStatusChange}
                  newWinDealId={newWinDealId}
                  activeId={activeId}
                  overId={overId}
                  selectedDeals={selectedDeals}
                  onToggleSelect={onToggleSelect}
                  selectionMode={selectionMode}
                />
              </SortableContext>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay 
        dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        style={{ cursor: 'grabbing' }}
      >
        {activeDeal ? (
          <div className="rotate-2 scale-105 shadow-2xl">
            <DealCard deal={activeDeal} isDragging onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
