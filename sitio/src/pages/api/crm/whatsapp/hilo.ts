// WHATSAPP · Un hilo completo: mensajes, notas internas y la ventana de 24 h.
//
// GET ?id=<conversation_id>  → { conversacion, mensajes, notas, ventana }
//   Abrir el hilo MARCA leído (no_leidos = 0): el que lo lee, lo leyó.
// PUT { id, asignado_a? | estado? | no_leidos? }  (whitelist, patrón email)
//
// La ventana de 24 h de Meta se calcula del último mensaje ENTRANTE: dentro
// de ella se puede escribir texto libre; fuera, solo plantilla aprobada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('*, contacts(id, nombre, apellido, email, lifecycle_stage, tipo, company_id), companies(id, nombre, nombre_comercial, plan, mrr, sucursales, giro, estado_cuenta)')
    .eq('id', id).maybeSingle();
  if (!conv) return json({ error: 'Conversación no encontrada' }, 404);

  const [{ data: mensajes }, { data: notas }] = await Promise.all([
    supabase.from('wa_mensajes')
      .select('id, kapso_message_id, direccion, tipo, cuerpo, transcript, media_url, status, error, enviado_at, created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(500),
    supabase.from('wa_notas')
      .select('id, autor, texto, created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(200),
  ]);

  // Ventana de 24 h desde el último entrante.
  const ultimoEntrante = [...(mensajes || [])].reverse().find(m => m.direccion === 'entrante');
  const base = ultimoEntrante ? new Date(ultimoEntrante.enviado_at || ultimoEntrante.created_at).getTime() : 0;
  const expira = base + 24 * 3600 * 1000;
  const ventana = { abierta: base > 0 && Date.now() < expira, expira_at: base ? new Date(expira).toISOString() : null };

  if ((conv.no_leidos || 0) > 0) {
    await supabase.from('wa_conversaciones').update({ no_leidos: 0 }).eq('id', id);
    conv.no_leidos = 0;
  }

  return json({ conversacion: conv, mensajes: mensajes || [], notas: notas || [], ventana });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const cambios: any = {};
  // Whitelist explícita: lo que el inbox puede tocar de una conversación.
  if ('asignado_a' in b) cambios.asignado_a = b.asignado_a || null;
  if ('estado' in b && ['active', 'ended'].includes(b.estado)) cambios.estado = b.estado;
  if ('estado_crm' in b && ['abierta', 'pendiente', 'resuelta'].includes(b.estado_crm)) cambios.estado_crm = b.estado_crm;
  if ('snooze_until' in b) cambios.snooze_until = b.snooze_until || null;
  if ('no_leidos' in b) cambios.no_leidos = Math.max(0, Number(b.no_leidos) || 0);
  // Ligar la conversación a un contacto recién creado (adopción manual).
  if ('contact_id' in b) cambios.contact_id = b.contact_id || null;
  if ('company_id' in b) cambios.company_id = b.company_id || null;
  if (!Object.keys(cambios).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('wa_conversaciones').update(cambios).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
