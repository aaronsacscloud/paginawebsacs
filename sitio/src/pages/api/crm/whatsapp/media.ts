// WHATSAPP · Biblioteca de medios del inbox (bucket Storage público `wa-media`).
// GET → { archivos } (con url pública) · POST multipart {file, nombre?, descripcion?, categoria?}
// · POST JSON {uso:id} incrementa usage_count · DELETE {id}
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const BUCKET = 'wa-media';
const tipoDe = (mime: string) => mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('wa_media_files').select('*').order('usage_count', { ascending: false }).order('created_at', { ascending: false });
  const archivos = (data || []).map(f => ({ ...f, url: supabase.storage.from(BUCKET).getPublicUrl(f.path).data.publicUrl }));
  return json({ archivos });
};

export const POST: APIRoute = async ({ request }) => {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    const b = await request.json().catch(() => ({}));
    if (b.uso) {
      const { data } = await supabase.from('wa_media_files').select('usage_count').eq('id', b.uso).maybeSingle();
      await supabase.from('wa_media_files').update({ usage_count: (data?.usage_count || 0) + 1 }).eq('id', b.uso);
      return json({ ok: true });
    }
    return json({ error: 'Body inválido' }, 400);
  }
  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return json({ error: 'Falta file' }, 400);
  if (file.size > 4 * 1024 * 1024) return json({ error: 'Máximo 4 MB' }, 400);
  const mime = (file.type || 'application/octet-stream').split(';')[0];
  const nombreLimpio = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${Date.now()}_${nombreLimpio}`;
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
  const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: mime, upsert: false });
  if (eUp) return json({ error: `Upload: ${eUp.message}` }, 500);
  const { data, error } = await supabase.from('wa_media_files').insert({
    nombre: String(form.get('nombre') || file.name).slice(0, 120),
    descripcion: String(form.get('descripcion') || '') || null,
    categoria: String(form.get('categoria') || '') || null,
    path, tipo: tipoDe(mime), mime, bytes: file.size,
  }).select('*').single();
  if (error) { await supabase.storage.from(BUCKET).remove([path]).catch(() => {}); return json({ error: error.message }, 500); }
  return json({ ok: true, archivo: { ...data, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl } });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const { data } = await supabase.from('wa_media_files').select('path').eq('id', b.id).maybeSingle();
  if (data?.path) await supabase.storage.from(BUCKET).remove([data.path]).catch(() => {});
  await supabase.from('wa_media_files').delete().eq('id', b.id);
  return json({ ok: true });
};
