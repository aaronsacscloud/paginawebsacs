// Contexto de UN lead para decidir: los últimos 20 mensajes (todas sus conversaciones), llamadas, notas, datos y el
// estado del agente. GET ?contact_id=&n=20
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cid = url.searchParams.get('contact_id'); if (!cid) return json({ error: 'Falta contact_id' }, 400);
  const n = Math.min(Number(url.searchParams.get('n')) || 20, 60);
  const [{ data: k }, { data: convs }, { data: pf }, { data: bk }, { data: qs }] = await Promise.all([
    supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, telefono, fuente, giro, sucursales_interes, lifecycle_stage, estatus_lead, created_at, last_contact_at, company_id, companies(nombre_comercial, nombre, giro, sucursales)').eq('id', cid).maybeSingle(),
    supabase.from('wa_conversaciones').select('id, telefono, ultimo_mensaje_at, asignado_a').eq('contact_id', cid).order('ultimo_mensaje_at', { ascending: false }).limit(5),
    supabase.from('ti_perfil').select('datos, resumen, agente_estado, silenciar_ia, temas_reunion').eq('contact_id', cid).maybeSingle(),
    supabase.from('bookings').select('id, start_at, estado, event_type_id').eq('contact_id', cid).order('start_at', { ascending: false }).limit(5),
    supabase.from('quotes').select('id, estado, total, created_at').eq('contact_id', cid).neq('estado', 'plantilla').order('created_at', { ascending: false }).limit(5),
  ]);
  const convIds = (convs || []).map(c => c.id);
  let mensajes: any[] = [], llamadas: any[] = [], notas: any[] = [], envios: any[] = [];
  if (convIds.length) {
    const r = await Promise.all([
      supabase.from('wa_mensajes').select('id, conversation_id, direccion, tipo, cuerpo, transcript, status, created_at, autor, kapso_message_id, filename').in('conversation_id', convIds).is('borrado_at', null).order('created_at', { ascending: false }).limit(n),
      supabase.from('wa_llamadas').select('id, direccion, estado, duracion_seg, started_at, atendida_por_nombre, minuta, siguiente_paso').in('conversation_id', convIds).order('started_at', { ascending: false }).limit(5),
      supabase.from('wa_notas').select('id, autor, texto, created_at').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(5),
      supabase.from('ti_envios').select('kapso_message_id, origen, estado').eq('contact_id', cid).not('kapso_message_id', 'is', null).limit(80),
    ]);
    mensajes = (r[0].data || []).reverse(); llamadas = r[1].data || []; notas = r[2].data || []; envios = r[3].data || [];
  }
  const delAgente = new Set(envios.map(e => e.kapso_message_id));
  const st: any = (pf as any)?.agente_estado || {};
  return json({
    contacto: k, conversaciones: convs || [],
    mensajes: mensajes.map(m => ({ ...m, quien: m.direccion === 'entrante' ? 'lead' : delAgente.has(m.kapso_message_id) ? 'agente' : (m.autor || 'equipo') })),
    llamadas, notas, citas: bk || [], cotizaciones: qs || [],
    perfil: pf ? { datos: (pf as any).datos || {}, resumen: (pf as any).resumen || '', silenciar_ia: (pf as any).silenciar_ia, temas_reunion: (pf as any).temas_reunion || [] } : null,
    agente: { ciclo: st.ciclo || 0, fase: st.fase || null, intentos: (st.intentos || []).length, validos: (st.intentos || []).filter((i: any) => i.valido).length, agendada_at: st.agendada_at || null, cerrado: st.cerrado || null, modo: st.modo || null },
  });
};
