import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// Adjuntos de cotización (specs de hardware, brochures, comparativas).
// Mismo bucket público 'quotes' que upload-logo, prefijo attachments/.

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return new Response(JSON.stringify({ error: 'No file' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Tipo no permitido. Usa PDF, PNG, JPG o WebP.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Máx 5MB (los PDFs de specs suelen pesar más que un logo)
  if (file.size > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Archivo muy grande. Máximo 5MB.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const filename = `attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from('quotes').upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const { data: urlData } = supabase.storage.from('quotes').getPublicUrl(filename);

  return new Response(JSON.stringify({ url: urlData.publicUrl, name: file.name }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
