// TELEFONÍA · Generar (o rehacer) el PDF de la minuta de una llamada y decidir
// su entrega. POST { call_id }.
//
// Normalmente esto corre solo, en cuanto Claude termina de redactar la minuta.
// Este endpoint es la puerta manual para los dos casos en que hace falta:
// una llamada vieja que quedó sin documento, y un envío que falló y se quiere
// reintentar sin esperar a nada.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { generarYEntregarMinuta } from '../../../../lib/minuta/entrega';
import { supabase } from '../../../../lib/supabase';
import { redactarMinuta } from '../../../../lib/whatsapp/minuta.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const b = await request.json().catch(() => ({}));
  const callId = String(b.call_id || '').trim();
  if (!/^CA[0-9a-f]{32}$/i.test(callId)) return json({ error: 'call_id inválido' }, 400);

  /* `redactar: true` vuelve a escribir la minuta DESDE LA TRANSCRIPCIÓN que ya
     está guardada, sin bajar ni volver a transcribir el audio. Hace falta para
     las llamadas anteriores a que existiera la versión del cliente, y para
     cuando se afina el prompt: re-procesar el audio costaría minutos y dinero
     para repetir un paso que ya está hecho. */
  if (b.redactar === true) {
    const { data: ll } = await supabase.from('wa_llamadas')
      .select('transcript, canal, direccion, duracion_seg, conversation_id, telefono').eq('call_id', callId).maybeSingle();
    if (!ll?.transcript) return json({ error: 'Esta llamada no tiene transcripción guardada' }, 404);

    let quien = ll.telefono;
    if (ll.conversation_id) {
      const { data: cv } = await supabase.from('wa_conversaciones')
        .select('contacts(nombre, apellido), companies(nombre_comercial, nombre)').eq('id', ll.conversation_id).maybeSingle();
      const c: any = (cv as any)?.contacts, e: any = (cv as any)?.companies;
      if (c?.nombre) quien = `${c.nombre} ${c.apellido || ''}`.trim() + (e ? ` (${e.nombre_comercial || e.nombre})` : '');
    }
    const seg = Number(ll.duracion_seg || 0);
    const red = await redactarMinuta({
      transcript: ll.transcript, quien, canal: ll.canal, direccion: ll.direccion,
      dur: seg ? `${Math.floor(seg / 60)} min ${seg % 60} s` : 'desconocida',
    });
    await supabase.from('wa_llamadas').update({
      minuta: red.minuta || undefined, minuta_cliente: red.minuta_cliente || null,
      siguiente_paso: red.siguiente_paso || null, minuta_at: new Date().toISOString(),
      // Los PDF viejos se descartan para que se vuelvan a dibujar con el texto nuevo.
      minuta_pdf_url: null, minuta_pdf_cliente_url: null,
    }).eq('call_id', callId);
  }

  const r = await generarYEntregarMinuta(callId);
  return json(r);
};
