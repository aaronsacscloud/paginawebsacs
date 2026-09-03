// ══ SEMÁFORO DE AUTOMÁTICOS (decisión del dueño 2026-09-04) ═══════════════════════════════════════════════════════
// Ocho flujos distintos le pueden escribir al mismo lead. Antes de que CUALQUIER mensaje automático se programe o salga,
// pasa por aquí. Las RESPUESTAS a lo que el lead escribe quedan exentas (contestar nunca es spam). Reglas:
//  · horas silenciosas (default 21:00–8:00 CDMX): no se toca, solo se responde (una aprobación humana las salta);
//  · opt-out o píldora apagada: nada;
//  · un humano escribió en las últimas 4 h: el agente calla;
//  · máximo UN automático cada 24 h por lead y por TELÉFONO (hay números repetidos en dos contactos);
//  · tope semanal de automáticos por lead (default 3);
//  · si ya hay un automático pendiente para ese teléfono, no se apila otro.
import { supabase } from '../../supabase';
import { leerConfig } from './motor';

export type Veredicto = { ok: true } | { ok: false; motivo: string };
const dig = (t: any) => String(t || '').replace(/\D/g, '').slice(-10);

export async function puedeAutomatico(contactId: string, o: { telefono?: string | null; origen: string; aprobadoHumano?: boolean } = { origen: 'automatico' }): Promise<Veredicto> {
  if (o.origen === 'respuesta') return { ok: true };
  const cfg: any = await leerConfig();
  const ahora = new Date(); const hCdmx = (ahora.getUTCHours() - 6 + 24) % 24;
  const q = cfg.silencio_automaticos || { desde: 21, hasta: 8 };
  if (!o.aprobadoHumano && (hCdmx >= Number(q.desde) || hCdmx < Number(q.hasta))) return { ok: false, motivo: 'horas_silenciosas' };
  const [{ data: k }, { data: pf }] = await Promise.all([
    supabase.from('contacts').select('wa_optout, whatsapp, archived_at').eq('id', contactId).maybeSingle(),
    supabase.from('ti_perfil').select('silenciar_ia, agente_estado').eq('contact_id', contactId).maybeSingle(),
  ]);
  if (!k || k.archived_at || k.wa_optout) return { ok: false, motivo: 'optout_o_archivado' };
  if ((pf as any)?.silenciar_ia || (pf as any)?.agente_estado?.cerrado) return { ok: false, motivo: 'agente_apagado_en_este_lead' };
  const tel = dig(o.telefono || k.whatsapp);
  // Humano escribió hace < 4 h en alguna conversación del contacto.
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contactId).limit(5);
  const ids = (convs || []).map(c => c.id);
  if (ids.length) {
    const { data: humano } = await supabase.from('wa_mensajes').select('id').in('conversation_id', ids).eq('direccion', 'saliente').not('autor_id', 'is', null).gte('created_at', new Date(ahora.getTime() - 4 * 3600e3).toISOString()).limit(1);
    if ((humano || []).length) return { ok: false, motivo: 'humano_escribio_4h' };
  }
  // Un automático cada 24 h por lead o por teléfono; tope semanal.
  const hace24 = new Date(ahora.getTime() - 24 * 3600e3).toISOString(); const hace7d = new Date(ahora.getTime() - 7 * 86400e3).toISOString();
  let q24 = supabase.from('ti_envios').select('id, contact_id, telefono, enviado_at').eq('estado', 'enviado').neq('origen', 'respuesta').gte('enviado_at', hace7d).limit(50);
  q24 = tel ? q24.or(`contact_id.eq.${contactId},telefono.like.%${tel}`) : q24.eq('contact_id', contactId);
  const { data: env } = await q24;
  const lista = env || [];
  if (lista.some(e => e.enviado_at >= hace24)) return { ok: false, motivo: 'ya_hubo_automatico_24h' };
  const tope = Number(cfg.tope_semanal_automaticos) || 3;
  if (lista.length >= tope) return { ok: false, motivo: `tope_semanal_${tope}` };
  // Pendiente de otro flujo para el mismo teléfono (contacto duplicado).
  if (tel) {
    const { data: pendTel } = await supabase.from('ti_envios').select('id, contact_id').in('estado', ['pendiente', 'enviando']).like('telefono', `%${tel}`).limit(3);
    if ((pendTel || []).some(p => p.contact_id !== contactId)) return { ok: false, motivo: 'pendiente_mismo_telefono' };
  }
  return { ok: true };
}

/** ¿Este lead está en ciclo del agente? (para que difusiones y secuencias no se le crucen) */
export async function enCicloAgente(contactIds: string[]): Promise<Set<string>> {
  if (!contactIds.length) return new Set();
  const { data } = await supabase.from('ti_perfil').select('contact_id, agente_estado').in('contact_id', contactIds);
  return new Set((data || []).filter(p => { const st: any = p.agente_estado || {}; return !st.cerrado && (st.fase || (Array.isArray(st.intentos) && st.intentos.length) || st.reenganche || st.puente_pendiente); }).map(p => p.contact_id));
}

/** EL LEAD RESPONDIÓ: todo lo automático que estuviera programado para él se cancela; solo sale la respuesta. */
export async function alResponderElLead(contactId: string) {
  const ahora = new Date().toISOString();
  const { data } = await supabase.from('ti_envios').update({ estado: 'reemplazado', motivo_veto: 'el lead respondió: se cancela lo automático programado', updated_at: ahora }).eq('contact_id', contactId).eq('estado', 'pendiente').neq('origen', 'respuesta').select('id, origen');
  return (data || []).length;
}
