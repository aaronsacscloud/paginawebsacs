// LLAMADAS INTELIGENTES · La espera del contacto cuando el vendedor se cayó en
// plena conversación (se le fue el internet, cerró la pestaña). En vez de
// colgarle, se le pide un segundo y se aguanta ~20 s; si el vendedor reentra a
// la sala en ese lapso, `procesarSala` lo regresa a la conferencia
// (twiml?reenganche=1). Si no, se le pide una disculpa y se cuelga; el
// `completed` de esa llamada lo reprograma para volver a marcar.
import type { APIRoute } from 'astro';
import { xml } from '../../../../lib/telefonia/twilio';
import { escapar } from '../../../../lib/telefonia/marcador';
import { supabase } from '../../../../lib/supabase';
import { leer } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'espera');
  if (r instanceof Response) return r;
  if (!r.item) return xml('<Hangup/>');
  const { data: it } = await supabase.from('tel_sesion_items').select('id, estado, agente_salio_at').eq('id', r.item).maybeSingle();
  if (!it || it.estado !== 'en_linea') return xml('<Hangup/>');
  const voz = 'Polly.Mia-Neural';
  return xml(
    `<Say language="es-MX" voice="${voz}">${escapar('Un segundo, no cuelgue por favor.')}</Say>` +
    `<Pause length="18"/>` +
    `<Say language="es-MX" voice="${voz}">${escapar('Disculpe, se nos cortó la llamada. Le volvemos a marcar en unos minutos.')}</Say>` +
    `<Hangup/>`,
  );
};
