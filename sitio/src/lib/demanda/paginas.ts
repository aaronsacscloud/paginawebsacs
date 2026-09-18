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

/**
 * El contenido REAL de la página, sin el menú ni el pie.
 *
 * Contar palabras sobre el HTML entero hacía inútil la regla de contenido
 * delgado: el armazón del sitio —navegación, pie, avisos— son ~1,800 palabras,
 * así que una página COMPLETAMENTE VACÍA contaba 1,872 y nunca se marcaba. Se
 * descubrió con /manifiesto, que lleva publicada con un comentario dentro
 * («el contenido irá aquí») y salía como una página normal de 1,872 palabras.
 */
function soloContenido(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return main ? main[1] : html;
}

/** Lo que se puede saber de una página sin ejecutar su JavaScript. Basta: el
 *  sitio es estático y lo que Google indexa es este HTML. */
export function leerHtml(html: string) {
  const texto = soloContenido(html)
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

/**
 * TODOS los sitemaps, leídos de robots.txt.
 *
 * Antes se leía solo `sitemap-index.xml` —el que genera el build— y eso dejaba
 * ciego al motor sobre SU PROPIO CONTENIDO: lo que publica va a
 * `sitemap-demanda.xml`, porque son rutas `prerender = false` que el build
 * nunca escribe en disco.
 *
 * El efecto no era sutil. Las once guías publicadas quedaban marcadas
 * `en_sitemap: false` y `huerfana: true`, nunca se rastreaban (por eso su conteo
 * de palabras salía vacío), y generaban hallazgos que nadie podía resolver
 * porque describían un problema que no existía. El motor se acusaba a sí mismo
 * de esconder lo que acababa de publicar.
 *
 * Se leen de `robots.txt` y no de una lista aquí a propósito: robots.txt ya es
 * la declaración pública de cuáles son, y así agregar un tercero no obliga a
 * tocar este archivo. Si robots.txt falla, se cae al índice del build en vez de
 * quedarse sin nada.
 */
async function sitemapsDeclarados(): Promise<string[]> {
  try {
    const r = await fetch(`${SITIO}/robots.txt`, { headers: { 'User-Agent': 'SacsDemandEngine/1.0' } });
    if (!r.ok) throw new Error(`robots.txt → ${r.status}`);
    const txt = await r.text();
    const ls = [...txt.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map(m => m[1]);
    if (ls.length) return [...new Set(ls)];
    console.error('[paginas] robots.txt no declara ningún Sitemap; se usa solo el del build');
  } catch (e: any) {
    console.error(`[paginas] no se pudo leer robots.txt (${e?.message}); se usa solo el del build`);
  }
  return [`${SITIO}/sitemap-index.xml`];
}

export async function inventariar(limite = 60): Promise<{ vistas: number; nuevas: number; enlaces: number; errores: number }> {
  /* Un sitemap caído no puede borrar el mapa entero: si `sitemap-demanda.xml`
     responde 500, lo que NO hay que hacer es concluir que sus once guías
     salieron del sitemap y marcarlas todas. Por eso cada uno se lee aparte y el
     que falle se avisa y se salta. */
  const crudas: string[] = [];
  let fallaron = 0;
  for (const sm of await sitemapsDeclarados()) {
    try { crudas.push(...await urlsDelSitemap(sm)); }
    catch (e: any) { fallaron++; console.error(`[paginas] sitemap ilegible ${sm}: ${e?.message}`); }
  }
  if (fallaron) throw new Error(`${fallaron} sitemap(s) no se pudieron leer: no se rastrea con un mapa incompleto, porque lo que falte se marcaría como salido del sitemap`);

  const urls = [...new Set(crudas.map(normalizarUrl).filter((u): u is string => !!u))];
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

  /* Las que YA NO están en el sitemap dejan de ser indexables.

     El rastreador solo visita URLs del sitemap, así que una página que sale de
     él se queda con su última foto **para siempre** — y esa foto sigue
     generando hallazgos que nadie puede resolver, porque la página ya no se
     vuelve a mirar.

     Pasó hoy: al poner `/app/dashboard` e `/app/inbox` en la lista de no
     indexables salieron del sitemap, y sus hallazgos de «sin H1» y «sin meta»
     quedaron atascados en abierto con datos de la víspera. La orden de trabajo
     mandaba a escribirle una meta descripción al inbox de la aplicación.

     Se marca en `en_sitemap` y NO en `indexable`. La primera versión usó
     `indexable` y el efecto fue inmediato: la regla `noindex_en_sitemap` empezó
     a acusar de estar-en-el-sitemap-con-noindex a páginas que acababan de SALIR
     del sitemap. Siete hallazgos de severidad alta diciendo lo contrario de la
     verdad. Un campo que significa dos cosas acaba mintiendo sobre las dos. */
  const enSitemap = new Set(urls);
  const desaparecidas = [...mapa.keys()].filter(u => !enSitemap.has(u));
  if (desaparecidas.length) {
    for (let i = 0; i < desaparecidas.length; i += 150) {
      const { error } = await supabase.from('de_paginas')
        .update({ en_sitemap: false, updated_at: new Date().toISOString() })
        .in('url', desaparecidas.slice(i, i + 150));
      if (error) console.error(`[paginas] no se pudieron marcar las que salieron del sitemap: ${error.message}`);
    }
  }

  return out;
}

/* El rastreo es `ingerir.sitio`; las REGLAS sobre lo rastreado viven en
   tecnico.ts como `detectar.tecnico`. Separarlos permite reprocesar una regla
   nueva sin volver a pedirle 120 páginas al servidor. */
registrar('ingerir.sitio', async (a): Promise<ResultadoHandler> => {
  const r = await inventariar(Number(a.payload?.limite) || 80);
  return {
    ok: true,
    resumen: `${r.vistas} páginas rastreadas · ${r.nuevas} nuevas · ${r.enlaces} enlaces${r.errores ? ` · ${r.errores} con error` : ''}`,
    datos: r,
  };
});
