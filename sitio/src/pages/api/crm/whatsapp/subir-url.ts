// WHATSAPP · URL firmada para subir un archivo GRANDE directo del navegador a
// Storage, sin pasar por la función serverless (tope ~4.5 MB en Vercel).
// POST { nombre, mime, conversation_id } → { signed_url, token, path, public_url }
// Luego el front manda { media_url: public_url } a /enviar.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const nombre = String(b.nombre || 'archivo').replace(/[^\w.\-]+/g, '_').slice(-80);
  const conv = String(b.conversation_id || 'sin-conv').replace(/[^\w-]/g, '');
  const path = `wa/${conv}/${Date.now()}_${nombre}`;
  await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});
  const { data, error } = await supabase.storage.from('quotes').createSignedUploadUrl(path);
  if (error || !data) return json({ error: error?.message || 'No se pudo firmar la subida' }, 500);
  const { data: pub } = supabase.storage.from('quotes').getPublicUrl(path);
  return json({ signed_url: data.signedUrl, token: data.token, path, public_url: pub.publicUrl });
};
