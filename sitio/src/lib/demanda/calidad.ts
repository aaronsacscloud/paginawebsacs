// DEMAND ENGINE · el gate de calidad: nada llega a la bandeja del dueño sin
// haber pasado por aquí.
//
// TRES PASOS, y el orden es la idea:
//
//   contenido.competencia   ANTES de escribir: qué páginas contestan hoy esta
//                           pregunta, qué cubren y qué les falta.
//   contenido.referee       DESPUÉS de escribir: ¿la nuestra es mejor que esas
//                           en lo concreto? Si no, dice exactamente qué cambiar
//                           y la manda a reescribir.
//   contenido.imagen        Solo cuando pasó: una portada documental, subida a
//                           storage para no depender de un despliegue.
//
// POR QUÉ EL MODELO LEE A LOS COMPETIDORES Y NO ESTE SERVIDOR
// Este servidor está bloqueado por Cloudflare en buena parte de los sitios del
// ramo (sicar.mx devuelve 403 con «error code: 1005»). gpt-5 con `web_search`
// sí los lee —el rastreador es de OpenAI, no nuestro— y de paso hace lo que un
// fetch no haría: resume estructura, huecos y por qué rankea. En la primera
// prueba trajo dos competidores directos de novias (Glow-Dress, Dressesfy) que
// no estaban en nuestra lista. Cuesta unos $0.20 por pregunta.
//
// SOBRE «QUE GOOGLE NO DETECTE QUE ES IA»
// Google no penaliza el contenido por venir de un modelo; penaliza el contenido
// genérico y a escala que no ayuda a nadie. Los «detectores de IA» son ruleta.
// Lo que sí se puede exigir —y es lo mismo que hace que una página sirva— es
// que lea como escrita por alguien que lleva una tienda: casos con nombre y
// número, límites admitidos, opiniones, cero folleto. Eso es el eje «voz de
// experto» del referee, y es medible.
import { supabase } from '../supabase';
import { preguntar } from './ia';
import { registrar } from './handlers';
import { fichaSacs, PRECIOS, GUIAS, HERRAMIENTAS } from './capacidades';
import { aTexto, aMarkdown, palabras as contarPalabras, type Bloque } from './bloques';
import { frenoDeSalida } from './salida';
import type { ResultadoHandler } from './tipos';

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();
const POR_CORRIDA = 5;
/** Cuántas veces se reescribe antes de rendirse y dejarla para que la vea el dueño. */
const MAX_REESCRITURAS = 2;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · COMPETENCIA
// ═══════════════════════════════════════════════════════════════════════════

export type PaginaSimilar = {
  url: string; titulo: string; tipo: string; palabras_aprox: number; h2: string[];
  tiene_faq: boolean; tiene_tabla_o_pasos: boolean; menciona_precios: boolean;
  cubre_bien: string[]; le_falta: string[]; por_que_rankea: string;
};
export type Competencia = { paginas: PaginaSimilar[]; hueco_comun: string; analizada_at: string };

/** Lee las páginas que hoy contestan la pregunta, con `web_search` de gpt-5. */
export async function analizarCompetencia(pregunta: string, contexto?: string): Promise<{ ok: boolean; datos?: Competencia; error?: string; costo: number }> {
  const llave = env('OPENAI_API_KEY');
  if (!llave) return { ok: false, error: 'falta OPENAI_API_KEY', costo: 0 };

  const input = `Busca en Google en español (México) las páginas que hoy mejor contestan esta pregunta:

«${pregunta}»
${contexto ? `\nContexto de quien pregunta: ${contexto}\n` : ''}
Lee las 5 mejores páginas que encuentres (blogs, guías, proveedores de software, foros, en español o inglés) y devuélveme SOLO un JSON con esta forma exacta, sin texto fuera del JSON:
{"paginas":[{"url":"","titulo":"","tipo":"proveedor|guia_independiente|foro|otro","palabras_aprox":0,"h2":[""],"tiene_faq":false,"tiene_tabla_o_pasos":false,"menciona_precios":false,"cubre_bien":[""],"le_falta":[""],"por_que_rankea":""}],"hueco_comun":"lo que NINGUNA cubre bien y una página nuestra podría cubrir, en dos frases concretas"}`;

  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5', tools: [{ type: 'web_search' }], input }),
  });
  const j: any = await r.json();
  if (j.error) return { ok: false, error: j.error.message, costo: 0 };

  const texto = (j.output || []).flatMap((o: any) => (o.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text)).join('');
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'la respuesta no trajo JSON', costo: 0 };

  // Precio de gpt-5: $1.25/M entrada, $10/M salida; la búsqueda web va aparte y se estima.
  const ent = j.usage?.input_tokens || 0, sal = j.usage?.output_tokens || 0;
  const busquedas = (j.output || []).filter((o: any) => o.type === 'web_search_call').length;
  const costo = (ent * 1.25 + sal * 10) / 1e6 + busquedas * 0.01;
  try { await supabase.from('ia_uso').insert({ modelo: 'geo:gpt-5', proposito: 'demanda:competencia', input_tokens: ent, output_tokens: sal, cache_read: 0, cache_write: 0, busquedas_web: busquedas, costo_usd: costo, ok: true, ms: Date.now() - t0 }); } catch {}

  let d: any;
  try { d = JSON.parse(m[0]); } catch { return { ok: false, error: 'JSON inválido', costo }; }
  const paginas: PaginaSimilar[] = (d.paginas || []).filter((p: any) => p?.url).slice(0, 6).map((p: any) => ({
    url: String(p.url), titulo: String(p.titulo || ''), tipo: String(p.tipo || 'otro'),
    palabras_aprox: Number(p.palabras_aprox) || 0, h2: Array.isArray(p.h2) ? p.h2.slice(0, 10) : [],
    tiene_faq: !!p.tiene_faq, tiene_tabla_o_pasos: !!p.tiene_tabla_o_pasos, menciona_precios: !!p.menciona_precios,
    cubre_bien: Array.isArray(p.cubre_bien) ? p.cubre_bien.slice(0, 5) : [], le_falta: Array.isArray(p.le_falta) ? p.le_falta.slice(0, 5) : [],
    por_que_rankea: String(p.por_que_rankea || ''),
  }));
  return { ok: true, datos: { paginas, hueco_comun: String(d.hueco_comun || ''), analizada_at: new Date().toISOString() }, costo };
}

/** Guarda las páginas junto a la pieza, y da de alta los competidores que no conocíamos. */
async function guardarCompetencia(contenidoId: string, c: Competencia) {
  for (const p of c.paginas) {
    await supabase.from('de_paginas_similares').upsert({
      contenido_id: contenidoId, url: p.url, titulo: p.titulo, tipo: p.tipo, palabras_aprox: p.palabras_aprox,
      h2: p.h2, tiene_faq: p.tiene_faq, tiene_tabla_o_pasos: p.tiene_tabla_o_pasos, menciona_precios: p.menciona_precios,
      cubre_bien: p.cubre_bien, le_falta: p.le_falta, por_que_rankea: p.por_que_rankea, analizada_at: c.analizada_at,
    }, { onConflict: 'contenido_id,url' });

    /* Un proveedor que rankea para nuestra pregunta y no está en `de_competidores`
       es un competidor que el motor no vigila. Se da de alta con la nota de dónde
       salió; el ciclo de competidores lo rastrea a partir de ahí. */
    if (p.tipo === 'proveedor') {
      let dominio = '';
      try { dominio = new URL(p.url).hostname.replace(/^www\./, ''); } catch { continue; }
      if (!dominio || /sacscloud/.test(dominio)) continue;
      const { data: ya } = await supabase.from('de_competidores').select('id').eq('dominio', dominio).maybeSingle();
      if (!ya) {
        await supabase.from('de_competidores').insert({
          nombre: p.titulo.split(/[|–—-]/)[0].trim().slice(0, 60) || dominio, dominio, tipo: 'directo',
          descubierto_por: 'competencia', activo: true,
          notas: `Rankea para una pregunta nuestra (descubierto por contenido.competencia el ${c.analizada_at.slice(0, 10)})`,
        });
      }
    }
  }
}

registrar('contenido.competencia', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  // Briefs que todavía no tienen su análisis de competencia.
  const { data: pend } = await supabase.from('de_contenido')
    .select('id, slug, brief').eq('estado', 'brief').order('created_at').limit(limite * 3);
  const sin = (pend || []).filter(p => !(p.brief as any)?.competencia).slice(0, limite);
  if (!sin.length) return { ok: true, resumen: 'todos los briefs tienen su competencia analizada' };

  let hechos = 0, costo = 0, nuevosComp = 0;
  const fallos: string[] = [];
  for (const p of sin) {
    const b = p.brief as any;
    const r = await analizarCompetencia(b.pregunta, b.quien);
    costo += r.costo;
    if (!r.ok || !r.datos) { fallos.push(`${p.slug}: ${r.error}`); continue; }
    const antes = (await supabase.from('de_competidores').select('id', { count: 'exact', head: true })).count || 0;
    await guardarCompetencia(p.id, r.datos);
    const despues = (await supabase.from('de_competidores').select('id', { count: 'exact', head: true })).count || 0;
    nuevosComp += Math.max(0, despues - antes);
    const { error } = await supabase.from('de_contenido').update({ brief: { ...b, competencia: r.datos } }).eq('id', p.id);
    if (error) { fallos.push(`${p.slug}: no se guardó: ${error.message}`); continue; }
    hechos++;
  }
  return {
    ok: fallos.length === 0,
    resumen: `${hechos} brief(s) con competencia analizada${nuevosComp ? ` · ${nuevosComp} competidor(es) nuevo(s) dados de alta` : ''}${fallos.length ? ` · ${fallos.length} fallaron` : ''}`,
    datos: { hechos, nuevosComp, fallos }, costo_usd: costo,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · REFEREE
// ═══════════════════════════════════════════════════════════════════════════

export type Veredicto = {
  pasa: boolean;
  puntajes: Record<string, number>;   // 0-10 por eje
  fallos: string[];                   // lo que hay que cambiar, concreto
  mejor_que_competencia: boolean;
  por_que: string;
};

/* Las rutas del sitio a las que una página puede enlazar. Las guías y
   herramientas salen de la ficha; el resto son las secciones fijas del sitio
   (src/pages). Se compara sin la diagonal final: Astro sirve las dos formas. */
const RUTAS_FIJAS = ['/agendar', '/prueba-gratis', '/contacto', '/planes', '/producto', '/giros', '/herramientas', '/recursos', '/comparar', '/casos-de-exito', '/soluciones', '/software-para', '/nosotros', '/marcas', '/enterprise', '/blog', '/partners'];
export function rutaExiste(ruta: string): boolean {
  const r = String(ruta || '').replace(/\/$/, '');
  if (!r.startsWith('/')) return true; // externas: las juzga el modelo
  const guias = Object.keys(GUIAS).map(s => `/recursos/${s}`);
  const herr = Object.keys(HERRAMIENTAS).map(s => `/herramientas/${s}`);
  return guias.includes(r) || herr.includes(r) || RUTAS_FIJAS.some(f => r === f || r.startsWith(f + '/'));
}

/** Lo que se comprueba SIN modelo: no cuesta, no se equivoca, y atrapa lo que
 *  un juez leyendo de corrido se salta. */
export function comprobacionesDuras(p: { titulo: string; meta_desc: string; h1: string; cuerpo: Bloque[]; brief: any }): string[] {
  const f: string[] = [];
  const cuerpo = p.cuerpo || [];
  const plano = aTexto(cuerpo);
  const txt = JSON.stringify(cuerpo);
  const tipos = cuerpo.map(b => b.t);

  // SEO de forma
  if (p.titulo.length > 53) f.push(`título de ${p.titulo.length} caracteres; máximo 53 (la plantilla agrega « | Sacs»)`);
  if ((p.meta_desc || '').length > 158) f.push(`meta de ${p.meta_desc.length}; máximo 158`);
  if ((p.meta_desc || '').length < 90) f.push('meta demasiado corta: desaprovecha el espacio del resultado');
  if (/[\s,;:]$/.test(p.meta_desc || '')) f.push('la meta termina a media frase');
  const h2 = cuerpo.filter(b => b.t === 'h2').length;
  if (h2 < 4) f.push(`solo ${h2} secciones h2; una guía que compite necesita 4 o más`);
  if (h2 > 9) f.push(`${h2} secciones h2: demasiadas, se dispersa`);
  const enlaces = (txt.match(/\]\(\/[a-z0-9\/-]+\)/g) || []).length;
  if (enlaces < 2) f.push(`solo ${enlaces} enlace(s) interno(s); mínimo 2 a guías o herramientas propias`);

  // GEO: contestar primero, y con estructura que una IA pueda extraer
  const primero = cuerpo.find(b => b.t === 'p') as any;
  if (!primero) f.push('no empieza con un párrafo');
  else {
    const n = primero.texto.split(/\s+/).length;
    if (n > 110) f.push(`el primer párrafo tiene ${n} palabras: la respuesta directa va en las primeras 60-80, lo demás después`);
    if (/^(en (el|la|este)|hoy en día|actualmente|vivimos)/i.test(primero.texto.trim())) f.push('el primer párrafo empieza con preámbulo en vez de contestar');
  }
  if (!tipos.includes('faq')) f.push('sin bloque faq: es lo que más pesa para que una IA cite la página');
  else {
    const faq = cuerpo.find(b => b.t === 'faq') as any;
    if ((faq.items || []).length < 4) f.push(`el faq tiene ${faq.items.length} preguntas; mínimo 4`);
  }
  if (!tipos.includes('tabla') && !tipos.includes('pasos')) f.push('sin tabla ni pasos: los hechos estructurados son lo que se extrae y se cita');
  if (!tipos.includes('cta')) f.push('sin cta al final');

  // Voz de experto (lo medible)
  const numeros = (plano.match(/\d[\d,.]*\s?(%|\$|pesos|piezas|tallas|días|meses|semanas|horas|mm|cm)/gi) || []).length;
  if (numeros < 4) f.push(`solo ${numeros} cifras con unidad; una guía de experto trae casos con números`);
  const folleto = plano.match(/potencia tu negocio|solución integral|revoluciona|en el mundo actual|hoy en día más que nunca|lleva tu negocio al siguiente nivel|de la mano de la tecnología|sin duda alguna|es importante mencionar/i);
  if (folleto) f.push(`frase de folleto: «${folleto[0]}»`);
  const parrafos = cuerpo.filter(b => b.t === 'p') as any[];
  const largos = parrafos.filter(b => b.texto.split(/\s+/).length > 140).length;
  if (largos > 2) f.push(`${largos} párrafos de más de 140 palabras: partirlos`);

  // Hechos de Sacs
  const preciosOk = new Set(Object.values(PRECIOS).filter(v => typeof v === 'number').map(String));
  for (const m of txt.matchAll(/\$\s?([\d,]{3,7})/g)) {
    const n = m[1].replace(/,/g, '');
    const ctx = txt.slice(Math.max(0, (m.index || 0) - 110), (m.index || 0) + 110);
    if (!preciosOk.has(n) && /\bsacs\b/i.test(ctx) && /\bplan(es)?\b|vende|controla|fideliza|automatiza|mensualidad|al mes por tienda/i.test(ctx))
      f.push(`precio presentado como de Sacs que no está en la lista: $${m[1]}`);
  }
  for (const m of txt.matchAll(/\]\((\/[a-z0-9\/-]+)\)/g)) {
    if (!rutaExiste(m[1])) f.push(`enlace a una ruta que no existe: ${m[1]}`);
  }
  const cta = cuerpo.find(b => b.t === 'cta') as any;
  if (cta?.url && !rutaExiste(cta.url)) f.push(`la cta apunta a ${cta.url}, que no existe`);

  // Cortada: el modelo se quedó sin tokens y el JSON llegó «entero» con el
  // último texto a medias. Se ve en que el último bloque no es faq ni cta, o
  // en que un párrafo termina sin puntuación.
  const ultimo = cuerpo[cuerpo.length - 1];
  if (ultimo && !['faq', 'cta'].includes(ultimo.t)) f.push(`la página termina en un bloque «${ultimo.t}», no en faq/cta: parece cortada`);
  const sinCierre = parrafos.filter(b => /[a-záéíóúñ0-9,;:(\[]$/i.test(b.texto.trim())).length;
  if (sinCierre) f.push(`${sinCierre} párrafo(s) terminan sin puntuación final: texto cortado a media frase`);

  // Honestidad: si el brief avisó, la página lo DICE
  if (p.brief?.nota_honestidad) {
    const niega = /\bno (tiene|tenemos|hay|existe|cuenta con|ofrece|hace|lleva)\b|\bno es cierto\b|\bno te voy a decir\b|\bno prometemos\b|\bsin rodeos\b/i.test(plano);
    if (!niega) f.push('el brief avisó de algo que no podemos afirmar y la página no lo aclara');
  }
  return f;
}

const ESQUEMA_VEREDICTO = {
  type: 'object', additionalProperties: false,
  properties: {
    pasa: { type: 'boolean' },
    mejor_que_competencia: { type: 'boolean' },
    puntajes: {
      type: 'object', additionalProperties: false,
      properties: { contesta: { type: 'number' }, profundidad: { type: 'number' }, voz_experto: { type: 'number' }, honestidad: { type: 'number' }, estructura_geo: { type: 'number' }, vs_competencia: { type: 'number' } },
      required: ['contesta', 'profundidad', 'voz_experto', 'honestidad', 'estructura_geo', 'vs_competencia'],
    },
    fallos: { type: 'array', items: { type: 'string' } },
    por_que: { type: 'string' },
  },
  required: ['pasa', 'mejor_que_competencia', 'puntajes', 'fallos', 'por_que'],
};

const SISTEMA_REFEREE = `Eres el referee de una página antes de que la vea el dueño de Sacs. Tu trabajo es decidir si es MEJOR que lo que ya existe en internet para esa pregunta, y si no, decir exactamente qué cambiar.

No eres amable ni severo: eres concreto. Un fallo útil dice QUÉ y DÓNDE («la sección 3 promete X, que la ficha no lista»; «el primer párrafo tarda 80 palabras en contestar»). Un fallo inútil dice «mejorar la claridad».

SEIS EJES, cada uno de 0 a 10:
- contesta: ¿el primer párrafo responde la pregunta tal cual la haría quien busca? ¿O habla del tema?
- profundidad: ¿enseña algo que quien lleva una tienda no sabía? ¿Con ejemplos con nombre y número, no con generalidades?
- voz_experto: ¿lee como escrito por alguien que ha estado en el mostrador? Señales: casos concretos (una prenda, una talla, una cifra), opiniones («preferimos», «no conviene»), límites admitidos. Anti-señales: frases de folleto, listas de consejos genéricos, párrafos que podrían estar en cualquier sitio de software.
- honestidad: ¿afirma SOLO lo que la ficha de Sacs respalda? ¿Respeta la nota del brief sobre lo que NO se puede decir? Un solo invento aquí es fallo automático.
- estructura_geo: ¿tiene faq con preguntas reales, tabla o pasos con hechos, encabezados que una IA pueda citar sueltos?
- vs_competencia: comparada con las páginas que hoy rankean (te las doy con lo que cubren y lo que les falta), ¿la nuestra cubre el hueco común y es más útil en lo concreto? No más larga: más útil.

PASA solo si: honestidad ≥ 9, contesta ≥ 7, y el promedio de los seis ≥ 7.5, y mejor_que_competencia es true.

Si no pasa, «fallos» lleva de 2 a 6 cambios concretos y accionables, en orden de importancia. Quien reescriba va a aplicar exactamente esos, así que escríbelos como instrucciones.`;

export async function juzgar(contenidoId: string): Promise<{ ok: boolean; veredicto?: Veredicto; duras?: string[]; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, titulo, h1, meta_desc, cuerpo, brief').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe', costo: 0 };
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const b = c.brief as any;

  const duras = comprobacionesDuras({ titulo: c.titulo, meta_desc: c.meta_desc || '', h1: c.h1 || '', cuerpo, brief: b });

  /* Si nadie leyó a la competencia para esta pregunta (una pieza escrita antes
     de que existiera esta fase), se lee ahora: juzgar sin comparar no es juzgar. */
  let comp: Competencia | undefined = b?.competencia;
  let costoComp = 0;
  if (!comp?.paginas?.length && b?.pregunta) {
    const rc = await analizarCompetencia(b.pregunta, b.quien);
    costoComp = rc.costo;
    if (rc.ok && rc.datos) {
      comp = rc.datos;
      await guardarCompetencia(c.id, comp);
      await supabase.from('de_contenido').update({ brief: { ...b, competencia: comp } }).eq('id', c.id);
      b.competencia = comp;
    }
  }
  const compTxt = comp?.paginas?.length
    ? comp.paginas.map((p, i) => `  ${i + 1}. [${p.tipo}] ${p.titulo} (${p.url})\n     ~${p.palabras_aprox} palabras · faq:${p.tiene_faq ? 'sí' : 'no'} · tabla/pasos:${p.tiene_tabla_o_pasos ? 'sí' : 'no'} · precios:${p.menciona_precios ? 'sí' : 'no'}\n     cubre bien: ${p.cubre_bien.join('; ')}\n     le falta: ${p.le_falta.join('; ')}`).join('\n') + `\n  HUECO COMÚN que ninguna cubre: ${comp.hueco_comun}`
    : '  (no hay análisis de competencia para esta pregunta — juzga sin comparar y pon vs_competencia en 5)';

  const usuario = `PREGUNTA QUE LA PÁGINA TIENE QUE CONTESTAR: ${b?.pregunta || c.titulo}
QUIÉN PREGUNTA: ${b?.quien || '—'}
LO QUE EL BRIEF AVISÓ QUE NO SE PUEDE AFIRMAR: ${b?.nota_honestidad || '(nada)'}

LAS PÁGINAS QUE HOY RANKEAN PARA ESTO:
${compTxt}

COMPROBACIONES AUTOMÁTICAS QUE YA FALLARON (inclúyelas en «fallos» si siguen aplicando):
${duras.length ? duras.map(x => `  - ${x}`).join('\n') : '  (ninguna)'}

${fichaSacs()}

LA PÁGINA A JUZGAR
Título: ${c.titulo}
H1: ${c.h1}
Meta: ${c.meta_desc}
Cuerpo (${contarPalabras(cuerpo)} palabras; los bloques [TABLA], [PASOS], [FAQ] y [CTA] se renderizan como tabla, lista numerada, acordeón y botón — no son texto corrido):
${aMarkdown(cuerpo).slice(0, 18000)}`;

  const r = await preguntar<Veredicto>({ agente: 'contenido_referee', trabajo: 'estrategia', sistema: SISTEMA_REFEREE, usuario, esquema: ESQUEMA_VEREDICTO, max_tokens: 8000 });
  if (!r.ok || !r.datos) return { ok: false, error: r.error, duras, costo: costoComp + (r.costo_usd || 0) };

  const v = r.datos;
  // Las duras mandan: si el modelo dijo «pasa» pero hay un precio inventado, no pasa.
  const graves = duras.filter(d => /precio|no existe|no lo aclara|sin bloque faq|sin cta|cortad/.test(d));
  if (graves.length) { v.pasa = false; v.fallos = [...new Set([...graves, ...v.fallos])]; }
  return { ok: true, veredicto: v, duras, costo: costoComp + (r.costo_usd || 0) };
}

registrar('contenido.referee', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  const { data: pend } = await supabase.from('de_contenido').select('id, slug, brief').eq('estado', 'borrador').order('created_at').limit(limite);
  if (!pend?.length) return { ok: true, resumen: 'no hay borradores que juzgar' };

  let pasaron = 0, reescribir = 0, atascadas = 0, costo = 0;
  const fallos: string[] = [];
  for (const p of pend) {
    const b = (p.brief as any) || {};
    const r = await juzgar(p.id);
    costo += r.costo;
    if (!r.ok || !r.veredicto) { fallos.push(`${p.slug}: ${r.error}`); continue; }
    const v = r.veredicto;
    const rondas = Number(b.reescrituras || 0);
    const referee = { ...v, duras: r.duras, ronda: rondas, cuando: new Date().toISOString() };

    if (v.pasa) {
      await supabase.from('de_contenido').update({
        estado: 'aprobado',
        brief: { ...b, atascada: undefined, correcciones: undefined },
        auditorias: { referee, automatica: { score: 10, nota: 'Pasó el referee: mejor que la competencia, honesta, estructurada.' } },
        actualizado_at: new Date().toISOString(),
      }).eq('id', p.id);
      pasaron++;
      continue;
    }

    if (rondas >= MAX_REESCRITURAS) {
      /* Se rinde y lo deja a la vista: dos reescrituras que no pasan es señal de
         que el problema está en el encargo o en la ficha, no en la redacción.
         Que lo vea una persona con el veredicto al lado. */
      await supabase.from('de_contenido').update({
        brief: { ...b, atascada: true },
        auditorias: { referee },
        actualizado_at: new Date().toISOString(),
      }).eq('id', p.id);
      atascadas++;
      continue;
    }

    // A reescribir: el borrador lee `brief.correcciones` y las aplica.
    await supabase.from('de_contenido').update({
      estado: 'brief',
      brief: { ...b, reescrituras: rondas + 1, correcciones: v.fallos, veredicto_anterior: v.puntajes },
      auditorias: { referee },
      actualizado_at: new Date().toISOString(),
    }).eq('id', p.id);
    reescribir++;
  }

  return {
    ok: fallos.length === 0,
    resumen: `${pasaron} pasaron a la bandeja · ${reescribir} a reescribir · ${atascadas} atascadas tras ${MAX_REESCRITURAS} rondas${fallos.length ? ` · ${fallos.length} fallaron` : ''}`,
    datos: { pasaron, reescribir, atascadas, fallos }, costo_usd: costo,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · IMAGEN
// ═══════════════════════════════════════════════════════════════════════════

/* El mismo estilo que las fotos de los giros: documental, luz natural, gente
   real trabajando. Nada de renders de «tecnología» con hologramas azules — eso
   es exactamente lo que grita «generado» y lo que un lector del ramo no cree. */
const ESTILO_FOTO = 'Photorealistic documentary photograph, 35mm lens, shallow depth of field, natural window light, realistic film grain, candid, no text, no logos, no watermarks. Mexico.';

const ESQUEMA_FOTO = {
  type: 'object', additionalProperties: false,
  properties: { escena: { type: 'string' }, alt: { type: 'string' } },
  required: ['escena', 'alt'],
};

export async function generarPortada(contenidoId: string): Promise<{ ok: boolean; url?: string; alt?: string; error?: string; costo: number }> {
  const llave = env('OPENAI_API_KEY');
  if (!llave) return { ok: false, error: 'falta OPENAI_API_KEY', costo: 0 };
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, titulo, brief').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe', costo: 0 };
  const b = (c.brief as any) || {};
  if (b.portada?.url) return { ok: true, url: b.portada.url, alt: b.portada.alt, costo: 0 };

  const freno = await frenoDeSalida(`generada la portada de /${c.seccion}/${c.slug}/`);
  if (freno) return { ok: false, error: freno.motivo, costo: 0 };

  // 1) decidir la escena y el alt con el modelo barato
  const e = await preguntar<{ escena: string; alt: string }>({
    agente: 'contenido_portada', trabajo: 'volumen',
    sistema: `Describes UNA escena fotográfica documental para la portada de una guía del ramo de la moda en México. En inglés para «escena» (es un prompt de imagen), en español para «alt».
Reglas: una tienda o taller real, una o dos personas trabajando, un detalle que solo tenga ese giro (una cinta métrica, una corrida de zapatos, un vestido en bolsa). Sin pantallas protagonistas, sin hologramas, sin texto. El alt describe lo que se ve, en una frase, sin decir «imagen de».`,
    usuario: `Guía: ${c.titulo}\nPregunta que contesta: ${b.pregunta || ''}\nQuién la lee: ${b.quien || ''}\nGiro: ${b.giro || 'tienda de ropa'}`,
    esquema: ESQUEMA_FOTO, max_tokens: 400,
  });
  if (!e.ok || !e.datos) return { ok: false, error: e.error || 'sin escena', costo: e.costo_usd || 0 };

  // 2) la imagen
  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: `${ESTILO_FOTO} ${e.datos.escena}`, size: '1536x1024', quality: 'high' }),
  });
  const j: any = await r.json();
  if (j.error) return { ok: false, error: j.error.message, costo: e.costo_usd || 0 };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: 'sin imagen en la respuesta', costo: e.costo_usd || 0 };
  const costoImg = 0.19; // gpt-image-2 «high» 1536x1024, aproximado
  try { await supabase.from('ia_uso').insert({ modelo: 'openai:gpt-image-2', proposito: 'demanda:portada', input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, busquedas_web: 0, costo_usd: costoImg, ok: true, ms: Date.now() - t0 }); } catch {}

  // 3) a JPG de 1200×630 (proporción OG) y a storage público: sin despliegue
  const sharp = (await import('sharp')).default;
  const jpg = await sharp(Buffer.from(b64, 'base64')).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const path = `guias/${c.seccion}-${c.slug}-${Date.now().toString(36)}.jpg`;
  const { error: eUp } = await supabase.storage.from('wa-media').upload(path, jpg, { contentType: 'image/jpeg', upsert: false });
  if (eUp) return { ok: false, error: `no se pudo subir: ${eUp.message}`, costo: (e.costo_usd || 0) + costoImg };
  const url = supabase.storage.from('wa-media').getPublicUrl(path).data.publicUrl;

  const portada = { url, alt: e.datos.alt, escena: e.datos.escena, generada_at: new Date().toISOString() };
  await supabase.from('de_contenido').update({ brief: { ...b, portada } }).eq('id', contenidoId);
  return { ok: true, url, alt: e.datos.alt, costo: (e.costo_usd || 0) + costoImg };
}

registrar('contenido.imagen', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  // Solo lo que ya pasó el referee: no se paga una foto por algo que se va a reescribir.
  const { data: pend } = await supabase.from('de_contenido').select('id, slug, brief').in('estado', ['aprobado', 'publicado']).order('created_at', { ascending: false }).limit(limite * 4);
  const sin = (pend || []).filter(p => !(p.brief as any)?.portada?.url).slice(0, limite);
  if (!sin.length) return { ok: true, resumen: 'todas las piezas aprobadas tienen portada' };
  let hechas = 0, costo = 0; const fallos: string[] = [];
  for (const p of sin) {
    const r = await generarPortada(p.id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${p.slug}: ${r.error}`); continue; }
    hechas++;
  }
  return { ok: fallos.length === 0, resumen: `${hechas} portada(s) generada(s)${fallos.length ? ` · ${fallos.length} fallaron` : ''}`, datos: { hechas, fallos }, costo_usd: costo };
});
