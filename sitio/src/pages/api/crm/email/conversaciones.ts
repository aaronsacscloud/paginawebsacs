// /api/crm/email/conversaciones — la bandeja.
//
// GET            hilos (filtros: no_leidos | mios | sin_asignar | cerradas)
// GET ?id=       un hilo con todos sus mensajes
// POST           responder (sale por el pipeline como 'relacion': lleva pie
//                legal pero NO cuenta para la presión de marketing — nadie
//                debe quedarse sin respuesta por un tope de cortesía)
// PUT            marcar leída / asignar / cerrar
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { enviarCorreo } from '../../../../lib/email/pipeline';
import { escapar } from '../../../../lib/email/footer';
import { darDeBaja } from '../../../../lib/email/bajas';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const id = url.searchParams.get('id');

  if (id) {
    const { data: conv } = await supabase.from('email_conversations')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, companies(nombre))')
      .eq('id', id).eq('tenant_id', t.id).maybeSingle();
    if (!conv) return json({ error: 'No existe esa conversación.' }, 404);
    const { data: msgs } = await supabase.from('email_messages')
      .select('*').eq('conversation_id', id).order('created_at');
    return json({ conversacion: conv, mensajes: msgs || [] });
  }

  const filtro = url.searchParams.get('filtro') || 'abiertas';
  let q = supabase.from('email_conversations')
    .select('*, contacts(nombre, apellido, lifecycle_stage, companies(nombre))')
    .eq('tenant_id', t.id).order('ultimo_mensaje_at', { ascending: false }).limit(200);
  if (filtro === 'no_leidos') q = q.eq('leida', false).eq('estado', 'abierta');
  else if (filtro === 'sin_asignar') q = q.is('asignado_a', null).eq('estado', 'abierta');
  else if (filtro === 'cerradas') q = q.eq('estado', 'cerrada');
  else q = q.eq('estado', 'abierta');

  const { data } = await q;
  const { count: sinLeer } = await supabase.from('email_conversations')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('leida', false).eq('estado', 'abierta');
  return json({ conversaciones: data || [], sin_leer: sinLeer || 0 });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id de la conversación.' }, 400);

  const { data: conv } = await supabase.from('email_conversations').select('*').eq('id', body.id).eq('tenant_id', t.id).maybeSingle();
  if (!conv) return json({ error: 'No existe esa conversación.' }, 404);

  // Baja pedida por escrito, ejecutada con un clic desde el hilo.
  if (body.accion === 'dar_de_baja') {
    await darDeBaja({ tenantId: t.id, email: conv.email, contactId: conv.contact_id, origen: 'bandeja', detalle: 'Lo pidió por correo' });
    await supabase.from('email_conversations').update({ estado: 'cerrada' }).eq('id', conv.id);
    return json({ ok: true });
  }

  const texto = String(body.texto || '').trim();
  if (!texto) return json({ error: 'Escribe la respuesta.' }, 400);

  // El último mensaje entrante da el hilo (In-Reply-To / References): sin
  // esto la respuesta llega como correo suelto y el cliente pierde el contexto.
  const { data: ultimo } = await supabase.from('email_messages')
    .select('message_id, referencias, asunto').eq('conversation_id', conv.id)
    .eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(1).maybeSingle();

  const asunto = String(conv.asunto || '').replace(/^\[PIDE BAJA\]\s*/, '').replace(/^(re:\s*)+/i, '');
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#222;white-space:pre-line;">${escapar(texto)}</div>`;

  const r = await enviarCorreo({
    tenantId: t.id, para: conv.email, asunto: `Re: ${asunto}`.slice(0, 200),
    html, texto, categoria: 'relacion',
    contactId: conv.contact_id, companyId: conv.company_id,
  });
  if (!r.enviado) return json({ error: 'No se pudo enviar: ' + (r.detalle || r.motivo) }, 400);

  await supabase.from('email_messages').insert({
    conversation_id: conv.id, direccion: 'saliente',
    de_email: t.from_email, para_email: conv.email, asunto: `Re: ${asunto}`,
    cuerpo_texto: texto, cuerpo_html: html, send_id: r.sendId,
    in_reply_to: ultimo?.message_id || null,
    referencias: [ultimo?.referencias, ultimo?.message_id].filter(Boolean).join(' ') || null,
    autor: body.autor || null,
  });
  await supabase.from('email_conversations')
    .update({ leida: true, ultimo_mensaje_at: new Date().toISOString() }).eq('id', conv.id);
  if (conv.contact_id) {
    await supabase.from('contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', conv.contact_id);
    await supabase.from('activities').insert({
      contact_id: conv.contact_id, company_id: conv.company_id, tipo: 'email_enviado', automatico: false,
      titulo: `Le respondimos por correo: ${texto.slice(0, 90)}`, metadata: { conversation_id: conv.id },
    });
  }
  return json({ ok: true, send_id: r.sendId });
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id.' }, 400);
  const updates: Record<string, any> = {};
  for (const k of ['leida', 'estado', 'asignado_a']) if (k in body) updates[k] = body[k];
  const { data, error } = await supabase.from('email_conversations')
    .update(updates).eq('id', body.id).eq('tenant_id', t.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ conversacion: data });
};
