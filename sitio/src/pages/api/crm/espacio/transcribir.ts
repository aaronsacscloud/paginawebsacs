// POST /api/crm/espacio/transcribir { path } → { texto }
// Baja el audio del bucket y lo transcribe con Groq (whisper-large-v3-turbo,
// español); si Groq falla o no hay llave, OpenAI whisper-1. Sin ninguna de las
// dos, contesta texto null y el mensaje sale con "sin transcripción".
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, pasaRitmo } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

async function whisper(url: string, key: string, modelo: string, bytes: ArrayBuffer, mime: string): Promise<string | null> {
  const ext = /mpeg|mp3/.test(mime) ? 'mp3' : /ogg|opus/.test(mime) ? 'ogg' : /mp4|m4a|aac/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : 'webm';
  const fd = new FormData();
  fd.append('file', new File([bytes], `nota.${ext}`, { type: mime }));
  fd.append('model', modelo);
  fd.append('language', 'es');
  fd.append('response_format', 'json');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(55000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return String(j.text || '').trim() || null;
}

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const path = String(b.path || '');
  // Solo audios propios: el path arranca con el id del que lo subió.
  if (!path.startsWith(yo.id.replace(/-/g, '') + '/') || !/^[a-z0-9]{4,}\/[\w./-]{8,}$/i.test(path)) return json({ error: 'Audio no encontrado' }, 404);
  if (!pasaRitmo(`tr:${yo.id}`, 20)) return json({ error: 'Muy rápido' }, 429);

  const { data: blob, error } = await supabase.storage.from('espacio').download(path);
  if (error || !blob) return json({ error: 'No se pudo leer el audio' }, 404);
  const bytes = await blob.arrayBuffer();
  const mime = blob.type || 'audio/webm';

  const groq = env('GROQ_API_KEY'), openai = env('OPENAI_API_KEY');
  if (!groq && !openai) return json({ texto: null, error: 'Sin servicio de transcripción configurado' });
  let ultimo = '';
  if (groq) {
    try { return json({ texto: await whisper('https://api.groq.com/openai/v1/audio/transcriptions', groq, 'whisper-large-v3-turbo', bytes, mime), motor: 'groq' }); }
    catch (e: any) { ultimo = String(e?.message || e); }
  }
  if (openai) {
    try { return json({ texto: await whisper('https://api.openai.com/v1/audio/transcriptions', openai, 'whisper-1', bytes, mime), motor: 'openai' }); }
    catch (e: any) { ultimo = String(e?.message || e); }
  }
  return json({ texto: null, error: ultimo.slice(0, 160) });
};
