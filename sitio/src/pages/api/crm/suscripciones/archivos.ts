// Documentos de una suscripción: contratos, anexos, comprobantes.
//
// GET    ?id=<sub>              → lista con liga temporal para cada archivo
// POST   multipart {id, file}   → sube
// DELETE { id, path }           → borra
//
// Los binarios van al bucket PRIVADO crm-docs, no al público donde viven los
// adjuntos de cotización. Un brochure en un bucket público da igual; un
// contrato firmado ahí queda accesible para cualquiera con la liga y sin
// sesión, y esa liga no caduca nunca.
//
// Por eso no se guarda una URL: se guarda el path y cada vez que alguien abre
// la ficha se firma una liga que expira. Si el enlace se filtra, muere en una
// hora.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const BUCKET = 'crm-docs';
const VIGENCIA = 3600;   // 1 hora
const MAX = 15 * 1024 * 1024;
const TIPOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function leer(id: string) {
  const { data } = await supabase.from('subscriptions').select('id, archivos').eq('id', id).maybeSingle();
  return Array.isArray(data?.archivos) ? data!.archivos : [];
}

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || '';
  if (!id) return json({ error: 'Falta el id de la suscripción.' }, 400);
  const archivos = await leer(id);
  // Una liga firmada por archivo, en un solo viaje.
  const firmados = await Promise.all(archivos.map(async (a: any) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, VIGENCIA);
    return { ...a, url: data?.signedUrl || null };
  }));
  return json({ archivos: firmados });
};

export const POST: APIRoute = async ({ request }) => {
  const fd = await request.formData().catch(() => null);
  const id = String(fd?.get('id') || '');
  const file = fd?.get('file') as File | null;
  if (!id || !file) return json({ error: 'Falta la suscripción o el archivo.' }, 400);
  if (!TIPOS.includes(file.type)) return json({ error: 'Tipo no permitido. Usa PDF, Word o imagen.' }, 400);
  if (file.size > MAX) return json({ error: 'El archivo pasa de 15 MB.' }, 400);

  // Nombre en el path con marca de tiempo: dos contratos con el mismo nombre no
  // se pisan, y el original se conserva para mostrarlo.
  const limpio = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `suscripciones/${id}/${Date.now()}_${limpio}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return json({ error: error.message }, 500);

  const archivos = await leer(id);
  const nuevo = { path, nombre: file.name, tipo: file.type, size: file.size, subido_at: new Date().toISOString() };
  const { error: e2 } = await supabase.from('subscriptions')
    .update({ archivos: [nuevo, ...archivos] }).eq('id', id);
  // Si la lista no se pudo guardar, el binario quedaría huérfano ocupando
  // espacio y sin forma de llegar a él: se borra.
  if (e2) { await supabase.storage.from(BUCKET).remove([path]); return json({ error: e2.message }, 500); }

  const { data: firma } = await supabase.storage.from(BUCKET).createSignedUrl(path, VIGENCIA);
  return json({ ok: true, archivo: { ...nuevo, url: firma?.signedUrl || null } }, 201);
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || ''), path = String(b?.path || '');
  if (!id || !path) return json({ error: 'Falta la suscripción o el archivo.' }, 400);
  const archivos = await leer(id);
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from('subscriptions').update({ archivos: archivos.filter((a: any) => a.path !== path) }).eq('id', id);
  return json({ ok: true });
};
