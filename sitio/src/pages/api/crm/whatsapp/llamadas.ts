// WHATSAPP · Llamadas (Calling API de Meta vía Kapso).
// GET  ?activas=1                → llamadas timbrando (para el banner de entrante)
// GET  ?conversation_id=         → historial de esa conversación
// GET  ?permiso=<wa_id>          → estado del permiso para llamar (business-initiated)
// GET  ?ajustes=1                → configuración de calling del número
// POST { accion:'aceptar', call_id, sdp }     → pre_accept + accept con el SDP answer del navegador
// POST { accion:'rechazar'|'terminar', call_id }
// POST { accion:'llamar', conversation_id, sdp } → connect (solo donde Meta lo permite)
// POST { accion:'configurar', calling }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { accionLlamada, permisoLlamada, ajustesLlamadas, configurarLlamadas, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { explicarError } from '../../../../lib/whatsapp/errores';
import { upsertConversacion } from '../../../../lib/whatsapp/espejo';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fallo = (e: any) => { const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined); return json({ error: `${x.titulo}. ${x.que_hacer}`, error_detalle: x }, 502); };

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  if (p.get('activas')) {
    const hace2min = new Date(Date.now() - 120e3).toISOString();
    const { data } = await supabase.from('wa_llamadas').select('*, wa_conversaciones(id, contacts(nombre, apellido), companies(nombre, nombre_comercial))')
      .eq('estado', 'timbrando').gte('started_at', hace2min).order('started_at', { ascending: false }).limit(5);
    return json({ llamadas: data || [] });
  }
  if (p.get('conversation_id')) {
    const { data } = await supabase.from('wa_llamadas').select('id, call_id, direccion, estado, started_at, answered_at, ended_at, duracion_seg, atendida_por_nombre').eq('conversation_id', p.get('conversation_id')).order('started_at', { ascending: false }).limit(30);
    return json({ llamadas: data || [] });
  }
  if (p.get('permiso')) {
    try { return json({ permiso: await permisoLlamada(String(p.get('permiso')).replace(/\D/g, '')) }); }
    catch (e: any) {
      const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined);
      // 138013 = el país del número no admite llamadas salientes del negocio: no es un error del agente.
      return json({ permiso: null, no_disponible: true, motivo: /138013|not available|not supported/i.test(x.crudo) ? 'Meta no permite llamadas salientes del negocio para este número (país). El cliente sí puede llamarte.' : `${x.titulo}. ${x.que_hacer}` });
    }
  }
  if (p.get('ajustes')) { try { return json({ ajustes: await ajustesLlamadas() }); } catch (e: any) { return fallo(e); } }
  return json({ error: 'Parámetro requerido' }, 400);
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const yo = await getCurrentUser(request).catch(() => null);
  try {
    if (b.accion === 'aceptar') {
      if (!b.call_id || !b.sdp) return json({ error: 'Faltan call_id y sdp' }, 400);
      // pre_accept baja la latencia de conexión; si Meta lo rechaza, accept solo.
      await accionLlamada({ action: 'pre_accept', call_id: b.call_id, sdp: b.sdp, sdp_type: 'answer' }).catch(() => null);
      const r = await accionLlamada({ action: 'accept', call_id: b.call_id, sdp: b.sdp, sdp_type: 'answer' });
      await supabase.from('wa_llamadas').update({ estado: 'aceptada', answered_at: new Date().toISOString(), sdp_answer: b.sdp, atendida_por: yo?.id || null, atendida_por_nombre: (yo as any)?.nombre || null, updated_at: new Date().toISOString() }).eq('call_id', b.call_id);
      return json({ ok: true, r });
    }
    if (b.accion === 'rechazar' || b.accion === 'terminar') {
      if (!b.call_id) return json({ error: 'Falta call_id' }, 400);
      const r = await accionLlamada({ action: b.accion === 'rechazar' ? 'reject' : 'terminate', call_id: b.call_id });
      const { data: prev } = await supabase.from('wa_llamadas').select('started_at, answered_at, conversation_id, direccion').eq('call_id', b.call_id).maybeSingle();
      const fin = new Date();
      const dur = prev?.answered_at ? Math.round((fin.getTime() - new Date(prev.answered_at).getTime()) / 1000) : null;
      await supabase.from('wa_llamadas').update({ estado: b.accion === 'rechazar' ? 'rechazada' : 'terminada', ended_at: fin.toISOString(), duracion_seg: dur, atendida_por: yo?.id || null, atendida_por_nombre: (yo as any)?.nombre || null, updated_at: fin.toISOString() }).eq('call_id', b.call_id);
      if (prev?.conversation_id) await supabase.from('wa_eventos').insert({ conversation_id: prev.conversation_id, tipo: 'llamada', autor: (yo as any)?.nombre || null,
        detalle: b.accion === 'rechazar' ? 'Llamada de WhatsApp rechazada' : `Llamada de WhatsApp ${prev.direccion === 'entrante' ? 'recibida' : 'realizada'}${dur != null ? ` · ${Math.floor(dur / 60)} min ${dur % 60} s` : ''}` });
      return json({ ok: true, r });
    }
    if (b.accion === 'llamar') {
      if (!b.conversation_id || !b.sdp) return json({ error: 'Faltan conversation_id y sdp' }, 400);
      const { data: conv } = await supabase.from('wa_conversaciones').select('id, telefono').eq('id', b.conversation_id).maybeSingle();
      if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
      const r = await accionLlamada({ action: 'connect', to: conv.telefono.replace(/\D/g, ''), sdp: b.sdp, sdp_type: 'offer' });
      const callId = r?.calls?.[0]?.id;
      if (callId) await supabase.from('wa_llamadas').insert({ call_id: callId, conversation_id: conv.id, telefono: conv.telefono, direccion: 'saliente', estado: 'timbrando', sdp_offer: b.sdp, atendida_por: yo?.id || null, atendida_por_nombre: (yo as any)?.nombre || null });
      return json({ ok: true, call_id: callId || null });
    }
    if (b.accion === 'configurar') {
      const r = await configurarLlamadas(b.calling || {});
      await supabase.from('wa_config').update({ calling: b.calling || null }).eq('id', 1);
      return json({ ok: true, r });
    }
    if (b.accion === 'estado') {
      // El navegador pregunta por el SDP answer de una saliente / si la entrante sigue viva.
      const { data } = await supabase.from('wa_llamadas').select('call_id, estado, sdp_answer, ended_at').eq('call_id', b.call_id).maybeSingle();
      return json({ llamada: data });
    }
    return json({ error: 'Acción desconocida' }, 400);
  } catch (e: any) { return fallo(e); }
};
