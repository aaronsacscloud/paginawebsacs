// Twilio llama aquí cuando termina el <Connect><ConversationRelay> de Fernanda.
// Si Fernanda pidió pasar la llamada a un humano (HandoffData) y el vendedor
// sigue en la sala, la pata del contacto entra a la conferencia; si no, cuelga.
import type { APIRoute } from 'astro';
import { leer } from './_comun';
import { xml } from '../../../../lib/telefonia/twilio';
import { supabase } from '../../../../lib/supabase';
import { BASE, getSesion } from '../../../../lib/telefonia/marcador';

export const prerender = false;
const BASE_TX = (item: string) => `${BASE}/api/telefonia/marcador/transcripcion?item=${item}`;
const BASE_SALA = (sesion: string) => `${BASE}/api/telefonia/marcador/sala?sesion=${sesion}`;

export const POST: APIRoute = async ({ request, url }) => {
  const r = await leer(request, url, 'relay-fin');
  if (r instanceof Response) return r;
  if (!r.item) return xml('<Hangup/>');
  const { data: it } = await supabase.from('tel_sesion_items').select('id, sesion_id, voz').eq('id', r.item).maybeSingle();
  const s = it ? await getSesion(it.sesion_id) : null;
  if (!it || !s) return xml('<Hangup/>');
  let handoff: any = null;
  try { handoff = r.p.HandoffData ? JSON.parse(r.p.HandoffData) : null; } catch { handoff = null; }
  const ahora = new Date().toISOString();
  const voz = { ...((it.voz as any) || {}), relay_fin: { motivo: handoff?.motivo || null, status: r.p.SessionStatus || null, at: ahora } };
  if (handoff?.motivo === 'pasa_a_humano' && s.estado === 'activa' && s.agente_en_sala) {
    voz.handoff = { ...(voz.handoff || {}), entro_sala_at: ahora };
    await supabase.from('tel_sesion_items').update({ voz, updated_at: ahora }).eq('id', it.id);
    return xml(
      `<Start><Transcription statusCallbackUrl="${BASE_TX(it.id)}" statusCallbackMethod="POST" languageCode="es-MX" track="both_tracks" partialResults="true" enableAutomaticPunctuation="true"/></Start>` +
      `<Dial><Conference beep="false" startConferenceOnEnter="false" endConferenceOnExit="false" waitUrl="" ` +
      `statusCallback="${BASE_SALA(s.id)}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">sesion-${s.id}</Conference></Dial>`,
    );
  }
  await supabase.from('tel_sesion_items').update({ voz, updated_at: ahora }).eq('id', it.id);
  return xml('<Hangup/>');
};
