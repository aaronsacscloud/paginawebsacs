// CRON · Poner a salvo la media entrante de WhatsApp.
//
// Meta borra los archivos a los 30 días y las URLs de terceros mueren cuando
// se cancela el servicio: un historial lleno de "Imagen no disponible" no
// sirve de nada. Este cron copia a NUESTRO Storage todo lo que llegó y aún
// no es nuestro, y reescribe media_url — igual que se hizo con los 2,597
// archivos de la migración, pero para lo que entra cada día.
//
// Corre cada 15 min y trabaja de a poco (lotes chicos) para no pasarse del
// tiempo de la función.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { descargarMedia, usarNumero } from '../../../lib/whatsapp/kapso-api';

export const prerender = false;
const BUCKET = 'wa-media';
const LOTE = 25;
const MAX_BYTES = 45 * 1024 * 1024;   // Storage rechaza arriba de 50 MB

const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const extDe = (mime: string) => {
  const m = (mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') && m.includes('audio')) return 'mp3';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('xml')) return 'xml';
  if (m.includes('sheet') || m.includes('excel')) return 'xlsx';
  if (m.includes('word')) return 'docx';
  return 'bin';
};

export const GET: APIRoute = async () => {
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  // Lo que falta por asegurar: o solo vive en Meta (media_id) o apunta a un
  // dominio ajeno. Lo nuestro y lo ya migrado se saltan.
  const { data: pendientes } = await supabase.from('wa_mensajes')
    .select('id, media_id, media_url, mime, conversation_id, phone_number_id:conversation_id')
    .or('and(media_id.not.is.null,media_url.is.null),and(media_url.not.is.null,media_url.not.like.%supabase.co%)')
    .is('borrado_at', null)
    .order('created_at', { ascending: false })
    .limit(LOTE);

  let ok = 0, fallos = 0, saltados = 0;
  for (const m of pendientes || []) {
    try {
      let bytes: ArrayBuffer | null = null;
      let mime = m.mime || 'application/octet-stream';

      if (m.media_url && !/supabase\.co/.test(m.media_url)) {
        const r = await fetch(m.media_url);
        if (!r.ok) { fallos++; continue; }
        bytes = await r.arrayBuffer();
        mime = r.headers.get('content-type') || mime;
      } else if (m.media_id) {
        // El número por el que entró: la media se pide con SU phone_number_id.
        const { data: conv } = await supabase.from('wa_conversaciones')
          .select('phone_number_id').eq('id', m.conversation_id).maybeSingle();
        usarNumero(conv?.phone_number_id || null);
        const d = await descargarMedia(m.media_id);
        if (!d) { fallos++; continue; }
        bytes = d.bytes; mime = d.mime || mime;
      }
      if (!bytes) { saltados++; continue; }
      if (bytes.byteLength > MAX_BYTES) { saltados++; continue; }

      const path = `entrante/${m.id}.${extDe(mime)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
      if (error) { fallos++; continue; }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await supabase.from('wa_mensajes').update({ media_url: url, mime }).eq('id', m.id);
      ok++;
    } catch { fallos++; }
  }

  // Cuánto queda por delante, para vigilar que el cron no se quede corto.
  const { count } = await supabase.from('wa_mensajes')
    .select('id', { count: 'exact', head: true })
    .or('and(media_id.not.is.null,media_url.is.null),and(media_url.not.is.null,media_url.not.like.%supabase.co%)');

  return json({ ok, fallos, saltados, pendientes_restantes: (count || 0) - ok });
};
