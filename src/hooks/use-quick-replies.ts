import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut?: string;
  category?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateQuickReplyData {
  title: string;
  content: string;
  shortcut?: string;
  category?: string;
}

export function useQuickReplies() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getQuickReplies = useCallback(async (category?: string, search?: string): Promise<QuickReply[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      
      const queryString = params.toString();
      const url = `/api/quick-replies${queryString ? `?${queryString}` : ''}`;
      
      const response = await api<QuickReply[]>(url);
      return response;
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar respostas rápidas');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getCategories = useCallback(async (): Promise<string[]> => {
    try {
      const response = await api<string[]>('/api/quick-replies/categories');
      return response;
    } catch (err: any) {
      console.error('Erro ao buscar categorias:', err);
      return [];
    }
  }, []);

  const createQuickReply = useCallback(async (data: CreateQuickReplyData): Promise<QuickReply | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<QuickReply>('/api/quick-replies', {
        method: 'POST',
        body: data,
      });
      return response;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar resposta rápida');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuickReply = useCallback(async (id: string, data: CreateQuickReplyData): Promise<QuickReply | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<QuickReply>(`/api/quick-replies/${id}`, {
        method: 'PATCH',
        body: data,
      });
      return response;
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar resposta rápida');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteQuickReply = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/quick-replies/${id}`, { method: 'DELETE' });
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir resposta rápida');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getQuickReplies,
    getCategories,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
  };
}
