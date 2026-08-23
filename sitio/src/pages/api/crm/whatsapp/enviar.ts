// WHATSAPP · Enviar desde el inbox: texto, plantilla o archivo.
//
// POST JSON { conversation_id | telefono, texto }            → texto libre
// POST JSON { telefono | conversation_id, plantilla:{nombre,idioma,params[]} }
//   La plantilla también INICIA conversaciones nuevas (fuera de ventana).
// POST multipart { file, conversation_id }                   → documento/imagen
//
// El espejo se escribe AQUÍ con el wamid que devuelve Kapso (optimista); el
// webhook message.sent que llega después cae en el dedup y no duplica.
// La ventana de 24 h se valida server-side: aunque el front se equivoque, el
// 422 de Kapso se traduce a { ventana_cerrada: true } y el mensaje NO se espeja.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { enviarTexto, enviarPlantilla, enviarMediaLink, subirMediaKapso, enviarMediaId, sanearParam, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { esMP4, mp4OpusAOgg } from '../../../../lib/whatsapp/ogg';
import { upsertConversacion, registrarMensaje } from '../../../../lib/whatsapp/espejo';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const MIMES: Record<string, 'image' | 'document' | 'audio' | 'video'> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image',
  'audio/ogg': 'audio', 'audio/mpeg': 'audio', 'audio/mp4': 'audio', 'audio/aac': 'audio', 'audio/webm': 'audio',
  'video/mp4': 'video', 'video/3gpp': 'video',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/csv': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
};
const MAX_BYTES = 4 * 1024 * 1024; // el límite real de la función serverless es ~4.5 MB

/** El teléfono E.164 de la conversación (o del body) y su id de espejo. */
async function resolverDestino(b: { conversation_id?: string; telefono?: string }) {
  if (b.conversation_id) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('id, telefono').eq('id', b.conversation_id).maybeSingle();
    if (!data) return null;
    return { convId: data.id as string, telefono: data.telefono as string };
  }
  const tel = telefonoWhatsApp(b.telefono);
  if (!tel) return null;
  const conv = await upsertConversacion({ telefono: tel });
  return conv ? { convId: conv.id, telefono: tel } : null;
}

const errorKapso = (e: any) => {
  if (e instanceof KapsoError && e.status === 422) return json({ ventana_cerrada: true, error: 'La ventana de 24 horas está cerrada: usa una plantilla aprobada.' }, 422);
  return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
};

export const POST: APIRoute = async ({ request }) => {
  const ct = request.headers.get('content-type') || '';

  // ── Archivo (multipart) ──
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const convIdIn = String(form.get('conversation_id') || '');
    const caption = String(form.get('caption') || '').trim() || undefined;
    const esVoz = String(form.get('voz') || '') === '1';
    if (!file || !convIdIn) return json({ error: 'Faltan file y conversation_id' }, 400);
    const mimeBase = (file.type || '').split(';')[0].trim().toLowerCase();
    const clase = MIMES[mimeBase];
    if (!clase) return json({ error: `Tipo no permitido: ${file.type}` }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'Máximo 4 MB (límite del servidor)' }, 400);

    const destino = await resolverDestino({ conversation_id: convIdIn });
    if (!destino) return json({ error: 'Conversación no encontrada' }, 404);

    // ── Nota de voz: sube a Meta por ID (voice:true) con transcoding si hace falta ──
    if (esVoz || clase === 'audio') {
      let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
      let mime = mimeBase;
      // Chrome/macOS graba audio/mp4;codecs=opus → WhatsApp lo rechaza como nota de voz.
      if (esMP4(bytes)) {
        const ogg = mp4OpusAOgg(bytes);
        if (ogg) { bytes = ogg as Uint8Array; mime = 'audio/ogg'; }
      }
      if (mime === 'audio/webm') return json({ error: 'audio/webm no es compatible con WhatsApp. Graba en ogg/opus o mp4.' }, 400);
      try {
        const mediaId = await subirMediaKapso(bytes, mime, mime === 'audio/ogg' ? 'voz.ogg' : file.name || 'audio');
        const r = await enviarMediaId(destino.telefono, 'audio', mediaId, { voice: esVoz });
        const wamid = r?.messages?.[0]?.id;
        // Espejo: sin URL pública (el binario vive en Meta) — el hilo lo muestra como [audio].
        if (wamid) await registrarMensaje({
          kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente',
          tipo: 'audio', cuerpo: esVoz ? 'Nota de voz' : (file.name || 'Audio'), status: 'sent',
        });
        return json({ ok: true, message_id: wamid || null, media_id: mediaId });
      } catch (e: any) { return errorKapso(e); }
    }

    // Bucket público: WhatsApp descarga el archivo por link (patrón upload-logo).
    const nombre = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `wa/${destino.convId}/${Date.now()}_${nombre}`;
    await supabase.storage.createBucket('quotes', { public: true }).catch(() => {});
    const { error: eUp } = await supabase.storage.from('quotes')
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (eUp) return json({ error: `Upload: ${eUp.message}` }, 500);
    const { data: pub } = supabase.storage.from('quotes').getPublicUrl(path);
    const link = pub.publicUrl;

    try {
      const r = await enviarMediaLink(destino.telefono, clase as 'image' | 'document', link, nombre, caption);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente',
        tipo: clase, cuerpo: caption || (clase === 'document' ? nombre : null), mediaUrl: link, status: 'sent',
      });
      return json({ ok: true, message_id: wamid || null, media_url: link });
    } catch (e: any) {
      await supabase.storage.from('quotes').remove([path]).catch(() => {});
      return errorKapso(e);
    }
  }

  // ── JSON: texto o plantilla ──
  const b = await request.json().catch(() => ({}));
  const destino = await resolverDestino(b);
  if (!destino) return json({ error: 'Destino inválido (conversation_id o teléfono utilizable)' }, 400);

  // ── Media desde la biblioteca (URL pública ya existente) ──
  if (b.media_url) {
    const clase = (['image', 'document', 'video'].includes(b.clase) ? b.clase : 'document') as 'image' | 'document' | 'video';
    try {
      const r = await enviarMediaLink(destino.telefono, clase, String(b.media_url), String(b.nombre || 'archivo'), b.caption ? String(b.caption) : undefined);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente',
        tipo: clase, cuerpo: b.caption || b.nombre || null, mediaUrl: String(b.media_url), status: 'sent',
      });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }

  if (b.plantilla?.nombre) {
    try {
      const params = (Array.isArray(b.plantilla.params) ? b.plantilla.params : []).map(sanearParam);
      const r = await enviarPlantilla(destino.telefono, String(b.plantilla.nombre), String(b.plantilla.idioma || 'es_MX'), params);
      const wamid = r?.messages?.[0]?.id;
      // El cuerpo espejado es la plantilla con sus params — legible en el hilo.
      const { data: p } = await supabase.from('wa_plantillas')
        .select('cuerpo').eq('nombre', b.plantilla.nombre).limit(1).maybeSingle();
      let cuerpo = p?.cuerpo || `[plantilla ${b.plantilla.nombre}]`;
      params.forEach((v: string, i: number) => { cuerpo = cuerpo.replaceAll(`{{${i + 1}}}`, v); });
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente',
        tipo: 'template', cuerpo, status: 'sent',
      });
      return json({ ok: true, message_id: wamid || null, conversation_id: destino.convId });
    } catch (e: any) { return errorKapso(e); }
  }

  const texto = String(b.texto || '').trim();
  if (!texto) return json({ error: 'Falta texto' }, 400);
  try {
    const r = await enviarTexto(destino.telefono, texto);
    const wamid = r?.messages?.[0]?.id;
    if (wamid) await registrarMensaje({
      kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente',
      tipo: 'text', cuerpo: texto, status: 'sent',
    });
    return json({ ok: true, message_id: wamid || null, conversation_id: destino.convId });
  } catch (e: any) { return errorKapso(e); }
};
