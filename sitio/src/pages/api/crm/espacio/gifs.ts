// GET /api/crm/espacio/gifs?q= → { gifs:[{id,url,preview,w,h}], sin_llave? }
// Tenor v2 desde el servidor: la llave no pisa el navegador. Sin q, tendencias.
// Se guarda cada búsqueda 10 min en memoria: el mismo "ok" pedido veinte veces
// no debe costar veinte llamadas.
import type { APIRoute } from 'astro';
import { json, quien } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const cache = new Map<string, { at: number; gifs: any[] }>();

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const key = String((import.meta as any).env?.TENOR_API_KEY || process.env.TENOR_API_KEY || '').trim();
  if (!key) return json({ gifs: [], sin_llave: true });
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < 600_000) return json({ gifs: hit.gifs });
  const p = new URLSearchParams({ key, client_key: 'sacs-crm', limit: '24', media_filter: 'tinygif,nanogif', locale: 'es_MX', contentfilter: 'medium' });
  if (q) p.set('q', q);
  const r = await fetch(`https://tenor.googleapis.com/v2/${q ? 'search' : 'featured'}?${p}`, { signal: AbortSignal.timeout(8000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: `Tenor: ${j?.error?.message || r.status}` }, 502);
  const gifs = (j.results || []).map((x: any) => {
    const t = x.media_formats?.tinygif, n = x.media_formats?.nanogif || t;
    if (!t?.url) return null;
    return { id: x.id, url: t.url, preview: n?.url || t.url, w: t.dims?.[0] || 220, h: t.dims?.[1] || 160 };
  }).filter(Boolean);
  cache.set(q, { at: Date.now(), gifs });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return json({ gifs });
};
