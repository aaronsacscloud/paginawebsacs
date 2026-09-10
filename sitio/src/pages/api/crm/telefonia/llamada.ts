// TELEFONÍA · Estado real de UNA llamada, para el panel del navegador.
// GET ?call_id=CAxxx → { estado, duracion_seg, motivo, minuta, ... }
//
// Por qué existe: el SDK del navegador solo sabe que la llamada terminó, NO
// por qué. «Colgué yo», «comunicaba», «no contestó» y «el número no existe»
// llegan todas como un mismo `disconnect`. El desenlace de verdad lo escribe
// Twilio en el espejo (`/api/telefonia/estado`), y la minuta la escribe el
// pipeline de la grabación. Este endpoint es la ventana a las dos cosas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const callId = String(url.searchParams.get('call_id') || '').trim();
  // Un CallSid de Twilio es `CA` + 32 hex. Validarlo evita que este endpoint
  // sirva para pasear por la tabla con ids ajenos.
  if (!/^CA[0-9a-f]{32}$/i.test(callId)) return json({ error: 'call_id inválido' }, 400);

  const { data } = await supabase.from('wa_llamadas')
    .select('call_id, estado, direccion, telefono, duracion_seg, motivo, started_at, answered_at, ended_at, conversation_id, transcript, minuta, minuta_at, siguiente_paso')
    .eq('call_id', callId).eq('canal', 'telefono').maybeSingle();

  // Todavía no existe: el webhook de Twilio puede tardar un instante en
  // escribirla. No es un error — es «aún no», y el cliente reintenta.
  if (!data) return json({ existe: false });

  const dur = Number(data.duracion_seg || 0);
  const viva = ['timbrando', 'aceptada'].includes(String(data.estado));
  return json({
    existe: true,
    ...data,
    // Si habló menos de 20 s no habrá minuta NUNCA (la grabación ni se manda a
    // transcribir). Decirlo explícito evita dejar al usuario esperando una
    // barra de progreso que no va a llegar a ningún lado.
    minuta_esperada: !viva && dur >= 20,
    minuta_lista: !!data.minuta,
  });
};
