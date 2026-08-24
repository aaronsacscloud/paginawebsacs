// TELEFONÍA · recordingStatusCallback: al terminar la grabación, Twilio nos
// avisa; descargamos el mp3 y corre el MISMO pipeline de minuta que WhatsApp
// (Whisper → Claude → hilo/panel/ficha). PÚBLICO con firma validada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaValida, descargarGrabacion } from '../../../lib/telefonia/twilio';
import { generarMinutaDesdeAudio } from '../../../lib/whatsapp/minuta.lib';

export const prerender = false;
const BASE = 'https://www.sacscloud.com';
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!firmaValida(`${BASE}/api/telefonia/grabacion`, p, request.headers.get('x-twilio-signature'))) return json({ ok: false }, 403);
  if (p.RecordingStatus && p.RecordingStatus !== 'completed') return json({ ok: true });

  const callId = p.CallSid;
  const dur = parseInt(p.RecordingDuration || '0', 10) || 0;
  if (dur > 0) await supabase.from('wa_llamadas').update({ duracion_seg: dur }).eq('call_id', callId).is('duracion_seg', null);
  if (dur < 20) return json({ ok: true, motivo: 'muy corta para minuta' });

  try {
    const buf = await descargarGrabacion(p.RecordingUrl);
    const r = await generarMinutaDesdeAudio(callId, buf, 'audio/mpeg');
    return json({ ok: r.ok, ...(r.ok ? {} : { motivo: r.error }) });
  } catch (e: any) {
    return json({ ok: false, motivo: String(e?.message || e) });
  }
};
