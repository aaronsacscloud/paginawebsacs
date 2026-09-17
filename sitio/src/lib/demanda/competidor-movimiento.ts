// DEMAND ENGINE · qué están haciendo los competidores que nosotros no.
//
// No es espionaje ni es copiar: es que **cuando tres competidores publican
// sobre lo mismo en el mismo mes, casi siempre es porque el mercado lo está
// preguntando** — y ese dato llega antes por sus sitemaps que por nuestro
// propio tráfico, porque ellos ya se movieron y nosotros todavía no tenemos
// visitas que medir.
//
// La regla que evita que esto se convierta en un imitador: se reporta el TEMA,
// no la página. Que Sizes and Colors publique «guía de curva de tallas» no es
// una instrucción para publicar lo mismo; es una señal de que ese tema está
// caliente, y la decisión de qué decir sigue siendo nuestra —y tiene que ser
// mejor, o no vale la pena—.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { traerTodo } from './paginar';
import { diaCdmx } from './fechas';
import type { ResultadoHandler } from './tipos';

/** Cuántos competidores tienen que tocar un tema para que cuente. Dos es
 *  casualidad; tres a la vez es el mercado. */
const MINIMO_COMPETIDORES = 2;

/** Palabras que aparecen en cualquier URL y no dicen nada del tema. */
const RUIDO = new Set([
  'www', 'com', 'mx', 'http', 'https', 'index', 'html', 'php', 'page', 'blog',
  'post', 'articulo', 'articulos', 'category', 'categoria', 'tag', 'tags',
  'el', 'la', 'los', 'las', 'de', 'del', 'en', 'para', 'por', 'con', 'que',
  'un', 'una', 'y', 'o', 'a', 'al', 'su', 'es', 'como', 'the', 'and', 'of', 'to',
  'about', 'contact', 'us', 'privacy', 'policy', 'terms', 'legal', 'login',
  'sign', 'signup', 'demo', 'pricing', 'price', 'precios', 'contacto', 'nosotros',
  'aviso', 'terminos', 'condiciones', 'inicio', 'home', 'search', 'buscar', 'with',
]);

/** El tema de una URL: su ÚLTIMO segmento, y solo si es de varias palabras.
 *
 *  La primera versión sacaba palabras sueltas de la ruta entera y devolvió
 *  3,356 «temas» encabezados por `product`, `marketing`, `contact` y `pricing`
 *  — que no son temas: son secciones de menú que tienen TODOS los sitios.
 *  Quince competidores «tocando el tema product» no dice absolutamente nada.
 *
 *  Un slug de una sola palabra es una sección; uno de varias es un artículo.
 *  `curva-de-tallas` o `sell-through-calculation` son temas; `blog` no. Esa
 *  distinción es toda la diferencia entre una lista accionable y ruido. */
function temaDe(url: string): string | null {
  let ruta: string;
  try { ruta = new URL(url).pathname; } catch { return null; }

  const segmentos = ruta.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\.(html?|php|aspx?)$/, '')
    .split('/').filter(Boolean);
  if (!segmentos.length) return null;

  const palabras = segmentos[segmentos.length - 1]
    .split(/[^a-z0-9]+/).filter(p => p.length >= 3 && !/^\d+$/.test(p));

  // Menos de dos palabras útiles: es una sección, no un tema.
  if (palabras.length < 2) return null;
  // Todo ruido: `about-us`, `contact-us`, `privacy-policy`.
  if (palabras.every(p => RUIDO.has(p))) return null;

  return palabras.join('-');
}

export type Movimiento = {
  tema: string;
  competidores: string[];
  paginas: { competidor: string; url: string; titulo: string | null; vista: string }[];
  /** ¿Tenemos algo sobre esto? */
  tenemos: boolean;
};

export async function detectarMovimiento(dias = 60): Promise<Movimiento[]> {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();

  const [nuevas, competidores, propias] = await Promise.all([
    traerTodo<any>('de_competidor_paginas', 'competidor_id, url, titulo, vista_primera',
      q => q.gte('vista_primera', desde), 50_000, 'url'),
    traerTodo<any>('de_competidores', 'id, nombre, dominio'),
    traerTodo<any>('de_contenido', 'slug, titulo', q => q.eq('estado', 'publicado')),
  ]);

  const nombreDe = new Map(competidores.map(c => [c.id, c.nombre || c.dominio]));
  const nuestroTexto = propias.map(p => `${p.slug} ${p.titulo || ''}`).join(' ').toLowerCase();

  // tema → qué competidores lo tocaron (por id, para no contar dos páginas del
  // mismo competidor como dos competidores).
  const porTema = new Map<string, { comps: Set<string>; paginas: Movimiento['paginas'] }>();

  for (const p of nuevas) {
    const tema = temaDe(p.url);
    if (!tema) continue;
    const e = porTema.get(tema) || { comps: new Set<string>(), paginas: [] };
    e.comps.add(p.competidor_id);
    if (e.paginas.length < 6) {
      e.paginas.push({
        competidor: nombreDe.get(p.competidor_id) || '(desconocido)',
        url: p.url, titulo: p.titulo, vista: String(p.vista_primera).slice(0, 10),
      });
    }
    porTema.set(tema, e);
  }

  return [...porTema.entries()]
    .filter(([, e]) => e.comps.size >= MINIMO_COMPETIDORES)
    .map(([tema, e]) => ({
      tema,
      competidores: [...e.comps].map(id => nombreDe.get(id) || '(desconocido)'),
      paginas: e.paginas,
      // Por PALABRAS y no por la cadena entera: `sell-through-rate` no aparece
      // literal en nuestro texto, pero si ya escribimos sobre sell-through sí
      // lo tenemos.
      tenemos: tema.split('-').filter(x => !RUIDO.has(x)).every(x => nuestroTexto.includes(x)),
    }))
    // Lo que NO tenemos primero: es donde hay algo que hacer.
    .sort((a, b) => Number(a.tenemos) - Number(b.tenemos) || b.competidores.length - a.competidores.length);
}

registrar('detectar.competidor', async (): Promise<ResultadoHandler> => {
  const movs = await detectarMovimiento();
  const huecos = movs.filter(m => !m.tenemos);

  const ahora = new Date().toISOString();
  let anotados = 0;

  for (const m of huecos.slice(0, 15)) {
    /* Clave por MES: un tema caliente sigue caliente varias semanas, y un
       hallazgo nuevo cada día por lo mismo entierra los que sí son nuevos. */
    const { error } = await supabase.from('de_issues').upsert({
      clave_idem: `competidor:${m.tema}:${diaCdmx().slice(0, 7)}`,
      tipo: 'hueco_vs_competidor',
      severidad: m.competidores.length >= 3 ? 'media' : 'baja',
      url: m.paginas[0]?.url || '',
      detalle: {
        tema: m.tema,
        cuantos_competidores: m.competidores.length,
        competidores: m.competidores,
        ejemplos: m.paginas,
        nota: 'Publicaron sobre esto y nosotros no. Es una señal de que el mercado lo pregunta, NO una instrucción para copiar: lo que digamos tiene que ser mejor o no vale la pena.',
      },
      estado: 'abierto',
      visto_ultima: ahora,
    }, { onConflict: 'clave_idem' });
    if (!error) anotados++;
    else console.error(`[competidor] no se pudo anotar «${m.tema}»: ${error.message}`);
  }

  return {
    ok: true,
    resumen: movs.length
      ? `${movs.length} tema(s) que ${MINIMO_COMPETIDORES}+ competidores tocaron · ${huecos.length} que nosotros no · ${anotados} anotados`
      : 'ningún tema tocado por varios competidores a la vez',
    datos: { temas: movs.length, huecos: huecos.length, top: huecos.slice(0, 8).map(m => ({ tema: m.tema, competidores: m.competidores.length })) },
  };
});
