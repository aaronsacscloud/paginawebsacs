// DEMAND ENGINE · LA COLA.
//
// Un solo carril para todo el trabajo del motor. Existe por cuatro razones
// concretas, todas medidas en este repo:
//
//  1. Cada despliegue de Vercel PARA los crons. Si el trabajo vive dentro de
//     una función, se pierde; si vive en una tabla, el siguiente worker lo
//     retoma donde iba.
//  2. Un ciclo que corre dos veces no puede duplicar contenido ni
//     oportunidades: por eso todo entra con `clave_idem`.
//  3. El dueño tiene que PODER VER y aprobar lo que el motor va a hacer antes
//     de que lo haga. Una cola en memoria no se puede aprobar.
//  4. Un fallo de Reddit no puede detener a Search Console: cada trabajo es su
//     propia fila y su propio fracaso.
import { supabase } from '../supabase';
import { notificar } from '../crm/notificaciones';
import { leerConfig } from './config';
import { veredicto, politicaDe, corridasHoy } from './politicas';
import type { Accion, EntradaAccion, Config } from './tipos';

const iso = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString());

export type Encolada = { id: string | null; estado: string; nueva: boolean; motivo?: string | null };

/**
 * Deja trabajo en la cola. Idempotente por `clave_idem`: encolar dos veces lo
 * mismo devuelve la acción que ya estaba, no crea otra.
 *
 * Devuelve `id: null` cuando la acción NO se encoló porque su tipo ya agotó el
 * tope del día. No es un error: es el tope haciendo su trabajo.
 */
export async function encolar(e: EntradaAccion, cfg?: Config): Promise<Encolada> {
  const c = cfg || await leerConfig();

  // El kill switch corta lo que ESCRIBE. Se puede seguir leyendo y mirando.
  if (c.kill_switch) return { id: null, estado: 'cancelada', nueva: false, motivo: 'Motor apagado (kill switch).' };

  const existente = await supabase
    .from('de_acciones').select('id, estado').eq('clave_idem', e.clave_idem).maybeSingle();
  if (existente.data) return { id: existente.data.id, estado: existente.data.estado, nueva: false };

  const p = await politicaDe(e.tipo);
  if (p.tope_dia != null) {
    const hoy = await corridasHoy(e.tipo);
    if (hoy >= p.tope_dia)
      return { id: null, estado: 'cancelada', nueva: false, motivo: `Tope diario de ${e.tipo} (${p.tope_dia}) alcanzado.` };
  }

  const v = await veredicto(e.tipo, c);
  // Con dependencia sin terminar nace 'pendiente'; el RPC la promueve sola.
  const estado = e.depende_de && v.estado === 'lista' ? 'pendiente' : v.estado;

  const { data, error } = await supabase.from('de_acciones').insert({
    clave_idem: e.clave_idem,
    tipo: e.tipo,
    prioridad: e.prioridad ?? 50,
    estado,
    payload: e.payload || {},
    agente: e.agente || null,
    max_intentos: v.max_intentos,
    programada_at: e.programada_at ? iso(e.programada_at) : new Date().toISOString(),
    depende_de: e.depende_de || null,
    ciclo_id: e.ciclo_id || null,
    riesgo: v.riesgo,
    nivel_requerido: v.nivel,
    creada_por: e.creada_por || 'motor',
    motivo: e.motivo || v.motivo,
  }).select('id, estado').single();

  // Carrera: dos workers encolando lo mismo a la vez. El índice único es el
  // árbitro; el perdedor lee la fila del ganador en vez de reventar.
  if (error) {
    const ya = await supabase.from('de_acciones').select('id, estado').eq('clave_idem', e.clave_idem).maybeSingle();
    if (ya.data) return { id: ya.data.id, estado: ya.data.estado, nueva: false };
    throw new Error(`[cola] no se pudo encolar ${e.tipo}: ${error.message}`);
  }

  if (estado === 'necesita_aprobacion') {
    await notificar({
      clave: `de_aprobacion:${data.id}`, tipo: 'demanda_aprobacion', nivel: 'alerta',
      titulo: 'El motor de demanda espera tu visto bueno',
      detalle: `${e.tipo} · ${v.motivo || 'requiere aprobación'}`,
      destino: 'de-sistema',
    });
  }
  return { id: data.id, estado: data.estado, nueva: true };
}

/** Encola varias y devuelve cuántas quedaron realmente. */
export async function encolarVarias(es: EntradaAccion[], cfg?: Config): Promise<{ nuevas: number; repetidas: number; frenadas: number }> {
  const c = cfg || await leerConfig();
  let nuevas = 0, repetidas = 0, frenadas = 0;
  for (const e of es) {
    try {
      const r = await encolar(e, c);
      if (!r.id) frenadas++; else if (r.nueva) nuevas++; else repetidas++;
    } catch { frenadas++; }
  }
  return { nuevas, repetidas, frenadas };
}

/** Toma trabajo con candado (el RPC libera leases vencidos y promueve las que
 *  esperaban dependencia). Dos workers simultáneos nunca toman lo mismo. */
export async function tomar(n = 5, leaseSeg = 600): Promise<Accion[]> {
  const { data, error } = await supabase.rpc('de_tomar_acciones', { n, lease_seg: leaseSeg });
  if (error) throw new Error(`[cola] no se pudo tomar trabajo: ${error.message}`);
  return (data || []) as Accion[];
}

export async function terminar(id: string, resultado: any, costo = 0): Promise<void> {
  await supabase.from('de_acciones').update({
    estado: 'terminada', terminada_at: new Date().toISOString(), lease_hasta: null,
    resultado: resultado ?? {}, costo_usd: costo, error: null, updated_at: new Date().toISOString(),
  }).eq('id', id);
}

/** Espera creciente, con techo: 5 min, 10, 20, 40… hasta 6 horas. Reintentar
 *  cada minuto contra una API caída es la forma más rápida de que te bloqueen. */
const espera = (intentos: number) => Math.min(5 * 60 * 1000 * 2 ** Math.max(0, intentos - 1), 6 * 60 * 60 * 1000);

/**
 * Marca el fallo y decide si se vuelve a intentar.
 *
 * `definitivo` corta el reintento de raíz: si falta una credencial, insistir
 * ocho veces no la va a traer — solo gasta cuota y ensucia la bitácora.
 */
export async function fallar(a: Accion, err: any, definitivo = false): Promise<'reintenta' | 'muerta'> {
  const mensaje = String(err?.message || err || 'error desconocido').slice(0, 800);
  const agotada = definitivo || a.intentos >= a.max_intentos;
  const parche: any = {
    error: { mensaje, definitivo, intento: a.intentos, at: new Date().toISOString() },
    lease_hasta: null, updated_at: new Date().toISOString(),
  };
  if (agotada) {
    parche.estado = 'muerta';
    parche.terminada_at = new Date().toISOString();
  } else {
    parche.estado = 'lista';
    parche.programada_at = new Date(Date.now() + espera(a.intentos)).toISOString();
  }
  await supabase.from('de_acciones').update(parche).eq('id', a.id);

  if (agotada) {
    // Una acción muerta en silencio es un agujero que nadie ve durante semanas.
    await notificar({
      clave: `de_muerta:${a.id}`, tipo: 'demanda_fallo', nivel: 'alerta',
      titulo: `El motor no pudo completar «${a.tipo}»`,
      detalle: `${mensaje} · ${a.intentos} intento(s)`, destino: 'de-sistema',
    });
  }
  return agotada ? 'muerta' : 'reintenta';
}

/** El dueño aprueba o rechaza desde el CRM. */
export async function resolverAprobacion(id: string, aprobar: boolean, quien: string | null, motivo?: string): Promise<void> {
  await supabase.from('de_acciones').update({
    estado: aprobar ? 'lista' : 'rechazada',
    aprobada_por: quien, aprobada_at: new Date().toISOString(),
    motivo: motivo || null, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('estado', 'necesita_aprobacion');
}

export async function resumenCola(): Promise<Record<string, number>> {
  const { data } = await supabase.from('de_acciones').select('estado');
  const r: Record<string, number> = {};
  for (const f of data || []) r[f.estado] = (r[f.estado] || 0) + 1;
  return r;
}
