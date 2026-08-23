// WHATSAPP · Envíos programados y recordatorios "si no contesta".
// GET ?conversation_id → { programados }
// POST { conversation_id, tipo:'envio'|'recordatorio', ejecutar_at, payload }
//   envio: payload = { texto } | { media_url, clase, nombre, caption }
//   recordatorio: payload = { nota } — se dispara SOLO si el cliente no ha
//   escrito desde que se creó (si contestó, se cancela solo).
// DELETE { id }
// Los ejecuta el cron wa-snooze cada 15 min.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('conversation_id');
  if (!id) return json({ programados: [] });
  const { data } = await supabase.from('wa_programados').select('*').eq('conversation_id', id).eq('estado', 'pendiente').order('ejecutar_at');
  return json({ programados: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const yo = await getCurrentUser(request).catch(() => null);
  if (!b.conversation_id || !['envio', 'recordatorio'].includes(b.tipo) || !b.ejecutar_at) return json({ error: 'Faltan datos' }, 400);
  const cuando = new Date(b.ejecutar_at);
  if (isNaN(cuando.getTime()) || cuando.getTime() < Date.now() - 60e3) return json({ error: 'La fecha debe ser futura' }, 400);
  const payload = b.tipo === 'envio'
    ? (b.payload?.texto ? { texto: String(b.payload.texto).slice(0, 4000), cita: b.payload.cita || null } : b.payload?.media_url ? { media_url: b.payload.media_url, clase: b.payload.clase, nombre: b.payload.nombre, caption: b.payload.caption || null } : null)
    : { nota: String(b.payload?.nota || 'Sin respuesta del cliente').slice(0, 300), desde: new Date().toISOString() };
  if (!payload) return json({ error: 'El envío necesita texto o archivo' }, 400);
  const { data, error } = await supabase.from('wa_programados').insert({
    conversation_id: b.conversation_id, tipo: b.tipo, ejecutar_at: cuando.toISOString(), payload,
    autor_id: yo?.id || null, autor: (yo as any)?.nombre || yo?.email || null,
  }).select('*').single();
  if (error) return json({ error: error.message }, 500);
  await supabase.from('wa_eventos').insert({
    conversation_id: b.conversation_id, tipo: b.tipo === 'envio' ? 'programado' : 'recordatorio', autor: (yo as any)?.nombre || null,
    detalle: b.tipo === 'envio'
      ? `Mensaje programado para ${cuando.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      : `Recordatorio si no contesta: ${cuando.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
  });
  return json({ ok: true, programado: data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  await supabase.from('wa_programados').update({ estado: 'cancelado' }).eq('id', b.id).eq('estado', 'pendiente');
  return json({ ok: true });
};
