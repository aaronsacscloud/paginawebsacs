// LLAMADAS INTELIGENTES · Lo que se le dice al PORTERO (la contestadora que
// pide nombre y motivo). Se reproduce solo en la pata del contacto, vía
// `AnnounceUrl`, sin sacarla de la sala.
import type { APIRoute } from 'astro';
import { xml } from '../../../../lib/telefonia/twilio';
import { getSesion, escapar } from '../../../../lib/telefonia/marcador';
import { supabase } from '../../../../lib/supabase';
import { leer } from './_comun';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'anuncio');
  if (r instanceof Response) return r;
  if (!r.item) return xml('');
  const { data: it } = await supabase.from('tel_sesion_items').select('id, sesion_id, nombre').eq('id', r.item).maybeSingle();
  const s = it ? await getSesion(it.sesion_id) : null;
  if (!s) return xml('');
  if (s.presentacion_audio_url) return xml(`<Play>${escapar(s.presentacion_audio_url)}</Play>`);
  const quien = s.presentacion_nombre ? `Soy ${s.presentacion_nombre}` : 'Le llamo de Sacscloud';
  const motivo = s.presentacion_motivo ? `, ${s.presentacion_motivo}` : '';
  const para = it?.nombre ? ` Busco a ${it.nombre}.` : '';
  return xml(`<Pause length="1"/><Say language="es-MX" voice="${escapar(s.presentacion_voz || 'Polly.Mia-Neural')}">${escapar(`${quien}${motivo}.${para} Gracias.`)}</Say>`);
};
