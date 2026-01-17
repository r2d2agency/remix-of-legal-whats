import { useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  name: string;
  is_superadmin: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  member_count?: number;
  created_at: string;
}

export function useSuperadmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  });

  const checkSuperadmin = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/admin/check`, { headers: getHeaders() });
      if (!response.ok) return false;
      const data = await response.json();
      return data.isSuperadmin;
    } catch {
      return false;
    }
  }, []);

  const getAllUsers = useCallback(async (): Promise<User[]> => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Acesso negado');
      return response.json();
    } catch (err) {
      console.error('Get users error:', err);
      return [];
    }
  }, []);

  const getAllOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      const response = await fetch(`${API_URL}/api/admin/organizations`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Acesso negado');
      return response.json();
    } catch (err) {
      console.error('Get organizations error:', err);
      return [];
    }
  }, []);

  const createOrganization = useCallback(async (data: { 
    name: string; 
    slug: string; 
    logo_url?: string;
    owner_email: string;
  }): Promise<Organization | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/admin/organizations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || 'Erro ao criar organização');
      }
      
      return response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrganization = useCallback(async (id: string, data: { 
    name?: string; 
    logo_url?: string;
  }): Promise<Organization | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || 'Erro ao atualizar organização');
      }
      
      return response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteOrganization = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/admin/organizations/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || 'Erro ao deletar organização');
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const setSuperadmin = useCallback(async (userId: string, isSuperadmin: boolean): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/superadmin`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_superadmin: isSuperadmin })
      });
      
      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || 'Erro ao atualizar usuário');
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    checkSuperadmin,
    getAllUsers,
    getAllOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    setSuperadmin
  };
}