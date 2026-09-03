/**
 * SEGUIMIENTO · paridad 9/10 antes de la autonomía (decisión del dueño, 2026-09-03).
 *
 * Mientras el agente está en entrenamiento (cfg.agente_modo === 'sombra'), TODO lo que redacta para un lead
 * real nace como «sugerencia»: aparece en el panel Seguimiento y, en el inbox, como compuerta encima del
 * compositor. El consultor tiene que decidir: enviar tal cual (10), enviar con modificaciones (según cuánto
 * cambió) o rechazar con razón (0). Si contestó por su cuenta desde el teléfono, la respuesta humana se
 * compara igual (decisión «humano»). Cada decisión es una calificación y una lección para el redactor.
 *
 * Promedio de las últimas `paridad_ventana` (100) ≥ `paridad_meta` (9.0) ⇒ se ABRE el botón «Activar respuestas
 * automáticas» (nada cambia solo: el dueño lo enciende). En vivo responde solo todos los WhatsApps. Los números de prueba (agente_prueba_telefonos) siguen recibiendo el flujo en vivo.
 */
import { supabase } from '../../supabase';
import { leerConfig } from './motor';

export const META_DEFAULT = 9;
export const VENTANA_DEFAULT = 100;   // decisión del dueño 3-sep: 100 respuestas, no 300

const norm = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
/** Parecido entre dos textos (Dice sobre bigramas de caracteres, 0..1). Barato y estable para mensajes cortos. */
export function similitud(a: string, b: string): number {
  const A = norm(a), B = norm(b);
  if (!A && !B) return 1; if (!A || !B) return 0; if (A === B) return 1;
  const gr = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const ga = gr(A), gb = gr(B); let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) || 0);
  return (2 * inter) / Math.max(1, (A.length - 1) + (B.length - 1));
}
/** Escala de la calificación: tal cual 10 · rechazo 0 · cambios según cuánto quedó del original. */
export function calificacionPor(decision: 'enviar' | 'modificar' | 'rechazar' | 'humano', sim: number | null): number {
  if (decision === 'enviar') return 10;
  if (decision === 'rechazar') return 0;
  const s = Number(sim ?? 0);
  return s >= 0.9 ? 9 : s >= 0.75 ? 8 : s >= 0.6 ? 6 : s >= 0.4 ? 4 : 2;
}

export async function paridad(cfgIn?: any) {
  const cfg: any = cfgIn || await leerConfig();
  const meta = Number(cfg.paridad_meta) > 0 ? Number(cfg.paridad_meta) : META_DEFAULT;
  const ventana = Number(cfg.paridad_ventana) > 0 ? Number(cfg.paridad_ventana) : VENTANA_DEFAULT;
  const { data } = await supabase.from('ti_calificaciones').select('id, decision, calificacion, usuario_id, created_at').order('created_at', { ascending: false }).limit(ventana);
  const filas = data || [];
  const n = filas.length;
  const suma = filas.reduce((s, f) => s + Number(f.calificacion || 0), 0);
  const promedio = n ? Math.round((suma / n) * 100) / 100 : null;
  const cuenta = (d: string) => filas.filter(f => f.decision === d).length;
  const rec = filas.slice(0, 50), ant = filas.slice(50, 100);
  const prom = (xs: any[]) => xs.length ? xs.reduce((s, f) => s + Number(f.calificacion || 0), 0) / xs.length : null;
  const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
  const porUsuario: Record<string, { n: number; suma: number }> = {};
  for (const f of filas) { const k = f.usuario_id || 'sin_usuario'; porUsuario[k] = porUsuario[k] || { n: 0, suma: 0 }; porUsuario[k].n++; porUsuario[k].suma += Number(f.calificacion || 0); }
  const ids = Object.keys(porUsuario).filter(k => k !== 'sin_usuario');
  const { data: tm } = ids.length ? await supabase.from('team_members').select('id, nombre').in('id', ids) : { data: [] as any[] };
  return {
    meta, ventana, n, promedio, faltan: Math.max(0, ventana - n), llena: n >= ventana,
    alcanzada: n >= ventana && promedio !== null && promedio >= meta,
    tal_cual: cuenta('enviar'), modificadas: cuenta('modificar'), rechazadas: cuenta('rechazar'), humano: cuenta('humano'),
    hoy: filas.filter(f => new Date(f.created_at) >= hoy0).length,
    tendencia: { reciente: prom(rec), anterior: prom(ant) },
    por_usuario: Object.entries(porUsuario).map(([id, v]) => ({ id, nombre: (tm || []).find((t: any) => t.id === id)?.nombre || (id === 'sin_usuario' ? 'Desde el teléfono' : 'Consultor'), n: v.n, promedio: Math.round((v.suma / v.n) * 10) / 10 })).sort((a, b) => b.n - a.n),
    modo: cfg.agente_modo || 'sombra', alcanzada_at: cfg.paridad_alcanzada_at || null, lista_at: cfg.paridad_lista_at || null, pruebas: (cfg.agente_prueba_telefonos || []).length,
  };
}

/** Ventana llena y promedio en la meta ⇒ se marca «lista» UNA vez y se avisa. NO cambia el modo: el dueño enciende el
 *  botón «Activar respuestas automáticas» (decisión 3-sep: que se abra el botón, no que se active solo). */
export async function revisarParidad(): Promise<{ cambio: boolean; lista: boolean; paridad: any }> {
  const cfg: any = await leerConfig();
  const p = await paridad(cfg);
  if (!p.alcanzada || (cfg.agente_modo || 'sombra') === 'vivo' || cfg.paridad_lista_at) return { cambio: false, lista: !!p.alcanzada, paridad: p };
  const ahora = new Date().toISOString();
  await supabase.from('ti_config').update({ valor: { ...cfg, paridad_lista_at: ahora } }).eq('id', 1);
  await supabase.from('ia_log').insert({ accion: 'paridad_lista', razon: `paridad ${p.promedio}/10 en ${p.n} respuestas (meta ${p.meta})`, detalle: p }).then(() => {}, () => {});
  try {
    const { avisoSistema } = await import('./agente');
    await avisoSistema({ tipo: 'paridad_lista', nivel: 'info', clave: `paridad_lista:${ahora.slice(0, 10)}`, titulo: `El agente llegó a ${p.promedio}/10 en las últimas ${p.n} respuestas`, detalle: `Tal cual ${p.tal_cual} · modificadas ${p.modificadas} · rechazadas ${p.rechazadas}. Ya puedes activar las respuestas automáticas; hasta entonces sigue pasando todo por un consultor.`, que_hacer: 'Trabajo inteligente → Seguimiento → botón «Activar respuestas automáticas».' });
  } catch { /* el aviso no detiene nada */ }
  return { cambio: false, lista: true, paridad: p };
}

type Decision = { decision: 'enviar' | 'modificar' | 'rechazar'; mensaje?: string; adjuntos?: any[]; motivo?: string; detalle?: string; userId?: string | null };

/** La decisión del consultor sobre una sugerencia. Enviar/modificar mandan de verdad (por el despachador del agente). */
export async function decidirSugerencia(envioId: string, o: Decision): Promise<any> {
  const { data: e } = await supabase.from('ti_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e) return { error: 'La sugerencia ya no existe' };
  if (!['sugerencia', 'pendiente'].includes(e.estado)) return { error: `Esa sugerencia ya está ${e.estado}` };
  const ahora = new Date().toISOString();
  const estadoGuion = (e.salida as any)?.estado || 'descubriendo';
  const mensajeLead = (e.salida as any)?.ultimo_mensaje || null;
  const base = { envio_id: e.id, contact_id: e.contact_id, conversation_id: e.conversation_id, usuario_id: o.userId || null, origen: e.origen, estado_guion: estadoGuion, mensaje_sugerido: e.mensaje };

  if (o.decision === 'rechazar') {
    const motivo = String(o.motivo || '').trim().slice(0, 200); const detalle = String(o.detalle || '').trim().slice(0, 600);
    if (!motivo) return { error: 'Di por qué se rechaza: eso es lo que aprende' };
    await supabase.from('ti_envios').update({ estado: 'vetado', vetado_por: o.userId || null, motivo_veto: [motivo, detalle].filter(Boolean).join(': ').slice(0, 300), revisado_at: ahora, updated_at: ahora }).eq('id', e.id);
    // Lección negativa: NO entra al bloque «así se contesta» (estado_rev rechazado); la lee el bloque de rechazos y el ciclo nocturno.
    await supabase.from('ia_ejemplos').insert({ estado: estadoGuion, situacion: `Rechazo del consultor a una sugerencia del agente (${e.origen})`, mensaje_lead: mensajeLead, respuesta: e.mensaje, pulida: e.mensaje, por_que: `EVITAR: ${[motivo, detalle].filter(Boolean).join(' · ')}`, fuente: 'rechazo_consultor', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'rechazado', revisado_at: ahora, adjuntos: e.adjuntos || [] }).then(() => {}, () => {});
    await supabase.from('ia_log').insert({ accion: 'agente_vetado', contact_id: e.contact_id, razon: [motivo, detalle].filter(Boolean).join(': '), contenido: e.mensaje, detalle: { envio_id: e.id, por: o.userId || null, sugerencia: true } }).then(() => {}, () => {});
    await supabase.from('ti_calificaciones').insert({ ...base, decision: 'rechazar', calificacion: 0, similitud: null, mensaje_final: null, motivo, detalle: detalle || null });
    const par = await revisarParidad();
    return { ok: true, decision: 'rechazar', calificacion: 0, paridad: par.paridad };
  }

  let mensaje = e.mensaje as string; let sim: number | null = null; let adjuntos: any[] = Array.isArray(e.adjuntos) ? e.adjuntos : [];
  if (o.decision === 'modificar') {
    mensaje = String(o.mensaje || '').trim();
    if (mensaje.length < 2) return { error: 'El mensaje está vacío' };
    if (Array.isArray(o.adjuntos)) adjuntos = o.adjuntos.slice(0, 5).map((a: any) => ({ id: a.id || null, tipo: a.tipo || 'image', url: a.url, nombre: a.nombre || 'Adjunto' })).filter(a => a.url);
    const mismoTexto = norm(mensaje) === norm(e.mensaje);
    const mismosAdj = JSON.stringify((e.adjuntos || []).map((a: any) => a.url)) === JSON.stringify(adjuntos.map(a => a.url));
    if (mismoTexto && mismosAdj) o.decision = 'enviar';                       // no cambió nada: cuenta como tal cual
    else {
      sim = mismoTexto ? 0.95 : similitud(e.mensaje, mensaje);
      const img = adjuntos.find(a => a.tipo === 'image') || null;
      await supabase.from('ti_envios').update({ mensaje, mensaje_original: e.mensaje_original || e.mensaje, editado_por: o.userId || null, adjuntos, imagen_id: img?.id || null, imagen_url: img?.url || null, updated_at: ahora }).eq('id', e.id);
      const criterio = String(o.detalle || '').trim().slice(0, 600);
      await supabase.from('ia_ejemplos').insert({ estado: estadoGuion, situacion: `El consultor corrigió la sugerencia del agente antes de mandarla (${e.origen})`, mensaje_lead: mensajeLead, respuesta: mensaje, pulida: mensaje, adjuntos, imagen_id: img?.id || null, por_que: `${criterio ? `CRITERIO: ${criterio}\n` : ''}El consultor corrigió al agente. Original: ${e.mensaje}`, fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'aprobado', revisado_at: ahora }).then(() => {}, () => {});
      await supabase.from('ia_log').insert({ accion: 'correccion_dueno', contact_id: e.contact_id, contenido: mensaje, razon: 'modificación en Seguimiento', detalle: { envio_id: e.id, original: e.mensaje, criterio: criterio || null, similitud: sim } }).then(() => {}, () => {});
    }
  }
  // Sale de verdad: la aprobación de una persona es el permiso aunque el agente esté en entrenamiento.
  await supabase.from('ti_envios').update({ estado: 'pendiente', sale_at: ahora, aprobado_por: o.userId || null, revisado_at: ahora, updated_at: ahora }).eq('id', e.id);
  let enviado = false; let errorEnvio: string | null = null;
  try {
    const { despacharEnvios } = await import('./agente');
    const r = await despacharEnvios({ forzar: true, soloId: e.id });
    enviado = Number(r?.enviados) === 1;
    if (!enviado) { const { data: e2 } = await supabase.from('ti_envios').select('estado, error').eq('id', e.id).maybeSingle(); errorEnvio = e2?.error || (e2?.estado && e2.estado !== 'enviado' ? `quedó ${e2.estado}` : null); enviado = e2?.estado === 'enviado'; }
  } catch (err: any) { errorEnvio = String(err?.message || err); }
  if (!enviado) {
    // No se manda = no se califica. Se regresa a sugerencia para que no se pierda ni se cuente.
    await supabase.from('ti_envios').update({ estado: 'sugerencia', aprobado_por: null, updated_at: new Date().toISOString() }).eq('id', e.id).eq('estado', 'pendiente');
    return { error: `No se pudo enviar: ${errorEnvio || 'sin detalle'}` };
  }
  const cal = calificacionPor(o.decision, sim);
  await supabase.from('ti_calificaciones').insert({ ...base, decision: o.decision, calificacion: cal, similitud: sim, mensaje_final: mensaje, adjuntos, detalle: o.detalle ? String(o.detalle).slice(0, 600) : null });
  const par = await revisarParidad();
  return { ok: true, decision: o.decision, calificacion: cal, similitud: sim, enviado: true, paridad: par.paridad, lista: par.lista };
}

/** El humano contestó por su cuenta (teléfono, otra sesión): la sugerencia se compara y califica sola. */
export async function calificarHumano(e: { id: string; contact_id: string | null; conversation_id: string | null; origen?: string | null; mensaje: string; salida?: any }, humano: { texto: string; at: string; adjuntos?: any[] }) {
  const sim = similitud(e.mensaje, humano.texto);
  const cal = calificacionPor('humano', sim);
  await supabase.from('ti_calificaciones').insert({ envio_id: e.id, contact_id: e.contact_id, conversation_id: e.conversation_id, usuario_id: null, origen: e.origen || null, estado_guion: e.salida?.estado || null, decision: 'humano', calificacion: cal, similitud: sim, mensaje_sugerido: e.mensaje, mensaje_final: humano.texto, adjuntos: humano.adjuntos || [], motivo: 'El consultor contestó por su cuenta antes de decidir la sugerencia' }).then(() => {}, () => {});
  await revisarParidad().catch(() => {});
  return { calificacion: cal, similitud: sim };
}

/** Barrido de sugerencias: el humano contestó (se califica como «humano»), o lleva >3 días sin decisión (expira, sin calificar). */
export async function barrerSugerencias() {
  const { data: sug } = await supabase.from('ti_envios').select('id, contact_id, conversation_id, origen, mensaje, salida, created_at').eq('estado', 'sugerencia').order('created_at', { ascending: true }).limit(200);
  const res = { humano: 0, expiradas: 0 };
  const limite = Date.now() - 3 * 864e5;
  for (const e of sug || []) {
    let h: { texto: string; at: string; adjuntos?: any[] } | null = null;
    if (e.conversation_id) {
      const { data } = await supabase.from('wa_mensajes').select('cuerpo, created_at, metadata, autor, tipo, media_url').eq('conversation_id', e.conversation_id).eq('direccion', 'saliente').gt('created_at', e.created_at).is('borrado_at', null).order('created_at', { ascending: true }).limit(6);
      const humanos = (data || []).filter(x => (x.metadata as any)?.origen !== 'agente' && x.autor !== 'Agenda');
      const m = humanos.find(x => String(x.cuerpo || '').trim().length >= 4);
      // Lo que mandó el consultor por su cuenta se guarda completo: texto Y las imágenes/PDF que adjuntó (son parte de la lección).
      const adjuntos = humanos.filter(x => x.media_url).map(x => ({ id: null, tipo: /video/.test(String(x.tipo || '')) ? 'video' : /image|imagen|sticker/.test(String(x.tipo || '')) ? 'image' : 'document', url: x.media_url, nombre: String(x.tipo || 'archivo') })).slice(0, 5);
      if (m) h = { texto: String(m.cuerpo).trim(), at: m.created_at, adjuntos };
    }
    if (h) {
      await supabase.from('ti_envios').update({ estado: 'humano_respondio', humano_respuesta: h.texto, humano_at: h.at, updated_at: new Date().toISOString() }).eq('id', e.id).eq('estado', 'sugerencia');
      await calificarHumano(e as any, h); res.humano++;
      // Ejemplo «dudoso» para que el dueño lo apruebe o descarte en Informes → Biblioteca (igual que el par agente/humano de siempre).
      await supabase.from('ia_ejemplos').insert({ estado: (e.salida as any)?.estado || 'descubriendo', situacion: 'El consultor contestó por su cuenta en vez de decidir la sugerencia del agente', mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: h.texto, pulida: h.texto, adjuntos: h.adjuntos || [], por_que: `Par agente/humano · envio:${e.id} · el agente había propuesto: ${String(e.mensaje).slice(0, 300)}`, fuente: 'humano_antes', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'dudoso' }).then(() => {}, () => {});
    } else if (Date.parse(e.created_at) < limite) {
      await supabase.from('ti_envios').update({ estado: 'expirado', motivo_veto: 'sugerencia sin decisión en 3 días', updated_at: new Date().toISOString() }).eq('id', e.id).eq('estado', 'sugerencia'); res.expiradas++;
    }
  }
  return res;
}

/** Cola del panel: sugerencias por decidir, con quién es el lead. */
export async function sugerenciasPendientes(limit = 60) {
  const { data: sug } = await supabase.from('ti_envios').select('id, contact_id, conversation_id, telefono, origen, mensaje, adjuntos, imagen_url, salida, created_at, sale_at').eq('estado', 'sugerencia').order('created_at', { ascending: true }).limit(limit);
  const ids = [...new Set((sug || []).map(s => s.contact_id).filter(Boolean))] as string[];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, email, lifecycle_stage, giro, company_id, companies(nombre_comercial, nombre)').in('id', ids) : { data: [] as any[] };
  return (sug || []).map(s => { const c: any = (cs || []).find((x: any) => x.id === s.contact_id) || {}; const sal: any = s.salida || {}; return { ...s, salida: undefined, ultimo_mensaje: sal.ultimo_mensaje || null, ultimos_mensajes: sal.ultimos_mensajes || [], objetivo: sal.objetivo || null, estado_guion: sal.estado || null, interes: sal.interes || null, contacto: { nombre: c.nombre || null, email: c.email || null, etapa: c.lifecycle_stage || null, giro: c.giro || null, empresa: c.companies?.nombre_comercial || c.companies?.nombre || null } }; });
}

export async function historialCalificaciones(limit = 60) {
  const { data } = await supabase.from('ti_calificaciones').select('id, envio_id, contact_id, conversation_id, usuario_id, decision, calificacion, similitud, mensaje_sugerido, mensaje_final, motivo, detalle, origen, created_at').order('created_at', { ascending: false }).limit(limit);
  const cids = [...new Set((data || []).map(d => d.contact_id).filter(Boolean))] as string[];
  const uids = [...new Set((data || []).map(d => d.usuario_id).filter(Boolean))] as string[];
  const [{ data: cs }, { data: us }] = await Promise.all([
    cids.length ? supabase.from('contacts').select('id, nombre').in('id', cids) : Promise.resolve({ data: [] as any[] }),
    uids.length ? supabase.from('team_members').select('id, nombre').in('id', uids) : Promise.resolve({ data: [] as any[] }),
  ]);
  return (data || []).map(d => ({ ...d, contacto: (cs || []).find((c: any) => c.id === d.contact_id)?.nombre || null, usuario: (us || []).find((u: any) => u.id === d.usuario_id)?.nombre || null }));
}
