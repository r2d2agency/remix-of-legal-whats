import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
 import { Search, Loader2, MessageSquare, Clock, Calendar, X, Filter } from 'lucide-react';
 import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
 import { formatDistanceToNow, subDays, startOfDay, endOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SearchResult {
  message_id: string;
  conversation_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  group_name: string | null;
  is_group: boolean;
  content: string;
  timestamp: string;
  is_from_me: boolean;
  attendance_status: 'waiting' | 'attending' | 'finished';
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectResult: (conversationId: string, messageId?: string) => void;
}

export function GlobalSearchDialog({ open, onOpenChange, onSelectResult }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState<{ results: SearchResult[], totalCount: number }>({ results: [], totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    const hasValidQuery = query.trim() && query.length >= 2;
    
    if (!hasValidQuery) {
      setResults({ results: [], totalCount: 0 });
      setSearched(false);
      return;
    }

    const search = async () => {
      if (!query.trim() || query.length < 2) {
        setResults({ results: [], totalCount: 0 });
        setSearched(false);
        return;
      }

      setLoading(true);
      setSearched(true);
      try {
        let url = `/api/chat/messages/search?q=${encodeURIComponent(query)}&limit=100`;
        if (startDate) url += `&from_date=${startDate}`;
        if (endDate) url += `&to_date=${endDate}`;
        
        const data = await api<{ results: SearchResult[], totalCount: number }>(url);
        setResults({ 
          results: data.results || [], 
          totalCount: data.totalCount || (data.results?.length || 0) 
        });
      } catch (error) {
        console.error('Global search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 400);
    return () => clearTimeout(timer);
  }, [query, startDate, endDate]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setStartDate('');
      setEndDate('');
      setResults({ results: [], totalCount: 0 });
      setSearched(false);
    }
  }, [open]);

  const handleSelect = useCallback((result: SearchResult) => {
    onSelectResult(result.conversation_id, result.message_id);
    onOpenChange(false);
  }, [onSelectResult, onOpenChange]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? (
         <mark key={i} className="bg-primary/20 text-primary px-0.5 rounded font-medium border-b border-primary/30">
          {part}
        </mark>
      ) : part
    );
  };

  const getContextSnippet = (content: string, query: string) => {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) return content.slice(0, 100);
    
    const start = Math.max(0, index - 30);
    const end = Math.min(content.length, index + query.length + 50);
    
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  };

  const getStatusLabel = (status: SearchResult['attendance_status']) => {
    if (status === 'waiting') return 'Aguardando';
    if (status === 'finished') return 'Finalizada';
    return 'Atendendo';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar em todas as conversas
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3">
          {/* Search Input */}
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite para buscar mensagens..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            {query.length > 0 && query.length < 2 && (
              <p className="text-xs text-muted-foreground">Digite pelo menos 2 caracteres</p>
            )}
          </div>

           {/* Date Filters */}
           <div className="flex flex-col space-y-2">
             <div className="flex items-center justify-between border-b pb-1 mb-1">
               <div className="flex items-center gap-1.5">
                 <Filter className="h-3 w-3 text-muted-foreground" />
                 <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Filtrar por período</span>
               </div>
               {(startDate || endDate) && (
                 <button 
                   onClick={() => { setStartDate(''); setEndDate(''); }}
                   className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium"
                 >
                   <X className="h-2.5 w-2.5" /> Limpar filtros
                 </button>
               )}
             </div>
             
             <div className="flex flex-wrap gap-1.5 mt-1">
               <Button
                 variant={startDate === format(new Date(), 'yyyy-MM-dd') && endDate === format(new Date(), 'yyyy-MM-dd') ? "default" : "outline"}
                 size="sm"
                 className="h-7 text-[10px] px-2.5 rounded-full"
                 onClick={() => {
                   const d = format(new Date(), 'yyyy-MM-dd');
                   setStartDate(d);
                   setEndDate(d);
                 }}
               >
                 Hoje
               </Button>
               <Button
                 variant={startDate === format(subDays(new Date(), 1), 'yyyy-MM-dd') && endDate === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? "default" : "outline"}
                 size="sm"
                 className="h-7 text-[10px] px-2.5 rounded-full"
                 onClick={() => {
                   const d = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                   setStartDate(d);
                   setEndDate(d);
                 }}
               >
                 Ontem
               </Button>
               <Button
                 variant={startDate === format(subDays(new Date(), 7), 'yyyy-MM-dd') && endDate === format(new Date(), 'yyyy-MM-dd') ? "default" : "outline"}
                 size="sm"
                 className="h-7 text-[10px] px-2.5 rounded-full"
                 onClick={() => {
                   setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                   setEndDate(format(new Date(), 'yyyy-MM-dd'));
                 }}
               >
                 Últimos 7 dias
               </Button>
               <Button
                 variant={startDate === format(subDays(new Date(), 30), 'yyyy-MM-dd') && endDate === format(new Date(), 'yyyy-MM-dd') ? "default" : "outline"}
                 size="sm"
                 className="h-7 text-[10px] px-2.5 rounded-full"
                 onClick={() => {
                   setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                   setEndDate(format(new Date(), 'yyyy-MM-dd'));
                 }}
               >
                 Últimos 30 dias
               </Button>
             </div>

              <p className="text-[10px] text-muted-foreground mt-1">Ou defina um intervalo personalizado:</p>
              <div className="grid grid-cols-2 gap-2 mt-0.5">
               <div className="relative">
                 <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                 <Input
                   type="date"
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="pl-8 h-8 text-xs"
                   title="Data inicial"
                 />
               </div>
               <div className="relative">
                 <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                 <Input
                   type="date"
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="pl-8 h-8 text-xs"
                   title="Data final"
                 />
               </div>
             </div>
           </div>
        </div>

         {/* Results */}
          <div className="flex-1 border-t min-h-0 overflow-y-auto">
           {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : results.results.length === 0 ? (
            searched && query.length >= 2 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma mensagem encontrada</p>
                <p className="text-xs mt-1">Tente outros termos de busca</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Busque por mensagens</p>
                <p className="text-xs mt-1">A busca inclui todas as suas conversas</p>
              </div>
            )
          ) : (
              <div className="divide-y pb-4">
               {results.results.map((result) => (
                <button
                  key={result.message_id}
                  className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
                  onClick={() => handleSelect(result)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(result.is_group ? result.group_name : result.contact_name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {result.is_group 
                            ? (result.group_name || 'Grupo')
                            : (result.contact_name || result.contact_phone || 'Desconhecido')}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(result.timestamp), { 
                            addSuffix: false, 
                            locale: ptBR 
                          })}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {result.is_from_me && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            Você
                          </Badge>
                        )}
                        {result.is_group && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            Grupo
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {getStatusLabel(result.attendance_status)}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {highlightText(getContextSnippet(result.content, query), query)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>

        {/* Footer */}
        {searched && (
          <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between items-center shrink-0">
            <div className="flex flex-col">
              <span>
                Mostrando {results.results.length} de {results.totalCount} resultado{results.totalCount !== 1 ? 's' : ''}
              </span>
              {results.totalCount > results.results.length && (
                <span className="text-[9px] opacity-70">
                  Refine a busca para ver resultados mais antigos
                </span>
              )}
            </div>
            {(startDate || endDate) && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                Período filtrado
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}