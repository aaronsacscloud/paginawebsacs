// RECURSOS DEL AGENTE · subida directa a Storage (imágenes, PDF, video) sin pasar por la función
// (Vercel corta el body en 4.5 MB). Flujo: firmar → el navegador sube al signedUrl → registrar.
// POST { accion:'firmar', nombre, mime, bytes } → { signedUrl, path, tipo }
// POST { accion:'registrar', path, nombre, descripcion, cuando, mime, bytes } → { recurso }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { validarRecurso, asegurarFormatoWhatsApp, REGLAS_WA } from '../../../../lib/crm/ti/imagenes-agente';

export const prerender = false;
const BUCKET = 'wa-media';
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  return json({ reglas: REGLAS_WA });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'firmar') {
    const v = validarRecurso({ mime: b.mime, bytes: b.bytes, nombre: b.nombre });
    if (!v.ok) return json({ error: v.error }, 400);
    const ext = String(b.nombre || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `agente/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return json({ error: error?.message || 'No se pudo firmar la subida' }, 500);
    return json({ ok: true, signedUrl: data.signedUrl, token: data.token, path, tipo: v.tipo, convertir: v.convertir });
  }
  if (b.accion === 'registrar') {
    const path = String(b.path || '');
    if (!path.startsWith('agente/')) return json({ error: 'Ruta inválida' }, 400);
    const v = validarRecurso({ mime: b.mime, bytes: b.bytes, nombre: b.nombre });
    if (!v.ok) return json({ error: v.error }, 400);
    let url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    let mime = String(b.mime || '').split(';')[0];
    if (v.tipo === 'image' && v.convertir) {
      const f = await asegurarFormatoWhatsApp(url);
      if (f.error) return json({ error: `No pude convertir la imagen a JPG: ${f.error}` }, 400);
      url = f.url; mime = 'image/jpeg';
    }
    const nombre = String(b.nombre || '').replace(/\.[a-z0-9]+$/i, '').trim().slice(0, 120) || 'Recurso';
    const { data, error } = await supabase.from('ia_imagenes').insert({
      nombre, url, tipo: v.tipo, mime, bytes: Number(b.bytes) || null, archivo: path,
      descripcion: String(b.descripcion || '').trim().slice(0, 300) || null, cuando: String(b.cuando || '').trim().slice(0, 300) || null,
      giros: [], temas: [], created_by: user.id, grupo: String(b.grupo || '').trim().slice(0, 80) || null,
    }).select('*').single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from('ia_log').insert({ accion: 'galeria_recurso', razon: `${v.tipo} · ${nombre}`, detalle: { recurso_id: data.id, por: user.id, mime, bytes: b.bytes } });
    return json({ ok: true, recurso: data });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
