// DEMAND ENGINE · los especialistas: lo que le falta a cada pieza, antes y
// después de publicar, y el loop que saca más piezas de cada una.
//
// El referee (calidad.ts) decide si una página PASA. Esto es otra cosa: dos
// especialistas —uno de SEO (Google/Bing), otro de IA y agentes (ChatGPT,
// Perplexity, Gemini, Claude, AI Overviews, navegadores agente)— dicen QUÉ MÁS
// FALTA aunque haya pasado, y un tercero, ya publicada, mide si la página está
// ganando autoridad (indexada, citada, enlazada, con tráfico) y qué hay que
// hacer para que la gane. Todo cae en `de_contenido_pendientes`, que es la
// lista que el dueño ve en «Seguimiento» y va tachando.
//
// El loop: de cada pieza publicada salen 3-5 ÁNGULOS (comparativa, paso a
// paso, plantilla, error común, caso) que entran como oportunidades al brief.
// Así un tema se cubre desde varios lados y el sitio se vuelve la referencia
// del tema, no una página suelta.
import { supabase } from '../supabase';
import { preguntar } from './ia';
import { registrar } from './handlers';
import { fichaSacs } from './capacidades';
import { aMarkdown, palabras as contarPalabras, type Bloque } from './bloques';
import { SITIO } from '../../data/entidad';
import type { ResultadoHandler } from './tipos';

const POR_CORRIDA = 4;
const DIAS_ESPECIALISTA = 14;   // se vuelve a revisar lo publicado cada dos semanas
const DIAS_AUTORIDAD = 7;

// ═══════════════════════════════════════════════════════════════════════════
// LOS 10 CRITERIOS DE IA Y AGENTES que no estaban en los 18 del referee
// ═══════════════════════════════════════════════════════════════════════════
export const CRITERIOS_AGENTES: { clave: string; nombre: string; que: string }[] = [
  { clave: 'llms_txt', nombre: 'llms.txt y llms-full.txt', que: 'La pieza aparece en /llms.txt con su resumen y en /llms-full.txt completa, para que un agente la lea sin rastrear el sitio. (El sitio ya lo genera de lo publicado: verificar que esta pieza salga y que el resumen sea la respuesta, no el título.)' },
  { clave: 'rastreadores_ia', nombre: 'Rastreadores de IA permitidos y rápidos', que: 'robots.txt permite GPTBot, ClaudeBot, PerplexityBot, Google-Extended (ya está). Lo que falta medir: que la página responda en < 1.5 s sin JavaScript (SSR con caché) y sin interstitials, porque los rastreadores de IA tienen timeouts cortos y no ejecutan JS.' },
  { clave: 'entidad_categoria', nombre: 'Entidad + categoría en la misma frase', que: 'Al menos una vez «Sacs» + qué es («sistema para tiendas de moda en México») + el dominio, en una frase completa citable, para que el modelo asocie entidad, categoría y giro. Y schema Organization con sameAs/knowsAbout coherentes (ya existe: verificar que knowsAbout incluya el giro de la pieza).' },
  { clave: 'variantes_conversacionales', nombre: 'La pregunta en 3 formas', que: 'La página contesta la pregunta tal como se le hace a un chat («¿qué sistema me recomiendas para…?», «¿existe un software que…?», «¿cómo llevo…?»): H2 en forma de pregunta, y las variantes del brief (palabras que rankean) presentes en el texto.' },
  { clave: 'extraible', nombre: 'Todo dato extraíble sin ver la imagen', que: 'Ninguna cifra vive solo en una imagen: el diagrama tiene su tabla o caption con los datos; tablas con encabezado y ≤ 6 columnas; listas cortas. Un agente que no ve imágenes debe poder reconstruir la respuesta.' },
  { clave: 'estadisticas_atribuidas', nombre: 'Cifras con atribución en línea', que: 'Cada cifra externa lleva la fuente EN LA MISMA FRASE («486,645 matrimonios en 2024, según INEGI») además del enlace: es lo que un modelo copia con la atribución puesta.' },
  { clave: 'que_cambio', nombre: 'Qué cambió y cuándo', que: 'dateModified real + una línea visible de «actualizado el … : qué cambió» cuando se refresca. Los modelos prefieren la versión con fecha y cambio explícito sobre la que solo dice «actualizado».' },
  { clave: 'acciones_agente', nombre: 'Acciones que un agente puede ejecutar', que: 'La página ofrece una acción clara y sin fricción para un agente que actúa por el usuario: agendar demo con formulario simple (sin captcha bloqueante), calculadora con parámetros en la URL, y —cuando exista— endpoint MCP/API. Un agente que puede COMPLETAR la tarea desde nuestra página nos recomienda.' },
  { clave: 'fuentes_que_citan', nombre: 'Estar en las fuentes que las IAs ya citan', que: 'Para cada pregunta, las IAs citan siempre 3-5 dominios (se ven en de_ia_muestras.urls_citadas). Aparecer en ellos —directorio, comparativa, foro, reseña— vale más que otra página propia. Pedirlo o publicarlo ahí.' },
  { clave: 'consistencia_terceros', nombre: 'Consistencia en terceros', que: 'Misma descripción, categoría, precios y nombre en Capterra, GetApp, Google Business, LinkedIn y directorios del ramo. Los modelos triangulan; una ficha vieja con otro precio resta credibilidad a todo lo demás.' },
];

const HECHOS_DEL_SITIO = `HECHOS DEL SITIO (ya resueltos; no los pidas como pendientes):
- robots.txt permite GPTBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended.
- /llms.txt y /llms-full.txt se generan de lo publicado; /sitemap-demanda.xml lista lo publicado; al publicar se avisa por IndexNow (Bing/Yandex) y se reenvía el sitemap a Google.
- Las páginas del motor son SSR (sin JS para leer), con caché CDN de 1 h.
- Schema: Article (autor/editor = Organization con sameAs y knowsAbout), FAQPage, HowTo, DefinedTermSet, ImageObject, VideoObject, speakable; portada OG 1200×630.
- Plantilla: fecha de publicación/actualización visible, índice con anclas, cierre «Sacs para <giro>» con enlace a /giros/<giro>.`;

const ESQUEMA_PENDIENTES = {
  type: 'object', additionalProperties: false,
  properties: {
    score: { type: 'number' },
    resumen: { type: 'string' },
    pendientes: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      clave: { type: 'string' }, titulo: { type: 'string' }, detalle: { type: 'string' },
      quien: { type: 'string', enum: ['motor', 'dueno'] }, prioridad: { type: 'number' }, impacto: { type: 'string' },
    }, required: ['clave', 'titulo', 'detalle', 'quien', 'prioridad', 'impacto'] } },
  },
  required: ['score', 'resumen', 'pendientes'],
};

const SISTEMA_SEO = `Eres especialista senior de SEO para Google y Bing en México (Bing importa: es donde busca ChatGPT). Te dan una página que YA pasó un referee de 18 criterios y las señales reales que tiene. Tu trabajo NO es repetir lo que ya está bien: es decir QUÉ MÁS FALTA para que esta página rankee primera para su pregunta y para las búsquedas de comprador, y qué haría un SEO con presupuesto que aquí no se está haciendo.

Piensa en: intención y SERP real (qué tipo de resultado gana hoy: guía, herramienta, video, comparativa), palabras exactas en título/H1/URL, canibalización con otras páginas del sitio, enlaces internos que faltan DESDE páginas con autoridad, snippet/CTR (título y meta que ganen el clic), datos estructurados que Google enseña (FAQ, HowTo, video, imagen), Core Web Vitals, hreflang/país, y qué señales externas necesita (menciones, directorios, reseñas).

Devuelve de 5 a 10 pendientes, concretos y accionables, cada uno con «quien»: «motor» si el sistema puede hacerlo solo (cambiar título, agregar enlaces, reescribir meta, crear otra página) o «dueno» si hace falta una persona (grabar, conseguir una mención, subir una captura, confirmar un dato). «prioridad» 1 = hoy, 2 = esta semana, 3 = cuando se pueda. «impacto» en una frase: qué cambia si se hace. «clave» corta en snake_case, estable (para no duplicar si se vuelve a revisar). «score» 0-100: qué tan lista está para rankear hoy.`;

const SISTEMA_GEO = `Eres especialista en búsqueda con IA y agentes: cómo ChatGPT, Perplexity, Gemini, Claude, los AI Overviews / AI Mode de Google y los navegadores agente eligen QUÉ página citar, resumir o desde cuál ejecutar una acción. Te dan una página que ya pasó un referee de 18 criterios, los hechos del sitio, las señales reales y los 10 criterios de IA/agentes que van más allá del referee.

Tu trabajo es decir QUÉ MÁS FALTA para que esta página sea LA que citen para su pregunta, en los 10 criterios y en lo que tú veas además. Sé concreto: no «mejorar la citabilidad» sino «la cifra de INEGI aparece sin atribución en la frase; ponla como “486,645 matrimonios en 2024 (INEGI)”».

Devuelve de 5 a 10 pendientes con «quien» («motor» = el sistema puede hacerlo solo; «dueno» = hace falta una persona: publicar en un directorio, pedir una mención, grabar algo), «prioridad» 1-3, «impacto», «clave» en snake_case estable. «score» 0-100: probabilidad de que hoy la citen.`;

const SISTEMA_AUTORIDAD = `Eres el especialista que sigue una página DESPUÉS de publicada. Te dan las señales medidas (indexada en Google, avisada a Bing, clics e impresiones de 28 días, posición, sesiones que llegan desde IAs, leads, cuántas veces la citan las IAs en nuestras muestras, enlaces internos que la apuntan, y qué páginas del sitio podrían enlazarla) y la lista de dominios que las IAs citan hoy para su pregunta.

Tu trabajo: decir qué le falta para ganar AUTORIDAD y a quién le toca. Piensa en: enlaces internos desde páginas concretas (te doy candidatas: di desde cuál y con qué anchor), menciones externas alcanzables (directorios, comparativas, foros del ramo, la descripción de un video del canal), qué dominio de los que las IAs citan podríamos conseguir, si el título/meta pierden clics vs impresiones (CTR bajo = cambiar), si la posición se estancó (refrescar con qué), y si conviene una pieza hermana. Nada genérico: cada pendiente dice qué, dónde y por qué.

Devuelve de 4 a 8 pendientes con «quien», «prioridad», «impacto», «clave» snake_case estable. «score» 0-100: autoridad actual de la página para su pregunta.`;

const ESQUEMA_ANGULOS = {
  type: 'object', additionalProperties: false,
  properties: {
    angulos: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      titulo: { type: 'string' }, pregunta: { type: 'string' }, tipo: { type: 'string' }, seccion: { type: 'string' }, slug: { type: 'string' }, por_que: { type: 'string' },
    }, required: ['titulo', 'pregunta', 'tipo', 'seccion', 'slug', 'por_que'] } },
  },
  required: ['angulos'],
};

const SISTEMA_ANGULOS = `Una página ya cubre una pregunta. Propón de 3 a 5 ÁNGULOS distintos sobre el mismo tema que la gente también busca y que una IA contestaría con otra página: cada uno con intención distinta (comparativa entre opciones, paso a paso operativo, plantilla o checklist descargable, el error común y cómo evitarlo, caso por ciudad o por tamaño de tienda, calculadora). No repitas la página madre: cada ángulo tiene que poder enlazarla y ser enlazado desde ella.
Para cada uno: «titulo», «pregunta» (tal como la haría quien busca), «tipo» (comparativa|paso_a_paso|plantilla|error_comun|caso|calculadora), «seccion» (recursos|comparar|software-para), «slug» corto en minúsculas y guiones, «por_que» (una frase: qué búsqueda o qué hueco cubre).`;

// ═══════════════════════════════════════════════════════════════════════════
// SEÑALES REALES DE UNA PIEZA
// ═══════════════════════════════════════════════════════════════════════════
export type Senales = {
  url: string; publicada: boolean;
  indexada_gsc: boolean | null; en_sitemap: boolean | null; avisada_at: string | null; enlaces_in: number | null; citabilidad: number | null; cwv: any;
  clics_28d: number; impresiones_28d: number; posicion_28d: number | null; sesiones_ia_28d: number; leads_28d: number; demos_28d: number;
  queries_top: { query: string; clics: number; impresiones: number; posicion: number }[];
  citas_ia: number; menciones_sacs_ia: number; dominios_citados: string[];
  enlaces_hacia: { desde: string; anchor: string }[];
  candidatas_para_enlazar: { url: string; titulo: string }[];
};

async function senalesDe(c: any): Promise<Senales> {
  const url = `${SITIO}/${c.seccion}/${c.slug}/`;
  const ruta = `/${c.seccion}/${c.slug}/`;
  const hace28 = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);

  const { data: pag } = await supabase.from('de_paginas').select('indexada_gsc, en_sitemap, avisada_at, enlaces_in, citabilidad, cwv').eq('url', url).maybeSingle();
  const { data: met } = await supabase.from('de_pagina_metricas').select('clics, impresiones, posicion, sesiones_ia, leads, demos').eq('url', url).gte('fecha', hace28);
  const sum = (k: string) => (met || []).reduce((a, m: any) => a + (Number(m[k]) || 0), 0);
  const posiciones = (met || []).map((m: any) => Number(m.posicion)).filter(n => n > 0);
  const { data: gsc } = await supabase.from('de_gsc_diario').select('query, clics, impresiones, posicion').eq('pagina', url).gte('fecha', hace28).order('impresiones', { ascending: false }).limit(60);
  const porQuery: Record<string, { query: string; clics: number; impresiones: number; posicion: number; n: number }> = {};
  for (const g of gsc || []) {
    const q = porQuery[g.query] || (porQuery[g.query] = { query: g.query, clics: 0, impresiones: 0, posicion: 0, n: 0 });
    q.clics += g.clics || 0; q.impresiones += g.impresiones || 0; q.posicion += g.posicion || 0; q.n++;
  }
  const queries_top = Object.values(porQuery).map(q => ({ query: q.query, clics: q.clics, impresiones: q.impresiones, posicion: Math.round((q.posicion / Math.max(q.n, 1)) * 10) / 10 })).sort((a, b) => b.impresiones - a.impresiones).slice(0, 8);

  const { count: citas } = await supabase.from('de_ia_muestras').select('id', { count: 'exact', head: true }).ilike('urls_citadas', `%${c.slug}%`);
  // Qué dominios citan las IAs para prompts parecidos (por palabras del slug).
  const claves = String(c.slug).split('-').filter((w: string) => w.length > 4).slice(0, 3);
  let dominios: string[] = [], menciones = 0;
  if (claves.length) {
    const { data: prompts } = await supabase.from('de_prompts_ia').select('id').or(claves.map(k => `prompt.ilike.%${k}%`).join(',')).limit(10);
    const ids = (prompts || []).map(p => p.id);
    if (ids.length) {
      const { data: m } = await supabase.from('de_ia_muestras').select('urls_citadas, sacs_mencionado').in('prompt_id', ids).order('created_at', { ascending: false }).limit(60);
      const cnt: Record<string, number> = {};
      for (const x of m || []) {
        if (x.sacs_mencionado) menciones++;
        for (const u of String(x.urls_citadas || '').match(/https?:\/\/[^\s,"'\]]+/g) || []) { try { const d = new URL(u).hostname.replace(/^www\./, ''); cnt[d] = (cnt[d] || 0) + 1; } catch {} }
      }
      dominios = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, n]) => `${d} (${n})`);
    }
  }

  const { data: hacia } = await supabase.from('de_enlaces').select('desde, anchor').eq('hacia', url).limit(20);
  let candidatas: { url: string; titulo: string }[] = [];
  try {
    const { sugerirEnlacesHacia } = await import('./enlaces');
    candidatas = (await sugerirEnlacesHacia(url, 6)).map(s => ({ url: s.desde, titulo: s.anchor }));
  } catch { /* sin embeddings no hay sugerencia; el especialista propone por título */ }
  if (!candidatas.length) {
    const { data: pags } = await supabase.from('de_paginas').select('url, titulo').eq('indexable', true).or(claves.map(k => `titulo.ilike.%${k}%`).join(',') || 'titulo.ilike.%tienda%').neq('url', url).limit(8);
    candidatas = (pags || []).map(p => ({ url: p.url, titulo: p.titulo }));
  }

  return {
    url, publicada: c.estado === 'publicado', ruta,
    indexada_gsc: pag?.indexada_gsc ?? null, en_sitemap: pag?.en_sitemap ?? null, avisada_at: pag?.avisada_at ?? null, enlaces_in: pag?.enlaces_in ?? null, citabilidad: pag?.citabilidad ?? null, cwv: pag?.cwv ?? null,
    clics_28d: sum('clics'), impresiones_28d: sum('impresiones'), posicion_28d: posiciones.length ? Math.round((posiciones.reduce((a, b) => a + b, 0) / posiciones.length) * 10) / 10 : null,
    sesiones_ia_28d: sum('sesiones_ia'), leads_28d: sum('leads'), demos_28d: sum('demos'),
    queries_top, citas_ia: citas || 0, menciones_sacs_ia: menciones, dominios_citados: dominios,
    enlaces_hacia: (hacia || []).map(h => ({ desde: h.desde, anchor: h.anchor })), candidatas_para_enlazar: candidatas,
  } as Senales & { ruta: string };
}

function senalesTexto(s: Senales): string {
  return `SEÑALES REALES DE LA PÁGINA (${s.url})
  Publicada: ${s.publicada ? 'sí' : 'NO (aprobada, en bandeja)'} · Indexada en Google (GSC): ${s.indexada_gsc === null ? 'sin dato' : s.indexada_gsc ? 'sí' : 'no'} · En sitemap: ${s.en_sitemap ?? 'sin dato'} · Avisada a Bing (IndexNow): ${s.avisada_at ? s.avisada_at.slice(0, 10) : 'no'}
  28 días: ${s.clics_28d} clics · ${s.impresiones_28d} impresiones · posición media ${s.posicion_28d ?? '—'} · ${s.sesiones_ia_28d} sesiones desde IAs · ${s.leads_28d} leads · ${s.demos_28d} demos
  Búsquedas que ya la muestran: ${s.queries_top.length ? s.queries_top.map(q => `«${q.query}» ${q.impresiones} imp / ${q.clics} clics / pos ${q.posicion}`).join('; ') : '(ninguna todavía)'}
  Citada por IAs en nuestras muestras: ${s.citas_ia} veces · Sacs mencionado en prompts del tema: ${s.menciones_sacs_ia} · Dominios que las IAs citan para el tema: ${s.dominios_citados.join(', ') || '(sin muestras)'}
  Enlaces internos que la apuntan: ${s.enlaces_hacia.length}${s.enlaces_hacia.length ? ' (' + s.enlaces_hacia.map(e => e.desde.replace(SITIO, '')).join(', ') + ')' : ''}
  Páginas del sitio que podrían enlazarla: ${s.candidatas_para_enlazar.map(p => `${p.url.replace(SITIO, '')} («${p.titulo}»)`).join('; ') || '(sin candidatas)'}
  CWV: ${s.cwv ? JSON.stringify(s.cwv).slice(0, 200) : 'sin dato'} · Citabilidad (score interno): ${s.citabilidad ?? '—'}`;
}

function piezaTexto(c: any): string {
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const ref = (c.auditorias as any)?.referee;
  return `LA PÁGINA
Título: ${c.titulo}
H1: ${c.h1}
Meta: ${c.meta_desc}
URL: /${c.seccion}/${c.slug}/
Pregunta que contesta: ${(c.brief as any)?.pregunta || '—'}
Giro: ${(c.brief as any)?.giro || '—'}
Palabras que rankean (brief): ${((c.brief as any)?.palabras_que_rankean || []).slice(0, 8).join(' · ') || '—'}
Referee: ${ref ? `promedio ${Object.values(ref.puntajes || {}).map(Number).reduce((a: number, b: number) => a + b, 0) / Math.max(Object.keys(ref.puntajes || {}).length, 1)} · probabilidad de cita ${ref.probabilidad_cita ?? '—'}% · criterios ok ${(ref.criterios || []).filter((k: any) => k.ok).length}/${(ref.criterios || []).length}` : 'sin veredicto'}
Cuerpo (${contarPalabras(cuerpo)} palabras):
${aMarkdown(cuerpo).slice(0, 20000)}`;
}

async function guardarPendientes(contenidoId: string, origen: string, lista: any[]) {
  let n = 0;
  /* Lo que el especialista YA NO ve en esta revisión se da por hecho: la lista
     vieja se quedaba abierta aunque la página ya no tuviera el problema
     (el «[ENLACE] roto» de novias seguía pendiente tres versiones después). */
  const clavesNuevas = new Set((lista || []).filter(p => p?.clave).map(p => `${origen}:${String(p.clave).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60)}`));
  const { data: abiertos } = await supabase.from('de_contenido_pendientes').select('id, clave').eq('contenido_id', contenidoId).eq('origen', origen).eq('estado', 'pendiente');
  for (const a of abiertos || []) if (!clavesNuevas.has(a.clave)) await supabase.from('de_contenido_pendientes').update({ estado: 'hecho', hecho_at: new Date().toISOString(), impacto: 'cerrado solo: el especialista ya no lo ve' }).eq('id', a.id);
  for (const p of lista || []) {
    if (!p?.clave || !p?.titulo) continue;
    const clave = `${origen}:${String(p.clave).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60)}`;
    const { data: ya } = await supabase.from('de_contenido_pendientes').select('id, estado').eq('contenido_id', contenidoId).eq('clave', clave).maybeSingle();
    if (ya) {
      // Lo hecho o descartado no se resucita; lo pendiente se actualiza con el detalle nuevo.
      if (ya.estado === 'pendiente') await supabase.from('de_contenido_pendientes').update({ titulo: p.titulo, detalle: p.detalle, quien: p.quien === 'motor' ? 'motor' : 'dueno', prioridad: Math.min(3, Math.max(1, Number(p.prioridad) || 2)), impacto: p.impacto }).eq('id', ya.id);
      continue;
    }
    const { error } = await supabase.from('de_contenido_pendientes').insert({
      contenido_id: contenidoId, origen, clave, titulo: p.titulo, detalle: p.detalle, quien: p.quien === 'motor' ? 'motor' : 'dueno',
      prioridad: Math.min(3, Math.max(1, Number(p.prioridad) || 2)), impacto: p.impacto,
    });
    if (!error) n++;
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · ESPECIALISTAS SEO + IA/AGENTES (antes de publicar y cada 14 días)
// ═══════════════════════════════════════════════════════════════════════════
export async function revisarEspecialistas(contenidoId: string): Promise<{ ok: boolean; seo?: any; geo?: any; nuevos: number; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, seccion, slug, titulo, h1, meta_desc, cuerpo, brief, estado, auditorias').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, nuevos: 0, error: 'no existe', costo: 0 };
  const s = await senalesDe(c);
  const base = `${HECHOS_DEL_SITIO}\n\n${senalesTexto(s)}\n\n${fichaSacs()}\n\n${piezaTexto(c)}`;
  let costo = 0;

  const seo = await preguntar<any>({ agente: 'especialista_seo', trabajo: 'estrategia', sistema: SISTEMA_SEO, usuario: base, esquema: ESQUEMA_PENDIENTES, max_tokens: 6000 });
  costo += seo.costo_usd || 0;
  if (!seo.ok || !seo.datos) return { ok: false, nuevos: 0, error: `seo: ${seo.error}`, costo };

  const geo = await preguntar<any>({ agente: 'especialista_geo', trabajo: 'estrategia', sistema: SISTEMA_GEO, usuario: `LOS 10 CRITERIOS DE IA Y AGENTES:\n${CRITERIOS_AGENTES.map(k => `  - ${k.clave}: ${k.que}`).join('\n')}\n\n${base}`, esquema: ESQUEMA_PENDIENTES, max_tokens: 6000 });
  costo += geo.costo_usd || 0;
  if (!geo.ok || !geo.datos) return { ok: false, nuevos: 0, error: `geo: ${geo.error}`, costo };

  const nuevos = (await guardarPendientes(c.id, 'seo', seo.datos.pendientes)) + (await guardarPendientes(c.id, 'geo', geo.datos.pendientes));
  const audit = { ...((c.auditorias as any) || {}), especialista: { seo: { score: seo.datos.score, resumen: seo.datos.resumen }, geo: { score: geo.datos.score, resumen: geo.datos.resumen }, cuando: new Date().toISOString() } };
  await supabase.from('de_contenido').update({ auditorias: audit }).eq('id', c.id);
  return { ok: true, seo: seo.datos, geo: geo.datos, nuevos, costo };
}

registrar('contenido.especialista', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  const ids: string[] = a.payload?.contenido_id ? [a.payload.contenido_id] : [];
  if (!ids.length) {
    const { data } = await supabase.from('de_contenido').select('id, estado, auditorias').in('estado', ['aprobado', 'publicado']).order('actualizado_at', { ascending: false }).limit(limite * 5);
    const corte = Date.now() - DIAS_ESPECIALISTA * 864e5;
    for (const c of data || []) {
      const cuando = (c.auditorias as any)?.especialista?.cuando;
      if (!cuando || (c.estado === 'publicado' && new Date(cuando).getTime() < corte)) ids.push(c.id);
      if (ids.length >= limite) break;
    }
  }
  if (!ids.length) return { ok: true, resumen: 'todas las piezas tienen revisión de especialistas reciente' };
  let hechas = 0, nuevos = 0, costo = 0; const fallos: string[] = [];
  for (const id of ids) {
    const r = await revisarEspecialistas(id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${id.slice(0, 8)}: ${r.error}`); continue; }
    hechas++; nuevos += r.nuevos;
  }
  return { ok: fallos.length === 0, resumen: `${hechas} pieza(s) revisadas · ${nuevos} pendiente(s) nuevo(s)${fallos.length ? ` · ${fallos.length} fallaron` : ''}`, datos: { hechas, nuevos, fallos }, costo_usd: costo };
});

// ═══════════════════════════════════════════════════════════════════════════
// 1b · EJECUTAR lo que es del motor: parche → referee → republicar
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Un pendiente «motor» se aplica como corrección por parches sobre la pieza,
 * se vuelve a juzgar y, si sigue pasando, se republica como versión nueva. Si
 * el parche no aplica a ESTA página (p. ej. «enlazar desde /producto/…» es
 * cambiar otra página) el modelo no devuelve parches y el pendiente pasa al
 * dueño con la nota. Si el referee lo tumba, se revierte el cuerpo.
 */
export async function ejecutarPendiente(pendienteId: string): Promise<{ ok: boolean; resultado: string; costo: number }> {
  const { data: p } = await supabase.from('de_contenido_pendientes').select('*').eq('id', pendienteId).maybeSingle();
  if (!p) return { ok: false, resultado: 'no existe', costo: 0 };
  if (p.estado !== 'pendiente') return { ok: true, resultado: `ya está ${p.estado}`, costo: 0 };
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, estado, cuerpo, titulo, h1, meta_desc, brief, version').eq('id', p.contenido_id).maybeSingle();
  if (!c) return { ok: false, resultado: 'la pieza no existe', costo: 0 };
  if (!['aprobado', 'publicado'].includes(c.estado)) return { ok: false, resultado: `la pieza está en «${c.estado}»`, costo: 0 };

  const { aplicarParches } = await import('./contenido');
  const { juzgar } = await import('./calidad');
  const respaldo = { cuerpo: c.cuerpo, titulo: c.titulo, h1: c.h1, meta_desc: c.meta_desc, estado: c.estado };
  const marca = async (estado: string, nota: string) => supabase.from('de_contenido_pendientes').update({ estado, hecho_at: estado === 'pendiente' ? null : new Date().toISOString(), impacto: nota, ...(estado === 'pendiente' ? { quien: 'dueno' } : {}) }).eq('id', p.id);

  // 1) el pendiente como corrección
  await supabase.from('de_contenido').update({ brief: { ...(c.brief as any), correcciones: [`${p.titulo}: ${p.detalle}`] } }).eq('id', c.id);
  const r = await aplicarParches(c.id);
  let costo = r.costo;
  if (!r.ok || !r.parches) {
    await supabase.from('de_contenido').update({ estado: respaldo.estado, brief: { ...(c.brief as any), correcciones: undefined } }).eq('id', c.id);
    await marca('pendiente', `el motor no pudo aplicarlo sobre esta página (${r.error || 'sin parches: probablemente hay que cambiar OTRA página o hace falta una persona'})`);
    return { ok: true, resultado: 'no aplica en esta página: pasó al dueño', costo };
  }

  // 2) vuelve a juzgar: si el cambio rompió algo, se revierte
  const j = await juzgar(c.id);
  costo += j.costo;
  const pasa = j.ok && j.veredicto?.pasa;
  if (!pasa) {
    await supabase.from('de_contenido').update({ ...respaldo }).eq('id', c.id);
    await marca('pendiente', `aplicado y revertido: el referee lo tumbó (${(j.veredicto?.fallos || [j.error]).slice(0, 2).join(' | ').slice(0, 200)})`);
    return { ok: true, resultado: 'aplicado pero el referee lo tumbó: revertido', costo };
  }

  // 3) se queda; si estaba publicada, versión nueva en línea
  let republicada = '';
  if (respaldo.estado === 'publicado') {
    const { publicar } = await import('./publicar');
    try { const pub = await publicar(c.id, `pendiente del motor aplicado: ${p.titulo}`); republicada = pub.simulado ? ` (simulado: ${pub.simulado})` : ` · versión ${pub.version} en línea`; }
    catch (e: any) { await supabase.from('de_contenido').update({ ...respaldo }).eq('id', c.id); await marca('pendiente', `no se pudo republicar: ${String(e?.message || e).slice(0, 160)}`); return { ok: false, resultado: 'no se pudo republicar; revertido', costo }; }
  } else {
    await supabase.from('de_contenido').update({ estado: respaldo.estado, auditorias: { referee: { ...j.veredicto, duras: j.duras, cuando: new Date().toISOString() } } }).eq('id', c.id);
  }
  await marca('hecho', `hecho por el motor: ${r.parches} parche(s), referee ${Object.values(j.veredicto!.puntajes).map(Number).reduce((a, b) => a + b, 0) / 6}${republicada}`);
  return { ok: true, resultado: `hecho: ${r.parches} parche(s)${republicada}`, costo };
}

registrar('contenido.ejecutar', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || 3;
  let ids: string[] = a.payload?.pendiente_id ? [a.payload.pendiente_id] : [];
  if (!ids.length) {
    let q = supabase.from('de_contenido_pendientes').select('id, contenido_id').eq('estado', 'pendiente').eq('quien', 'motor').order('prioridad').order('created_at').limit(limite * 3);
    if (a.payload?.contenido_id) q = q.eq('contenido_id', a.payload.contenido_id);
    const { data } = await q;
    // Uno por pieza por corrida: dos parches seguidos sobre la misma página se pisan.
    const vistas = new Set<string>();
    for (const p of data || []) { if (vistas.has(p.contenido_id)) continue; vistas.add(p.contenido_id); ids.push(p.id); if (ids.length >= limite) break; }
  }
  if (!ids.length) return { ok: true, resumen: 'no hay pendientes del motor' };
  let hechos = 0, costo = 0; const notas: string[] = [];
  for (const id of ids) {
    const r = await ejecutarPendiente(id);
    costo += r.costo; if (r.ok && /^hecho/.test(r.resultado)) hechos++;
    notas.push(`${id.slice(0, 8)}: ${r.resultado}`);
  }
  return { ok: true, resumen: `${hechos}/${ids.length} pendiente(s) del motor hechos`, datos: { notas }, costo_usd: costo };
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · AUTORIDAD (solo publicado, cada 7 días)
// ═══════════════════════════════════════════════════════════════════════════
export async function revisarAutoridad(contenidoId: string): Promise<{ ok: boolean; datos?: any; senales?: Senales; nuevos: number; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, seccion, slug, titulo, h1, meta_desc, cuerpo, brief, estado, auditorias, publicado_at').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, nuevos: 0, error: 'no existe', costo: 0 };
  if (c.estado !== 'publicado') return { ok: false, nuevos: 0, error: 'todavía no está publicada', costo: 0 };
  const s = await senalesDe(c);
  const dias = c.publicado_at ? Math.round((Date.now() - new Date(c.publicado_at).getTime()) / 864e5) : 0;
  const usuario = `${HECHOS_DEL_SITIO}\n\nPublicada hace ${dias} día(s).\n\n${senalesTexto(s)}\n\n${piezaTexto(c).slice(0, 9000)}`;
  const r = await preguntar<any>({ agente: 'especialista_autoridad', trabajo: 'estrategia', sistema: SISTEMA_AUTORIDAD, usuario, esquema: ESQUEMA_PENDIENTES, max_tokens: 5000 });
  if (!r.ok || !r.datos) return { ok: false, nuevos: 0, error: r.error, costo: r.costo_usd || 0 };
  const nuevos = await guardarPendientes(c.id, 'autoridad', r.datos.pendientes);
  const audit = { ...((c.auditorias as any) || {}), autoridad: { score: r.datos.score, resumen: r.datos.resumen, senales: { clics_28d: s.clics_28d, impresiones_28d: s.impresiones_28d, posicion_28d: s.posicion_28d, citas_ia: s.citas_ia, enlaces_hacia: s.enlaces_hacia.length, indexada_gsc: s.indexada_gsc }, cuando: new Date().toISOString() } };
  await supabase.from('de_contenido').update({ auditorias: audit }).eq('id', c.id);
  return { ok: true, datos: r.datos, senales: s, nuevos, costo: r.costo_usd || 0 };
}

registrar('contenido.autoridad', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  const ids: string[] = a.payload?.contenido_id ? [a.payload.contenido_id] : [];
  if (!ids.length) {
    const { data } = await supabase.from('de_contenido').select('id, auditorias').eq('estado', 'publicado').order('publicado_at', { ascending: false }).limit(limite * 5);
    const corte = Date.now() - DIAS_AUTORIDAD * 864e5;
    for (const c of data || []) {
      const cuando = (c.auditorias as any)?.autoridad?.cuando;
      if (!cuando || new Date(cuando).getTime() < corte) ids.push(c.id);
      if (ids.length >= limite) break;
    }
  }
  if (!ids.length) return { ok: true, resumen: 'toda la autoridad está medida esta semana' };
  let hechas = 0, nuevos = 0, costo = 0; const fallos: string[] = [];
  for (const id of ids) {
    const r = await revisarAutoridad(id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${id.slice(0, 8)}: ${r.error}`); continue; }
    hechas++; nuevos += r.nuevos;
  }
  return { ok: fallos.length === 0, resumen: `${hechas} pieza(s) medidas · ${nuevos} pendiente(s) de autoridad`, datos: { hechas, nuevos, fallos }, costo_usd: costo };
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · ÁNGULOS: el loop que saca más piezas de cada pieza
// ═══════════════════════════════════════════════════════════════════════════
export async function proponerAngulos(contenidoId: string): Promise<{ ok: boolean; angulos?: any[]; creados: number; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, seccion, slug, titulo, brief, cuerpo, estado').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, creados: 0, error: 'no existe', costo: 0 };
  const b = (c.brief as any) || {};
  if (b.angulos_generados) return { ok: true, angulos: b.angulos || [], creados: 0, costo: 0 };

  const publicadas = await supabase.from('de_contenido').select('seccion, slug, titulo').in('estado', ['publicado', 'aprobado', 'borrador', 'brief']);
  const usuario = `PÁGINA MADRE: /${c.seccion}/${c.slug}/ — ${c.titulo}
Pregunta: ${b.pregunta || '—'} · Giro: ${b.giro || '—'}
Preguntas que la gente hace y nadie contesta (de la investigación): ${(b.preguntas_sin_contestar || []).slice(0, 10).map((x: string) => `\n  - ${x}`).join('') || '—'}
Palabras que rankean: ${(b.palabras_que_rankean || []).slice(0, 8).join(' · ') || '—'}
YA EXISTE O ESTÁ EN CAMINO (no lo repitas): ${(publicadas.data || []).map(p => `/${p.seccion}/${p.slug}/`).join(', ')}

${fichaSacs()}

Secciones de la madre:\n${((c.cuerpo || []) as Bloque[]).filter(x => x.t === 'h2').map((x: any) => `  - ${x.texto}`).join('\n')}`;
  const r = await preguntar<{ angulos: any[] }>({ agente: 'contenido_angulos', trabajo: 'estrategia', sistema: SISTEMA_ANGULOS, usuario, esquema: ESQUEMA_ANGULOS, max_tokens: 3000 });
  if (!r.ok || !r.datos) return { ok: false, creados: 0, error: r.error, costo: r.costo_usd || 0 };

  let creados = 0;
  const angulos = (r.datos.angulos || []).slice(0, 5).map(x => ({ ...x, slug: String(x.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60), seccion: x.tipo === 'comparativa' ? 'comparar' : (b.giro ? 'guias' : 'recursos') }));
  for (const ang of angulos) {
    if (!ang.slug) continue;
    const clave = `SEO_CONTENT:angulo:${c.slug}:${ang.slug}`;
    const { data: ya } = await supabase.from('de_oportunidades').select('id').eq('clave_idem', clave).maybeSingle();
    if (ya) continue;
    const { error } = await supabase.from('de_oportunidades').insert({
      clave_idem: clave, tipo: 'SEO_CONTENT', titulo: ang.pregunta || ang.titulo,
      descripcion: `Ángulo «${ang.tipo}» derivado de /${c.seccion}/${c.slug}/: ${ang.por_que}`,
      evidencia: { angulo: ang.tipo, padre: `/${c.seccion}/${c.slug}/`, padre_id: c.id, titulo_propuesto: ang.titulo, seccion_propuesta: ang.seccion, slug_propuesto: ang.slug, giro: b.giro || null },
      score: 60, desglose: { angulo: true }, pesos_version: 0 /* entero: la versión de pesos no aplica a un ángulo */, accion_recomendada: 'Escribir la pieza hermana y enlazarla con la madre en ambos sentidos', esfuerzo: 'M', riesgo: 'LOW', estado: 'nueva',
    });
    if (!error) creados++;
  }
  await supabase.from('de_contenido').update({ brief: { ...b, angulos, angulos_generados: new Date().toISOString() } }).eq('id', c.id);
  return { ok: true, angulos, creados, costo: r.costo_usd || 0 };
}

registrar('contenido.angulos', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  const ids: string[] = a.payload?.contenido_id ? [a.payload.contenido_id] : [];
  if (!ids.length) {
    const { data } = await supabase.from('de_contenido').select('id, brief').eq('estado', 'publicado').order('publicado_at', { ascending: false }).limit(limite * 5);
    for (const c of data || []) { if (!(c.brief as any)?.angulos_generados) ids.push(c.id); if (ids.length >= limite) break; }
  }
  if (!ids.length) return { ok: true, resumen: 'todas las piezas publicadas ya tienen sus ángulos' };
  let hechas = 0, creados = 0, costo = 0; const fallos: string[] = [];
  for (const id of ids) {
    const r = await proponerAngulos(id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${id.slice(0, 8)}: ${r.error}`); continue; }
    hechas++; creados += r.creados;
  }
  return { ok: fallos.length === 0, resumen: `${hechas} pieza(s) con ángulos · ${creados} oportunidad(es) nueva(s) para el brief`, datos: { hechas, creados, fallos }, costo_usd: costo };
});
