// WHATSAPP · Pasarle una conversación a un compañero.
//
// La liga se arma sola en el navegador (`/admin/crm?tab=whatsapp&wa_conv=…`) y
// con copiarla basta para mandarla por donde sea. Esto es el otro camino, el
// que no depende de que el otro abra el WhatsApp: le suena la campana DENTRO
// del CRM y con un clic cae en la conversación —y en el mensaje, si la liga
// venía anclada.
//
// Y deja rastro en el hilo. Sin eso, mañana nadie sabe por qué esta
// conversación la está atendiendo alguien que no la abrió nunca: quién se la
// pasó a quién, con qué recado y cuándo es justo el contexto que hace que el
// seguimiento no empiece de cero.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { notificar } from '../../../../lib/crm/notificaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const b = await request.json().catch(() => ({}));
  const convId = String(b.conversation_id || '').trim();
  const para = String(b.para || '').trim();
  const recado = String(b.recado || '').trim().slice(0, 500);
  const mensajeId = String(b.mensaje_id || '').trim() || null;
  if (!convId || !para) return json({ error: 'Faltan conversation_id y para' }, 400);
  if (para === user.id) return json({ error: 'Esa conversación ya es tuya' }, 400);

  // El destinatario tiene que ser alguien del equipo Y activo: una liga que
  // llega a una cuenta apagada es un seguimiento que nadie recoge.
  const { data: quien } = await supabase.from('team_members')
    .select('id, nombre, email, activo').eq('id', para).maybeSingle();
  if (!quien?.id || !quien.activo) return json({ error: 'Esa persona ya no está en el equipo' }, 400);

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, telefono, contacts(nombre, apellido), companies(nombre_comercial, nombre)')
    .eq('id', convId).maybeSingle();
  if (!conv?.id) return json({ error: 'No existe esa conversación' }, 404);

  const c: any = (conv as any).contacts, e: any = (conv as any).companies;
  const deQuien = [c?.nombre, c?.apellido].filter(Boolean).join(' ').trim()
    || e?.nombre_comercial || e?.nombre || conv.telefono || 'un contacto';
  const yo = user.nombre || user.email?.split('@')[0] || 'Alguien';

  const destino = `whatsapp?wa_conv=${conv.id}${mensajeId ? `&wa_msg=${mensajeId}` : ''}`;

  /* Idempotente por minuto: el doble clic —o la pestaña que reintenta— no
     tiene que dejarle dos avisos iguales. Pasado el minuto sí: volver a
     pasarle la misma conversación más tarde es insistir, y eso sí se avisa. */
  const minuto = new Date().toISOString().slice(0, 16);
  await notificar({
    clave: `wa_compartida:${conv.id}:${para}:${minuto}`,
    tipo: 'wa_compartida',
    nivel: 'alerta',
    para,
    titulo: `${yo} te pasó la conversación de ${deQuien}`,
    detalle: recado || null,
    destino,
    metadata: { conversation_id: conv.id, mensaje_id: mensajeId, de: user.id, de_nombre: yo },
  });

  // El rastro en el hilo. Autor = quien la pasó (no «Sistema»): esto lo hizo
  // una persona y el hilo tiene que decir cuál.
  await supabase.from('wa_notas').insert({
    conversation_id: conv.id,
    contact_id: conv.contact_id || null,
    autor: yo,
    texto: `Le pasé esta conversación a ${quien.nombre || quien.email}${recado ? `: «${recado}»` : ''}`,
    menciones: [quien.id],
    metadata: { compartida: true, para: quien.id, mensaje_id: mensajeId },
  }).select('id').maybeSingle();

  return json({ ok: true, para: quien.nombre || quien.email });
};
