// WHATSAPP · Un hilo OMNICANAL: mensajes de WhatsApp, correos del mismo
// contacto, notas internas, eventos de sistema y la ventana de 24 h.
//
// GET ?id=<wa_conversation_id> | ?email_id=<email_conversation_id>
//   → { conversacion, mensajes, correos, eventos, notas, ventana, canales }
//   Abrir MARCA leído en ambos canales (wa.no_leidos=0, email.leida=true).
// PUT { id, asignado_a? | estado_crm? | snooze_until? | ... } — whitelist;
//   asignación/estado/snooze dejan su EVENTO de sistema en el hilo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolverTenant, puedeEnviar } from '../../../../lib/email/tenant';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  const emailId = url.searchParams.get('email_id');
  if (!id && !emailId) return json({ error: 'Falta id o email_id' }, 400);

  // ── El ancla: la conversación de WhatsApp, o una de email (fila email-only) ──
  let conv: any = null;
  let soloEmail: any = null;
  if (id) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo, company_id, wa_optout), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta)')
      .eq('id', id).maybeSingle();
    conv = data;
    if (!conv) return json({ error: 'Conversación no encontrada' }, 404);
  } else {
    const { data } = await supabase.from('email_conversations')
      .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo, company_id, wa_optout), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta)')
      .eq('id', emailId).maybeSingle();
    soloEmail = data;
    if (!soloEmail) return json({ error: 'Conversación no encontrada' }, 404);
    // Forma compatible con el front: una "conversacion" sin teléfono utilizable.
    conv = {
      id: null, email_only_id: soloEmail.id, telefono: soloEmail.email,
      contact_id: soloEmail.contact_id, company_id: soloEmail.company_id,
      contacts: soloEmail.contacts, companies: soloEmail.companies,
      estado: 'active', estado_crm: soloEmail.estado === 'cerrada' ? 'resuelta' : 'abierta',
      no_leidos: soloEmail.leida ? 0 : 1, asignado_a: soloEmail.asignado_a || null,
      snooze_until: null, ultimo_mensaje_at: soloEmail.ultimo_mensaje_at,
    };
  }

  // ── Los CORREOS del mismo contacto (o del mismo email si es email-only) ──
  const contactId = conv.contact_id;
  const emailContacto = conv.contacts?.email || (soloEmail ? soloEmail.email : null);
  let convsEmail: any[] = [];
  if (soloEmail) convsEmail = [soloEmail];
  else if (contactId || emailContacto) {
    const q = supabase.from('email_conversations').select('*').order('ultimo_mensaje_at', { ascending: false }).limit(5);
    const { data } = contactId
      ? await q.eq('contact_id', contactId)
      : await q.eq('email', emailContacto);
    convsEmail = data || [];
  }
  const correos: any[] = [];
  for (const ce of convsEmail) {
    const { data: msjs } = await supabase.from('email_messages')
      .select('id, direccion, de_email, para_email, asunto, cuerpo_texto, adjuntos, autor, created_at')
      .eq('conversation_id', ce.id).order('created_at', { ascending: true }).limit(200);
    correos.push({ conversacion: { id: ce.id, asunto: ce.asunto, estado: ce.estado, email: ce.email }, mensajes: msjs || [] });
  }

  // ── Mensajes de WhatsApp + notas + eventos (solo con ancla de WhatsApp) ──
  const [{ data: mensajes }, { data: notas }, { data: eventos }] = conv.id ? await Promise.all([
    supabase.from('wa_mensajes')
      .select('id, kapso_message_id, direccion, tipo, cuerpo, transcript, media_url, status, error, enviado_at, created_at')
      .eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(500),
    supabase.from('wa_notas')
      .select('id, autor, texto, created_at')
      .eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(200),
    supabase.from('wa_eventos')
      .select('id, tipo, detalle, autor, created_at')
      .eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(200),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as any;

  // Ventana de 24 h desde el último entrante de WhatsApp.
  const ultimoEntrante = [...(mensajes || [])].reverse().find((m: any) => m.direccion === 'entrante');
  const base = ultimoEntrante ? new Date(ultimoEntrante.enviado_at || ultimoEntrante.created_at).getTime() : 0;
  const expira = base + 24 * 3600 * 1000;
  const ventana = { abierta: base > 0 && Date.now() < expira, expira_at: base ? new Date(expira).toISOString() : null };

  // ── Canales disponibles para el composer ──
  const t = await resolverTenant().catch(() => null);
  const correoOk = !!emailContacto && !!t && puedeEnviar(t);
  const canales = {
    whatsapp: !!conv.id,
    correo: {
      ok: correoOk,
      email: emailContacto || null,
      // El hilo abierto (si hay) al que respondería el composer en modo Correo.
      conversation_id: convsEmail.find(c => c.estado === 'abierta')?.id || null,
      motivo: !emailContacto ? 'El contacto no tiene email'
        : (!t || !puedeEnviar(t)) ? 'Configura el remitente en Email → Ajustes' : null,
    },
  };

  // ── Marcar leído en ambos canales ──
  if (conv.id && (conv.no_leidos || 0) > 0) {
    await supabase.from('wa_conversaciones').update({ no_leidos: 0 }).eq('id', conv.id);
    conv.no_leidos = 0;
  }
  const sinLeer = convsEmail.filter(c => !c.leida).map(c => c.id);
  if (sinLeer.length) await supabase.from('email_conversations').update({ leida: true }).in('id', sinLeer);

  return json({ conversacion: conv, mensajes: mensajes || [], correos, eventos: eventos || [], notas: notas || [], ventana, canales });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const user = await getCurrentUser(request);
  const autor = user?.nombre || user?.email || 'equipo';
  const cambios: any = {};
  const eventos: Array<{ tipo: string; detalle: string }> = [];

  // Whitelist explícita: lo que el inbox puede tocar de una conversación.
  if ('asignado_a' in b) {
    cambios.asignado_a = b.asignado_a || null;
    if (b.asignado_a) {
      const { data: m } = await supabase.from('team_members').select('nombre').eq('id', b.asignado_a).maybeSingle();
      eventos.push({ tipo: 'asignada', detalle: `Asignada a ${m?.nombre || 'alguien'}` });
    } else eventos.push({ tipo: 'asignada', detalle: 'Sin asignar' });
  }
  if ('estado' in b && ['active', 'ended'].includes(b.estado)) cambios.estado = b.estado;
  if ('estado_crm' in b && ['abierta', 'pendiente', 'resuelta'].includes(b.estado_crm)) {
    cambios.estado_crm = b.estado_crm;
    eventos.push({ tipo: 'estado', detalle: `Marcada como ${b.estado_crm}` });
  }
  if ('snooze_until' in b) {
    cambios.snooze_until = b.snooze_until || null;
    eventos.push({
      tipo: 'snooze',
      detalle: b.snooze_until
        ? `Pospuesta hasta ${new Date(b.snooze_until).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : 'Despertada',
    });
  }
  if ('no_leidos' in b) cambios.no_leidos = Math.max(0, Number(b.no_leidos) || 0);
  // Ligar la conversación a un contacto recién creado (adopción manual).
  if ('contact_id' in b) cambios.contact_id = b.contact_id || null;
  if ('company_id' in b) cambios.company_id = b.company_id || null;
  if (!Object.keys(cambios).length) return json({ error: 'Nada que cambiar' }, 400);

  const { error } = await supabase.from('wa_conversaciones').update(cambios).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  for (const e of eventos) {
    await supabase.from('wa_eventos').insert({ conversation_id: b.id, tipo: e.tipo, detalle: e.detalle, autor });
  }
  return json({ ok: true });
};
