/* ══ A QUIÉN NO SE LE VUELVE A LLAMAR (Mejora CRM #1, 22-sep-2026) ══════════
 *
 * Regla del dueño: «si un lead ha sido descalificado previamente en cualquier
 * momento, no debe volver a ser incluido automáticamente en ninguna lista,
 * cola o proceso de llamadas, independientemente de cuál sea su estatus
 * actual».
 *
 * Por eso aquí NO se mira `lifecycle_stage`: la etapa se mueve sola (la
 * reactivación la regresa a `lead`) y en cuanto dejaba de decir
 * «descalificado» el lead volvía a la lista. Se mira el SELLO
 * `contacts.descalificado_at`, que pone la base al descalificar y que nada
 * borra (migración 2026-09-22-descalificado-no-llamar.sql). Sólo una persona
 * lo levanta, a propósito, desde la ficha (`descalificado_levantado_at`).
 *
 * Se compara por contacto Y por número: el mismo teléfono puede venir como
 * cuenta del ABM (sin contact_id) o como un contacto duplicado.
 */
import { supabase } from '../supabase';

export type Veto = { motivo: 'descalificado' | 'no_llamar'; texto: string };

const tel10 = (t?: string | null) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
};
const fecha = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', year: 'numeric' })
  : null;
const texto = (motivo: string, at?: string | null) => motivo === 'descalificado'
  ? `se descalificó${fecha(at) ? ` el ${fecha(at)}` : ''}: no se le vuelve a llamar`
  : 'pidió que no se le llame';

/**
 * Los vetados son pocos (decenas) y la lista de llamadas puede ser de 500:
 * se trae el conjunto entero una vez y se compara en memoria. Falla CERRADO:
 * si la consulta truena, se lanza — una lista armada sin el veto es
 * justamente el error que esta regla existe para evitar.
 */
export async function cargarVetos(): Promise<{ porContacto: Map<string, Veto>; porTelefono: Map<string, Veto> }> {
  const porContacto = new Map<string, Veto>();
  const porTelefono = new Map<string, Veto>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('v_tel_vetados')
      .select('contact_id, tel10, motivo, descalificado_at').order('contact_id').range(desde, desde + 999);
    if (error) throw new Error(`No se pudo leer a quién no llamar: ${error.message}`);
    for (const v of data || []) {
      const veto: Veto = { motivo: v.motivo, texto: texto(v.motivo, v.descalificado_at) };
      // Si un mismo contacto sale por las dos causas, gana «descalificado» (es la que explica más).
      if (!porContacto.has(v.contact_id) || veto.motivo === 'descalificado') porContacto.set(v.contact_id, veto);
      if (v.tel10 && (!porTelefono.has(v.tel10) || veto.motivo === 'descalificado')) porTelefono.set(v.tel10, veto);
    }
    if ((data || []).length < 1000) break;
  }
  return { porContacto, porTelefono };
}

export function vetoDe(v: Awaited<ReturnType<typeof cargarVetos>>, o: { contact_id?: string | null; telefono?: string | null }): Veto | null {
  if (o.contact_id && v.porContacto.has(o.contact_id)) return v.porContacto.get(o.contact_id)!;
  const t = tel10(o.telefono);
  return t ? v.porTelefono.get(t) || null : null;
}

/** Una sola persona, justo antes de marcarle (el veto pudo nacer después de armar la lista). */
export async function vetoDeUno(o: { contact_id?: string | null; telefono?: string | null }): Promise<Veto | null> {
  const t = tel10(o.telefono);
  const filtros = [o.contact_id ? `contact_id.eq.${o.contact_id}` : null, t ? `tel10.eq.${t}` : null].filter(Boolean).join(',');
  if (!filtros) return null;
  const { data, error } = await supabase.from('v_tel_vetados').select('motivo, descalificado_at').or(filtros).limit(5);
  if (error) throw new Error(`No se pudo leer a quién no llamar: ${error.message}`);
  const f = (data || []).find(x => x.motivo === 'descalificado') || (data || [])[0];
  return f ? { motivo: f.motivo, texto: texto(f.motivo, f.descalificado_at) } : null;
}

/* ══ LOS QUE YA TUVIERON UNA ACCIÓN (22-sep-2026) ═══════════════════════════
 *
 * Pedido del dueño, señalando las pestañas de Llamadas inteligentes: «los que
 * ya tuvieron una acción de cualquier tipo se deben excluir en automático de
 * cualquier lista automática de llamada […] porque con ellos ya generé una
 * acción específica para dicho proceso».
 *
 * «Acción» = lo mismo que cuentan esas pestañas, pero SIN exigir que haya
 * salido de la cabina (si ya tiene cita, da igual si la agendó la llamada o la
 * página: marcarle otra vez es gastar el contacto):
 *   · Reunión próxima (cualquier cita que todavía no pasa y no se canceló).
 *   · Seguimiento pendiente (tarea prometida al hablar, vencida o no). Ese se
 *     llama por SU camino —la promesa entra sola a su hora—, no en la lista.
 *   · Oportunidad: ya avanzó (oportunidad, cotización, conciliación, prueba,
 *     cliente).
 *   · Descalificado: ya lo cubre el veto de arriba; aquí se repite para que el
 *     motivo que se enseña sea el mismo que la pestaña.
 * Se apaga por lista con `incluir_con_accion=1` (la palomita del armador).
 */
const ETAPAS_CON_ACCION: Record<string, string> = {
  oportunidad: 'ya es oportunidad', en_cotizacion: 'ya tiene cotización', en_conciliacion: 'ya está en conciliación',
  prueba_gratis: 'ya está en prueba', cliente: 'ya es cliente', descalificado: 'ya se descalificó', perdido_definitivo: 'ya se dio por perdido',
};

export type ConAccion = { porContacto: Map<string, string>; porTelefono: Map<string, string> };

export async function cargarConAccion(): Promise<ConAccion> {
  const porContacto = new Map<string, string>();
  const porTelefono = new Map<string, string>();
  const poner = (cid: string | null | undefined, tels: (string | null | undefined)[], motivo: string) => {
    if (cid && !porContacto.has(cid)) porContacto.set(cid, motivo);
    for (const t of tels) { const k = tel10(t); if (k && !porTelefono.has(k)) porTelefono.set(k, motivo); }
  };
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const [citas, tareas] = await Promise.all([
    supabase.from('bookings').select('contact_id, invitee_whatsapp, fecha').gte('fecha', hoy)
      .not('estado', 'in', '("cancelada","no_asistio","reagendada")').limit(2000),
    supabase.from('ti_tareas').select('contact_id, payload').eq('estado', 'pendiente').eq('payload->>de_llamada', 'true').limit(2000),
  ]);
  if (citas.error) throw new Error(`No se pudieron leer las citas: ${citas.error.message}`);
  if (tareas.error) throw new Error(`No se pudieron leer los seguimientos: ${tareas.error.message}`);
  for (const b of citas.data || []) poner(b.contact_id, [b.invitee_whatsapp], `ya tiene reunión el ${b.fecha}`);
  for (const t of tareas.data || []) poner(t.contact_id, [(t.payload as any)?.whatsapp, (t.payload as any)?.telefono], 'ya tiene un seguimiento pendiente');
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('contacts').select('id, whatsapp, telefono, lifecycle_stage')
      .in('lifecycle_stage', Object.keys(ETAPAS_CON_ACCION)).order('id').range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer las etapas: ${error.message}`);
    for (const c of data || []) poner(c.id, [c.whatsapp, c.telefono], ETAPAS_CON_ACCION[c.lifecycle_stage] || 'ya tuvo una acción');
    if ((data || []).length < 1000) break;
  }
  return { porContacto, porTelefono };
}

export function accionDe(a: ConAccion, o: { contact_id?: string | null; telefono?: string | null }): string | null {
  if (o.contact_id && a.porContacto.has(o.contact_id)) return a.porContacto.get(o.contact_id)!;
  const t = tel10(o.telefono);
  return t ? a.porTelefono.get(t) || null : null;
}

/** ¿La lista pidió incluirlos? Sólo si lo dice explícito; por omisión se excluyen. */
export const incluyeConAccion = (qs?: string | null) => /(^|&)incluir_con_accion=1(&|$)/.test(String(qs || ''));
