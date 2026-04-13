import { API_URL } from "@/lib/api";

const MEDIA_PROXY_URL = API_URL ? `${API_URL}/api/uploads/proxy` : "/api/uploads/proxy";
const PROXIED_MEDIA_HOSTS = new Set(["lookaside.fbsbx.com"]);

function toAbsoluteExternalUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

function shouldProxyExternalMedia(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return PROXIED_MEDIA_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Normaliza URLs de mídia vindas do backend.
 * - Se vier absoluta (http/https/data/blob) mantém.
 * - Se vier relativa (/uploads/...) prefixa com o API_URL.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;

  if (/^(data:|blob:)/i.test(u)) return u;

  if (/^https?:/i.test(u) || u.startsWith("//")) {
    const absoluteUrl = toAbsoluteExternalUrl(u);
    if (shouldProxyExternalMedia(absoluteUrl)) {
      return `${MEDIA_PROXY_URL}?url=${encodeURIComponent(absoluteUrl)}`;
    }
    return absoluteUrl;
  }

  // /api/uploads/public/xxx/yyy → backend route directly
  if (u.startsWith("/api/uploads/")) return `${API_URL}${u}`;
  if (u.startsWith("/uploads/public/")) return `${API_URL}/api${u}`;
  if (u.startsWith("uploads/public/")) return `${API_URL}/api/${u}`;
  if (u.startsWith("/uploads/")) return `${API_URL}${u}`;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return `${API_URL}/${u}`;
}
