// DEMAND ENGINE · el gate de calidad: nada llega a la bandeja del dueño sin
// haber pasado por aquí.
//
// TRES PASOS, y el orden es la idea:
//
//   contenido.competencia   ANTES de escribir: qué páginas contestan hoy esta
//                           pregunta, qué cubren, qué les falta, y qué FUENTES
//                           reales hay para dar autoridad a la nuestra.
//   contenido.referee       DESPUÉS de escribir: 18 criterios (SEO, IA, uso
//                           real) + comprobaciones duras. Si no pasa, dice
//                           exactamente qué cambiar y la manda a reescribir.
//   contenido.imagen        Solo cuando pasó: portada, fotos intermedias y el
//                           diagrama de referencia, subidos a storage.
//
// POR QUÉ EL MODELO LEE A LOS COMPETIDORES Y NO ESTE SERVIDOR
// Este servidor está bloqueado por Cloudflare en buena parte de los sitios del
// ramo (sicar.mx devuelve 403 con «error code: 1005»). gpt-5 con `web_search`
// sí los lee —el rastreador es de OpenAI, no nuestro— y de paso hace lo que un
// fetch no haría: resume estructura, huecos y por qué rankea.
//
// SOBRE «QUE GOOGLE NO DETECTE QUE ES IA»
// Google no penaliza el contenido por venir de un modelo; penaliza el contenido
// genérico y a escala que no ayuda a nadie. Lo que sí se puede exigir —y es lo
// mismo que hace que una página sirva— es que lea como escrita por alguien que
// lleva una tienda: casos con nombre y número, límites admitidos, opiniones,
// cero folleto. Eso es el criterio «lenguaje del ramo / voz de mostrador».
import { supabase } from '../supabase';
import { preguntar } from './ia';
import { registrar } from './handlers';
import { fichaSacs, PRECIOS, GUIAS, HERRAMIENTAS } from './capacidades';
import { aTexto, aMarkdown, palabras as contarPalabras, type Bloque } from './bloques';
import { frenoDeSalida } from './salida';
import { videosCanal } from '../../data/videos-canal';
import type { ResultadoHandler } from './tipos';

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();
const POR_CORRIDA = 5;
/** Cuántas veces se reescribe antes de rendirse y dejarla para que la vea el dueño. */
const MAX_REESCRITURAS = 3;

// ═══════════════════════════════════════════════════════════════════════════
// LOS 18 CRITERIOS
// Los 7 primeros son los que circulan como «flujos de SEO/GEO» (Jev/Ryze);
// los 11 siguientes son los que faltan ahí y que hacen que una página del ramo
// de verdad se USE y aparezca en un AI Overview: glosario, lenguaje, fotos,
// DIAGRAMA con el dato, datos con fuente, CTA a mitad de camino, entidad,
// respuesta corta, frescura, legibilidad, video.
// ═══════════════════════════════════════════════════════════════════════════
export const CRITERIOS: { clave: string; nombre: string; que: string; para: 'seo' | 'ia' | 'uso' }[] = [
  { clave: 'competencia_superada', nombre: 'Mejor que lo que rankea', para: 'seo', que: 'Comparada con las páginas que hoy rankean (puntuadas en respuesta, profundidad, prueba y frescura), ¿la nuestra cubre el hueco común y es más útil en lo concreto? No más larga: más útil.' },
  { clave: 'elementos_seo', nombre: 'Título, meta, H1, FAQ, schema', para: 'seo', que: 'Cada elemento: ¿se mantiene o se cambia? Título con la forma real de la búsqueda, ≤ 53; meta 90-158 que contesta; H1 distinto del título y con la pregunta; FAQ con preguntas que alguien haría; schema completo (Article, FAQPage, HowTo, DefinedTermSet, ImageObject, VideoObject).' },
  { clave: 'preguntas_ia', nombre: 'Contesta lo que se le pregunta a la IA', para: 'ia', que: 'Contra la lista de prompts reales que la gente hace a ChatGPT/Gemini/Claude sobre esto: ¿cuáles contesta esta página y cuáles no? Las que no, ¿deberían?' },
  { clave: 'probabilidad_cita', nombre: 'Probabilidad de ser citada', para: 'ia', que: '0-100: ¿qué tan probable es que una IA o un AI Overview la cite? Hechos extraíbles sueltos (tabla, pasos, definiciones, cifras con fuente), encabezados que responden solos, respuesta corta arriba, una imagen de referencia con el dato. Y la PRIMERA corrección que más subiría esa probabilidad.' },
  { clave: 'intencion_compradora', nombre: 'Escrita para términos que convierten', para: 'seo', que: '¿Apunta a las búsquedas de COMPRADOR (quien tiene el problema y busca resolverlo), no a curiosos? ¿El título y el primer párrafo usan la forma en que un comprador lo busca (las palabras que rankean del brief)?' },
  { clave: 'enlaces_internos', nombre: 'Enlaces internos con razón honesta', para: 'seo', que: '≥ 3 rutas internas distintas, cada una donde de verdad ayuda seguir leyendo: guía relacionada, herramienta, giro, producto. Ninguno pegado por pegar. Anchors naturales, nunca la ruta cruda.' },
  { clave: 'checks_duros', nombre: 'Las comprobaciones sí/no', para: 'seo', que: 'Todas las comprobaciones automáticas pasan (forma, precios, rutas, honestidad, no cortada).' },
  { clave: 'glosario', nombre: 'Glosario del ramo', para: 'uso', que: '≥ 6 términos del giro definidos como los dice la gente del giro (no como un diccionario), y usados en el texto. Es lo que hace que una página sea clara para quien entra sin contexto y citable para «qué es X».' },
  { clave: 'lenguaje_ramo', nombre: 'Lenguaje del ramo y voz de mostrador', para: 'uso', que: 'Español de México, palabras que usa quien tiene esa tienda (las del glosario del brief), nada de anglicismos que nadie dice ni términos de España (la lista «evitar» del brief). Casos con prenda, talla y cifra; opiniones; límites admitidos. Cero folleto.' },
  { clave: 'fotos', nombre: 'Fotos que hacen visual la página', para: 'uso', que: 'Portada + ≥ 1 foto intermedia documental (gente real trabajando, un detalle del giro) colocada donde ayuda a entender. Alt que describe lo que se ve. Nada de renders de tecnología.' },
  { clave: 'diagrama', nombre: 'Imagen de referencia con el dato', para: 'ia', que: 'Un AI Overview enseña junto a la respuesta UNA imagen que contiene el dato (una tabla de curva de tallas, un calendario de abonos, una ficha de medidas). ≥ 1 bloque «diagrama» con título, encabezados y filas reales de la página, que se renderiza como imagen PNG con alt: es la imagen que Google pone al lado de la respuesta.' },
  { clave: 'datos_con_fuente', nombre: 'Datos citados con autoridad', para: 'ia', que: '≥ 2 datos duros con fuente verificable y URL (ley, SAT/PROFECO, INEGI, asociación o revista del ramo), citados sin exagerar y SOLO de la lista de fuentes verificadas. Es lo que separa una guía de una opinión y lo que una IA repite con enlace.' },
  { clave: 'cta_mitad', nombre: 'CTA a mitad de camino a la landing relevante', para: 'uso', que: 'Además del cierre por giro, ≥ 1 llamada a la acción EN MEDIO del texto, justo después de la sección donde aparece el módulo o el giro, que manda a esa landing (/giros/<giro>, /producto/<módulo>, herramienta). Que siga la experiencia, no que interrumpa.' },
  { clave: 'entidad', nombre: 'Entidad y E-E-A-T', para: 'ia', que: 'Autor y editor = la organización (nunca persona inventada), fecha de publicación y actualización, «cómo lo sabemos» implícito en los casos, y precios/ficha/enlaces verificables. Nada que un lector escéptico pueda desmentir en una llamada.' },
  { clave: 'respuesta_corta', nombre: 'Respuesta corta arriba', para: 'ia', que: 'Bloque «En corto» de 3-5 líneas al inicio, cada una una afirmación completa y citable, y el primer párrafo contesta en ≤ 80 palabras.' },
  { clave: 'frescura', nombre: 'Frescura verificable', para: 'seo', que: 'Fecha visible, datos del año en curso donde aplique (precios de lista, reglas fiscales), y nada que caduque sin decir cuándo.' },
  { clave: 'legibilidad', nombre: 'Se lee en el celular', para: 'uso', que: 'Párrafos ≤ 110 palabras, un subtítulo cada ~250 palabras, tabla donde se comparan cosas, pasos donde hay orden, negritas con criterio. Que se pueda escanear en 30 segundos y leer en 8 minutos.' },
  { clave: 'video_media', nombre: 'Video u otro medio si suma', para: 'uso', que: 'Si hay un video del canal que enseña lo mismo, va embebido con su ficha (VideoObject). Si no, se dice exactamente qué video de 3 minutos habría que grabar (para que el dueño lo grabe). Igual para plantilla descargable o calculadora.' },
];

/* Los 15 WOW (29-43): no bloquean, puntúan. Lo que ningún competidor del ramo
   tiene y lo que un modelo ya no puede copiar. Ver PLAN-NOVIAS-DOMINIO.md. */
export const CRITERIOS_WOW: { clave: string; nombre: string; que: string }[] = [
  { clave: 'selector_caso', nombre: 'Selector de caso', que: '¿La página deja elegir «1 boutique / 3 sucursales / también rento» y reordena lo que aplica? (bloque «casos» con variantes)' },
  { clave: 'dato_propio', nombre: 'Dato propio del ramo', que: '¿Trae un número que solo Sacs puede saber (agregado anónimo de sus tiendas) presentado como tal?' },
  { clave: 'caso_real', nombre: 'Caso real con nombre y cifras', que: '¿Hay una tienda real (con permiso) con antes/después en números?' },
  { clave: 'voz_duena', nombre: 'La voz de una dueña', que: '¿Hay 2-3 citas textuales de una dueña real con nombre y ciudad?' },
  { clave: 'cuando_no', nombre: '«Cuándo NO te conviene Sacs»', que: '¿Hay una sección honesta de anti-venta con casos concretos?' },
  { clave: 'plantilla', nombre: 'Plantilla descargable', que: '¿Ofrece una plantilla imprimible propia (nota, ficha, contrato) con los campos de la guía?' },
  { clave: 'video_propio', nombre: 'Video propio de 60 s', que: '¿Tiene un clip propio del tema (no genérico) con transcripción?' },
  { clave: 'audio', nombre: 'Escúchalo en 3 minutos', que: '¿Tiene versión en audio del resumen y los pasos?' },
  { clave: 'calculadora_costo', nombre: 'Calculadora del costo de no tenerlo', que: '¿Enlaza o incluye una calculadora que convierte los números del lector en pérdida en pesos y manda el resultado por WhatsApp?' },
  { clave: 'compartible', nombre: 'Bloques compartibles', que: '¿Las tablas y diagramas se pueden copiar/mandar por WhatsApp con enlace a la pieza?' },
  { clave: 'revisado_experto', nombre: 'Revisado por un experto con nombre', que: '¿Lo legal-fiscal lleva «revisado por [contador/abogado], cédula, fecha»?' },
  { clave: 'gemela', nombre: 'Página gemela para el cliente final', que: '¿Existe (o se propone) la misma pregunta desde el lado del cliente, enlazada?' },
  { clave: 'foros', nombre: 'Lo que dicen los foros', que: '¿Cita 3 hilos reales (con enlace) y les contesta?' },
  { clave: 'serie', nombre: 'Serie por correo/WhatsApp', que: '¿Ofrece recibir las piezas del tema una por semana?' },
  { clave: 'rendimiento', nombre: '100 en rendimiento y accesibilidad', que: 'LCP < 1.5 s, imágenes optimizadas, contraste AA, alt en todo (lo mide la plantilla; el referee revisa alt y tamaño de imágenes).' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 1 · COMPETENCIA + FUENTES
// ═══════════════════════════════════════════════════════════════════════════

export type PaginaSimilar = {
  url: string; titulo: string; tipo: string; palabras_aprox: number; h2: string[];
  tiene_faq: boolean; tiene_tabla_o_pasos: boolean; menciona_precios: boolean;
  cubre_bien: string[]; le_falta: string[]; por_que_rankea: string;
  puntajes?: { respuesta: number; profundidad: number; prueba: number; frescura: number };
  fecha_visible?: string; citada_por_ia?: boolean;
};
export type Fuente = { tema: string; dato: string; cita_textual: string; fuente: string; url: string; fecha: string };
export type Competencia = { paginas: PaginaSimilar[]; hueco_comun: string; analizada_at: string };

async function gpt5Busca(input: string, proposito: string): Promise<{ ok: boolean; json?: any; error?: string; costo: number }> {
  const llave = env('OPENAI_API_KEY');
  if (!llave) return { ok: false, error: 'falta OPENAI_API_KEY', costo: 0 };
  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5', tools: [{ type: 'web_search' }], input }),
  });
  const j: any = await r.json();
  if (j.error) return { ok: false, error: j.error.message, costo: 0 };
  const texto = (j.output || []).flatMap((o: any) => (o.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text)).join('');
  const ent = j.usage?.input_tokens || 0, sal = j.usage?.output_tokens || 0;
  const busquedas = (j.output || []).filter((o: any) => o.type === 'web_search_call').length;
  const costo = (ent * 1.25 + sal * 10) / 1e6 + busquedas * 0.01;
  try { await supabase.from('ia_uso').insert({ modelo: 'geo:gpt-5', proposito, input_tokens: ent, output_tokens: sal, cache_read: 0, cache_write: 0, busquedas_web: busquedas, costo_usd: costo, ok: true, ms: Date.now() - t0 }); } catch {}
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'la respuesta no trajo JSON', costo };
  try { return { ok: true, json: JSON.parse(m[0]), costo }; } catch { return { ok: false, error: 'JSON inválido', costo }; }
}

/** Lee las páginas que hoy contestan la pregunta, con `web_search` de gpt-5. */
export async function analizarCompetencia(pregunta: string, contexto?: string): Promise<{ ok: boolean; datos?: Competencia; error?: string; costo: number }> {
  const input = `Busca en Google en español (México) las páginas que hoy mejor contestan esta pregunta:

«${pregunta}»
${contexto ? `\nContexto de quien pregunta: ${contexto}\n` : ''}
Lee las 5 mejores páginas que encuentres (blogs, guías, proveedores de software, foros, en español o inglés) y devuélveme SOLO un JSON con esta forma exacta, sin texto fuera del JSON:
{"paginas":[{"url":"","titulo":"","tipo":"proveedor|guia_independiente|foro|otro","palabras_aprox":0,"h2":[""],"tiene_faq":false,"tiene_tabla_o_pasos":false,"menciona_precios":false,"fecha_visible":"la fecha que muestra la página o vacío","puntajes":{"respuesta":0,"profundidad":0,"prueba":0,"frescura":0},"cubre_bien":[""],"le_falta":[""],"por_que_rankea":""}],"hueco_comun":"lo que NINGUNA cubre bien y una página nuestra podría cubrir, en dos frases concretas"}
«puntajes» de 0 a 5: respuesta = contesta de frente la pregunta; profundidad = enseña con ejemplos y números; prueba = datos con fuente, capturas, casos; frescura = fecha y datos vigentes.`;

  const r = await gpt5Busca(input, 'demanda:competencia');
  if (!r.ok) return { ok: false, error: r.error, costo: r.costo };
  const d = r.json;
  const paginas: PaginaSimilar[] = (d.paginas || []).filter((p: any) => p?.url).slice(0, 6).map((p: any) => ({
    url: String(p.url), titulo: String(p.titulo || ''), tipo: String(p.tipo || 'otro'),
    palabras_aprox: Number(p.palabras_aprox) || 0, h2: Array.isArray(p.h2) ? p.h2.slice(0, 10) : [],
    tiene_faq: !!p.tiene_faq, tiene_tabla_o_pasos: !!p.tiene_tabla_o_pasos, menciona_precios: !!p.menciona_precios,
    cubre_bien: Array.isArray(p.cubre_bien) ? p.cubre_bien.slice(0, 5) : [], le_falta: Array.isArray(p.le_falta) ? p.le_falta.slice(0, 5) : [],
    por_que_rankea: String(p.por_que_rankea || ''),
    fecha_visible: String(p.fecha_visible || ''),
    puntajes: p.puntajes ? { respuesta: +p.puntajes.respuesta || 0, profundidad: +p.puntajes.profundidad || 0, prueba: +p.puntajes.prueba || 0, frescura: +p.puntajes.frescura || 0 } : undefined,
  }));
  // ¿Alguna IA ya cita a este competidor en nuestras muestras? Es la señal de a quién hay que desbancar.
  for (const p of paginas) {
    try {
      const dominio = new URL(p.url).hostname.replace(/^www\./, '');
      const { count } = await supabase.from('de_ia_muestras').select('id', { count: 'exact', head: true }).ilike('urls_citadas', `%${dominio}%`);
      p.citada_por_ia = (count || 0) > 0;
    } catch { p.citada_por_ia = false; }
  }
  return { ok: true, datos: { paginas, hueco_comun: String(d.hueco_comun || ''), analizada_at: new Date().toISOString() }, costo: r.costo };
}

/** Datos duros con fuente verificable para dar autoridad a la página. */
export async function buscarFuentes(pregunta: string, giro?: string): Promise<{ ok: boolean; fuentes?: Fuente[]; error?: string; costo: number }> {
  const input = `Una guía en español de México para dueños de ${giro || 'tiendas de ropa'} va a contestar: «${pregunta}».
Busca DATOS CITABLES REALES que le den autoridad: leyes y reglas oficiales (PROFECO, Ley Federal de Protección al Consumidor, SAT/CFDI), cifras oficiales (INEGI, DENUE), datos de asociaciones o revistas del ramo con año. Abre cada fuente y confirma que el dato está ahí; si no, descártala.
Devuelve SOLO JSON: {"fuentes":[{"tema":"","dato":"la cifra o regla en una frase","cita_textual":"≤ 35 palabras tal cual","fuente":"nombre","url":"","fecha":"año"}]}
Entre 4 y 8 fuentes. Nada inventado.`;
  const r = await gpt5Busca(input, 'demanda:fuentes');
  if (!r.ok) return { ok: false, error: r.error, costo: r.costo };
  const fuentes: Fuente[] = (r.json.fuentes || []).filter((f: any) => f?.url && /^https?:\/\//.test(f.url) && f.dato).slice(0, 10).map((f: any) => ({
    tema: String(f.tema || ''), dato: String(f.dato), cita_textual: String(f.cita_textual || '').slice(0, 300), fuente: String(f.fuente || ''), url: String(f.url), fecha: String(f.fecha || ''),
  }));
  return { ok: true, fuentes, costo: r.costo };
}

/** Guarda las páginas junto a la pieza, y da de alta los competidores que no conocíamos. */
export async function guardarCompetencia(contenidoId: string, c: Competencia) {
  for (const p of c.paginas) {
    await supabase.from('de_paginas_similares').upsert({
      contenido_id: contenidoId, url: p.url, titulo: p.titulo, tipo: p.tipo, palabras_aprox: p.palabras_aprox,
      h2: p.h2, tiene_faq: p.tiene_faq, tiene_tabla_o_pasos: p.tiene_tabla_o_pasos, menciona_precios: p.menciona_precios,
      cubre_bien: p.cubre_bien, le_falta: p.le_falta, por_que_rankea: p.por_que_rankea, analizada_at: c.analizada_at,
      puntajes: p.puntajes || null, citada_por_ia: !!p.citada_por_ia, fecha_visible: p.fecha_visible || null,
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
  const { data: pend } = await supabase.from('de_contenido')
    .select('id, slug, brief').eq('estado', 'brief').order('created_at').limit(limite * 3);
  const sin = (pend || []).filter(p => !(p.brief as any)?.competencia || !(p.brief as any)?.fuentes).slice(0, limite);
  if (!sin.length) return { ok: true, resumen: 'todos los briefs tienen competencia y fuentes' };

  let hechos = 0, costo = 0, nuevosComp = 0;
  const fallos: string[] = [];
  for (const p of sin) {
    let b = p.brief as any;
    if (!b.competencia?.paginas?.length) {
      const r = await analizarCompetencia(b.pregunta, b.quien);
      costo += r.costo;
      if (!r.ok || !r.datos) { fallos.push(`${p.slug}: ${r.error}`); continue; }
      const antes = (await supabase.from('de_competidores').select('id', { count: 'exact', head: true })).count || 0;
      await guardarCompetencia(p.id, r.datos);
      const despues = (await supabase.from('de_competidores').select('id', { count: 'exact', head: true })).count || 0;
      nuevosComp += Math.max(0, despues - antes);
      b = { ...b, competencia: r.datos };
    }
    if (!b.fuentes?.length) {
      const f = await buscarFuentes(b.pregunta, b.giro);
      costo += f.costo;
      if (f.ok) b = { ...b, fuentes: f.fuentes };
      else fallos.push(`${p.slug}: fuentes: ${f.error}`);
    }
    const { error } = await supabase.from('de_contenido').update({ brief: b }).eq('id', p.id);
    if (error) { fallos.push(`${p.slug}: no se guardó: ${error.message}`); continue; }
    hechos++;
  }
  return {
    ok: fallos.length === 0,
    resumen: `${hechos} brief(s) con competencia y fuentes${nuevosComp ? ` · ${nuevosComp} competidor(es) nuevo(s)` : ''}${fallos.length ? ` · ${fallos.length} fallaron` : ''}`,
    datos: { hechos, nuevosComp, fallos }, costo_usd: costo,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · REFEREE
// ═══════════════════════════════════════════════════════════════════════════

export type Elemento = { elemento: string; veredicto: 'mantener' | 'cambiar'; confianza: number; propuesta: string };
export type Veredicto = {
  pasa: boolean;
  puntajes: Record<string, number>;   // 0-10 por eje
  fallos: string[];                   // lo que hay que cambiar, concreto
  mejor_que_competencia: boolean;
  por_que: string;
  probabilidad_cita: number;          // 0-100
  primera_correccion: string;
  elementos: Elemento[];
  criterios: { clave: string; ok: boolean; nota: string }[];
  preguntas_ia_cubiertas: string[];
  preguntas_ia_sin_cubrir: string[];
  video_sugerido: string;             // id del canal o '' o «grabar: …»
  necesita_del_dueno: string[];       // lo que el motor no puede generar y hay que pedir
  funciones_prometidas: string[];     // lo que la página presenta como de Sacs y no está construido (para ventas)
  wow: { clave: string; ok: boolean; nota: string }[];   // los 15 WOW: no bloquean, puntúan
};

/* Las rutas del sitio a las que una página puede enlazar. Las guías y
   herramientas salen de la ficha; el resto son las secciones fijas del sitio
   (src/pages). Se compara sin la diagonal final: Astro sirve las dos formas. */
const RUTAS_FIJAS = ['/guias', '/agendar', '/prueba-gratis', '/contacto', '/planes', '/producto', '/giros', '/herramientas', '/recursos', '/comparar', '/casos-de-exito', '/soluciones', '/software-para', '/nosotros', '/marcas', '/enterprise', '/blog', '/partners'];
export function rutaExiste(ruta: string): boolean {
  const r = String(ruta || '').replace(/\/$/, '');
  if (!r.startsWith('/')) return true; // externas: las juzga el modelo
  const guias = Object.keys(GUIAS).map(s => `/recursos/${s}`);
  const herr = Object.keys(HERRAMIENTAS).map(s => `/herramientas/${s}`);
  return guias.includes(r) || herr.includes(r) || RUTAS_FIJAS.some(f => r === f || r.startsWith(f + '/'));
}

const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lo que se comprueba SIN modelo: no cuesta, no se equivoca, y atrapa lo que
 *  un juez leyendo de corrido se salta. Devuelve los fallos. */
export function comprobacionesDuras(p: { titulo: string; meta_desc: string; h1: string; cuerpo: Bloque[]; brief: any }): string[] {
  const f: string[] = [];
  const cuerpo = p.cuerpo || [];
  const plano = aTexto(cuerpo);
  const txt = JSON.stringify(cuerpo);
  const tipos = cuerpo.map(b => b.t);
  const parrafos = cuerpo.filter(b => b.t === 'p') as any[];

  // ── SEO de forma ──
  if (p.titulo.length > 53) f.push(`título de ${p.titulo.length} caracteres; máximo 53 (la plantilla agrega « | Sacs»)`);
  if ((p.meta_desc || '').length > 158) f.push(`meta de ${p.meta_desc.length}; máximo 158`);
  if ((p.meta_desc || '').length < 90) f.push('meta demasiado corta: desaprovecha el espacio del resultado');
  if (/[\s,;:]$/.test(p.meta_desc || '')) f.push('la meta termina a media frase');
  if (p.h1 && norm(p.h1) === norm(p.titulo)) f.push('H1 idéntico al título: el H1 puede ser más largo y llevar la pregunta completa');
  const h2 = cuerpo.filter(b => b.t === 'h2').length;
  if (h2 < 4) f.push(`solo ${h2} secciones h2; una guía que compite necesita 4 o más`);
  if (h2 > 10) f.push(`${h2} secciones h2: demasiadas, se dispersa`);

  // ── Enlaces internos ──
  const rutas = new Set<string>();
  for (const m of txt.matchAll(/\]\((\/[a-z0-9\/-]+)\)/g)) {
    if (!rutaExiste(m[1])) f.push(`enlace a una ruta que no existe: ${m[1]}`);
    rutas.add(m[1].replace(/\/$/, ''));
  }
  for (const b of cuerpo) if (b.t === 'cta') { if (!rutaExiste(b.url)) f.push(`la cta apunta a ${b.url}, que no existe`); rutas.add(String(b.url || '').replace(/\/$/, '')); }
  if (rutas.size < 3) f.push(`solo ${rutas.size} ruta(s) interna(s) distinta(s); mínimo 3 (guía, herramienta, giro o producto)`);
  if (p.brief?.giro && ![...rutas].some(r => r.includes(`/giros/${p.brief.giro}`))) f.push(`no enlaza a /giros/${p.brief.giro}, la landing de su giro`);
  if (/\[\/[a-z0-9\/-]+\]\(/.test(txt)) f.push('hay un enlace cuyo texto visible es la ruta cruda («[/agendar](/agendar)»)');

  // ── GEO: contestar primero, con estructura extraíble ──
  const iResumen = tipos.indexOf('resumen');
  if (iResumen < 0) f.push('sin bloque «resumen» (En corto) al inicio: es lo que una IA cita sin leer más');
  else {
    if (iResumen > 1) f.push('el bloque «resumen» tiene que ir al inicio (antes de la primera sección)');
    const n = ((cuerpo[iResumen] as any).items || []).length;
    if (n < 3 || n > 5) f.push(`el resumen tiene ${n} líneas; entre 3 y 5`);
  }
  const primero = parrafos[0];
  if (!primero) f.push('no hay párrafo de respuesta');
  else {
    const n = primero.texto.split(/\s+/).length;
    if (n > 90) f.push(`el primer párrafo tiene ${n} palabras: la respuesta directa va en ≤ 80, lo demás después`);
    if (/^(en (el|la|este)|hoy en dia|actualmente|vivimos)/i.test(norm(primero.texto.trim()))) f.push('el primer párrafo empieza con preámbulo en vez de contestar');
  }
  if (!tipos.includes('faq')) f.push('sin bloque faq: es lo que más pesa para que una IA cite la página');
  else {
    const faq = cuerpo.find(b => b.t === 'faq') as any;
    if ((faq.items || []).length < 6) f.push(`el faq tiene ${faq.items.length} preguntas; mínimo 6 (las que la gente hace de verdad)`);
  }
  if (!tipos.includes('tabla') && !tipos.includes('pasos')) f.push('sin tabla ni pasos: los hechos estructurados son lo que se extrae y se cita');

  // ── Diagrama con el dato (la imagen del AI Overview) ──
  const diag = cuerpo.find(b => b.t === 'diagrama') as any;
  if (!diag) f.push('sin bloque «diagrama»: la imagen de referencia con el dato (tabla/calendario/ficha) que Google enseña junto a la respuesta');
  else if (!diag.titulo || (diag.filas || []).length < 3 || (diag.encabezados || []).length < 2) f.push('el diagrama necesita título, ≥ 2 columnas y ≥ 3 filas con datos reales de la página');

  // ── Glosario ──
  const glos = cuerpo.find(b => b.t === 'glosario') as any;
  if (!glos) f.push('sin bloque «glosario»: ≥ 6 términos del ramo definidos como los dice la gente del giro');
  else if ((glos.items || []).length < 6) f.push(`el glosario tiene ${glos.items.length} términos; mínimo 6`);
  else {
    const noUsados = glos.items.filter((i: any) => {
      const t = norm(i.termino).split(/[\s/]+/)[0].replace(/[^a-z0-9]/g, '');
      return t.length > 3 && (norm(plano).match(new RegExp(`\\b${t}`, 'g')) || []).length < 2;
    }).map((i: any) => i.termino);
    if (noUsados.length > 2) f.push(`términos del glosario que el texto casi no usa: ${noUsados.slice(0, 4).join(', ')} — el glosario define lo que la página USA`);
  }

  // ── Fotos ──
  const imgs = cuerpo.filter(b => b.t === 'imagen') as any[];
  if (imgs.length < 1) f.push('sin foto intermedia: ≥ 1 bloque «imagen» (alt + escena) junto a los pasos o la tabla');
  for (const im of imgs) {
    if (!im.alt || im.alt.split(/\s+/).length < 5) f.push(`una imagen tiene alt demasiado corto («${im.alt || ''}»)`);
    if (!im.url && (!im.escena || im.escena.length < 40)) f.push('una imagen pendiente no describe la escena con detalle (≥ 40 caracteres)');
  }

  // ── Datos con fuente ──
  const citas = cuerpo.filter(b => b.t === 'cita' && /^https:\/\//.test((b as any).url || '')) as any[];
  const enlacesFuera = (txt.match(/\]\(https:\/\/[^)]+\)/g) || []).filter(u => !u.includes('sacscloud.com')).length;
  if (citas.length + enlacesFuera < 2) f.push(`solo ${citas.length + enlacesFuera} dato(s) con fuente externa (cita con url o enlace https); mínimo 2 — ley, SAT/PROFECO, INEGI, ramo`);
  if (p.brief?.fuentes?.length) {
    const urlsOk = new Set((p.brief.fuentes as Fuente[]).map(x => x.url.replace(/\/$/, '')));
    for (const c of citas) if (!urlsOk.has(String(c.url).replace(/\/$/, ''))) f.push(`cita con una url que no está en las fuentes verificadas del brief: ${c.url}`);
    for (const m of txt.matchAll(/\]\((https:\/\/[^)]+)\)/g)) if (!m[1].includes('sacscloud.com') && !urlsOk.has(m[1].replace(/\/$/, ''))) f.push(`enlace externo que no está en las fuentes verificadas: ${m[1]}`);
  }

  // ── CTA a mitad de camino + cierre ──
  const iFaq = tipos.indexOf('faq');
  const ctas = cuerpo.map((b, i) => ({ b: b as any, i })).filter(x => x.b.t === 'cta');
  if (!ctas.length) f.push('sin cta al final');
  else {
    if (ctas[ctas.length - 1].i !== cuerpo.length - 1) f.push('la última cta no es el último bloque');
    const enMedio = ctas.filter(x => iFaq > 0 && x.i < iFaq && /^\/(giros|producto|herramientas)\//.test(x.b.url || ''));
    if (!enMedio.length) f.push('sin cta A MITAD DE CAMINO: una llamada antes del faq que mande a /giros/<giro>, /producto/<módulo> o una herramienta, justo después de la sección donde aparece');
  }

  // ── Voz de experto (lo medible) ──
  const numeros = (plano.match(/\d[\d,.]*\s?(%|\$|pesos|piezas|tallas|dias|días|meses|semanas|horas|mm|cm)/gi) || []).length;
  if (numeros < 5) f.push(`solo ${numeros} cifras con unidad; una guía de experto trae casos con números`);
  const folleto = plano.match(/potencia tu negocio|solución integral|revoluciona|en el mundo actual|hoy en día más que nunca|lleva tu negocio al siguiente nivel|de la mano de la tecnología|sin duda alguna|es importante mencionar|en la era digital/i);
  if (folleto) f.push(`frase de folleto: «${folleto[0]}»`);
  const evitar: string[] = p.brief?.evitar || [];
  for (const e of evitar) {
    const t = String(e || '').replace(/\s*\(.*\)$/, '').trim();
    if (t.length > 2 && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(plano)) f.push(`usa «${t}», que no se dice en el ramo en México (ver brief.evitar)`);
  }
  const largos = parrafos.filter(b => b.texto.split(/\s+/).length > 110).length;
  if (largos > 1) f.push(`${largos} párrafos de más de 110 palabras: partirlos (se lee en el celular)`);

  // ── Hechos de Sacs ──
  const preciosOk = new Set(Object.values(PRECIOS).filter(v => typeof v === 'number').map(String));
  for (const m of txt.matchAll(/\$\s?([\d,]{3,7})/g)) {
    const n = m[1].replace(/,/g, '');
    const ctx = txt.slice(Math.max(0, (m.index || 0) - 110), (m.index || 0) + 110);
    if (!preciosOk.has(n) && /\bsacs\b/i.test(ctx) && /\bplan(es)?\b|vende|controla|fideliza|automatiza|mensualidad|al mes por tienda/i.test(ctx))
      f.push(`precio presentado como de Sacs que no está en la lista: $${m[1]}`);
  }
  /* Reparto de módulos por plan: la ficha solo dice qué trae Vende. «Fideliza
     cuando ya ocupas CRM y portal» es una promesa de empaque que la dueña
     descubre al contratar; el juez de gpt-5 la dejó pasar en novias. */
  const reparto = plano.match(/\b(Controla|Fideliza|Automatiza)\b[^.]{0,25}\b(si|cuando|para|incluye|trae|entra|cae)\b[^.]{0,80}\b(CRM|portal|taller|órdenes|ordenes|marketing|WhatsApp|reportes|sucursal|tienda)/i);
  if (reparto) f.push(`reparte módulos por plan sin respaldo en la ficha: «${reparto[0].slice(0, 90)}» — la ficha solo dice qué incluye Vende; el resto se confirma en la demo`);
  /* Regla del dueño (22-sep-2026): las funciones se presentan como existentes.
     Lo contrario —«Sacs no tiene», «no hace», «pídelo en la demo para confirmar»—
     es lo que ahora se marca. Los precios y datos siguen con sus propios checks. */
  const niega = plano.match(/\bSacs (no|NO) (tiene|hace|cuenta con|ofrece|lleva|trae|emite|permite)\b[^.]{0,60}/);
  if (niega) f.push(`dice que Sacs no tiene algo (regla del dueño: se presenta como existente): «${niega[0].slice(0, 80)}»`);
  const evasiva = (plano.match(/confírmalo en la demo|pídelo (por escrito|explícito)|pregúntalo en la demo|consúltalo en la demo/gi) || []).length;
  if (evasiva > 1) f.push(`${evasiva} remisiones a «confírmalo en la demo»: máximo una; la página afirma, no remite`);

  // ── Capturas de Sacs ──
  const capturas = cuerpo.filter(b => b.t === 'captura') as any[];
  if (capturas.length < 2) f.push(`solo ${capturas.length} captura(s) de Sacs; mínimo 2 bloques «captura» con la pantalla que resuelve cada sección clave`);
  for (const cp of capturas) if ((cp.campos || []).length < 5) f.push(`la captura «${cp.titulo}» tiene ${(cp.campos || []).length} campos; mínimo 5 realistas`);

  // ── Largo ──
  const nPal = plano.split(/\s+/).filter(Boolean).length;
  // 4,500 porque el conteo incluye glosario, faq, tablas y campos de capturas (estructura, no prosa).
  if (nPal > 4500) f.push(`${nPal} palabras: máximo 4,000 — se lee en el celular; elimina lo que menos enseña (nunca el glosario ni el faq)`);

  // ── Marcadores sin resolver ──
  // «Descarga la plantilla aquí: [ENLACE]» pasó el referee de novias; un
  // especialista lo vio después. Ningún corchete-marcador llega a la bandeja.
  const marcador = plano.match(/\[(ENLACE|URL|LINK|TODO|PENDIENTE|INSERTAR[^\]]*|CAPTURA[^\]]*)\]|lorem ipsum/i);
  if (marcador) f.push(`marcador sin resolver en el texto: «${marcador[0]}»`);

  // ── Cortada ──
  const ultimo = cuerpo[cuerpo.length - 1];
  if (ultimo && ultimo.t !== 'cta') f.push(`la página termina en un bloque «${ultimo.t}», no en la cta: parece cortada`);
  /* Cortado de verdad: termina en letra, coma, punto y coma o paréntesis
     abierto. Un párrafo que acaba en «:» y le sigue una lista/tabla/pasos, o
     que acaba en cifra, cierre de paréntesis o comillas, está bien; marcarlos
     tumbó una página de 9.2 en la ronda 0 (21-sep-2026). */
  const sinCierre = cuerpo.filter((b, i) => {
    if (b.t !== 'p') return false;
    const t = (b as any).texto.trim();
    if (/[a-záéíóúñ,;(\[]$/i.test(t)) return true;
    if (/:$/.test(t)) return !['lista', 'pasos', 'tabla', 'diagrama', 'cita', 'faq', 'glosario'].includes(cuerpo[i + 1]?.t as string);
    return false;
  }).length;
  if (sinCierre) f.push(`${sinCierre} párrafo(s) terminan sin puntuación final: texto cortado a media frase`);

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
    probabilidad_cita: { type: 'number' },
    primera_correccion: { type: 'string' },
    elementos: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { elemento: { type: 'string' }, veredicto: { type: 'string', enum: ['mantener', 'cambiar'] }, confianza: { type: 'number' }, propuesta: { type: 'string' } }, required: ['elemento', 'veredicto', 'confianza', 'propuesta'] } },
    criterios: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { clave: { type: 'string' }, ok: { type: 'boolean' }, nota: { type: 'string' } }, required: ['clave', 'ok', 'nota'] } },
    preguntas_ia_cubiertas: { type: 'array', items: { type: 'string' } },
    preguntas_ia_sin_cubrir: { type: 'array', items: { type: 'string' } },
    video_sugerido: { type: 'string' },
    necesita_del_dueno: { type: 'array', items: { type: 'string' } },
    funciones_prometidas: { type: 'array', items: { type: 'string' } },
    wow: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { clave: { type: 'string' }, ok: { type: 'boolean' }, nota: { type: 'string' } }, required: ['clave', 'ok', 'nota'] } },
    fallos: { type: 'array', items: { type: 'string' } },
    por_que: { type: 'string' },
  },
  required: ['pasa', 'mejor_que_competencia', 'puntajes', 'probabilidad_cita', 'primera_correccion', 'elementos', 'criterios', 'preguntas_ia_cubiertas', 'preguntas_ia_sin_cubrir', 'video_sugerido', 'necesita_del_dueno', 'funciones_prometidas', 'wow', 'fallos', 'por_que'],
};

const SISTEMA_REFEREE = `Eres el referee de una página antes de que la vea el dueño de Sacs. Decides si es MEJOR que lo que ya existe en internet para esa pregunta, si está hecha para que la cite una IA (y un AI Overview de Google) y para que la USE quien la lee, y si no, dices exactamente qué cambiar.

No eres amable ni severo: eres concreto. Un fallo útil dice QUÉ y DÓNDE («la sección 3 promete X, que la ficha no lista»; «el primer párrafo tarda 80 palabras en contestar»). Un fallo inútil dice «mejorar la claridad».

SEIS EJES, cada uno de 0 a 10:
- contesta: ¿el resumen y el primer párrafo responden la pregunta tal cual la haría quien busca? ¿O hablan del tema?
- profundidad: ¿enseña algo que quien lleva una tienda no sabía? ¿Con ejemplos con nombre y número, no con generalidades?
- voz_experto: ¿lee como escrito por alguien que ha estado en el mostrador? Casos concretos, opiniones, límites admitidos, las palabras del glosario del ramo, ninguna de la lista «evitar». Anti-señales: folleto, consejos genéricos, anglicismos.
- honestidad: SOLO sobre precios y planes (solo los de la ficha), datos externos (solo de las fuentes verificadas, con su url) y reglas legales/fiscales. Las FUNCIONES de Sacs NO cuentan aquí: por regla del dueño se presentan como existentes en su mejor versión, y una página que dice «Sacs no tiene X» o «pídelo en la demo» PIERDE puntos en profundidad. Un precio o dato inventado sí es fallo automático.
- estructura_geo: resumen «En corto», faq real, tabla o pasos, diagrama con el dato, glosario, encabezados que una IA pueda citar sueltos, datos con fuente.
- vs_competencia: comparada con las páginas que hoy rankean (te las doy puntuadas) y la lista «para ganar», ¿cubre el hueco común y es más útil en lo concreto? No más larga: más útil.

ADEMÁS entregas:
- criterios: los 18 criterios que te doy, cada uno ok/no con una nota de una frase (qué falta o por qué sí).
- elementos: para titulo, meta, h1, faq, schema, resumen, glosario, diagrama, imagenes, cta_mitad, enlaces: «mantener» o «cambiar», confianza 0-1, y la propuesta concreta si es cambiar (el texto nuevo del título o la meta, la pregunta del faq que falta, etc.).
- probabilidad_cita 0-100 y primera_correccion: el único cambio que más subiría esa probabilidad.
- preguntas_ia_cubiertas / sin_cubrir: de la lista de prompts y preguntas reales que te doy.
- video_sugerido: el id de un video del canal que encaje (te doy candidatos) o «grabar: <qué video de 3 min habría que grabar, con guion en 3 líneas>» o «».
- necesita_del_dueno: lo que el motor NO puede generar solo y hay que pedirle al dueño (un video, una plantilla descargable, confirmar un precio). Concreto, una línea cada uno. Las capturas de pantalla NO se piden: el motor las dibuja con los datos del bloque «captura».
- wow: los 15 criterios WOW que te doy, cada uno ok/no con nota de una frase. NO bloquean el «pasa»; son lo que la vuelve la referencia del tema. Cuando uno falte y sea del dueño (caso real, voz de dueña, experto), ponlo también en necesita_del_dueno.
- funciones_prometidas: las funciones que la página describe como de Sacs y que la ficha «LO QUE SACS HACE HOY» no lista. Una línea por función, concreta. Es la lista que ventas necesita para la demo; no es un fallo.

PASA solo si: honestidad ≥ 9, contesta ≥ 8, promedio de los seis ≥ 8, mejor_que_competencia true, y los criterios glosario, fotos, diagrama, datos_con_fuente, cta_mitad, respuesta_corta y enlaces_internos están en ok.

Si no pasa, «fallos» lleva de 2 a 8 cambios concretos y accionables, en orden de importancia. Quien reescriba va a aplicar exactamente esos, así que escríbelos como instrucciones.`;

/** Prompts reales que la gente hace a la IA y búsquedas de comprador para esta pieza. */
async function contextoDeDemanda(b: any): Promise<{ prompts: string[]; queries: string[] }> {
  let clusterId: string | null = null;
  if (b?.oportunidad_id) {
    const { data: op } = await supabase.from('de_oportunidades').select('cluster_id').eq('id', b.oportunidad_id).maybeSingle();
    clusterId = op?.cluster_id || null;
  }
  const claves = [...new Set(norm(`${b?.pregunta || ''} ${b?.giro || ''}`).split(/[^a-z0-9]+/).filter(w => w.length > 5))].slice(0, 6);
  let prompts: string[] = [];
  if (clusterId) {
    const { data } = await supabase.from('de_prompts_ia').select('prompt').eq('cluster_id', clusterId).eq('activo', true).limit(12);
    prompts = (data || []).map(x => x.prompt);
  }
  if (prompts.length < 4 && claves.length) {
    const { data } = await supabase.from('de_prompts_ia').select('prompt').eq('activo', true).or(claves.map(k => `prompt.ilike.%${k}%`).join(',')).limit(12);
    prompts = [...new Set([...prompts, ...(data || []).map(x => x.prompt)])];
  }
  let queries: string[] = [];
  if (clusterId) {
    const { data } = await supabase.from('de_queries').select('texto_original, intent_comercial, senales_n').eq('cluster_id', clusterId).order('senales_n', { ascending: false }).limit(15);
    queries = (data || []).map(q => `${q.texto_original}${q.intent_comercial ? ' (comprador)' : ''}`);
  }
  return { prompts, queries };
}

/** Videos del canal que se parecen a la pregunta, por palabras en común. */
export function videosCandidatos(b: any, max = 8): { id: string; titulo: string }[] {
  const claves = new Set(norm(`${b?.pregunta || ''} ${b?.giro || ''} ${(b?.secciones || []).join(' ')}`).split(/[^a-z0-9]+/).filter(w => w.length > 4));
  return (videosCanal as { id: string; titulo: string }[])
    .map(v => ({ ...v, n: norm(v.titulo).split(/[^a-z0-9]+/).filter(w => claves.has(w)).length }))
    .filter(v => v.n >= 2).sort((a, b) => b.n - a.n).slice(0, max)
    .map(v => ({ id: v.id, titulo: v.titulo }));
}

export async function juzgar(contenidoId: string): Promise<{ ok: boolean; veredicto?: Veredicto; duras?: string[]; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, titulo, h1, meta_desc, cuerpo, brief').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe', costo: 0 };
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const b = (c.brief || {}) as any;

  const duras = comprobacionesDuras({ titulo: c.titulo, meta_desc: c.meta_desc || '', h1: c.h1 || '', cuerpo, brief: b });

  /* Hub-and-spoke: un spoke tiene que enlazar al hub de su giro (si ya hay hub
     publicado). Es lo que sube la autoridad por el árbol; sin esto cada pieza
     nueva es un callejón. */
  if (b?.giro && !b?.es_hub) {
    const { data: hub } = await supabase.from('de_contenido').select('seccion, slug').eq('estado', 'publicado').filter('brief->>giro', 'eq', b.giro).filter('brief->>es_hub', 'eq', 'true').limit(1).maybeSingle();
    if (hub && !JSON.stringify(cuerpo).includes(`/${hub.seccion}/${hub.slug}`)) duras.push(`no enlaza al hub de su giro (/${hub.seccion}/${hub.slug}/): todo spoke enlaza a la guía completa en el primer tercio`);
  }

  /* Si nadie leyó a la competencia ni buscó fuentes para esta pregunta, se hace
     ahora: juzgar sin comparar no es juzgar. */
  let comp: Competencia | undefined = b?.competencia;
  let costoComp = 0;
  if (!comp?.paginas?.length && b?.pregunta) {
    const rc = await analizarCompetencia(b.pregunta, b.quien);
    costoComp += rc.costo;
    if (rc.ok && rc.datos) { comp = rc.datos; await guardarCompetencia(c.id, comp); b.competencia = comp; }
  }
  if (!b.fuentes?.length && b?.pregunta) {
    const rf = await buscarFuentes(b.pregunta, b.giro);
    costoComp += rf.costo;
    if (rf.ok) b.fuentes = rf.fuentes;
  }
  if (costoComp) await supabase.from('de_contenido').update({ brief: b }).eq('id', c.id);

  const compTxt = comp?.paginas?.length
    ? comp.paginas.map((p, i) => `  ${i + 1}. [${p.tipo}${p.citada_por_ia ? ' · YA CITADA POR IA' : ''}] ${p.titulo} (${p.url})\n     ~${p.palabras_aprox} palabras · faq:${p.tiene_faq ? 'sí' : 'no'} · tabla/pasos:${p.tiene_tabla_o_pasos ? 'sí' : 'no'} · precios:${p.menciona_precios ? 'sí' : 'no'}${p.puntajes ? ` · respuesta ${p.puntajes.respuesta}/5 profundidad ${p.puntajes.profundidad}/5 prueba ${p.puntajes.prueba}/5 frescura ${p.puntajes.frescura}/5` : ''}\n     cubre bien: ${p.cubre_bien.join('; ')}\n     le falta: ${p.le_falta.join('; ')}`).join('\n') + `\n  HUECO COMÚN que ninguna cubre: ${comp.hueco_comun}`
    : '  (no hay análisis de competencia — juzga sin comparar y pon vs_competencia en 5)';

  const { prompts, queries } = await contextoDeDemanda(b);
  const videos = videosCandidatos(b);

  const usuario = `PREGUNTA QUE LA PÁGINA TIENE QUE CONTESTAR: ${b?.pregunta || c.titulo}
QUIÉN PREGUNTA: ${b?.quien || '—'}
GIRO: ${b?.giro || '—'} (su landing: /giros/${b?.giro || '…'})
LO QUE EL BRIEF AVISÓ QUE NO SE PUEDE AFIRMAR (precios/planes/datos/ley): ${b?.nota_honestidad || '(nada)'}
FUNCIONES QUE LA PÁGINA PRESENTA COMO DE SACS POR REGLA DEL DUEÑO (no las marques como invento): ${(b?.funciones_a_prometer || []).join('; ') || '(las que el giro necesite)'}

LAS PÁGINAS QUE HOY RANKEAN PARA ESTO:
${compTxt}
${b.para_ganar?.length ? `\nLO QUE HARÍA QUE LA NUESTRA GANE A TODAS (lectura completa de la competencia):\n${b.para_ganar.map((x: string) => `  - ${x}`).join('\n')}` : ''}
${b.preguntas_sin_contestar?.length ? `\nPREGUNTAS QUE LA GENTE HACE Y NINGUNA PÁGINA CONTESTA:\n${b.preguntas_sin_contestar.map((x: string) => `  - ${x}`).join('\n')}` : ''}

FUENTES VERIFICADAS DISPONIBLES (solo estas pueden citarse con url; lo que digan «dato», «cita_textual» y «cómo usarla» SÍ está respaldado):
${(b.fuentes || []).map((f: any) => `  - ${f.dato} — ${f.fuente} ${f.fecha} ${f.url}${f.cita_textual ? `\n      cita: «${f.cita_textual}»` : ''}${f.como_usarlo ? `\n      cómo usarla: ${f.como_usarlo}` : ''}`).join('\n') || '  (ninguna)'}

LO QUE LA PLANTILLA AGREGA SOLA (no lo pidas como fallo):
  - Fecha de publicación y de actualización visibles, autor y editor = Sacs (organización) en el schema Article.
  - Portada arriba del cuerpo y el cierre «Sacs para <giro>» con foto, descripción y botón a /giros/<giro> al final.
  - FAQPage, HowTo, DefinedTermSet, ImageObject, VideoObject y speakable se generan del cuerpo automáticamente.
  - Las [IMAGEN pendiente de generar] y el [DIAGRAMA → imagen pendiente] se generan DESPUÉS de que la página pase: júzgalos por su alt/escena y por sus datos, no por estar pendientes. Lo que sí puedes pedir es una escena mejor o un diagrama con otros datos.
  - Las [CAPTURA DE SACS] se dibujan con el diseño del sistema a partir de sus campos: júzgalas por sus datos (¿son los de la sección? ¿realistas?). Videos nuevos y plantillas descargables NO los puede generar el motor: van en «necesita_del_dueno», nunca en «fallos».

LENGUAJE DEL RAMO
  Glosario del brief: ${(b.glosario || []).map((g: any) => g.termino).join(', ') || '(ninguno)'}
  Palabras que NO se dicen en México: ${(b.evitar || []).join(', ') || '(ninguna)'}
  Palabras que rankean: ${(b.palabras_que_rankean || []).slice(0, 8).join(' · ') || '(sin datos)'}

PROMPTS REALES QUE LA GENTE HACE A LA IA SOBRE ESTO:
${[...prompts, ...(b.preguntas_reales || []).slice(0, 8)].map(p => `  - ${p}`).join('\n') || '  (ninguno registrado)'}

BÚSQUEDAS REALES (las marcadas «comprador» son de quien quiere resolverlo):
${queries.map(q => `  - ${q}`).join('\n') || '  (ninguna registrada)'}

VIDEOS DEL CANAL QUE PODRÍAN ENCAJAR (id — título):
${videos.map(v => `  - ${v.id} — ${v.titulo}`).join('\n') || '  (ninguno parecido)'}

LOS 18 CRITERIOS (clave: qué se juzga):
${CRITERIOS.map(k => `  - ${k.clave}: ${k.que}`).join('\n')}

LOS 15 WOW (no bloquean; puntúan):
${CRITERIOS_WOW.map(k => `  - ${k.clave}: ${k.que}`).join('\n')}

COMPROBACIONES AUTOMÁTICAS QUE YA FALLARON (inclúyelas en «fallos» si siguen aplicando):
${duras.length ? duras.map(x => `  - ${x}`).join('\n') : '  (ninguna)'}

${fichaSacs()}

LA PÁGINA A JUZGAR
Título: ${c.titulo}
H1: ${c.h1}
Meta: ${c.meta_desc}
Cuerpo (${contarPalabras(cuerpo)} palabras; los bloques [RESUMEN], [TABLA], [PASOS], [FAQ], [GLOSARIO], [DIAGRAMA], [IMAGEN], [VIDEO] y [CTA] se renderizan con su propio diseño — no son texto corrido):
${aMarkdown(cuerpo).slice(0, 26000)}`;

  const r = await preguntar<Veredicto>({ agente: 'contenido_referee', trabajo: 'estrategia', sistema: SISTEMA_REFEREE, usuario, esquema: ESQUEMA_VEREDICTO, max_tokens: 32000 }); // el referee sí razona y esos tokens cuentan aquí
  if (!r.ok || !r.datos) return { ok: false, error: r.error, duras, costo: costoComp + (r.costo_usd || 0) };

  const v = r.datos;
  // Las duras mandan: si el modelo dijo «pasa» pero hay un precio inventado, no pasa.
  const graves = duras.filter(d => /precio|no existe|sin bloque|sin foto|sin cta|cortad|mínimo|no enlaza|fuentes verificadas|ruta cruda|reparte módulos|marcador sin resolver|Sacs no tiene|captura|hub de su giro/.test(d));
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
    if (b.atascada) continue;
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
      /* Se rinde y lo deja a la vista: tres reescrituras que no pasan es señal de
         que el problema está en el encargo o en la ficha, no en la redacción. */
      await supabase.from('de_contenido').update({ brief: { ...b, atascada: true }, auditorias: { referee }, actualizado_at: new Date().toISOString() }).eq('id', p.id);
      atascadas++;
      continue;
    }

    // A reescribir: el borrador lee `brief.correcciones` y las aplica.
    await supabase.from('de_contenido').update({
      estado: 'brief',
      brief: { ...b, reescrituras: rondas + 1, correcciones: v.fallos, veredicto_anterior: v.puntajes, elementos_propuestos: v.elementos.filter(e => e.veredicto === 'cambiar') },
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
// 3 · IMÁGENES: portada, fotos intermedias y el diagrama con el dato
// ═══════════════════════════════════════════════════════════════════════════

/* El mismo estilo que las fotos de los giros: documental, luz natural, gente
   real trabajando. Nada de renders de «tecnología» con hologramas azules — eso
   es exactamente lo que grita «generado» y lo que un lector del ramo no cree. */
const ESTILO_FOTO = 'Photorealistic documentary photograph, 35mm lens, shallow depth of field, natural window light, realistic film grain, candid, no text, no logos, no watermarks, no visible screens as the subject. Mexico.';

const ESQUEMA_FOTO = {
  type: 'object', additionalProperties: false,
  properties: { escena: { type: 'string' }, alt: { type: 'string' } },
  required: ['escena', 'alt'],
};

async function subirJpg(buf: Buffer, path: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { error } = await supabase.storage.from('wa-media').upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (error) return { ok: false, error: `no se pudo subir: ${error.message}` };
  return { ok: true, url: supabase.storage.from('wa-media').getPublicUrl(path).data.publicUrl };
}

async function generarJpg(escena: string, ancho: number, alto: number, path: string): Promise<{ ok: boolean; url?: string; error?: string; costo: number }> {
  const llave = env('OPENAI_API_KEY');
  if (!llave) return { ok: false, error: 'falta OPENAI_API_KEY', costo: 0 };
  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: `${ESTILO_FOTO} ${escena}`, size: '1536x1024', quality: 'high' }),
  });
  const j: any = await r.json();
  if (j.error) return { ok: false, error: j.error.message, costo: 0 };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: 'sin imagen en la respuesta', costo: 0 };
  const costo = 0.19; // gpt-image-2 «high» 1536x1024, aproximado
  try { await supabase.from('ia_uso').insert({ modelo: 'openai:gpt-image-2', proposito: 'demanda:imagen', input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, busquedas_web: 0, costo_usd: costo, ok: true, ms: Date.now() - t0 }); } catch {}
  const sharp = (await import('sharp')).default;
  const jpg = await sharp(Buffer.from(b64, 'base64')).resize(ancho, alto, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const s = await subirJpg(jpg, path);
  return { ...s, costo };
}

/**
 * El diagrama con el dato, como imagen. Es lo que un AI Overview enseña al lado
 * de la respuesta (la tabla de curva de tallas de fashionandillustration.com,
 * por ejemplo): una imagen que CONTIENE el dato, con alt. Se dibuja en SVG con
 * los datos de la propia página y se rasteriza con sharp; nada de modelo, así
 * que el texto sale nítido y exacto.
 */
export function svgDeDiagrama(d: { titulo: string; encabezados: string[]; filas: string[][]; nota?: string }): string {
  const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cols = Math.max(1, d.encabezados.length);
  const W = 1200, pad = 56, ancho = W - pad * 2;
  // Título y nota se parten en líneas (máx. 2 y 3) en vez de recortarse con «…».
  const partir = (t: string, max: number, lineas: number) => {
    const out: string[] = []; let l = '';
    for (const w of String(t ?? '').split(/\s+/)) { if ((l + ' ' + w).trim().length > max && l) { out.push(l); l = w; } else l = (l + ' ' + w).trim(); }
    if (l) out.push(l);
    if (out.length > lineas) { out.length = lineas; out[lineas - 1] = out[lineas - 1].replace(/.{0,2}$/, '…'); }
    return out;
  };
  const tituloL = partir(d.titulo, 58, 2), notaL = d.nota ? partir(d.nota, 118, 3) : [];
  const cabH = 56, titH = 60 + tituloL.length * 38, notaH = notaL.length * 24 + (notaL.length ? 16 : 0), pieH = 48;
  const filas = d.filas.slice(0, 12);
  /* Columnas proporcionales al texto más largo de cada una (con piso): una
     columna «Concepto» no se recorta por culpa de una de «Saldo». */
  const largo = d.encabezados.map((h, i) => Math.max(6, String(h).length, ...filas.map(f => String(f[i] ?? '').length)));
  const suma = largo.reduce((a, b) => a + b, 0);
  const colW = largo.map(l => Math.max(120, (ancho * l) / suma));
  const escala = ancho / colW.reduce((a, b) => a + b, 0);
  const x0 = colW.map((_, i) => pad + colW.slice(0, i).reduce((a, b) => a + b * escala, 0));
  const corta = (s: string, max: number) => { const t = String(s ?? ''); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
  const maxChars = (i: number) => Math.max(8, Math.floor((colW[i] * escala - 24) / 11.5));
  /* Las celdas largas se parten en hasta 3 líneas y la fila crece: un
     «Detalle citable» recortado con «…» es justo lo que no queremos que lea
     una IA. */
  const celdasL = filas.map(f => f.slice(0, cols).map((c, i) => partir(c, maxChars(i), 3)));
  const altos = celdasL.map(f => 52 + (Math.max(1, ...f.map(l => l.length)) - 1) * 26);
  const H = titH + cabH + altos.reduce((a, b) => a + b, 0) + notaH + pieH + pad;
  let y = titH;
  const cab = d.encabezados.map((h, i) => `<text x="${x0[i] + 16}" y="${y + 36}" font-size="17" font-weight="700" fill="#3b3a52" letter-spacing=".04em">${esc(corta(h.toUpperCase(), maxChars(i)))}</text>`).join('');
  y += cabH;
  let yy = y;
  const cuerpo = filas.map((_, r) => {
    const bg = r % 2 === 0 ? '#ffffff' : '#f7f6fb';
    const h = altos[r];
    const celdas = celdasL[r].map((lineas, i) => lineas.map((l, k) => `<text x="${x0[i] + 16}" y="${yy + 33 + k * 26}" font-size="21" font-weight="${i === 0 ? 650 : 450}" fill="#1b1a2e">${esc(l)}</text>`).join('')).join('');
    const out = `<rect x="${pad}" y="${yy}" width="${ancho}" height="${h}" fill="${bg}"/>${celdas}`;
    yy += h;
    return out;
  }).join('');
  y = yy;
  const nota = notaL.map((l, i) => `<text x="${pad}" y="${y + 30 + i * 24}" font-size="16" fill="#6b6985">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="${pad}" y="${pad - 16}" width="8" height="${tituloL.length * 38 + 2}" rx="2" fill="#4470D8"/>
${tituloL.map((l, i) => `<text x="${pad + 24}" y="${pad + 14 + i * 38}" font-size="30" font-weight="700" fill="#1b1a2e">${esc(l)}</text>`).join('')}
<line x1="${pad}" y1="${titH + cabH - 2}" x2="${W - pad}" y2="${titH + cabH - 2}" stroke="#d9d7e6" stroke-width="2"/>
${cab}${cuerpo}${nota}
<text x="${W - pad}" y="${H - 22}" font-size="15" fill="#8e8ca8" text-anchor="end">sacscloud.com</text>
</svg>`;
}

/**
 * La pantalla de Sacs, dibujada. Misma idea que el diagrama: SVG determinista
 * con el diseño del sistema (barra, migas, ficha de campos, tabla), sin modelo.
 * Es la «captura» que enseña cómo se ve resuelto en Sacs lo que la sección
 * explica — y por regla del dueño, se enseña la mejor versión.
 */
export function svgDeCaptura(c: { titulo: string; migas?: string; campos: [string, string][]; encabezados?: string[]; filas?: string[][] }): string {
  const esc = (x: string) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const corta = (x: string, max: number) => { const t = String(x ?? ''); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
  const W = 1200, barra = 52, pad = 40;
  const campos = (c.campos || []).slice(0, 10);
  const cols = 2, campoH = 74, filasCampos = Math.ceil(campos.length / cols);
  const tabla = (c.filas || []).slice(0, 6), enc = c.encabezados || [];
  const tablaH = tabla.length ? 48 + tabla.length * 44 + 24 : 0;
  const H = barra + 96 + filasCampos * campoH + tablaH + pad;
  const colW = (W - pad * 2 - 16) / cols;
  const camposSvg = campos.map(([k, v], i) => {
    const x = pad + (i % cols) * (colW + 16), y = barra + 96 + Math.floor(i / cols) * campoH;
    const estado = /^(activo|apartad|pagad|liquidad|listo|confirmad|aprobad|en taller|pendiente|vencid|program)/i.test(String(v));
    return `<rect x="${x}" y="${y}" width="${colW}" height="${campoH - 12}" rx="10" fill="#ffffff" stroke="#e6e4f0"/>
<text x="${x + 16}" y="${y + 24}" font-size="12" font-weight="700" fill="#8e8ca8" letter-spacing=".06em">${esc(corta(k.toUpperCase(), 34))}</text>
${estado ? `<rect x="${x + 14}" y="${y + 34}" width="${Math.min(colW - 28, 12 + String(v).length * 10)}" height="24" rx="12" fill="#EEECFE"/><text x="${x + 24}" y="${y + 51}" font-size="15" font-weight="700" fill="#5B3FD9">${esc(corta(v, 36))}</text>` : `<text x="${x + 16}" y="${y + 52}" font-size="19" font-weight="600" fill="#1b1a2e">${esc(corta(v, Math.floor(colW / 11)))}</text>`}`;
  }).join('');
  let tablaSvg = '';
  if (tabla.length) {
    const y0 = barra + 96 + filasCampos * campoH + 8, tw = W - pad * 2, ncol = Math.max(1, enc.length || tabla[0].length), cw = tw / ncol;
    tablaSvg = `<rect x="${pad}" y="${y0}" width="${tw}" height="${40 + tabla.length * 44}" rx="10" fill="#ffffff" stroke="#e6e4f0"/>` +
      enc.map((h, i) => `<text x="${pad + i * cw + 14}" y="${y0 + 26}" font-size="12" font-weight="700" fill="#8e8ca8" letter-spacing=".06em">${esc(corta(h.toUpperCase(), Math.floor(cw / 8)))}</text>`).join('') +
      `<line x1="${pad}" y1="${y0 + 40}" x2="${pad + tw}" y2="${y0 + 40}" stroke="#e6e4f0"/>` +
      tabla.map((f, r) => `${r % 2 ? `<rect x="${pad + 1}" y="${y0 + 40 + r * 44}" width="${tw - 2}" height="44" fill="#f7f6fb"/>` : ''}` + f.slice(0, ncol).map((cell, i) => `<text x="${pad + i * cw + 14}" y="${y0 + 40 + r * 44 + 28}" font-size="16" font-weight="${i === 0 ? 650 : 450}" fill="#1b1a2e">${esc(corta(cell, Math.floor(cw / 9.5)))}</text>`).join('')).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#F7F6FB"/>
<rect width="${W}" height="${barra}" fill="#1b1a2e"/>
<text x="${pad}" y="33" font-size="20" font-weight="800" fill="#ffffff" letter-spacing="-.02em">Sacs</text>
<text x="${pad + 62}" y="33" font-size="13" fill="#b9b6d3">Fashion Commerce</text>
<circle cx="${W - pad - 10}" cy="26" r="12" fill="#5B3FD9"/><text x="${W - pad - 15}" y="31" font-size="12" font-weight="700" fill="#fff">K</text>
${c.migas ? `<text x="${pad}" y="${barra + 30}" font-size="13" fill="#8e8ca8">${esc(corta(c.migas, 110))}</text>` : ''}
<text x="${pad}" y="${barra + 66}" font-size="26" font-weight="700" fill="#1b1a2e">${esc(corta(c.titulo, 66))}</text>
${camposSvg}${tablaSvg}
<text x="${W - pad}" y="${H - 14}" font-size="12" fill="#b9b6d3" text-anchor="end">sacscloud.com</text>
</svg>`;
}

export async function generarCapturas(contenidoId: string): Promise<{ ok: boolean; hechas: number; error?: string }> {
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, cuerpo').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, hechas: 0, error: 'no existe' };
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const pend = cuerpo.map((b, i) => ({ b: b as any, i })).filter(x => x.b.t === 'captura' && !x.b.url && x.b.campos?.length);
  if (!pend.length) return { ok: true, hechas: 0 };
  const sharp = (await import('sharp')).default;
  let hechas = 0;
  for (const { b, i } of pend) {
    const jpg = await sharp(Buffer.from(svgDeCaptura(b))).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const meta = await sharp(jpg).metadata();
    const s = await subirJpg(jpg, `guias/${c.seccion}-${c.slug}-captura-${i}-${Date.now().toString(36)}.jpg`);
    if (!s.ok) return { ok: false, hechas, error: s.error };
    (cuerpo[i] as any) = { ...b, url: s.url, ancho: meta.width || 1200, alto: meta.height || 760, alt: b.alt || `Pantalla de Sacs: ${b.titulo}` };
    hechas++;
  }
  const { error } = await supabase.from('de_contenido').update({ cuerpo, actualizado_at: new Date().toISOString() }).eq('id', contenidoId);
  if (error) return { ok: false, hechas, error: error.message };
  return { ok: true, hechas };
}

export async function generarDiagramas(contenidoId: string): Promise<{ ok: boolean; hechos: number; error?: string }> {
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, cuerpo').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, hechos: 0, error: 'no existe' };
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const pend = cuerpo.map((b, i) => ({ b: b as any, i })).filter(x => x.b.t === 'diagrama' && !x.b.url && x.b.filas?.length);
  if (!pend.length) return { ok: true, hechos: 0 };
  const sharp = (await import('sharp')).default;
  let hechos = 0;
  for (const { b, i } of pend) {
    const svg = svgDeDiagrama(b);
    const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const meta = await sharp(jpg).metadata();
    const s = await subirJpg(jpg, `guias/${c.seccion}-${c.slug}-diagrama-${i}-${Date.now().toString(36)}.jpg`);
    if (!s.ok) return { ok: false, hechos, error: s.error };
    (cuerpo[i] as any) = { ...b, url: s.url, ancho: meta.width || 1200, alto: meta.height || 800, alt: b.alt || `${b.titulo}: ${b.encabezados.join(', ')}` };
    hechos++;
  }
  const { error } = await supabase.from('de_contenido').update({ cuerpo, actualizado_at: new Date().toISOString() }).eq('id', contenidoId);
  if (error) return { ok: false, hechos, error: error.message };
  return { ok: true, hechos };
}

export async function generarPortada(contenidoId: string): Promise<{ ok: boolean; url?: string; alt?: string; error?: string; costo: number }> {
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

  const g = await generarJpg(e.datos.escena, 1200, 630, `guias/${c.seccion}-${c.slug}-${Date.now().toString(36)}.jpg`);
  if (!g.ok) return { ok: false, error: g.error, costo: (e.costo_usd || 0) + g.costo };
  const portada = { url: g.url, alt: e.datos.alt, escena: e.datos.escena, generada_at: new Date().toISOString() };
  await supabase.from('de_contenido').update({ brief: { ...b, portada } }).eq('id', contenidoId);
  return { ok: true, url: g.url, alt: e.datos.alt, costo: (e.costo_usd || 0) + g.costo };
}

/** Las fotos intermedias que el redactor pidió (bloques «imagen» sin url). */
export async function generarIntermedias(contenidoId: string): Promise<{ ok: boolean; hechas: number; error?: string; costo: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, cuerpo').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, hechas: 0, error: 'no existe', costo: 0 };
  const cuerpo = (c.cuerpo || []) as Bloque[];
  const pendientes = cuerpo.map((b, i) => ({ b: b as any, i })).filter(x => x.b.t === 'imagen' && !x.b.url && x.b.escena);
  if (!pendientes.length) return { ok: true, hechas: 0, costo: 0 };
  const freno = await frenoDeSalida(`generadas ${pendientes.length} fotos de /${c.seccion}/${c.slug}/`);
  if (freno) return { ok: false, hechas: 0, error: freno.motivo, costo: 0 };

  let costo = 0, hechas = 0;
  for (const { b, i } of pendientes.slice(0, 3)) {
    const g = await generarJpg(b.escena, 1200, 800, `guias/${c.seccion}-${c.slug}-${i}-${Date.now().toString(36)}.jpg`);
    costo += g.costo;
    if (!g.ok) return { ok: false, hechas, error: g.error, costo };
    (cuerpo[i] as any) = { ...b, url: g.url, ancho: 1200, alto: 800 };
    hechas++;
  }
  const { error } = await supabase.from('de_contenido').update({ cuerpo, actualizado_at: new Date().toISOString() }).eq('id', contenidoId);
  if (error) return { ok: false, hechas, error: error.message, costo };
  return { ok: true, hechas, costo };
}

registrar('contenido.imagen', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  // Solo lo que ya pasó el referee: no se paga una foto por algo que se va a reescribir.
  const { data: pend } = await supabase.from('de_contenido').select('id, slug, brief, cuerpo').in('estado', ['aprobado', 'publicado']).order('created_at', { ascending: false }).limit(limite * 4);
  const sin = (pend || []).filter(p => !(p.brief as any)?.portada?.url || ((p.cuerpo || []) as any[]).some(b => (b.t === 'imagen' && !b.url && b.escena) || ((b.t === 'diagrama' || b.t === 'captura') && !b.url))).slice(0, limite);
  if (!sin.length) return { ok: true, resumen: 'todas las piezas aprobadas tienen sus imágenes' };
  let hechas = 0, costo = 0; const fallos: string[] = [];
  for (const p of sin) {
    const d = await generarDiagramas(p.id);
    if (!d.ok) { fallos.push(`${p.slug}: diagrama: ${d.error}`); continue; }
    const k = await generarCapturas(p.id);
    if (!k.ok) { fallos.push(`${p.slug}: captura: ${k.error}`); continue; }
    const r = await generarPortada(p.id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${p.slug}: portada: ${r.error}`); continue; }
    const m = await generarIntermedias(p.id);
    costo += m.costo;
    if (!m.ok) { fallos.push(`${p.slug}: intermedias: ${m.error}`); continue; }
    hechas++;
  }
  return { ok: fallos.length === 0, resumen: `${hechas} pieza(s) con imágenes${fallos.length ? ` · ${fallos.length} fallaron` : ''}`, datos: { hechas, fallos }, costo_usd: costo };
});
