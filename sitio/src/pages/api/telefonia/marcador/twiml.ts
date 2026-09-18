// LLAMADAS INTELIGENTES · TwiML de la pata del CONTACTO: al contestar, Twilio
// pide aquí qué hacer. Se prende la transcripción en vivo de lo que él dice y
// se le mete a la sala donde ya espera el vendedor (con el micrófono apagado).
import type { APIRoute } from 'astro';
import { xml } from '../../../../lib/telefonia/twilio';
import { BASE, getSesion, lineasDe } from '../../../../lib/telefonia/marcador';
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
  /* ══ EN PARALELO, CADA LLAMADA ESPERA EN SU PROPIO CUARTO ════════════════
     Con varias líneas el contacto NO entra a la sala del vendedor al contestar:
     entraría junto con otros dos tonos y el vendedor oiría un revoltijo. Cada
     una espera sola, en silencio, mientras la transcripción decide si contestó
     una persona; en ese momento `alVeredicto` mueve a la sala al primero que
     habló y cuelga a los demás.

     Es el mismo TwiML salvo el nombre del cuarto, a propósito: así el camino
     de una línea —el de siempre, donde el vendedor oye el timbre— no cambia ni
     un carácter. */
  const cuarto = lineasDe(s) > 1 ? `espera-${it.id}` : `sesion-${s.id}`;
  const avisoSala = lineasDe(s) > 1 ? '' :
    `statusCallback="${BASE}/api/telefonia/marcador/sala?sesion=${s.id}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave"`;
  return xml(
    (reenganche ? '' : `<Start><Transcription statusCallbackUrl="${cb}" statusCallbackMethod="POST" languageCode="es-MX" track="both_tracks" partialResults="true" enableAutomaticPunctuation="true"/></Start>`) +
    `<Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="false" beep="false" waitUrl="" ${avisoSala}>${cuarto}</Conference></Dial>`,
  );
};
