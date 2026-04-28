import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Tipo no permitido. Usa PNG, JPG, WebP, HEIC o PDF.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Max 5MB (comprobantes pueden ser fotos del bauche)
  if (file.size > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Archivo muy grande. Máximo 5MB.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const ext = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const filename = `comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Reusa el bucket "quotes" que ya existe en upload-logo.ts
  await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from('quotes').upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: urlData } = supabase.storage.from('quotes').getPublicUrl(filename);
  return new Response(JSON.stringify({ url: urlData.publicUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
