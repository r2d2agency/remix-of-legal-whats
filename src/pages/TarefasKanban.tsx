import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useTaskBoards, useTaskBoardColumns, useTaskBoardCards,
  useTaskBoardMutations, useTaskColumnMutations, useTaskCardMutations,
  useEnsureDefaultBoard, useMigrateCRMTasks,
  TaskBoard, TaskBoardColumn,
} from "@/hooks/use-task-boards";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TaskCardDetailDialog } from "@/components/tasks/TaskCardDetailDialog";
import { ChecklistTemplateManager } from "@/components/tasks/ChecklistTemplateManager";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizations } from "@/hooks/use-organizations";
import { cn } from "@/lib/utils";
import {
  Plus, Kanban, LayoutGrid, Settings, Trash2, ListChecks, Download, GanttChart,
  Loader2, ChevronDown, Pencil, Filter, CalendarIcon, Users, X
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;
}

export default function TarefasKanban() {
  const { user } = useAuth();
  const { getMembers } = useOrganizations();
  const { data: boards, isLoading: boardsLoading } = useTaskBoards();
  const boardMut = useTaskBoardMutations();
  const ensureDefault = useEnsureDefaultBoard();
  const migrateTasks = useMigrateCRMTasks();

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetailOpen, setCardDetailOpen] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGantt, setShowGantt] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardGlobal, setNewBoardGlobal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardAssignee, setNewCardAssignee] = useState<string>("");
  const [showNewCard, setShowNewCard] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);

  // Filters
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterDueFrom, setFilterDueFrom] = useState<Date | undefined>();
  const [filterDueTo, setFilterDueTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = user?.role && ['owner', 'admin', 'manager'].includes(user.role);

  // Load org members
  useEffect(() => {
    if (user?.organization_id) {
      getMembers(user.organization_id).then(setOrgMembers);
    }
  }, [user?.organization_id, getMembers]);

  // Ensure default board exists
  useEffect(() => {
    if (!boardsLoading && boards && boards.length === 0) {
      ensureDefault.mutate();
    }
  }, [boardsLoading, boards]);

  // Auto-select first board
  useEffect(() => {
    if (boards?.length && !selectedBoardId) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  const selectedBoard = boards?.find(b => b.id === selectedBoardId);
  const { data: columns, isLoading: colsLoading } = useTaskBoardColumns(selectedBoardId);

  // Build filter params
  const cardFilters = useMemo(() => ({
    filter_user: filterUser,
    due_from: filterDueFrom ? format(filterDueFrom, 'yyyy-MM-dd') : undefined,
    due_to: filterDueTo ? format(filterDueTo, 'yyyy-MM-dd') : undefined,
  }), [filterUser, filterDueFrom, filterDueTo]);

  const { data: cards, isLoading: cardsLoading } = useTaskBoardCards(selectedBoardId, cardFilters);
  const columnMut = useTaskColumnMutations(selectedBoardId);
  const cardMut = useTaskCardMutations(selectedBoardId);

  const hasActiveFilters = filterUser !== 'all' || !!filterDueFrom || !!filterDueTo;

  const clearFilters = () => {
    setFilterUser("all");
    setFilterDueFrom(undefined);
    setFilterDueTo(undefined);
  };

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    boardMut.createBoard.mutate({ name: newBoardName, is_global: newBoardGlobal });
    setNewBoardName("");
    setNewBoardGlobal(false);
    setShowNewBoard(false);
  };

  const handleDeleteBoard = (boardId: string) => {
    if (confirm("Excluir este quadro e todos os cards?")) {
      boardMut.deleteBoard.mutate(boardId);
      if (selectedBoardId === boardId) {
        setSelectedBoardId(boards?.find(b => b.id !== boardId)?.id || null);
      }
    }
  };

  const handleCardMove = (cardId: string, columnId: string, position: number) => {
    cardMut.moveCard.mutate({ id: cardId, column_id: columnId, position });
  };

  const handleCreateCard = () => {
    if (!newCardTitle.trim() || !selectedBoardId || !columns?.length) return;
    const firstCol = columns.sort((a, b) => a.position - b.position)[0];
    cardMut.createCard.mutate({
      board_id: selectedBoardId,
      column_id: firstCol.id,
      title: newCardTitle,
      assigned_to: newCardAssignee || undefined,
    } as any);
    setNewCardTitle("");
    setNewCardAssignee("");
    setShowNewCard(false);
  };

  const handleMoveBetweenBoards = (cardId: string, targetBoardId: string) => {
    cardMut.moveCard.mutate({ id: cardId, board_id: targetBoardId });
  };

  // Gantt data
  const ganttData = useMemo(() => {
    if (!cards) return [];
    return cards
      .filter(c => c.start_date || c.due_date)
      .sort((a, b) => {
        const aDate = a.start_date || a.due_date || a.created_at;
        const bDate = b.start_date || b.due_date || b.created_at;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
  }, [cards]);

  return (
    <MainLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas tarefas em quadros Kanban</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
              <ListChecks className="h-4 w-4 mr-2" />Templates
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGantt(!showGantt)}>
              <GanttChart className="h-4 w-4 mr-2" />{showGantt ? "Kanban" : "Gantt"}
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => migrateTasks.mutate()} disabled={migrateTasks.isPending}>
                <Download className="h-4 w-4 mr-2" />
                {migrateTasks.isPending ? "Migrando..." : "Migrar Tarefas CRM"}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowNewCard(true)}>
              <Plus className="h-4 w-4 mr-2" />Novo Card
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                {[filterUser !== 'all', !!filterDueFrom, !!filterDueTo].filter(Boolean).length}
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          )}

          {showFilters && (
            <>
              {/* User filter - only for admin/manager */}
              {isAdmin && selectedBoard?.is_global && (
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {orgMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", filterDueFrom && "border-primary")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {filterDueFrom ? format(filterDueFrom, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDueFrom}
                    onSelect={setFilterDueFrom}
                    className="p-3 pointer-events-auto"
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", filterDueTo && "border-primary")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {filterDueTo ? format(filterDueTo, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDueTo}
                    onSelect={setFilterDueTo}
                    className="p-3 pointer-events-auto"
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}

          {!isAdmin && selectedBoard?.is_global && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Exibindo apenas suas tarefas
            </span>
          )}
        </div>

        {/* Board Tabs */}
        <div className="border-b px-4 flex items-center gap-2 overflow-x-auto">
          <ScrollArea className="flex-1">
            <div className="flex items-center gap-1 py-2">
              {boards?.map(board => (
                <Button
                  key={board.id}
                  variant={selectedBoardId === board.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedBoardId(board.id)}
                  className="whitespace-nowrap gap-2 shrink-0"
                >
                  {board.is_global ? <LayoutGrid className="h-3 w-3" /> : <Kanban className="h-3 w-3" />}
                  {board.name}
                  {!board.is_global && board.created_by !== user?.id && (
                    <span className="text-[10px] opacity-70">({board.creator_name?.split(' ')[0]})</span>
                  )}
                  <Badge variant="secondary" className="text-xs ml-1">{board.card_count || 0}</Badge>
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setShowNewBoard(true)} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </ScrollArea>
          {selectedBoard && (
            <div className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowColumnSettings(true)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
              {selectedBoard && !boards?.find(b => b.id === selectedBoardId && b.is_global && boards.filter(x => x.is_global).indexOf(b) === 0) && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteBoard(selectedBoardId!)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {boardsLoading || colsLoading || cardsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : showGantt ? (
            /* Gantt View */
            <ScrollArea className="h-full">
              <div className="p-4">
                <h3 className="font-semibold mb-4">Cronograma (Gantt)</h3>
                {ganttData.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma tarefa com datas definidas</p>
                ) : (
                  <div className="space-y-2">
                    {ganttData.map(card => {
                      const start = card.start_date ? parseISO(card.start_date) : (card.due_date ? parseISO(card.due_date) : new Date());
                      const end = card.due_date ? parseISO(card.due_date) : start;
                      const days = Math.max(1, differenceInDays(end, start) + 1);
                      const col = columns?.find(c => c.id === card.column_id);

                      return (
                        <div key={card.id} className="flex items-center gap-3 py-1 cursor-pointer hover:bg-muted/50 rounded px-2"
                          onClick={() => { setSelectedCardId(card.id); setCardDetailOpen(true); }}>
                          <div className="w-48 min-w-[12rem]">
                            <p className="text-sm font-medium truncate">{card.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(start, "dd/MM", { locale: ptBR })} → {format(end, "dd/MM", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex-1">
                            <div
                              className="h-6 rounded-md flex items-center px-2 text-xs text-white font-medium"
                              style={{
                                width: `${Math.min(days * 30, 100)}%`,
                                minWidth: '60px',
                                backgroundColor: col?.color || '#6B7280',
                              }}
                            >
                              {days}d
                            </div>
                          </div>
                          {card.assigned_name && (
                            <span className="text-xs text-muted-foreground w-20 text-right truncate">{card.assigned_name.split(' ')[0]}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : columns && cards ? (
            <TaskKanbanBoard
              columns={columns}
              cards={cards}
              onCardClick={card => { setSelectedCardId(card.id); setCardDetailOpen(true); }}
              onCardMove={handleCardMove}
            />
          ) : null}
        </div>

        {/* Card Detail Dialog */}
        <TaskCardDetailDialog
          cardId={selectedCardId}
          boardId={selectedBoardId}
          isGlobal={selectedBoard?.is_global || false}
          open={cardDetailOpen}
          onOpenChange={setCardDetailOpen}
          orgMembers={orgMembers.map(m => ({ user_id: m.user_id, name: m.name }))}
          allBoards={(boards || []).map(b => ({ id: b.id, name: b.name, is_global: b.is_global }))}
        />

        {/* New Board Dialog */}
        <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Quadro</DialogTitle>
              <DialogDescription>Crie um quadro pessoal ou global para organizar tarefas</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="Nome do quadro" autoFocus />
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newBoardGlobal} onChange={e => setNewBoardGlobal(e.target.checked)} />
                  Quadro Global (visível para toda organização)
                </label>
              )}
              <Button onClick={handleCreateBoard} disabled={!newBoardName.trim()} className="w-full">
                Criar Quadro
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Card Dialog */}
        <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Card</DialogTitle>
              <DialogDescription>Criar um novo card de tarefa no quadro atual</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateCard()}
                placeholder="Título do card"
                autoFocus
              />
              {/* Assignee - on global boards, allow assigning to other users */}
              {selectedBoard?.is_global && orgMembers.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                  <Select value={newCardAssignee || "me"} onValueChange={(v) => setNewCardAssignee(v === "me" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      <SelectValue placeholder="Para mim" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">Para mim</SelectItem>
                      {orgMembers.filter(m => m.is_active !== false).map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O card será criado na primeira coluna do quadro "{selectedBoard?.name}"
              </p>
              <Button onClick={handleCreateCard} disabled={!newCardTitle.trim()} className="w-full">
                Criar Card
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Column Settings Dialog */}
        <ColumnSettingsDialog
          open={showColumnSettings}
          onOpenChange={setShowColumnSettings}
          boardId={selectedBoardId}
          columns={columns || []}
          columnMut={columnMut}
        />

        {/* Checklist Templates */}
        <ChecklistTemplateManager open={showTemplates} onOpenChange={setShowTemplates} />
      </div>
    </MainLayout>
  );
}

// ========== Column Settings Dialog ==========

function ColumnSettingsDialog({
  open, onOpenChange, boardId, columns, columnMut
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  boardId: string | null; columns: TaskBoardColumn[];
  columnMut: ReturnType<typeof useTaskColumnMutations>;
}) {
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("#6B7280");

  const handleAdd = () => {
    if (!newColName.trim()) return;
    columnMut.createColumn.mutate({ name: newColName, color: newColColor });
    setNewColName("");
    setNewColColor("#6B7280");
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir esta coluna? Os cards serão movidos para a primeira coluna.")) {
      columnMut.deleteColumn.mutate(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colunas do Quadro</DialogTitle>
          <DialogDescription>Gerencie as colunas do quadro Kanban</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {columns.sort((a, b) => a.position - b.position).map(col => (
            <div key={col.id} className="flex items-center gap-2 p-2 border rounded">
              <input type="color" value={col.color} onChange={e => columnMut.updateColumn.mutate({ id: col.id, color: e.target.value })} className="h-6 w-6 rounded cursor-pointer" />
              <Input
                defaultValue={col.name}
                onBlur={e => {
                  if (e.target.value !== col.name) columnMut.updateColumn.mutate({ id: col.id, name: e.target.value });
                }}
                className="h-8 flex-1"
              />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input type="checkbox" checked={col.is_done_column}
                  onChange={e => columnMut.updateColumn.mutate({ id: col.id, is_done_column: e.target.checked })} />
                Final
              </label>
              {columns.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(col.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 border-t pt-3">
            <input type="color" value={newColColor} onChange={e => setNewColColor(e.target.value)} className="h-6 w-6 rounded cursor-pointer" />
            <Input value={newColName} onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nova coluna" className="h-8 flex-1" />
            <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newColName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
