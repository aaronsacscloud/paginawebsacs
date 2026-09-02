// TRANSCRIPCIÓN DE NOTAS DE VOZ DE WHATSAPP (Groq · whisper-large-v3-turbo).
//
// El lead «puede platicarlo por audio» — pero 105 de 106 audios de leads
// estaban sin transcripción, así que el agente los veía como «[audio sin
// transcripción]». Este barrido toma los audios recientes sin transcript, baja
// el binario por Kapso y lo transcribe. Corre con el observador; es barato
// (centavos por audio) y solo toca mensajes de los últimos días.
import { supabase } from '../supabase';

const GROQ_KEY = ((import.meta as any).env?.GROQ_API_KEY || process.env.GROQ_API_KEY || '').trim();

export async function transcribirAudio(bytes: ArrayBuffer, mime: string): Promise<string | null> {
  if (!GROQ_KEY) return null;
  const ext = /mpeg|mp3/.test(mime) ? 'mp3' : /ogg|opus/.test(mime) ? 'ogg' : /mp4|m4a|aac/.test(mime) ? 'm4a' : 'webm';
  const wf = new FormData();
  wf.append('file', new File([bytes], `nota.${ext}`, { type: mime }));
  wf.append('model', 'whisper-large-v3-turbo');
  wf.append('language', 'es');
  wf.append('response_format', 'json');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: wf, signal: AbortSignal.timeout(60000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Whisper: ${j?.error?.message || r.status}`);
  return String(j.text || '').trim() || null;
}

/** Barrido: audios entrantes de los últimos `dias` sin transcript. */
export async function transcribirPendientes(opts: { dias?: number; max?: number } = {}): Promise<any> {
  const res: any = { transcritos: 0, sin_media: 0, errores: 0 };
  if (!GROQ_KEY) return { transcripcion: 'sin_groq_key' };
  const desde = new Date(Date.now() - (opts.dias ?? 7) * 86400e3).toISOString();
  const { data: audios } = await supabase.from('wa_mensajes').select('id, media_id, media_url, mime, created_at')
    .eq('tipo', 'audio').eq('direccion', 'entrante').is('transcript', null).is('borrado_at', null)
    .gte('created_at', desde).order('created_at', { ascending: false }).limit(opts.max ?? 8);
  if (!(audios || []).length) return res;
  const { descargarMedia } = await import('./kapso-api');
  for (const a of audios || []) {
    try {
      let bytes: ArrayBuffer | null = null, mime = a.mime || 'audio/ogg';
      if (a.media_id) { const m = await descargarMedia(a.media_id); if (m) { bytes = m.bytes; mime = m.mime || mime; } }
      else if (a.media_url) { const r = await fetch(a.media_url, { signal: AbortSignal.timeout(20000) }); if (r.ok) { bytes = await r.arrayBuffer(); mime = r.headers.get('content-type') || mime; } }
      if (!bytes) { res.sin_media++; await supabase.from('wa_mensajes').update({ transcript: '' }).eq('id', a.id); continue; } // '' = intentado, sin media
      const t = await transcribirAudio(bytes, mime);
      await supabase.from('wa_mensajes').update({ transcript: t || '' }).eq('id', a.id);
      if (t) res.transcritos++;
    } catch (e: any) { res.errores++; res.ultimo_error = String(e?.message || e).slice(0, 120); }
  }
  return res;
}
