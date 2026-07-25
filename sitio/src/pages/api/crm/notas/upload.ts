// Upload de imágenes/PDFs para el LIENZO de notas del cliente (tab Notas).
// Mismo patrón que revenue/upload-attachment.ts: bucket público 'quotes',
// prefijo notas/. Founder-only (middleware /api/crm/*).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file' }, 400);

  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) return json({ error: 'Tipo no permitido. Usa PDF, PNG, JPG, WebP o GIF.' }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: 'Archivo muy grande. Máximo 8MB.' }, 400);

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const filename = `notas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});
  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from('quotes').upload(filename, buffer, { contentType: file.type, upsert: false });
  if (error) return json({ error: error.message }, 500);

  const { data: urlData } = supabase.storage.from('quotes').getPublicUrl(filename);
  return json({ url: urlData.publicUrl, name: file.name, es_pdf: file.type === 'application/pdf' });
};
