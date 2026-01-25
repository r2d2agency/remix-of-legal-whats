import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  max_concurrent_chats: number;
  auto_assign: boolean;
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  welcome_message: string | null;
  offline_message: string | null;
  queue_message: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  member_count?: number;
  available_count?: number;
  active_chats?: number;
  pending_chats?: number;
  // User-specific
  my_role?: 'supervisor' | 'agent';
  is_available?: boolean;
  current_chats?: number;
}

export interface DepartmentMember {
  id: string;
  department_id: string;
  user_id: string;
  role: 'supervisor' | 'agent';
  is_available: boolean;
  current_chats: number;
  created_at: string;
  user_name: string;
  user_email: string;
  avatar_url: string | null;
}

export const useDepartments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listar todos os departamentos da organização
  const getDepartments = useCallback(async (): Promise<Department[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Department[]>('/api/departments', { auth: true });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar departamentos';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar departamento por ID
  const getDepartment = useCallback(async (id: string): Promise<Department | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Department>(`/api/departments/${id}`, { auth: true });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar departamento';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Criar departamento
  const createDepartment = useCallback(async (data: Partial<Department>): Promise<Department | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Department>('/api/departments', {
        method: 'POST',
        body: data,
        auth: true,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar departamento';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualizar departamento
  const updateDepartment = useCallback(async (id: string, data: Partial<Department>): Promise<Department | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Department>(`/api/departments/${id}`, {
        method: 'PATCH',
        body: data,
        auth: true,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar departamento';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Deletar departamento
  const deleteDepartment = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/departments/${id}`, { method: 'DELETE', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar departamento';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Listar membros de um departamento
  const getMembers = useCallback(async (departmentId: string): Promise<DepartmentMember[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<DepartmentMember[]>(`/api/departments/${departmentId}/members`, { auth: true });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar membros';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Adicionar membro ao departamento
  const addMember = useCallback(async (departmentId: string, userId: string, role: 'supervisor' | 'agent' = 'agent'): Promise<DepartmentMember | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<DepartmentMember>(`/api/departments/${departmentId}/members`, {
        method: 'POST',
        body: { user_id: userId, role },
        auth: true,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar membro';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Remover membro do departamento
  const removeMember = useCallback(async (departmentId: string, userId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/departments/${departmentId}/members/${userId}`, { method: 'DELETE', auth: true });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover membro';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Listar meus departamentos
  const getMyDepartments = useCallback(async (): Promise<Department[]> => {
    try {
      const result = await api<Department[]>('/api/departments/user/my-departments', { auth: true });
      return result;
    } catch {
      return [];
    }
  }, []);

  // Atualizar minha disponibilidade
  const setMyAvailability = useCallback(async (isAvailable: boolean): Promise<boolean> => {
    try {
      await api('/api/departments/user/availability', {
        method: 'PATCH',
        body: { is_available: isAvailable },
        auth: true,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Transferir conversa para departamento
  const transferToDepartment = useCallback(async (conversationId: string, departmentId: string): Promise<boolean> => {
    try {
      await api(`/api/departments/transfer/${conversationId}`, {
        method: 'POST',
        body: { department_id: departmentId },
        auth: true,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao transferir';
      setError(message);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    getDepartments,
    getDepartment,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getMembers,
    addMember,
    removeMember,
    getMyDepartments,
    setMyAvailability,
    transferToDepartment,
  };
};
