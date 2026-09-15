// DEMAND ENGINE · el inventario de páginas propias.
//
// Todo lo que el motor decide después —qué falta, qué se canibaliza, qué está
// huérfano, qué decae, a qué enlazar— se apoya en saber QUÉ TENEMOS. Y hay que
// construirlo, porque el sitio no lo sabe: son 107 páginas escritas a mano en
// el repositorio más las que el propio motor publicará, y viven en dos sitios
// distintos.
//
// La fuente es el sitemap publicado, no el disco: lo que importa es lo que
// Google puede ver, no lo que existe en un archivo. Una página con `noindex` o
// que nunca llegó al sitemap no está compitiendo por nada, y verla en el
// inventario haría creer que sí.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { marcarOk, marcarFallo } from './conectores';
import type { ResultadoHandler } from './tipos';

const SITIO = 'https://www.sacscloud.com';

/** Un sitemap índice apunta a otros sitemaps; hay que seguirlos. */
async function urlsDelSitemap(url: string, visto = new Set<string>()): Promise<string[]> {
  if (visto.has(url) || visto.size > 40) return [];
  visto.add(url);
  const r = await fetch(url, { headers: { 'User-Agent': 'SacsDemandEngine/1.0' } });
  if (!r.ok) throw new Error(`sitemap ${url} → ${r.status}`);
  const xml = await r.text();

  if (/<sitemapindex/i.test(xml)) {
    const hijos = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]);
    const todo: string[] = [];
    for (const h of hijos) todo.push(...await urlsDelSitemap(h, visto));
    return todo;
  }
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]);
}

/**
 * UNA sola forma canónica de escribir una URL, para los dos lados del grafo.
 *
 * El sitemap publica `…/blog/` y el HTML enlaza a `/blog`. Si cada lado se
 * guarda como viene, `de_enlaces.hacia` no empata nunca con `de_paginas.url` y
 * el motor concluye que las 120 páginas del sitio están huérfanas — que fue
 * exactamente lo que pasó en la primera corrida. La regla: se conserva la
 * diagonal final (es como las publica el sitemap), se tiran parámetros y
 * anclas, y la raíz se queda en `/`, nunca en cadena vacía.
 */
export function normalizarUrl(u: string): string | null {
  try {
    const url = new URL(u);
    url.hash = ''; url.search = '';
    url.hostname = url.hostname.toLowerCase();
    // Un archivo (.pdf, .xml, .png) no lleva diagonal; una sección sí.
    const ultimo = url.pathname.split('/').pop() || '';
    if (!url.pathname.endsWith('/') && !ultimo.includes('.')) url.pathname += '/';
    return url.toString();
  } catch { return null; }
}

const entre = (html: string, re: RegExp) => (html.match(re)?.[1] || '').trim().replace(/\s+/g, ' ') || null;

/** Lo que se puede saber de una página sin ejecutar su JavaScript. Basta: el
 *  sitio es estático y lo que Google indexa es este HTML. */
export function leerHtml(html: string) {
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const robots = entre(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i) || '';
  return {
    titulo: entre(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: entre(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, '').trim() || null,
    meta_desc: entre(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    canonical: entre(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i),
    indexable: !/noindex/i.test(robots),
    palabras: texto.split(/\s+/).filter(Boolean).length,
    schema_tipos: [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map(m => m[1]),
    enlaces: [...html.matchAll(/<a[^>]+href=["']([^"'#?]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)]
      .map(m => ({ href: m[1], anchor: m[2].replace(/<[^>]+>/g, '').trim().slice(0, 80) })),
  };
}

export async function inventariar(limite = 60): Promise<{ vistas: number; nuevas: number; enlaces: number; errores: number }> {
  const urls = [...new Set((await urlsDelSitemap(`${SITIO}/sitemap-index.xml`))
    .map(normalizarUrl).filter((u): u is string => !!u))];
  const out = { vistas: 0, nuevas: 0, enlaces: 0, errores: 0 };
  if (!urls.length) throw new Error('el sitemap no devolvió ninguna URL');

  // Se visitan primero las que nunca se han visto y luego las más rancias: así
  // una corrida corta siempre avanza en vez de repasar siempre las mismas.
  const { data: conocidas } = await supabase.from('de_paginas').select('url, rastreada_at');
  const mapa = new Map((conocidas || []).map(p => [p.url, p.rastreada_at]));
  const orden = urls
    .map(u => ({ u, visto: mapa.get(u) || null, conocida: mapa.has(u) }))
    .sort((a, b) => (a.visto ? 1 : 0) - (b.visto ? 1 : 0) || String(a.visto).localeCompare(String(b.visto)))
    .slice(0, limite);

  const enlaces: { desde: string; hacia: string; anchor: string; tipo: string }[] = [];

  for (const { u, conocida } of orden) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'SacsDemandEngine/1.0' }, redirect: 'follow' });
      const html = r.ok ? await r.text() : '';
      const d = html ? leerHtml(html) : null;

      await supabase.from('de_paginas').upsert({
        url: u,
        tipo: u.includes('/herramientas/') ? 'herramienta' : 'estatica',
        origen: 'repo',
        titulo: d?.titulo || null, h1: d?.h1 || null, meta_desc: d?.meta_desc || null,
        canonical: d?.canonical || null,
        estado_http: r.status, indexable: d?.indexable ?? null,
        palabras: d?.palabras ?? null,
        schema_tipos: d?.schema_tipos || [],
        rastreada_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'url' });

      if (!conocida) out.nuevas++;
      out.vistas++;

      for (const e of d?.enlaces || []) {
        // Solo enlaces internos: el grafo que importa es el nuestro.
        const crudo = e.href.startsWith('http') ? e.href : e.href.startsWith('/') ? `${SITIO}${e.href}` : null;
        const hacia = crudo && crudo.startsWith(SITIO) ? normalizarUrl(crudo) : null;
        if (!hacia) continue;   // solo enlaces internos: el grafo que importa es el nuestro
        enlaces.push({ desde: u, hacia, anchor: e.anchor, tipo: 'cuerpo' });
      }
    } catch {
      out.errores++;
    }
  }

  /* Una página enlaza VARIAS VECES al mismo destino —el menú, el pie y el
     cuerpo apuntan todos a /planes—, y dos filas con la misma llave dentro del
     MISMO upsert hacen que Postgres rechace el lote entero
     («cannot affect row a second time»). Como el error no se miraba, los 6,700
     enlaces se perdían en silencio y el grafo quedaba vacío mientras la corrida
     reportaba éxito. Se deduplica antes, se conserva el primer anchor (el del
     cuerpo suele ir después del menú, pero el primero basta para la regla de
     no abusar del anchor exacto) y ahora el error SÍ se mira. */
  const unicos = new Map<string, typeof enlaces[number]>();
  for (const e of enlaces) unicos.set(`${e.desde}|${e.hacia}`, unicos.get(`${e.desde}|${e.hacia}`) || e);
  const lista = [...unicos.values()];

  for (let i = 0; i < lista.length; i += 500) {
    const { error } = await supabase.from('de_enlaces').upsert(
      lista.slice(i, i + 500).map(e => ({ ...e, visto_at: new Date().toISOString() })),
      { onConflict: 'desde,hacia' },
    );
    if (error) throw new Error(`[paginas] no se pudieron guardar los enlaces: ${error.message}`);
  }
  out.enlaces = lista.length;

  const { error: errConteo } = await supabase.rpc('de_recontar_enlaces');
  if (errConteo) throw new Error(`[paginas] no se pudieron recontar los enlaces: ${errConteo.message}`);
  return out;
}

registrar('detectar.tecnico', async (a, ctx): Promise<ResultadoHandler> => {
  try {
    const r = await inventariar(Number(a.payload?.limite) || 80);
    await marcarOk('competidores', r.vistas);
    return {
      ok: true,
      resumen: `${r.vistas} páginas revisadas · ${r.nuevas} nuevas · ${r.enlaces} enlaces${r.errores ? ` · ${r.errores} con error` : ''}`,
      datos: r,
    };
  } catch (e: any) {
    await marcarFallo('competidores', e?.message || String(e));
    throw e;
  }
});
