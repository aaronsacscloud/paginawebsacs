// DEMAND ENGINE · vigilancia de competidores.
//
// Solo lectura de lo PÚBLICO: el sitemap que ellos mismos publican para que los
// rastreen. Nada de trucos, nada de saltarse un robots.txt.
//
// Y una regla de producto que vale más que la técnica: se reportan CAMBIOS, no
// inventarios. Un informe semanal de las 4,000 páginas que tiene Shopify no lo
// abre nadie dos veces; «esta semana publicaron seis páginas sobre inventario
// por talla» sí se lee, porque es accionable.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { marcarOk, marcarFallo } from './conectores';
import type { ResultadoHandler } from './tipos';

const UA = 'SacsDemandEngine/1.0 (+https://www.sacscloud.com)';
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

async function traer(url: string, ms = 15000): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: c.signal, redirect: 'follow' });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

/** Dónde tiene su sitemap. Se pregunta primero al robots.txt, que es donde se
 *  declara, antes de adivinar rutas. */
export async function hallarSitemap(dominio: string): Promise<string | null> {
  const base = `https://${dominio.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const robots = await traer(`${base}/robots.txt`, 10000);
  if (robots) {
    const declarados = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
    if (declarados.length) return declarados[0];
  }
  for (const ruta of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    const x = await traer(`${base}${ruta}`, 10000);
    if (x && /<(urlset|sitemapindex)/i.test(x)) return `${base}${ruta}`;
  }
  return null;
}

/** Las URLs de un sitemap, siguiendo los índices. Con tope: hay competidores
 *  con decenas de miles de páginas y no hace falta traerlas todas para saber
 *  qué es nuevo. */
async function urlsDe(sitemap: string, tope = 3000, visto = new Set<string>()): Promise<string[]> {
  if (visto.has(sitemap) || visto.size > 12) return [];
  visto.add(sitemap);
  const xml = await traer(sitemap, 20000);
  if (!xml) return [];

  if (/<sitemapindex/i.test(xml)) {
    const hijos = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 8);
    const out: string[] = [];
    for (const h of hijos) {
      out.push(...await urlsDe(h, tope, visto));
      if (out.length >= tope) break;
      await espera(800);   // cortesía: no se le cae encima a nadie
    }
    return out.slice(0, tope);
  }
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]).slice(0, tope);
}

/** Lo que dice el camino de la URL, que es lo que la vuelve relevante o no. */
const TEMAS: Record<string, RegExp> = {
  inventario: /invent|stock|almac/i,
  tallas: /size|talla|variant/i,
  moda: /fashion|apparel|moda|ropa|clothing|boutique/i,
  punto_de_venta: /\bpos\b|point-of-sale|punto-de-venta|caja/i,
  mayoreo: /wholesale|b2b|mayoreo/i,
  precios: /pricing|precios|planes/i,
  ia: /\bai\b|artificial|inteligencia/i,
  comparativa: /\bvs\b|versus|alternative|compar/i,
};

const temasDe = (url: string) => Object.entries(TEMAS).filter(([, re]) => re.test(url)).map(([k]) => k);

export async function revisar(competidorId: string): Promise<{ nombre: string; total: number; nuevas: number; relevantes: number }> {
  const { data: c } = await supabase.from('de_competidores').select('*').eq('id', competidorId).single();
  if (!c) throw new Error('competidor inexistente');

  const sitemap = c.sitemap_url || await hallarSitemap(c.dominio);
  if (!sitemap) {
    await supabase.from('de_competidores').update({ ultimo_snapshot_at: new Date().toISOString(), notas: 'sin sitemap accesible' }).eq('id', c.id);
    return { nombre: c.nombre, total: 0, nuevas: 0, relevantes: 0 };
  }
  if (!c.sitemap_url) await supabase.from('de_competidores').update({ sitemap_url: sitemap }).eq('id', c.id);

  const urls = [...new Set(await urlsDe(sitemap))];
  if (!urls.length) return { nombre: c.nombre, total: 0, nuevas: 0, relevantes: 0 };

  const { data: conocidas } = await supabase.from('de_competidor_paginas').select('url').eq('competidor_id', c.id);
  const ya = new Set((conocidas || []).map(p => p.url));
  const nuevas = urls.filter(u => !ya.has(u));

  // La PRIMERA vez todo es nuevo y no significa nada: es la foto inicial, no un
  // movimiento. Reportarla como «publicaron 3,000 páginas» sería ruido puro.
  const primeraVez = ya.size === 0;

  for (let i = 0; i < urls.length; i += 500) {
    await supabase.from('de_competidor_paginas').upsert(
      urls.slice(i, i + 500).map(u => ({ competidor_id: c.id, url: u, vista_ultima: new Date().toISOString() })),
      { onConflict: 'competidor_id,url' },
    );
  }

  let relevantes = 0;
  if (!primeraVez && nuevas.length) {
    // De lo nuevo, solo lo que toca NUESTRO terreno. Que publiquen sobre
    // facturación en Canadá no es asunto nuestro.
    const interesa = nuevas.map(u => ({ url: u, temas: temasDe(u) })).filter(x => x.temas.length > 0);
    relevantes = interesa.length;

    for (const x of interesa.slice(0, 40)) {
      await supabase.from('de_competidor_snapshots').upsert({
        clave_idem: `pagina_nueva:${c.id}:${x.url}`,
        competidor_id: c.id, tipo_cambio: 'pagina_nueva', url: x.url,
        resumen: `${c.nombre} publicó una página sobre ${x.temas.join(', ')}`,
        evidencia: { temas: x.temas, sitemap },
        // Lo que toca moda o tallas pesa más: es donde competimos de verdad.
        relevancia: 50 + (x.temas.includes('moda') ? 25 : 0) + (x.temas.includes('tallas') ? 20 : 0) + (x.temas.includes('comparativa') ? 15 : 0),
      }, { onConflict: 'clave_idem', ignoreDuplicates: true });
    }
  }

  await supabase.from('de_competidores').update({
    paginas_conocidas: urls.length, ultimo_snapshot_at: new Date().toISOString(),
    notas: primeraVez ? 'primera foto: sin cambios que reportar todavía' : null,
  }).eq('id', c.id);

  return { nombre: c.nombre, total: urls.length, nuevas: primeraVez ? 0 : nuevas.length, relevantes };
}

registrar('ingerir.competidor', async (a, ctx): Promise<ResultadoHandler> => {
  // Los más rancios primero, para que todos se revisen por turno.
  const { data: lista } = await supabase.from('de_competidores')
    .select('id, nombre').eq('activo', true)
    .order('ultimo_snapshot_at', { ascending: true, nullsFirst: true })
    .limit(Number(a.payload?.limite) || 6);

  const hechos: string[] = [];
  let relevantes = 0;
  try {
    for (const c of lista || []) {
      if (Date.now() > ctx.limite - 30_000) break;
      const r = await revisar(c.id);
      relevantes += r.relevantes;
      hechos.push(`${r.nombre}: ${r.total} páginas${r.nuevas ? `, ${r.nuevas} nuevas` : ''}${r.relevantes ? ` (${r.relevantes} de lo nuestro)` : ''}`);
      await espera(1500);
    }
    await marcarOk('competidores', hechos.length);
  } catch (e: any) {
    await marcarFallo('competidores', e?.message || String(e));
    throw e;
  }

  return {
    ok: true,
    resumen: hechos.length ? `${hechos.length} revisados${relevantes ? ` · ${relevantes} páginas nuevas de nuestro terreno` : ' · sin novedades'}` : 'no había competidores por revisar',
    datos: { hechos, relevantes },
  };
});
