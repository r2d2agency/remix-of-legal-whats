import express from 'express';
import { log } from '../logger.js';

const router = express.Router();

// In-memory cache (24h TTL)
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function getCached(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function setCached(url, data) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(url, { data, at: Date.now() });
}

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function pickMeta(html, names) {
  for (const name of names) {
    // property="og:image" content="..."
    const re1 = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i');
    const m1 = html.match(re1);
    if (m1?.[1]) return decodeEntities(m1[1].trim());
    // content="..." property="og:image"
    const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${name}["']`, 'i');
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1].trim());
  }
  return null;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
}

function absolutize(maybeUrl, baseUrl) {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

async function fetchOgPreview(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Use a generic UA that most servers accept
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://example.com/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('xml')) return null;

    // Read at most ~512KB to avoid huge pages
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let total = 0;
    const MAX = 512 * 1024;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX) {
        try { await reader.cancel(); } catch {}
        break;
      }
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c)))
    );

    const finalUrl = res.url || targetUrl;
    const title =
      pickMeta(html, ['og:title', 'twitter:title']) || extractTitle(html);
    const description =
      pickMeta(html, ['og:description', 'twitter:description', 'description']);
    const imageRaw =
      pickMeta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    const siteName = pickMeta(html, ['og:site_name', 'application-name']);
    const image = absolutize(imageRaw, finalUrl);

    if (!title && !description && !image) return null;
    return {
      url: targetUrl,
      canonicalUrl: finalUrl,
      title: title || null,
      description: description || null,
      thumbnail: image || null,
      siteName: siteName || null,
    };
  } catch (error) {
    log({ level: 'warn', component: 'link-preview', message: 'fetch_failed', url: targetUrl, error: String(error?.message || error) });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Public endpoint (no auth) — chat preview is non-sensitive
router.get('/', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'invalid_url' });
    }
    // Block obvious internal hosts
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
      ) {
        return res.status(400).json({ error: 'blocked_host' });
      }
    } catch {
      return res.status(400).json({ error: 'invalid_url' });
    }

    const cached = getCached(url);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.json({ cached: true, data: cached });
    }

    const data = await fetchOgPreview(url);
    setCached(url, data);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.json({ cached: false, data });
  } catch (error) {
    return res.status(500).json({ error: 'internal_error', detail: String(error?.message || error) });
  }
});

export default router;
