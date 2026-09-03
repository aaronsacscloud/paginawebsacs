// POST /api/crm/espacio/subir { tipo: imagen|audio|thumb, mime, bytes, nombre? }
// → { path, url, token }. El navegador sube el archivo DIRECTO al bucket
// privado `espacio` con esa URL firmada (2 min); la función nunca carga el
// binario. Después, el path va en el adjunto del mensaje.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, pasaRitmo, LIMITES } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const MIMES: Record<string, Record<string, string>> = {
  imagen: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' },
  thumb: { 'image/jpeg': 'jpg', 'image/webp': 'webp' },
  audio: { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/webm': 'webm' },
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const tipo = String(b.tipo || '');
  const mime = String(b.mime || '').split(';')[0].trim().toLowerCase();
  const bytes = Number(b.bytes || 0);
  const ext = MIMES[tipo]?.[mime];
  if (!ext) return json({ error: `Formato no permitido (${mime || 'sin tipo'})` }, 400);
  const tope = tipo === 'audio' ? LIMITES.audio_bytes : LIMITES.imagen_bytes;
  if (!bytes || bytes > tope) return json({ error: `Archivo muy grande: máximo ${Math.round(tope / 1048576)} MB` }, 413);
  if (!pasaRitmo(`subir:${yo.id}`, 40)) return json({ error: 'Muy rápido' }, 429);

  // <usuario sin guiones>/<aaaa-mm>/<aleatorio>.<ext> — cumple el patrón que
  // valida mensajes.ts y deja ver de quién y de cuándo es cada archivo.
  const d = new Date();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => x.toString(16).padStart(2, '0')).join('');
  const path = `${yo.id.replace(/-/g, '')}/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${rand}${tipo === 'thumb' ? '-t' : ''}.${ext}`;
  const { data, error } = await supabase.storage.from('espacio').createSignedUploadUrl(path);
  if (error || !data) return json({ error: 'No se pudo preparar la subida: ' + (error?.message || '') }, 500);
  return json({ path, url: data.signedUrl, token: data.token });
};
