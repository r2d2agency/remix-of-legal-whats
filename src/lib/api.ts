const DEFAULT_API_URL = 'https://blaster-whats-backend.isyhhh.easypanel.host';
export const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_GET_RETRIES = 2;
const ERROR_LOG_COOLDOWN_MS = 15000;
const lastErrorLogByKey = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (method: string, status?: number) => {
  if (method !== 'GET') return false;
  if (!status) return true;
  return RETRYABLE_STATUS.has(status);
};

const shouldLogNow = (key: string) => {
  const now = Date.now();
  const last = lastErrorLogByKey.get(key) || 0;
  if (now - last < ERROR_LOG_COOLDOWN_MS) return false;
  lastErrorLogByKey.set(key, now);
  return true;
};

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  auth?: boolean;
}

export const api = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_URL}${endpoint}`;
  const retries = method === 'GET' ? MAX_GET_RETRIES : 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      // Read body as text first for safer parsing
      const rawText = await response.text().catch(() => '');

      if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { raw: rawText };
        }
      } else {
        if ((rawText.trim().startsWith('<!') || rawText.includes('<html')) && shouldLogNow(`html:${url}:${response.status}`)) {
          // eslint-disable-next-line no-console
          console.error('[api] Got HTML instead of JSON', {
            url,
            status: response.status,
            preview: rawText.substring(0, 300),
          });
        }
        data = { raw: rawText };
      }

      if (!response.ok) {
        if (attempt < retries && shouldRetry(method, response.status)) {
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }

        const baseMsg = data?.error || data?.message || `Erro na requisição (${response.status})`;
        const details = data?.details ? `: ${data.details}` : '';
        const logKey = `fail:${url}:${response.status}`;
        if (shouldLogNow(logKey)) {
          // eslint-disable-next-line no-console
          console.error('[api] request failed', {
            url,
            status: response.status,
            contentType,
            body,
            response: data,
          });
        }
        throw new Error(`${baseMsg}${details}`);
      }

      return data as T;
    } catch (error: any) {
      const canRetry = attempt < retries && shouldRetry(method);
      if (canRetry) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }

      if (shouldLogNow(`network:${url}`)) {
        // eslint-disable-next-line no-console
        console.error('[api] network failure', {
          url,
          method,
          message: error?.message || 'Erro de rede',
        });
      }

      throw error;
    }
  }

  throw new Error('Falha inesperada na requisição');
};

// Auth helpers
export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: { email, password }, auth: false }
    ),

  register: (email: string, password: string, name: string, plan_id?: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: { email, password, name, plan_id }, auth: false }
    ),

  getMe: () =>
    api<{ user: { id: string; email: string; name: string } }>('/api/auth/me'),

  getSignupPlans: () =>
    api<Array<{
      id: string;
      name: string;
      description: string | null;
      max_connections: number;
      max_monthly_messages: number;
      max_users: number;
      price: number;
      billing_period: string;
      trial_days: number;
      has_chat: boolean;
      has_campaigns: boolean;
      has_asaas_integration: boolean;
    }>>('/api/auth/plans', { auth: false }),
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};
