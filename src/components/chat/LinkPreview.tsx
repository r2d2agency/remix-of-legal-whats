import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

// Extract domain for display
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Simple OG fetcher using a free cors proxy / fallback to just domain display
async function fetchOgData(url: string): Promise<OgData | null> {
  try {
    // Use a public metadata API
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

const cache = new Map<string, OgData | null>();

export function LinkPreview({ url }: LinkPreviewProps) {
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
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <ExternalLink className="h-3 w-3" />
          <span className="truncate">{getDomain(url)}</span>
        </div>
      </a>
    );
  }

  if (!og) {
    // No OG data, just show a simple link card
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 rounded-lg border bg-background/50 p-3 hover:bg-accent/50 transition-colors text-xs text-primary underline"
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
    >
      {og.image && (
        <img
          src={og.image}
          alt={og.title || ''}
          className="w-full h-32 object-cover"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
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
    </a>
  );
}
