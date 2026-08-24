// WHATSAPP · Minuta automática de llamadas (endpoint del navegador).
//
// POST multipart {audio, call_id} — la grabación que el navegador hizo durante
// la llamada. El pipeline real vive en lib/whatsapp/minuta.lib.ts (compartido
// con la telefonía normal de Twilio).
// GET ?call_id=… → { llamada } (para saber si la minuta ya está lista).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { generarMinutaDesdeAudio } from '../../../../lib/whatsapp/minuta.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const callId = url.searchParams.get('call_id') || '';
  if (!callId) return json({ error: 'Falta call_id' }, 400);
  const { data } = await supabase.from('wa_llamadas')
    .select('call_id, estado, duracion_seg, transcript, minuta, minuta_at, siguiente_paso')
    .eq('call_id', callId).maybeSingle();
  return json({ llamada: data || null });
};

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Se esperaba multipart/form-data' }, 400);
  const audio = form.get('audio') as File | null;
  const callId = String(form.get('call_id') || '');
  if (!audio || !callId) return json({ error: 'Faltan audio y call_id' }, 400);
  if (audio.size < 12_000) return json({ error: 'La grabación es demasiado corta para una minuta' }, 400);
  if (audio.size > 50 * 1024 * 1024) return json({ error: 'Grabación mayor a 50 MB' }, 400);

  const r = await generarMinutaDesdeAudio(callId, await audio.arrayBuffer(), audio.type || 'audio/webm');
  if (!r.ok) return json({ error: r.error, ...(r.transcript !== undefined ? { transcript: r.transcript } : {}) }, r.status);
  return json({ ok: true, minuta: r.minuta, siguiente_paso: r.siguiente_paso, transcript_len: r.transcript_len });
};
