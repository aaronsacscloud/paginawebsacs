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
