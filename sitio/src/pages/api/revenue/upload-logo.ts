import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Requiere sesión (cualquier rol: partner sube su logo desde el portal;
  // founder/cs desde el admin). Antes NO tenía auth → subida anónima a bucket
  // público (abuso de hosting/almacenamiento).
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return new Response(JSON.stringify({ error: 'No file' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  // Validate file type
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Tipo de archivo no permitido. Usa PNG, JPG, WebP o SVG.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Archivo muy grande. Maximo 2MB.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const ext = file.name.split('.').pop() || 'png';
  const filename = `logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Ensure bucket exists (idempotent)
  await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});

  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from('quotes').upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const { data: urlData } = supabase.storage.from('quotes').getPublicUrl(filename);

  return new Response(JSON.stringify({ url: urlData.publicUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
