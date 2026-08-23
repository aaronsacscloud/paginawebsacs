// WHATSAPP · El canal CORREO del inbox omnicanal.
//
// POST { wa_id? | email_conversation_id? | contact_id?, para?, asunto?, texto }
// → responde en el hilo de email abierto del contacto, o CREA la conversación
//   (asunto obligatorio) y manda el primer correo.
//
// Todo sale por el MISMO pipeline que la Bandeja (enviarCorreo, categoria
// 'relacion'): candados de suprimidos/límite/config y footer legal incluidos.
// Nunca por el canal Resend transaccional — esas respuestas no entran al inbox.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant, puedeEnviar } from '../../../../lib/email/tenant';
import { enviarCorreo } from '../../../../lib/email/pipeline';
import { escapar } from '../../../../lib/email/footer';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const texto = String(b.texto || '').trim();
  if (!texto) return json({ error: 'Escribe el correo.' }, 400);

  const t = await resolverTenant();
  if (!t) return json({ error: 'No hay remitente de correo configurado (Email → Ajustes).' }, 400);
  if (!puedeEnviar(t)) return json({ error: 'La configuración de correo está incompleta (Email → Ajustes).' }, 400);
  const user = await getCurrentUser(request);

  // ── Resolver contacto/destino ──
  let contactId: string | null = b.contact_id || null;
  let companyId: string | null = null;
  let email: string | null = b.para ? String(b.para).trim().toLowerCase() : null;

  if (b.wa_id) {
    const { data: wa } = await supabase.from('wa_conversaciones')
      .select('contact_id, company_id').eq('id', b.wa_id).maybeSingle();
    if (wa) { contactId = contactId || wa.contact_id; companyId = wa.company_id; }
  }
  let convEmail: any = null;
  if (b.email_conversation_id) {
    const { data } = await supabase.from('email_conversations')
      .select('*').eq('id', b.email_conversation_id).eq('tenant_id', t.id).maybeSingle();
    convEmail = data;
    if (convEmail) { contactId = contactId || convEmail.contact_id; companyId = companyId || convEmail.company_id; email = convEmail.email; }
  }
  if (contactId && !email) {
    const { data: c } = await supabase.from('contacts')
      .select('id, email, company_id').eq('id', contactId).maybeSingle();
    email = c?.email || null; companyId = companyId || c?.company_id || null;
  }
  if (!email) return json({ error: 'Este contacto no tiene email. Agrégalo en el panel y reintenta.' }, 400);

  // ── El hilo: la conversación abierta de ese email, o una nueva ──
  if (!convEmail) {
    const { data } = await supabase.from('email_conversations')
      .select('*').eq('tenant_id', t.id).eq('email', email).eq('estado', 'abierta')
      .order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
    convEmail = data;
  }

  const esNueva = !convEmail;
  const asuntoBase = esNueva
    ? String(b.asunto || '').trim()
    : String(convEmail.asunto || '').replace(/^\[PIDE BAJA\]\s*/, '').replace(/^(re:\s*)+/i, '');
  if (esNueva && !asuntoBase) return json({ error: 'Un correo nuevo necesita asunto.' }, 400);

  if (esNueva) {
    const { data: nueva, error } = await supabase.from('email_conversations').insert({
      tenant_id: t.id, contact_id: contactId, company_id: companyId,
      email, asunto: asuntoBase.slice(0, 250), estado: 'abierta', leida: true,
      ultimo_mensaje_at: new Date().toISOString(),
    }).select('*').single();
    if (error || !nueva) return json({ error: error?.message || 'No se pudo crear la conversación.' }, 500);
    convEmail = nueva;
  }

  // In-Reply-To del último entrante: sin él la respuesta llega como correo
  // suelto y el cliente pierde el hilo (regla de la Bandeja).
  const { data: ultimo } = esNueva ? { data: null } : await supabase.from('email_messages')
    .select('message_id, referencias').eq('conversation_id', convEmail.id)
    .eq('direccion', 'entrante').order('created_at', { ascending: false }).limit(1).maybeSingle();

  const asunto = (esNueva ? asuntoBase : `Re: ${asuntoBase}`).slice(0, 200);
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#222;white-space:pre-line;">${escapar(texto)}</div>`;

  const r = await enviarCorreo({
    tenantId: t.id, para: email, asunto, html, texto, categoria: 'relacion',
    contactId, companyId,
  });
  if (!r.enviado) return json({ error: 'No se pudo enviar: ' + (r.detalle || r.motivo) }, 400);

  await supabase.from('email_messages').insert({
    conversation_id: convEmail.id, direccion: 'saliente',
    de_email: t.from_email, para_email: email, asunto,
    cuerpo_texto: texto, cuerpo_html: html, send_id: r.sendId,
    in_reply_to: ultimo?.message_id || null,
    referencias: [ultimo?.referencias, ultimo?.message_id].filter(Boolean).join(' ') || null,
    autor: user?.nombre || user?.email || null,
  });
  await supabase.from('email_conversations')
    .update({ leida: true, ultimo_mensaje_at: new Date().toISOString() }).eq('id', convEmail.id);
  if (contactId) {
    await supabase.from('contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', contactId);
    await supabase.from('activities').insert({
      contact_id: contactId, company_id: companyId, tipo: 'email_enviado', automatico: false,
      titulo: `Correo desde el inbox: ${texto.slice(0, 90)}`, metadata: { conversation_id: convEmail.id },
    });
  }
  return json({ ok: true, email_conversation_id: convEmail.id, send_id: r.sendId });
};
