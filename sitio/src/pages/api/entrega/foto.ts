// Foto o captura pegada a una nota de la CHECKLIST DE ENTREGA (19-oct-2026).
// La tableta la comprime antes de subirla (JPEG, ~1600 px). El bucket es
// público, igual que el de proyectos: el candado es la ruta, que lleva el
// código de la sesión y un sufijo aleatorio — no se adivina.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const CODIGO = /^[a-z0-9]{12,40}$/;
const MAX = 8 * 1024 * 1024;
const TIPOS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const BUCKET = 'entregas';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, error: 'Petición inválida.' }, 400);
  const codigo = String(form.get('codigo') || '');
  if (!CODIGO.test(codigo)) return json({ ok: false, error: 'Código inválido.' }, 400);
  const file = form.get('file') as File | null;
  if (!file || !file.size) return json({ ok: false, error: 'No llegó la foto.' }, 400);
  if (file.size > MAX) return json({ ok: false, error: 'La foto pesa más de 8 MB.' }, 413);
  const ext = TIPOS[file.type];
  if (!ext) return json({ ok: false, error: 'Solo fotos JPG, PNG o WebP.' }, 400);

  // Solo sesiones que existen: la liga del consultor es la llave.
  const { data: fila, error: eLee } = await supabase.from('entregas_checklist').select('codigo').eq('codigo', codigo).maybeSingle();
  if (eLee) return json({ ok: false, error: 'No se pudo subir.' }, 503);
  if (!fila) return json({ ok: false, error: 'Esa sesión no existe.' }, 404);

  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const ruta = `${codigo}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) return json({ ok: false, error: 'No se pudo subir la foto.' }, 503);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return json({ ok: true, url: data.publicUrl });
};
