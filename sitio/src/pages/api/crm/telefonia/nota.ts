// TELEFONÍA · La nota que alguien escribió MIENTRAS hablaba. POST { call_id, texto }
//
// Lo que se apunta durante la llamada es lo que de verdad importa —un nombre,
// un número de sucursales, una objeción— y es justo lo que se pierde: al colgar
// hay que buscar la conversación, abrirla y escribirlo de memoria. Aquí se
// guarda desde la propia pantalla de la llamada, ligado a esa llamada, y
// aparece en el hilo como cualquier nota del equipo.
//
// Se guarda APARTE de la minuta automática a propósito: la minuta la escribe
// la máquina a partir del audio; esto lo escribió una persona y vale más.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const b = await request.json().catch(() => ({}));
  const callId = String(b.call_id || '').trim();
  const texto = String(b.texto || '').trim().slice(0, 4000);
  if (!/^CA[0-9a-f]{32}$/i.test(callId)) return json({ error: 'call_id inválido' }, 400);
  if (!texto) return json({ error: 'La nota viene vacía' }, 400);

  const { data: ll } = await supabase.from('wa_llamadas')
    .select('conversation_id, telefono').eq('call_id', callId).maybeSingle();
  if (!ll?.conversation_id) return json({ error: 'Esta llamada no tiene conversación en el inbox' }, 404);

  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('contact_id').eq('id', ll.conversation_id).maybeSingle();

  /* Idempotente por llamada: la pantalla guarda al colgar y también si el
     usuario toca «guardar». Se ACTUALIZA la nota de esa llamada en vez de
     dejar tres versiones del mismo apunte. */
  const { data: previa } = await supabase.from('wa_notas')
    .select('id').eq('conversation_id', ll.conversation_id)
    .eq('metadata->>nota_llamada', callId).maybeSingle();

  const fila = {
    conversation_id: ll.conversation_id,
    contact_id: (conv as any)?.contact_id || null,
    autor: (user as any)?.nombre || 'Equipo',
    texto: `📝 **Apunte durante la llamada**\n\n${texto}`,
    metadata: { nota_llamada: callId, tipo: 'nota_llamada', autor_id: (user as any)?.id || null },
  };
  if (previa?.id) await supabase.from('wa_notas').update({ texto: fila.texto }).eq('id', previa.id);
  else await supabase.from('wa_notas').insert(fila);

  return json({ ok: true, conversation_id: ll.conversation_id });
};
