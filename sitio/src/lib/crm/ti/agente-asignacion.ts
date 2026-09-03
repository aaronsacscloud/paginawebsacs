// TRABAJO INTELIGENTE · «AGENTE IA» COMO ASIGNADO (decisión del dueño, 2026-09-02).
// Una conversación en piloto automático se ve asignada a «Agente IA» (morado). Si un asesor escribe, la
// asignación pasa a él y el agente se apaga en ese hilo; el asesor vuelve a elegir «Agente IA» para reactivarlo.
import { supabase } from '../../supabase';

let cache: { id: string | null; at: number } | null = null;
export async function agenteTeamMemberId(): Promise<string | null> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache.id;
  const { data } = await supabase.from('team_members').select('id').eq('email', 'agente-ia@sacscloud.com').maybeSingle();
  cache = { id: data?.id || null, at: Date.now() };
  return cache.id;
}

/** El agente toma el hilo si nadie lo tiene (o ya era suyo). Nunca le quita el hilo a un humano. */
export async function agenteTomaHilo(conversationId: string | null | undefined) {
  if (!conversationId) return;
  const agId = await agenteTeamMemberId(); if (!agId) return;
  const { data: c } = await supabase.from('wa_conversaciones').select('asignado_a').eq('id', conversationId).maybeSingle();
  if (!c || (c.asignado_a && c.asignado_a !== agId)) return;
  if (c.asignado_a === agId) return;
  await supabase.from('wa_conversaciones').update({ asignado_a: agId }).eq('id', conversationId);
  await supabase.from('wa_eventos').insert({ conversation_id: conversationId, tipo: 'asignada', autor: null, detalle: 'Agente IA en piloto automático en esta conversación' }).then(() => {}, () => {});
}

/** Un humano escribió: si el hilo era del agente, pasa al humano y el agente se apaga aquí. */
export async function humanoTomaHilo(conversationId: string | null | undefined, userId: string | null | undefined, nombre?: string | null) {
  if (!conversationId || !userId) return false;
  const agId = await agenteTeamMemberId(); if (!agId) return false;
  const { data: c } = await supabase.from('wa_conversaciones').select('asignado_a').eq('id', conversationId).maybeSingle();
  if (!c || c.asignado_a !== agId) return false;
  await supabase.from('wa_conversaciones').update({ asignado_a: userId }).eq('id', conversationId);
  await supabase.from('wa_eventos').insert({ conversation_id: conversationId, tipo: 'asignada', autor: nombre || null, detalle: `${nombre || 'El consultor'} tomó el hilo: el agente se apaga en esta conversación (vuelve a elegir «Agente IA» para reactivarlo)` }).then(() => {}, () => {});
  return true;
}

/** ¿Quién tiene el hilo de este contacto? 'agente' | 'humano' | null (sin asignar). */
export async function duenoDelHilo(contactId: string): Promise<{ quien: 'agente' | 'humano' | null; conversation_id: string | null }> {
  const agId = await agenteTeamMemberId();
  const { data: convs } = await supabase.from('wa_conversaciones').select('id, asignado_a').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(1);
  const c = convs?.[0]; if (!c) return { quien: null, conversation_id: null };
  return { quien: !c.asignado_a ? null : c.asignado_a === agId ? 'agente' : 'humano', conversation_id: c.id };
}
