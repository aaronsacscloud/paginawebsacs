/**
 * REGENERACIÓN INMEDIATA (decisión del dueño, 2026-09-07): una mejora del consultor tiene que pesar YA en lo que está en la
 * fila, no solo en lo que se redacte después.
 *
 *   · El consultor modifica una sugerencia dejando criterio o marcando qué cambió → las demás sugerencias del mismo tipo
 *     (mismo origen: seguimiento, reenganche, silencio, respuesta…) se marcan para reescribirse.
 *   · Se aprueba o edita una regla activa → TODAS las sugerencias pendientes se marcan.
 *   · El observador reescribe hasta 12 por tick (cada 2 min) con el guion, las reglas y los ejemplos ya actualizados.
 *   · La tarjeta que el consultor tiene enfrente trae «Reescribir ahora» para no esperar ni esos dos minutos.
 *
 * La sugerencia conserva su id y su lugar en la fila: solo cambia el texto (y se guarda el anterior, por si el nuevo es
 * peor). La plantilla, si la había, se conserva: sus parámetros se arman al salir.
 */
import { supabase } from '../../supabase';

const ORIGEN_L: Record<string, string> = { respuesta: 'respuesta a su mensaje', seguimiento: 'seguimiento de 1 a 4 días', silencio: 'toque por silencio', reenganche: 'reenganche de un lead que reconectó', reactivacion: 'reactivación tras meses', cotizacion: 'seguimiento de cotización', preparacion: 'preparación de la demo', cita: 'seguimiento de la cita', compromiso: 'mensaje del día que él pidió', contratacion: 'contratación' };

/** Marca sugerencias pendientes para reescribirlas. `origen` acota al mismo tipo; sin origen, todas. */
export async function marcarParaRegenerar(o: { origen?: string | null; motivo: string; exceptoId?: string | null; max?: number }): Promise<{ marcadas: number }> {
  let q = supabase.from('ti_envios').select('id, salida').eq('estado', 'sugerencia').order('created_at', { ascending: true }).limit(o.max ?? 40);
  if (o.origen) q = q.eq('origen', o.origen);
  const { data } = await q;
  const ahora = new Date().toISOString(); let n = 0;
  for (const e of data || []) {
    if (o.exceptoId && e.id === o.exceptoId) continue;
    await supabase.from('ti_envios').update({ salida: { ...((e.salida as any) || {}), regenerar: { motivo: String(o.motivo).slice(0, 240), at: ahora } }, updated_at: ahora }).eq('id', e.id).eq('estado', 'sugerencia');
    n++;
  }
  if (n) await supabase.from('ia_log').insert({ accion: 'regenerar_marcadas', razon: `${n} sugerencia(s)${o.origen ? ` de ${o.origen}` : ''} · ${String(o.motivo).slice(0, 160)}` }).then(() => {}, () => {});
  return { marcadas: n };
}

/** Reescribe UNA sugerencia con el guion/reglas/ejemplos de ahora. Conserva id, lugar en la fila y plantilla. */
export async function regenerarSugerencia(envioId: string, motivoExtra?: string | null): Promise<{ ok: boolean; mensaje?: string; anterior?: string; error?: string; costo?: number }> {
  const { data: e } = await supabase.from('ti_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e) return { ok: false, error: 'La sugerencia ya no existe' };
  if (e.estado !== 'sugerencia') return { ok: false, error: `Ya está ${e.estado}` };
  if (!e.contact_id) return { ok: false, error: 'Sin contacto' };
  const s: any = e.salida || {};
  const motivo = motivoExtra || s.regenerar?.motivo || 'mejora reciente del consultor';
  const tipo = ORIGEN_L[String(e.origen)] || String(e.origen || 'mensaje');
  const contexto = [
    s.objetivo ? `Propósito que tenía: ${String(s.objetivo).slice(0, 200)}.` : '',
    s.seguimiento?.label ? `Situación: ${s.seguimiento.label}${s.seguimiento.resumen ? ` (${String(s.seguimiento.resumen).slice(0, 200)})` : ''}.` : '',
    s.toque ? `Es el toque ${s.toque} del ciclo ${s.ciclo || 1}.` : '',
    s.compromiso?.pidio ? `El lead había pedido: «${s.compromiso.pidio}».` : '',
  ].filter(Boolean).join(' ');
  const nota = `REESCRITURA: este ${tipo} ya estaba redactado y se vuelve a escribir porque el consultor acaba de dejar una lección nueva (${motivo}). Mismo tipo de mensaje y mismo propósito${contexto ? `. ${contexto}` : ''}. Aplica las REGLAS VIGENTES y los EJEMPLOS APROBADOS tal como están ahora; si la lección nueva aplica a este lead, que se note. Versión anterior, para no repetirla palabra por palabra: «${String(e.mensaje || '').slice(0, 500)}».`;
  try {
    const { decidirTurno } = await import('./agente');
    const d = await decidirTurno(e.contact_id, nota, { tarea: String(e.origen || 'respuesta') });
    const ahora = new Date().toISOString();
    if (!d.salida?.mensaje || d.salida.responder === false) {
      await supabase.from('ti_envios').update({ salida: { ...s, regenerar: null, regeneracion_error: d.motivo || 'el agente no propuso mensaje' }, updated_at: ahora }).eq('id', envioId);
      return { ok: false, error: d.motivo || 'el agente no propuso mensaje', costo: d.costo };
    }
    const nuevo = String(d.salida.mensaje).trim();
    const historial = Array.isArray(s.regeneraciones) ? s.regeneraciones : [];
    await supabase.from('ti_envios').update({
      mensaje: nuevo, adjuntos: d.salida.adjuntos || [], imagen_id: d.salida.imagen?.id || null, imagen_url: d.salida.imagen?.url || null,
      mensaje_original: null, editado_por: null,
      salida: { ...s, ...d.salida, regenerar: null, regeneracion_error: null, regenerado: { at: ahora, motivo: String(motivo).slice(0, 240), anterior: String(e.mensaje || '').slice(0, 1500) }, regeneraciones: [...historial, { at: ahora, motivo: String(motivo).slice(0, 120) }].slice(-5) },
      costo_usd: Number(e.costo_usd || 0) + Number(d.costo || 0), updated_at: ahora,
    }).eq('id', envioId).eq('estado', 'sugerencia');
    await supabase.from('ia_log').insert({ accion: 'sugerencia_regenerada', contact_id: e.contact_id, razon: String(motivo).slice(0, 200), contenido: nuevo, costo: d.costo, detalle: { envio_id: envioId, origen: e.origen, anterior: String(e.mensaje || '').slice(0, 400) } }).then(() => {}, () => {});
    return { ok: true, mensaje: nuevo, anterior: String(e.mensaje || ''), costo: d.costo };
  } catch (err: any) {
    await supabase.from('ti_envios').update({ salida: { ...s, regenerar: null, regeneracion_error: String(err?.message || err).slice(0, 200) }, updated_at: new Date().toISOString() }).eq('id', envioId);
    return { ok: false, error: String(err?.message || err).slice(0, 200) };
  }
}

/** Observador: reescribe las marcadas, las más viejas primero, `max` por tick. */
export async function regenerarPendientes(max = 12): Promise<{ regeneradas: number; fallidas: number; costo: number; quedan: number }> {
  const res = { regeneradas: 0, fallidas: 0, costo: 0, quedan: 0 };
  const { data } = await supabase.from('ti_envios').select('id').eq('estado', 'sugerencia').not('salida->regenerar', 'is', null).order('created_at', { ascending: true }).limit(max + 1);
  const lista = data || [];
  for (const e of lista.slice(0, max)) {
    const r = await regenerarSugerencia(e.id);
    if (r.ok) res.regeneradas++; else res.fallidas++;
    res.costo += Number(r.costo || 0);
  }
  res.quedan = Math.max(0, lista.length - max);
  return res;
}
