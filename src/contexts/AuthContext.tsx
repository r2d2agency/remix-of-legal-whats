import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, setAuthToken, clearAuthToken, getAuthToken } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ModulesEnabled {
  campaigns: boolean;
  billing: boolean;
  groups: boolean;
  scheduled_messages: boolean;
  chatbots: boolean;
  chat: boolean;
  crm: boolean;
  ai_agents: boolean;
  group_secretary: boolean;
  ghost: boolean;
  projects: boolean;
  lead_gleego: boolean;
  doc_signatures: boolean;
}

// Page-level permissions from permission templates
export type PagePermissions = Record<string, boolean> | null;

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  organization_id?: string;
  modules_enabled?: ModulesEnabled;
  has_connections?: boolean;
  page_permissions?: PagePermissions;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  modulesEnabled: ModulesEnabled;
  pagePermissions: PagePermissions;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, planId?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const defaultModules: ModulesEnabled = {
    campaigns: true,
    billing: true,
    groups: true,
    scheduled_messages: true,
    chatbots: true,
    chat: true,
    crm: true,
    ai_agents: true,
    group_secretary: false,
    ghost: true,
    projects: false,
    lead_gleego: false,
    doc_signatures: false,
  };

  const refreshUser = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const { user } = await authApi.getMe();
        setUser(user);
      } catch {
        // Ignore errors on refresh
      }
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const { user: userData } = await authApi.getMe();
          const u = userData as any;
          setUser(u);
          if (u.organization_id) {
            sessionStorage.setItem('user_org_id', u.organization_id);
          }
        } catch {
          clearAuthToken();
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { user: userData, token } = await authApi.login(email, password);
    setAuthToken(token);
    const u = userData as any;
    setUser(u);
    if (u.organization_id) {
      sessionStorage.setItem('user_org_id', u.organization_id);
    }
    toast({ title: 'Login realizado com sucesso!' });
  };

  const register = async (email: string, password: string, name: string, planId?: string) => {
    const { user, token } = await authApi.register(email, password, name, planId);
    setAuthToken(token);
    setUser(user);
    toast({ title: 'Conta criada com sucesso!' });
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    toast({ title: 'Logout realizado' });
  };

  const modulesEnabled = user?.modules_enabled || defaultModules;
  const pagePermissions = user?.page_permissions || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        modulesEnabled,
        pagePermissions,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
