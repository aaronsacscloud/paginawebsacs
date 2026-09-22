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

  /* ══ 🔴 GUARDAR EL AUDIO Y HACER LA MINUTA SON DOS COSAS (19-sep-2026) ════
     Pedido del dueño: «todo hay que grabarlo, porque quiero usar esto luego
     para pasarlo a ElevenLabs y clonar mi voz junto al pitch que hago, para
     optimizar la llamada inicial».

     La grabación YA se disparaba sola en toda conversación con una persona
     —dual, una pista por voz— pero este webhook la TIRABA sin guardarla cuando
     la llamada duraba menos de 20 segundos: «muy corta para minuta». Y tenía
     sentido para la minuta… y ninguno para el audio. De 124 llamadas del mes
     sólo 28 tienen archivo, y las que faltan son justo las cortas: las de la
     apertura, que es el material que él quiere.

     Ahora se guarda SIEMPRE, y la minuta sigue con su umbral. Dos decisiones
     distintas, cada una con su criterio: el audio cuesta unos kilobytes y no
     se puede volver a pedir; la minuta cuesta una transcripción y una llamada
     a la IA, y de veinte segundos no sale nada que leer. */
  try {
    const buf = await descargarGrabacion(p.RecordingUrl);
    /* Mejora #2 (22-sep): el umbral de la minuta ya no es 20 s sino «más de
       3:00» y lo decide `generarMinutaDesdeAudio` con la duración real de la
       llamada. Aquí sólo se ahorra el paso por esa función cuando ni siquiera
       la grabación llega a 20 s. */
    if (dur < 20) {
      // Mismo bucket y misma forma de ruta que la minuta: `wa-media` + `llamadas/<sid>.mp3`.
      const path = `llamadas/${callId}.mp3`;
      const { error } = await supabase.storage.from('wa-media').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
      if (!error) await supabase.from('wa_llamadas').update({ grabacion_path: path }).eq('call_id', callId);
      return json({ ok: true, motivo: 'guardada; muy corta para minuta' });
    }
    const r = await generarMinutaDesdeAudio(callId, buf, 'audio/mpeg', { duracionSeg: dur || null });
    return json({ ok: r.ok || !!(r as any).omitida, ...(r.ok ? {} : { motivo: r.error }) });
  } catch (e: any) {
    return json({ ok: false, motivo: String(e?.message || e) });
  }
};
