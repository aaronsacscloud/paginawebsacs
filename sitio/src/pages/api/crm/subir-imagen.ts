// CRM · URL firmada para subir imágenes ya optimizadas desde el navegador.
// POST { nombre, mime, carpeta } → { signed_url, public_url, path }
// El navegador optimiza (lib/crm/imagen.ts) y sube directo a Storage: la
// función serverless no toca bytes (tope de 4.5 MB de Vercel no aplica).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const BUCKET = 'quotes';   // bucket público que ya usamos para media del inbox
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const mime = String(b.mime || '').toLowerCase();
  if (!MIMES.includes(mime)) return json({ error: `Tipo no permitido: ${mime || '(vacío)'}` }, 400);
  const carpeta = String(b.carpeta || 'general').replace(/[^\w-]+/g, '').slice(0, 30) || 'general';
  const nombre = String(b.nombre || 'imagen').replace(/[^\w.\-]+/g, '_').slice(-60);
  const path = `img/${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${nombre}`;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return json({ error: error?.message || 'No se pudo firmar la subida' }, 500);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return json({ signed_url: data.signedUrl, public_url: pub.publicUrl, path });
};
