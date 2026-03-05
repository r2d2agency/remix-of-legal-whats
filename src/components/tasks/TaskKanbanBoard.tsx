import { useState, useMemo } from "react";
import {
  DndContext, DragOverlay, closestCenter, DragStartEvent, DragEndEvent, DragOverEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, MeasuringStrategy
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard, TaskBoardColumn } from "@/hooks/use-task-boards";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Paperclip, CheckSquare, MessageSquare, User, Clock, AlertTriangle } from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskKanbanBoardProps {
  columns: TaskBoardColumn[];
  cards: TaskCard[];
  onCardClick: (card: TaskCard) => void;
  onCardMove: (cardId: string, columnId: string, position: number) => void;
}

// ========== MINI CARD ==========

function MiniTaskCard({ card, isDragging, onClick }: { card: TaskCard; isDragging?: boolean; onClick: () => void }) {
  const isOverdue = card.due_date && isPast(parseISO(card.due_date)) && card.status !== 'completed';
  const isDueToday = card.due_date && isToday(parseISO(card.due_date));
  const checklistProgress = card.checklist_total ? Math.round(((card.checklist_done || 0) / card.checklist_total) * 100) : null;

  const priorityColors: Record<string, string> = {
    urgent: "border-l-red-500",
    high: "border-l-orange-500",
    medium: "border-l-yellow-500",
    low: "border-l-muted",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-lg border border-border shadow-sm p-3 cursor-pointer",
        "hover:shadow-md transition-all duration-200",
        "border-l-4",
        priorityColors[card.priority] || "border-l-muted",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-xl",
        card.status === 'completed' && "opacity-60"
      )}
    >
      {card.cover_image_url && (
        <img src={card.cover_image_url} alt="" className="w-full h-24 object-cover rounded-md mb-2" />
      )}

      <div className="flex items-start gap-1.5 mb-1">
        {card.status === 'completed' ? (
          <CheckSquare className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
        <p className={cn(
          "text-sm font-medium line-clamp-2 break-words",
          card.status === 'completed' && "line-through text-muted-foreground"
        )}>
          {card.title}
        </p>
      </div>

      {(card.deal_title || card.company_name) && (
        <p className="text-xs text-muted-foreground truncate mb-2">
          {card.deal_title}{card.deal_title && card.company_name && " • "}{card.company_name}
        </p>
      )}

      {checklistProgress !== null && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <CheckSquare className="h-3 w-3" />
            <span>{card.checklist_done}/{card.checklist_total}</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", checklistProgress === 100 ? "bg-green-500" : "bg-primary")}
              style={{ width: `${checklistProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {card.due_date && (
            <span className={cn(
              "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
              isOverdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
              isDueToday ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "text-muted-foreground"
            )}>
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {format(parseISO(card.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}
          {(card.attachment_count || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />{card.attachment_count}
            </span>
          )}
          {(card.comment_count || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />{card.comment_count}
            </span>
          )}
        </div>
        {card.assigned_name && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />{card.assigned_name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ========== SORTABLE CARD WRAPPER ==========

function SortableCard({ card, onCardClick }: { card: TaskCard; onCardClick: (c: TaskCard) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={cn("touch-manipulation", isDragging && "opacity-30 scale-95")}
    >
      <MiniTaskCard card={card} onClick={() => !isDragging && onCardClick(card)} />
    </div>
  );
}

// ========== COLUMN ==========

function TaskColumn({
  column, cards, onCardClick, activeId, overId
}: {
  column: TaskBoardColumn; cards: TaskCard[];
  onCardClick: (c: TaskCard) => void; activeId: string | null; overId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });
  const isDraggingOver = isOver || overId === `column-${column.id}`;
  const hasActiveItem = cards.some(c => c.id === activeId);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[280px] min-w-[280px] max-w-[280px] bg-muted/50 rounded-lg border overflow-hidden shrink-0",
        "transition-all duration-300",
        isDraggingOver && !hasActiveItem && "ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between"
        style={{ borderTopColor: column.color, borderTopWidth: 4, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm truncate">{column.name}</h3>
          <Badge variant="secondary" className="text-xs shrink-0">{cards.length}</Badge>
        </div>
        {column.is_done_column && <span className="text-xs">✅</span>}
      </div>

      {/* Cards */}
      <div className="flex-1 max-h-[calc(100vh-280px)] overflow-y-auto p-2 space-y-2">
        {isDraggingOver && cards.length === 0 && !hasActiveItem && (
          <div className="h-20 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 flex items-center justify-center animate-pulse">
            <span className="text-sm text-primary font-medium">Soltar aqui</span>
          </div>
        )}
        {cards.length === 0 && !isDraggingOver && (
          <div className="py-8 text-center text-muted-foreground text-sm">Nenhum card</div>
        )}
        {cards.map(card => (
          <SortableCard key={card.id} card={card} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ========== MAIN BOARD ==========

export function TaskKanbanBoard({ columns, cards, onCardClick, onCardMove }: TaskKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const cardsByColumn = useMemo(() => {
    const map: Record<string, TaskCard[]> = {};
    for (const col of columns) {
      map[col.id] = cards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, cards]);

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find(c => c.id === activeId) || null;
  }, [activeId, cards]);

  const findColumnForCard = (cardId: string): string | null => {
    for (const [colId, colCards] of Object.entries(cardsByColumn)) {
      if (colCards.some(c => c.id === cardId)) return colId;
    }
    return null;
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    const cardId = active.id as string;
    const targetId = over.id as string;
    if (cardId === targetId) return;

    const currentColId = findColumnForCard(cardId);
    if (!currentColId) return;

    // Check if dropped on a column droppable (prefixed with "column-")
    const isColumnDrop = targetId.startsWith("column-");
    let targetColId: string | null = null;
    let targetPosition = 0;

    if (isColumnDrop) {
      targetColId = targetId.replace("column-", "");
      targetPosition = (cardsByColumn[targetColId]?.length || 0);
    } else {
      // Dropped on a card - find which column that card belongs to
      targetColId = findColumnForCard(targetId);
      const targetCards = cardsByColumn[targetColId!] || [];
      const targetIdx = targetCards.findIndex(c => c.id === targetId);
      targetPosition = targetIdx >= 0 ? targetIdx : 0;
    }

    if (!targetColId) return;
    onCardMove(cardId, targetColId, targetPosition);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragOver={(e: DragOverEvent) => setOverId(e.over?.id as string || null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-3 p-4 min-w-max">
          {columns.map(col => (
            <SortableContext key={col.id} items={(cardsByColumn[col.id] || []).map(c => c.id)} strategy={verticalListSortingStrategy}>
              <TaskColumn column={col} cards={cardsByColumn[col.id] || []} onCardClick={onCardClick} activeId={activeId} overId={overId} />
            </SortableContext>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }} style={{ cursor: 'grabbing' }}>
        {activeCard ? (
          <div className="rotate-2 scale-105 shadow-2xl w-[270px]">
            <MiniTaskCard card={activeCard} isDragging onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
