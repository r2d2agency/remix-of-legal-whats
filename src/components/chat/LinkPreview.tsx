import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { API_URL } from "@/lib/api";

interface LinkPreviewData {
  url?: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  url: string;
  savedPreview?: LinkPreviewData | null;
}

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function fetchFromBackend(url: string): Promise<OgData | null> {
  try {
    const base = API_URL || '';
    const endpoint = `${base}/api/link-preview?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data;
    if (!d) return null;
    return {
      title: d.title || undefined,
      description: d.description || undefined,
      image: d.thumbnail || undefined,
      siteName: d.siteName || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchFromMicrolink(url: string): Promise<OgData | null> {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 'success') return null;
    const d = json.data;
    return {
      title: d.title || undefined,
      description: d.description || undefined,
      image: d.image?.url || d.logo?.url || undefined,
      siteName: d.publisher || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchOgData(url: string): Promise<OgData | null> {
  // Prefer our backend (no CORS, no rate limits, cached)
  const backend = await fetchFromBackend(url);
  if (backend && (backend.title || backend.description || backend.image)) {
    return backend;
  }
  // Fallback to microlink free tier
  return fetchFromMicrolink(url);
}

const cache = new Map<string, OgData | null>();

export function LinkPreview({ url, savedPreview }: LinkPreviewProps) {
  // If we have saved WhatsApp preview data, use it directly
  if (savedPreview && (savedPreview.title || savedPreview.description || savedPreview.thumbnail)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border bg-background/50 overflow-hidden hover:bg-accent/50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {savedPreview.thumbnail && (
          <div className="flex items-start gap-2.5 p-2.5">
            <img
              src={savedPreview.thumbnail}
              alt={savedPreview.title || ''}
              className="w-16 h-16 rounded object-cover flex-shrink-0"
              loading="lazy"
              onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              {savedPreview.title && (
                <p className="text-xs font-medium line-clamp-2 text-foreground">{savedPreview.title}</p>
              )}
              {savedPreview.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{savedPreview.description}</p>
              )}
              <div className="flex items-center gap-1 text-[10px] text-primary pt-0.5">
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{getDomain(savedPreview.canonicalUrl || savedPreview.url || url)}</span>
              </div>
            </div>
          </div>
        )}
        {!savedPreview.thumbnail && (
          <div className="p-2.5 space-y-0.5">
            {savedPreview.title && (
              <p className="text-xs font-medium line-clamp-2 text-foreground">{savedPreview.title}</p>
            )}
            {savedPreview.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{savedPreview.description}</p>
            )}
            <div className="flex items-center gap-1 text-[10px] text-primary pt-0.5">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{getDomain(savedPreview.canonicalUrl || savedPreview.url || url)}</span>
            </div>
          </div>
        )}
      </a>
    );
  }

  // Fallback: fetch OG data from microlink
  return <LinkPreviewFetched url={url} />;
}

function LinkPreviewFetched({ url }: { url: string }) {
  const [og, setOg] = useState<OgData | null | undefined>(() => cache.get(url));
  const [loading, setLoading] = useState(!cache.has(url));

  useEffect(() => {
    if (cache.has(url)) {
      setOg(cache.get(url));
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchOgData(url).then((data) => {
      if (cancelled) return;
      cache.set(url, data);
      setOg(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border bg-background/50 p-3 hover:bg-accent/50 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{getDomain(url)}</span>
        </div>
      </a>
    );
  }

  if (!og) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 rounded-lg border bg-background/50 p-3 hover:bg-accent/50 transition-colors text-xs text-primary underline"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{getDomain(url)}</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-lg border bg-background/50 overflow-hidden hover:bg-accent/50 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {og.image && (
        <div className="flex items-start gap-2.5 p-2.5">
          <img
            src={og.image}
            alt={og.title || ''}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
            loading="lazy"
            onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            {og.siteName && (
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{og.siteName}</p>
            )}
            {og.title && (
              <p className="text-xs font-medium line-clamp-2 text-foreground">{og.title}</p>
            )}
            {og.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{og.description}</p>
            )}
            <div className="flex items-center gap-1 text-[10px] text-primary pt-0.5">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{getDomain(url)}</span>
            </div>
          </div>
        </div>
      )}
      {!og.image && (
        <div className="p-2.5 space-y-0.5">
          {og.siteName && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{og.siteName}</p>
          )}
          {og.title && (
            <p className="text-xs font-medium line-clamp-2 text-foreground">{og.title}</p>
          )}
          {og.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{og.description}</p>
          )}
          <div className="flex items-center gap-1 text-[10px] text-primary pt-0.5">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{getDomain(url)}</span>
          </div>
        </div>
      )}
    </a>
  );
}