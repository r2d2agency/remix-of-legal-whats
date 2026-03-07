import { useState, useEffect, useCallback } from 'react';
import { API_URL, getAuthToken } from '@/lib/api';

export interface BrandingSettings {
  logo_login: string | null;
  logo_sidebar: string | null;
  logo_topbar: string | null;
  favicon: string | null;
  company_name: string | null;
  theme_preset: string | null;
  theme_custom_colors: string | null;
}

export interface ThemeColors {
  primary: string; // HSL values e.g. "24 90% 52%"
  secondary: string;
  accent: string;
  sidebar: string;
}

export const THEME_PRESETS: Record<string, { name: string; colors: ThemeColors; preview: string[] }> = {
  default: {
    name: 'Gleego (Padrão)',
    colors: { primary: '24 90% 52%', secondary: '217 60% 92%', accent: '152 50% 90%', sidebar: '24 90% 52%' },
    preview: ['#e8600a', '#c2d6f2', '#c8f0dc'],
  },
  blue: {
    name: 'Azul Corporativo',
    colors: { primary: '217 70% 50%', secondary: '217 60% 92%', accent: '200 60% 90%', sidebar: '217 70% 50%' },
    preview: ['#2563eb', '#c2d6f2', '#c2e8f2'],
  },
  green: {
    name: 'Verde Profissional',
    colors: { primary: '152 55% 40%', secondary: '152 40% 90%', accent: '170 50% 88%', sidebar: '152 55% 40%' },
    preview: ['#1a9a5c', '#c8f0dc', '#c2f0e6'],
  },
  purple: {
    name: 'Roxo Moderno',
    colors: { primary: '271 65% 55%', secondary: '271 40% 92%', accent: '300 50% 90%', sidebar: '271 65% 55%' },
    preview: ['#8b5cf6', '#e2d6f2', '#f0c8f0'],
  },
  red: {
    name: 'Vermelho Dinâmico',
    colors: { primary: '0 72% 50%', secondary: '0 40% 92%', accent: '20 60% 90%', sidebar: '0 72% 50%' },
    preview: ['#dc2626', '#f2d6d6', '#f2e0c8'],
  },
  teal: {
    name: 'Teal Elegante',
    colors: { primary: '180 55% 38%', secondary: '180 40% 90%', accent: '160 50% 88%', sidebar: '180 55% 38%' },
    preview: ['#0d9488', '#c2f0f0', '#c2f0dc'],
  },
  pink: {
    name: 'Rosa Vibrante',
    colors: { primary: '330 70% 55%', secondary: '330 40% 92%', accent: '350 50% 90%', sidebar: '330 70% 55%' },
    preview: ['#ec4899', '#f2d6e6', '#f2d6d6'],
  },
  dark_blue: {
    name: 'Azul Marinho',
    colors: { primary: '220 60% 40%', secondary: '220 40% 90%', accent: '200 50% 88%', sidebar: '220 60% 40%' },
    preview: ['#2c4a7c', '#d0daf0', '#c8e4f0'],
  },
};

export function applyThemeColors(preset: string | null, customColors: string | null) {
  const root = document.documentElement;
  
  let colors: ThemeColors | null = null;
  
  if (preset === 'custom' && customColors) {
    try {
      colors = JSON.parse(customColors);
    } catch { /* ignore */ }
  } else if (preset && THEME_PRESETS[preset]) {
    colors = THEME_PRESETS[preset].colors;
  }
  
  if (!colors) return;
  
  // Apply to light mode root variables
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--ring', colors.primary);
  root.style.setProperty('--sidebar-primary', colors.sidebar);
  root.style.setProperty('--sidebar-ring', colors.sidebar);
  root.style.setProperty('--sidebar-accent', colors.sidebar.replace(/\d+%\s*$/, '94%'));
  root.style.setProperty('--sidebar-accent-foreground', colors.sidebar.replace(/\d+%\s*$/, '35%'));
  
  // Chat message sent color
  root.style.setProperty('--message-sent', colors.primary);
  
  // Neon glow
  root.style.setProperty('--neon-glow', colors.primary.replace(/\d+%\s*$/, '55%'));
  root.style.setProperty('--shadow-neon', `0 0 20px hsl(${colors.primary} / 0.3)`);
  
  // Update gradient
  const hue = colors.primary.split(' ')[0];
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${colors.primary}), hsl(${hue} 95% 55%))`);
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings>({
    logo_login: null,
    logo_sidebar: null,
    logo_topbar: null,
    favicon: null,
    company_name: null,
    theme_preset: null,
    theme_custom_colors: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      // Try to get org_id from stored user data
      let orgParam = '';
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // We'll get org_id from the API response, but also try cached
        }
      } catch { /* ignore */ }

      // Check for cached org_id
      const cachedOrgId = sessionStorage.getItem('user_org_id');
      if (cachedOrgId) {
        orgParam = `?org_id=${cachedOrgId}`;
      }

      const response = await fetch(`${API_URL}/api/admin/branding${orgParam}`);
      if (response.ok) {
        const data = await response.json();
        setBranding(data);
        
        // Apply favicon if set
        if (data.favicon) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
            link.href = data.favicon;
          }
        }
        
        // Apply theme colors
        applyThemeColors(data.theme_preset, data.theme_custom_colors);
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return { branding, loading, refetch: fetchBranding };
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<Array<{
    id: string;
    key: string;
    value: string | null;
    description: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSetting = useCallback(async (key: string, value: string | null) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value }),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setSettings(prev => 
          prev.map(s => s.key === key ? updated : s)
        );
        return updated;
      }
      throw new Error('Failed to update setting');
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
