// LLAMADAS INTELIGENTES · TwiML de la pata del CONTACTO: al contestar, Twilio
// pide aquí qué hacer. Se prende la transcripción en vivo de lo que él dice y
// se le mete a la sala donde ya espera el vendedor (con el micrófono apagado).
import type { APIRoute } from 'astro';
import { xml } from '../../../../lib/telefonia/twilio';
import { BASE, getSesion } from '../../../../lib/telefonia/marcador';
import { supabase } from '../../../../lib/supabase';
import { leer } from './_comun';
import { twimlRelay, vozConfigurada, configVoz } from '../../../../lib/telefonia/voz';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'twiml');
  if (r instanceof Response) return r;
  if (!r.item) return xml('<Hangup/>');
  const { data: it } = await supabase.from('tel_sesion_items').select('*').eq('id', r.item).maybeSingle();
  const s = it ? await getSesion(it.sesion_id) : null;
  // Si la sesión se pausó o el vendedor se fue mientras timbraba, no se le
  // deja al contacto una llamada muda: se cuelga sin decir nada.
  if (!it || !s || s.estado !== 'activa') return xml('<Hangup/>');
  // Fernanda al teléfono: en modo «ia» o «asistido» la pata del contacto se
  // conecta a la central de voz (no a la sala). El vendedor, si está, escucha
  // la transcripción en la cabina y puede tomar la llamada (handoff → relay-fin).
  if (s.modo && s.modo !== 'manual' && vozConfigurada() && (await configVoz()).encendida && url.searchParams.get('reenganche') !== '1') return xml(await twimlRelay(it, s));
  if (!s.agente_en_sala) return xml('<Hangup/>');

  // Reenganche: el vendedor se cayó y volvió; el contacto regresa de la
  // espera a la sala. La transcripción de esta llamada ya está corriendo.
  const reenganche = url.searchParams.get('reenganche') === '1';
  const cb = `${BASE}/api/telefonia/marcador/transcripcion?item=${it.id}`;
  // Las dos pistas: la del contacto (inbound) decide si es persona o máquina;
  // la del vendedor (outbound) solo alimenta el cierre con IA.
  return xml(
    (reenganche ? '' : `<Start><Transcription statusCallbackUrl="${cb}" statusCallbackMethod="POST" languageCode="es-MX" track="both_tracks" partialResults="true" enableAutomaticPunctuation="true"/></Start>`) +
    `<Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="false" beep="false" waitUrl="" ` +
    `statusCallback="${BASE}/api/telefonia/marcador/sala?sesion=${s.id}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">sesion-${s.id}</Conference></Dial>`,
  );
};
