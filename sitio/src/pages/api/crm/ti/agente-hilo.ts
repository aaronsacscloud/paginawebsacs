// El estado del agente EN ESTA conversación (decisión del dueño, 2026-09-03): activo (piloto automático),
// observando (hilo de un consultor o modo sombra) o apagado aquí; y el modo «que me sugiera» (el agente deja
// borradores sin mandar). GET ?contact_id= · POST { contact_id, conversation_id?, accion, envio_id? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';
import { agenteTeamMemberId } from '../../../../lib/crm/ti/agente-asignacion';
import { planSeguimiento } from '../../../../lib/crm/ti/reenganche';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function estadoDe(contactId: string) {
  const [cfg, agId, { data: pf }, { data: convs }, { data: sug }] = await Promise.all([
    leerConfig() as Promise<any>, agenteTeamMemberId(),
    supabase.from('ti_perfil').select('silenciar_ia, agente_estado').eq('contact_id', contactId).maybeSingle(),
    supabase.from('wa_conversaciones').select('id, asignado_a, telefono').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(1),
    supabase.from('ti_envios').select('id, mensaje, created_at, salida, adjuntos, imagen_url, origen, conversation_id').eq('contact_id', contactId).eq('estado', 'sugerencia').order('created_at', { ascending: false }).limit(3),
  ]);
  const conv = convs?.[0]; const st: any = (pf?.agente_estado as any) || {};
  const asignado: 'agente' | 'humano' | null = !conv?.asignado_a ? null : conv.asignado_a === agId ? 'agente' : 'humano';
  const modoSugerencia = st.modo === 'sugerir';
  let estado: 'activo' | 'observando' | 'apagado' = 'activo';
  if (pf?.silenciar_ia || st.cerrado === 'opt_out') estado = 'apagado';
  else if (cfg.agente_activo !== true) estado = 'apagado';
  else {
    // En modo sombra el agente solo manda a los números de prueba: para cualquier otro lead está OBSERVANDO (propone, no manda).
    const sombra = (cfg.agente_modo || 'sombra') === 'sombra';
    const dig = (t: string) => String(t || '').replace(/\D/g, '').slice(-10);
    const esPrueba = (cfg.agente_prueba_telefonos || []).some((t: string) => dig(t) === dig(conv?.telefono));
    if (asignado === 'humano' || modoSugerencia || (sombra && !esPrueba)) estado = 'observando';
  }
  const plan = await planSeguimiento(contactId).catch(() => null);
  const dig10 = (t: string) => String(t || '').replace(/\D/g, '').slice(-10);
  const entrenando = (cfg.agente_modo || 'sombra') === 'sombra' && !(cfg.agente_prueba_telefonos || []).some((t: string) => dig10(t) === dig10(conv?.telefono));
  return { estado, asignado, modo_sugerencia: modoSugerencia, sombra: (cfg.agente_modo || 'sombra') === 'sombra', entrenando, conversation_id: conv?.id || null, sugerencias: (sug || []).map((s: any) => ({ ...s, ultimo_mensaje: s.salida?.ultimo_mensaje || null, objetivo: s.salida?.objetivo || null, estado_guion: s.salida?.estado || null, salida: undefined })), plan };
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cid = url.searchParams.get('contact_id'); if (!cid) return json({ error: 'Falta contact_id' }, 400);
  return json(await estadoDe(cid));
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const cid = String(b.contact_id || ''); if (!cid) return json({ error: 'Falta contact_id' }, 400);
  const ahora = new Date().toISOString();
  const agId = await agenteTeamMemberId();
  const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', cid).maybeSingle();
  const st: any = (pf?.agente_estado as any) || {};
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', cid).order('ultimo_mensaje_at', { ascending: false }).limit(1);
  const convId = b.conversation_id || convs?.[0]?.id || null;
  const evento = async (detalle: string) => { if (convId) await supabase.from('wa_eventos').insert({ conversation_id: convId, tipo: 'asignada', autor: (user as any).nombre || null, detalle }).then(() => {}, () => {}); };
  if (b.accion === 'activar') {
    await supabase.from('ti_perfil').upsert({ contact_id: cid, silenciar_ia: false, agente_estado: { ...st, modo: undefined, cerrado: st.cerrado === 'opt_out' ? st.cerrado : undefined }, updated_at: ahora }, { onConflict: 'contact_id' });
    if (convId && agId) await supabase.from('wa_conversaciones').update({ asignado_a: agId }).eq('id', convId);
    await evento('Agente IA activado en esta conversación (piloto automático)');
  } else if (b.accion === 'sugerir') {
    await supabase.from('ti_perfil').upsert({ contact_id: cid, silenciar_ia: false, agente_estado: { ...st, modo: 'sugerir' }, updated_at: ahora }, { onConflict: 'contact_id' });
    if (convId) await supabase.from('wa_conversaciones').update({ asignado_a: (user as any).id }).eq('id', convId);
    await evento('Agente IA en modo sugerencia: deja borradores, no manda nada');
  } else if (b.accion === 'apagar') {
    await supabase.from('ti_perfil').upsert({ contact_id: cid, silenciar_ia: true, agente_estado: { ...st, modo: undefined }, updated_at: ahora }, { onConflict: 'contact_id' });
    await supabase.from('ti_envios').update({ estado: 'vetado', motivo_veto: 'agente apagado en esta conversación', updated_at: ahora }).eq('contact_id', cid).in('estado', ['pendiente', 'sugerencia']);
    if (convId && agId) await supabase.from('wa_conversaciones').update({ asignado_a: (user as any).id }).eq('id', convId).eq('asignado_a', agId);
    await evento('Agente IA apagado en esta conversación');
  } else if (b.accion === 'usar_sugerencia' && b.envio_id) {
    await supabase.from('ti_envios').update({ estado: 'humano_uso', humano_at: ahora, updated_at: ahora }).eq('id', b.envio_id);
    await supabase.from('ia_log').insert({ accion: 'sugerencia_usada', contact_id: cid, detalle: { envio_id: b.envio_id, por: (user as any).id } });
  } else if (b.accion === 'descartar_sugerencia' && b.envio_id) {
    await supabase.from('ti_envios').update({ estado: 'vetado', motivo_veto: String(b.motivo || 'sugerencia descartada por el consultor').slice(0, 200), vetado_por: (user as any).id, updated_at: ahora }).eq('id', b.envio_id);
    await supabase.from('ia_log').insert({ accion: 'agente_vetado', contact_id: cid, razon: b.motivo || 'sugerencia descartada', detalle: { envio_id: b.envio_id, por: (user as any).id, sugerencia: true } });
  } else return json({ error: 'Acción desconocida' }, 400);
  return json({ ok: true, ...(await estadoDe(cid)) });
};
