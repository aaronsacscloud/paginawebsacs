/**
 * GUION Y REGLAS COMO DATOS (decisión del dueño, 2026-09-03).
 *
 * Antes el guion, la wiki y los límites eran constantes en código: una regla nueva exigía deploy. Ahora:
 *  - ti_guion_versiones guarda cada versión del guion/wiki/límites; la más nueva manda; las constantes son el
 *    respaldo (versión 0) si la tabla está vacía.
 *  - ti_reglas con estado «activa» y texto entra al prompt como bloque «REGLAS VIGENTES», con fecha. Las propuestas
 *    las redacta Opus a partir de las correcciones/rechazos (patrón), se PRUEBAN contra casos reales (con y sin la
 *    regla, un juez califica) y el dueño las aprueba en la Torre. Nada entra al prompt sin aprobación.
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';
import { GUION_AGENTE } from './agente-guion';
import { WIKI_COMERCIAL, LIMITES_COPILOTO } from './wiki-comercial';

type Clave = 'guion' | 'wiki' | 'limites';
const DEF: Record<Clave, string> = { guion: GUION_AGENTE, wiki: WIKI_COMERCIAL, limites: LIMITES_COPILOTO };
let cacheGuion: { at: number; v: { textos: Record<Clave, string>; versiones: Record<Clave, number> } } | null = null;
let cacheReglas: { at: number; v: { texto: string; reglas: any[] } } | null = null;
const TTL = 60e3;

export async function guionActual(fresco = false) {
  if (!fresco && cacheGuion && Date.now() - cacheGuion.at < TTL) return cacheGuion.v;
  const { data } = await supabase.from('ti_guion_versiones').select('clave, version, texto').order('version', { ascending: false }).limit(60);
  const textos = { ...DEF }; const versiones: Record<Clave, number> = { guion: 0, wiki: 0, limites: 0 };
  for (const k of ['guion', 'wiki', 'limites'] as Clave[]) { const f = (data || []).find(x => x.clave === k); if (f?.texto) { textos[k] = f.texto; versiones[k] = f.version; } }
  cacheGuion = { at: Date.now(), v: { textos, versiones } };
  return cacheGuion.v;
}

export async function reglasVigentes(fresco = false) {
  if (!fresco && cacheReglas && Date.now() - cacheReglas.at < TTL) return cacheReglas.v;
  const { data } = await supabase.from('ti_reglas').select('id, texto, etapa, alcance, version, activa_desde, origen').eq('estado', 'activa').not('texto', 'is', null).order('activa_desde', { ascending: true }).limit(80);
  const reglas = data || [];
  const texto = reglas.length ? '\n\nREGLAS VIGENTES (aprobadas por el dueño a partir de correcciones reales; si chocan con el guion, mandan estas):\n' + reglas.map(r => `- ${r.etapa ? `[${r.etapa}] ` : ''}${String(r.texto).trim()} (desde ${String(r.activa_desde || '').slice(0, 10)})`).join('\n') : '';
  cacheReglas = { at: Date.now(), v: { texto, reglas } };
  return cacheReglas.v;
}
export const invalidarCaches = () => { cacheGuion = null; cacheReglas = null; };

/** El primer bloque del system prompt del agente: guion + wiki + límites + reglas vigentes. Cacheable por Anthropic mientras no cambie. */
export async function bloqueSistemaBase(extraReglas?: string) {
  const g = await guionActual(); const r = await reglasVigentes();
  return `${g.textos.guion}\n\nLO QUE SABES (general):\n${g.textos.wiki}\n\nLÍMITES:\n${g.textos.limites}${r.texto}${extraReglas ? `\n\nREGLA EN PRUEBA (aplícala como si fuera vigente):\n- ${extraReglas}` : ''}`;
}

export async function guardarVersionGuion(clave: Clave, texto: string, userId: string | null, nota?: string) {
  const t = String(texto || '').trim(); if (t.length < 200) return { error: 'El texto quedó demasiado corto: no se guarda' };
  const { data: ult } = await supabase.from('ti_guion_versiones').select('version, texto').eq('clave', clave).order('version', { ascending: false }).limit(1).maybeSingle();
  if (ult && ult.texto === t) return { error: 'Es idéntico a la versión vigente' };
  const version = (ult?.version || 0) + 1;
  const { error } = await supabase.from('ti_guion_versiones').insert({ clave, version, texto: t, nota: nota || null, created_by: userId });
  if (error) return { error: error.message };
  invalidarCaches();
  await supabase.from('ia_log').insert({ accion: 'guion_version', razon: `${clave} v${version}${nota ? ` · ${nota}` : ''}`, detalle: { clave, version, por: userId, largo: t.length } }).then(() => {}, () => {});
  return { ok: true, version };
}

/* ── REDACTAR LA REGLA con Opus a partir del patrón ── */
export async function redactarReglaConIA(o: { etapa: string; muestras: { mensaje_lead?: string | null; original?: string | null; pulida?: string | null; por_que?: string | null; fuente?: string | null }[] }): Promise<{ regla: string; evidencias: string[]; alcance: string; costo: number } | null> {
  if (!hasApiKey()) return null;
  const casos = o.muestras.slice(0, 8).map((m, i) => `CASO ${i + 1} (${m.fuente || 'corrección'})\nLead: ${String(m.mensaje_lead || '').slice(0, 240)}\nEl agente había dicho: ${String(m.original || '').slice(0, 320) || '(no consta)'}\nQuedó / lo que enseñó la persona: ${String(m.pulida || '').slice(0, 320)}\nRazón o criterio: ${String(m.por_que || '').replace(/^(CRITERIO|EVITAR):\s*/, '').slice(0, 240)}`).join('\n\n');
  const prompt = `Eres quien mantiene el guion de un agente SDR de WhatsApp (Sacs, sistema para tiendas de moda en México). Las personas corrigieron o rechazaron al agente varias veces en la etapa «${o.etapa}». Lee los casos y destila UNA regla operativa que, de haber existido, habría evitado la mayoría de estas correcciones.

${casos}

Escribe la regla en 1 o 2 líneas, imperativa, concreta y verificable (qué hacer y cuándo; si aplica, qué NO hacer). Nada de generalidades («sé empático»). Si los casos apuntan a dos reglas distintas, elige la que cubra más casos. Responde SOLO JSON: {"regla": "...", "evidencias": ["3 frases cortas, cada una citando un caso concreto"], "alcance": "global|etapa", "confianza": 0-1}`;
  const r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const txt = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
  let j: any; try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j.regla) return null;
  const costo = calculateCost(MODELS.opus, (r.usage || {}) as any).cost_usd;
  return { regla: String(j.regla).trim().slice(0, 400), evidencias: (Array.isArray(j.evidencias) ? j.evidencias : []).slice(0, 3).map(String), alcance: j.alcance === 'global' ? 'global' : 'etapa', costo };
}

/* ── PROBAR ANTES DE APLICAR: casos reales, con y sin la regla, y un juez ── */
/* Los casos tienen que ser DEL CASO que la regla gobierna (4-sep). Antes se tomaban ejemplos aprobados al azar: una
   regla que solo aplica «cuando el lead dice que no le interesa» se probaba contra conversaciones donde nadie dijo que
   no, así que solo metía ruido y salía peor. Ahora se buscan por parecido al texto de la regla; si no hay suficientes
   parecidos, se completa con los de su etapa y se dice cuántos eran realmente del caso. */
async function casosRelevantes(regla: string, etapa: string | null, n = 12) {
  const { data: par } = await supabase.rpc('ti_ejemplos_parecidos', { q: regla.slice(0, 600), etapa, n: n * 2 });
  const buenos = (par || []).filter((c: any) => c.score > 0.12 && String(c.pulida || '').length >= 20);
  return { casos: buenos.slice(0, n), relevantes: buenos.length };
}
async function casosDePrueba(etapa: string | null, n = 12) {   // 12 y no 24: cada caso se genera dos veces con Opus (~$0.04); con 12 la señal es la misma y la prueba baja de ~$0.9 a ~$0.45
  const base = supabase.from('ia_ejemplos').select('id, estado, situacion, mensaje_lead, pulida, fuente').eq('estado_rev', 'aprobado').neq('estado', 'reactivacion').not('mensaje_lead', 'is', null).order('created_at', { ascending: false });
  const { data: propios } = etapa ? await base.eq('estado', etapa).limit(n) : { data: [] as any[] };
  let casos = (propios || []).filter(c => String(c.mensaje_lead || '').length >= 8 && String(c.pulida || '').length >= 20);
  if (casos.length < 12) { const { data: otros } = await supabase.from('ia_ejemplos').select('id, estado, situacion, mensaje_lead, pulida, fuente').eq('estado_rev', 'aprobado').neq('estado', 'reactivacion').not('mensaje_lead', 'is', null).order('created_at', { ascending: false }).limit(60); for (const o of otros || []) if (casos.length < n && !casos.some(c => c.id === o.id) && String(o.mensaje_lead || '').length >= 8 && String(o.pulida || '').length >= 20) casos.push(o); }
  // Correcciones primero: son los casos donde más importa.
  casos.sort((a, b) => (a.fuente === 'correccion_dueno' ? 0 : 1) - (b.fuente === 'correccion_dueno' ? 0 : 1));
  return casos.slice(0, n);
}
async function redactarCaso(system: string, caso: any) {
  // Genera con el MISMO modelo que el agente (Opus): la prueba tiene que ser fiel, aunque cueste más (~$0.6 por regla).
  const r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 350, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: `CASO DE PRUEBA. Etapa del guion: ${caso.estado}. Situación: ${caso.situacion || ''}.\nEl lead escribió: «${caso.mensaje_lead}».\nEscribe SOLO el mensaje de WhatsApp que mandarías (sin JSON, sin explicación).` }] });
  const t = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  return { texto: t, costo: calculateCost(MODELS.opus, (r.usage || {}) as any).cost_usd };
}
async function juzgar(regla: string, caso: any, a: string, b: string) {
  const swap = Math.random() < 0.5; const A = swap ? b : a, B = swap ? a : b;
  const r = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 200, messages: [{ role: 'user', content: `Eres el juez del agente SDR de Sacs. Lead: «${caso.mensaje_lead}» (etapa ${caso.estado}). La respuesta que una persona aprobó como buena: «${String(caso.pulida).slice(0, 500)}». Regla que se está evaluando: «${regla}».\n\nRespuesta A: «${A.slice(0, 600)}»\nRespuesta B: «${B.slice(0, 600)}»\n\nCalifica cada una de 1 a 10 por qué tanto sigue el criterio de la respuesta aprobada (fondo, tono, brevedad, una sola pregunta, siguiente paso natural). Aparte, di si cada una VIOLA la regla evaluada (true/false), leyéndola literal. Responde SOLO JSON: {"a": n, "b": n, "viola_a": bool, "viola_b": bool}` }] });
  const t = (r.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
  const m = t.match(/\{[\s\S]*\}/); let j: any = {}; try { j = m ? JSON.parse(m[0]) : {}; } catch { /* vacío */ }
  const sa = Number(j.a) || 0, sb = Number(j.b) || 0; const va = !!j.viola_a, vb = !!j.viola_b;
  return { sin: swap ? sb : sa, con: swap ? sa : sb, viola_sin: swap ? vb : va, viola_con: swap ? va : vb, costo: calculateCost(MODELS.sonnet, (r.usage || {}) as any).cost_usd };
}
/** Firma de la línea base: si el guion o las reglas vigentes cambian, las respuestas «sin la regla» se rehacen. */
async function firmaBase() {
  const g = await guionActual(); const r = await reglasVigentes();
  const s = `${g.versiones.guion}.${g.versiones.wiki}.${g.versiones.limites}|${r.reglas.map(x => `${x.id}:${x.version}`).join(',')}`;
  let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return `v${Math.abs(h)}`;
}

export async function evaluarRegla(id: string): Promise<any> {
  const { data: r } = await supabase.from('ti_reglas').select('id, texto, etapa').eq('id', id).maybeSingle();
  if (!r?.texto) return { error: 'La regla no tiene texto' };
  if (!hasApiKey()) return { error: 'Sin API key' };
  const tope = Number(process.env.TI_CASOS_PRUEBA) || 12;
  const rel = await casosRelevantes(r.texto!, r.etapa || null, tope).catch(() => ({ casos: [] as any[], relevantes: 0 }));
  let casos: any[] = rel.casos;
  const deSuCaso = rel.relevantes;
  if (casos.length < 6) { const extra = await casosDePrueba(r.etapa || null, tope); for (const c of extra) if (casos.length < tope && !casos.some(x => x.id === c.id)) casos.push(c); }
  if (casos.length < 6) return { error: `Solo hay ${casos.length} casos para probar; hacen falta al menos 6` };
  const [sinRegla, conRegla, firma] = await Promise.all([bloqueSistemaBase(), bloqueSistemaBase(r.texto), firmaBase()]);
  let costo = 0; const res: any[] = [];
  for (let i = 0; i < casos.length; i += 6) {
    const lote = casos.slice(i, i + 6);
    const parte = await Promise.all(lote.map(async c => {
      try {
        // La mitad «sin la regla» no depende de la regla: se cachea por firma del guion y se reusa entre pruebas.
        const { data: cache } = await supabase.from('ti_baseline').select('texto').eq('caso_id', c.id).eq('firma', firma).maybeSingle();
        let a: { texto: string; costo: number };
        if (cache?.texto) a = { texto: cache.texto, costo: 0 };
        else {
          a = await redactarCaso(sinRegla, c);
          await supabase.from('ti_baseline').insert({ caso_id: c.id, firma, texto: a.texto, modelo: MODELS.opus }).then(() => {}, () => {});
        }
        const b = await redactarCaso(conRegla, c);
        const j = await juzgar(r.texto!, c, a.texto, b.texto);
        costo += a.costo + b.costo + j.costo;
        return { id: c.id, etapa: c.estado, lead: String(c.mensaje_lead).slice(0, 120), sin: j.sin, con: j.con, viola_sin: j.viola_sin, viola_con: j.viola_con, resp_sin: a.texto.slice(0, 300), resp_con: b.texto.slice(0, 300) };
      } catch (e: any) { return { id: c.id, error: String(e?.message || e) }; }
    }));
    res.push(...parte);
  }
  const ok = res.filter(x => !x.error && x.sin && x.con);
  const prom = (k: 'sin' | 'con') => ok.length ? Math.round((ok.reduce((s, x) => s + x[k], 0) / ok.length) * 100) / 100 : null;
  const prueba = { n: ok.length, del_caso: deSuCaso, sin: prom('sin'), con: prom('con'), delta: prom('con') !== null && prom('sin') !== null ? Math.round((prom('con')! - prom('sin')!) * 100) / 100 : null, mejora_en: ok.filter(x => x.con > x.sin).length, empeora_en: ok.filter(x => x.con < x.sin).length, viola_sin: ok.filter(x => x.viola_sin).length, viola_con: ok.filter(x => x.viola_con).length, at: new Date().toISOString(), costo: Math.round(costo * 1000) / 1000, casos: res.slice(0, 30) };
  await supabase.from('ti_reglas').update({ prueba, updated_at: new Date().toISOString() }).eq('id', id);
  await supabase.from('ia_log').insert({ accion: 'regla_probada', razon: `${prueba.con} con vs ${prueba.sin} sin (n=${prueba.n})`, costo_usd: costo, detalle: { regla_id: id, delta: prueba.delta } }).then(() => {}, () => {});
  return { ok: true, prueba };
}

/* ── DECIDIR ── */
export async function decidirRegla(id: string, o: { decision: 'aprobar' | 'rechazar' | 'retirar' | 'editar'; texto?: string; nota?: string; userId?: string | null; forzar?: boolean }) {
  const { data: r } = await supabase.from('ti_reglas').select('*').eq('id', id).maybeSingle();
  if (!r) return { error: 'No existe' };
  const ahora = new Date().toISOString();
  if (o.decision === 'editar') {
    const t = String(o.texto || '').trim(); if (t.length < 12) return { error: 'La regla quedó muy corta' };
    await supabase.from('ti_reglas').update({ texto: t, version: (r.version || 1) + (r.estado === 'activa' ? 1 : 0), prueba: t !== r.texto ? null : r.prueba, updated_at: ahora }).eq('id', id);
    invalidarCaches(); return { ok: true };
  }
  if (o.decision === 'aprobar') {
    const t = String(o.texto || r.texto || '').trim(); if (t.length < 12) return { error: 'La regla no tiene texto' };
    if (r.prueba && r.prueba.delta !== null && r.prueba.delta < 0 && !o.forzar) return { error: `La prueba dice que EMPEORA (${r.prueba.con} con vs ${r.prueba.sin} sin). Si aun así la quieres, confirma con «forzar».`, empeora: true };
    await supabase.from('ti_reglas').update({ texto: t, estado: 'activa', activa_desde: ahora, decidida_por: o.userId || null, decidida_at: ahora, nota: o.nota || r.nota, retirada_at: null, updated_at: ahora }).eq('id', id);
    invalidarCaches();
    await supabase.from('ia_log').insert({ accion: 'regla_activada', razon: t.slice(0, 200), detalle: { regla_id: id, etapa: r.etapa, por: o.userId, prueba: r.prueba ? { con: r.prueba.con, sin: r.prueba.sin, n: r.prueba.n } : null } }).then(() => {}, () => {});
    return { ok: true, estado: 'activa' };
  }
  // rechazar (propuesta) o retirar (activa): las dos terminan en «retirada», que es la memoria de «ya lo decidí».
  await supabase.from('ti_reglas').update({ estado: 'retirada', retirada_at: ahora, decidida_por: o.userId || null, decidida_at: ahora, nota: o.nota || r.nota, updated_at: ahora }).eq('id', id);
  invalidarCaches();
  await supabase.from('ia_log').insert({ accion: o.decision === 'retirar' ? 'regla_retirada' : 'regla_rechazada', razon: String(r.texto || r.clave).slice(0, 200), detalle: { regla_id: id, por: o.userId, nota: o.nota || null } }).then(() => {}, () => {});
  return { ok: true, estado: 'retirada' };
}

/** Propuesta manual (el dueño o una sesión de Claude la escriben): entra como propuesta, se prueba y se aprueba en la Torre. */
export async function proponerRegla(o: { texto: string; etapa?: string | null; evidencias?: string[]; origen?: string; userId?: string | null; nota?: string }) {
  const t = String(o.texto || '').trim(); if (t.length < 12) return { error: 'Texto muy corto' };
  const { data, error } = await supabase.from('ti_reglas').insert({ clave: 'regla_guion', valor: { id: `manual:${Date.now()}`, evidencias: o.evidencias || [] }, evidencia: { origen: o.origen || 'manual' }, estado: 'propuesta', texto: t, etapa: o.etapa || null, alcance: o.etapa ? 'etapa' : 'global', origen: o.origen || 'manual', nota: o.nota || null, decidida_por: null }).select('id').single();
  if (error) return { error: error.message };
  return { ok: true, id: data.id };
}

/** Del patrón (nightly) a propuesta con texto: redacta con Opus las que aún no tienen texto. */
export async function redactarPropuestasPendientes(limite = 4) {
  const { data: sin } = await supabase.from('ti_reglas').select('id, valor, evidencia').eq('clave', 'regla_guion').eq('estado', 'propuesta').is('texto', null).order('created_at', { ascending: false }).limit(limite);
  let n = 0, costo = 0;
  for (const r of sin || []) {
    const etapa = String((r.valor as any)?.estado || 'descubriendo');
    const { data: corr } = await supabase.from('ia_ejemplos').select('mensaje_lead, pulida, por_que, fuente').eq('estado', etapa).in('fuente', ['correccion_dueno', 'correccion_implicita', 'rechazo_consultor']).order('created_at', { ascending: false }).limit(8);
    const muestras = (corr || []).map(c => ({ mensaje_lead: c.mensaje_lead, pulida: c.pulida, por_que: c.por_que, fuente: c.fuente, original: (String(c.por_que || '').match(/Original:\s*([\s\S]{0,320})/) || [])[1] || (String(c.por_que || '').match(/había (?:propuesto|dicho):\s*([\s\S]{0,320})/) || [])[1] || null }));
    if (muestras.length < 2) continue;
    const red = await redactarReglaConIA({ etapa, muestras }).catch(() => null);
    if (!red) continue;
    costo += red.costo;
    await supabase.from('ti_reglas').update({ texto: red.regla, etapa, alcance: red.alcance, origen: 'patron', valor: { ...(r.valor as any), evidencias: red.evidencias }, updated_at: new Date().toISOString() }).eq('id', r.id);
    n++;
  }
  return { redactadas: n, costo };
}
