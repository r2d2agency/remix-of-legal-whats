import { useState, useCallback } from 'react';
import { API_URL, getAuthToken } from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: 'owner' | 'admin' | 'manager' | 'agent';
  created_at: string;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'agent';
  created_at: string;
}

export function useOrganizations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
  });

  const getOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      const response = await fetch(`${API_URL}/api/organizations`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Erro ao buscar organizações');
      return response.json();
    } catch (err) {
      console.error('Get organizations error:', err);
      return [];
    }
  }, []);

  const getOrganization = useCallback(async (id: string): Promise<Organization | null> => {
    try {
      const response = await fetch(`${API_URL}/api/organizations/${id}`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Erro ao buscar organização');
      return response.json();
    } catch (err) {
      console.error('Get organization error:', err);
      return null;
    }
  }, []);

  const createOrganization = useCallback(async (name: string, slug: string): Promise<Organization | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/organizations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, slug })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar organização');
      }
      
      return response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrganization = useCallback(async (id: string, data: { name?: string; logo_url?: string }): Promise<Organization | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/organizations/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || 'Erro ao atualizar organização');
      }
      
      return response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMembers = useCallback(async (organizationId: string): Promise<OrganizationMember[]> => {
    try {
      const response = await fetch(`${API_URL}/api/organizations/${organizationId}/members`, { headers: getHeaders() });
      if (!response.ok) throw new Error('Erro ao buscar membros');
      return response.json();
    } catch (err) {
      console.error('Get members error:', err);
      return [];
    }
  }, []);

  const addMember = useCallback(async (organizationId: string, email: string, role: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, role })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao adicionar membro');
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeMember = useCallback(async (organizationId: string, userId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/organizations/${organizationId}/members/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao remover membro');
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
    getOrganizations,
    getOrganization,
    createOrganization,
    updateOrganization,
    getMembers,
    addMember,
    removeMember
  };
}