// El comprobante de un pago: subirlo, ligarlo y verlo.
//
// Es el archivo que manda el CLIENTE —la captura de la transferencia, el
// recibo— no el acuse que nosotros emitimos. Se guarda en el bucket PRIVADO
// `comprobantes`, el mismo de los gastos: una captura de transferencia trae
// cuentas y saldos, y un bucket público la deja al alcance de cualquiera con
// la liga.
//
// POST { accion:'firmar', nombre, mime, bytes } → URL firmada para subir
// POST { accion:'guardar', payment_id, path, nombre } → la liga al pago
// POST { accion:'ver', path } → URL firmada de 1 h para abrirlo
//
// La subida va en dos tiempos —firmar, subir desde el navegador, guardar— por
// lo mismo que los gastos: un archivo de 15 MB pasando por la función serverless
// se come el límite de la petición y falla justo con los comprobantes grandes,
// que son los escaneados.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const MIMES = /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif)|application\/xml|text\/xml)$/;
const MAX = 15 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const accion = String(b.accion || '');

  if (accion === 'firmar') {
    const mime = String(b.mime || '');
    const bytes = Number(b.bytes || 0);
    if (!MIMES.test(mime)) return json({ error: 'El comprobante tiene que ser PDF, XML o una imagen.' }, 400);
    if (bytes > MAX) return json({ error: 'El archivo pasa de 15 MB.' }, 400);
    const ext = String(b.nombre || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    // Carpeta por mes: dentro de un año, encontrar el comprobante de marzo no
    // debe significar abrir una carpeta con miles de archivos.
    const mes = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7);
    const path = `pagos/${mes}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await supabase.storage.createBucket('comprobantes', { public: false }).catch(() => {});
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUploadUrl(path);
    if (error || !data) return json({ error: error?.message || 'No se pudo preparar la subida.' }, 500);
    return json({ ok: true, signedUrl: data.signedUrl, path });
  }

  if (accion === 'guardar') {
    if (!b.payment_id || !b.path) return json({ error: 'Faltan datos del comprobante.' }, 400);
    const { error } = await supabase.from('payments').update({
      comprobante_path: String(b.path),
      comprobante_nombre: String(b.nombre || '').slice(0, 160),
    }).eq('id', String(b.payment_id));
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'ver') {
    if (!b.path) return json({ error: 'Falta la ruta.' }, 400);
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(String(b.path), 3600);
    return error || !data ? json({ error: error?.message || 'Ese comprobante ya no está.' }, 404) : json({ ok: true, url: data.signedUrl });
  }

  return json({ error: 'Acción desconocida.' }, 400);
};
