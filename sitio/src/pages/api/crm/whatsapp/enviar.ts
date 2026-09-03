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
import { usarNumero, enviarTexto, enviarPlantilla, enviarMediaLink, subirMediaKapso, enviarMediaId, sanearParam, KapsoError, enviarInteractivo, enviarUbicacion, enviarContacto, enviarSticker, enviarReaccion, type Interactivo } from '../../../../lib/whatsapp/kapso-api';
import { esMP4, mp4OpusAOgg } from '../../../../lib/whatsapp/ogg';
import { explicarError } from '../../../../lib/whatsapp/errores';
import { upsertConversacion, registrarMensaje } from '../../../../lib/whatsapp/espejo';
import { puedeMandarWa } from '../../../../lib/whatsapp/presion';
import { textoConSv, conSv } from '../../../../lib/tracking/identidad';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Los MIME que WhatsApp acepta (docs de Meta). Lo que no esté aquí se manda
// como documento genérico si es application/* o text/*.
const MIMES: Record<string, 'image' | 'document' | 'audio' | 'video'> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'document',
  'audio/ogg': 'audio', 'audio/mpeg': 'audio', 'audio/mp4': 'audio', 'audio/aac': 'audio', 'audio/amr': 'audio', 'audio/webm': 'audio',
  'video/mp4': 'video', 'video/3gpp': 'video', 'video/quicktime': 'document',
  'application/pdf': 'document', 'text/plain': 'document', 'text/csv': 'document',
  'application/msword': 'document', 'application/vnd.ms-excel': 'document', 'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/zip': 'document', 'application/x-zip-compressed': 'document', 'application/json': 'document',
};
const claseDeMime = (m: string) => MIMES[m] || ((m.startsWith('application/') || m.startsWith('text/')) ? 'document' : undefined);
const MAX_BYTES = 4 * 1024 * 1024; // el límite real de la función serverless es ~4.5 MB

/** El teléfono E.164 de la conversación (o del body) y su id de espejo. */
async function resolverDestino(b: { conversation_id?: string; telefono?: string; phone_number_id?: string | null }) {
  if (b.conversation_id) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('id, telefono, phone_number_id, contact_id').eq('id', b.conversation_id).maybeSingle();
    if (!data) return null;
    usarNumero(data.phone_number_id || null);   // multi-número: se responde desde el número por el que escribió
    return { convId: data.id as string, telefono: data.telefono as string, contactId: (data as any).contact_id as string | null };
  }
  usarNumero(b.phone_number_id || null);
  const tel = telefonoWhatsApp(b.telefono);
  if (!tel) return null;
  const conv = await upsertConversacion({ telefono: tel });
  return conv ? { convId: conv.id, telefono: tel, contactId: (conv as any).contact_id || null } : null;
}

// El error que ve el agente: título + qué pasó + qué hacer, nunca el JSON de Meta.
const errorKapso = (e: any) => {
  const st = e instanceof KapsoError ? e.status : undefined;
  const x = explicarError(e instanceof KapsoError ? e.detalle : e, st);
  const ventana = x.codigo === '131047' || x.tipo === 'ventana';
  return json({
    error: `${x.titulo}. ${x.que_hacer}`,
    error_detalle: x,
    ventana_cerrada: ventana,
  }, ventana ? 422 : (st && st >= 400 && st < 600 ? st : 502));
};

export const POST: APIRoute = async ({ request }) => {
  const ct = request.headers.get('content-type') || '';
  // Quién manda: queda en el espejo (columna autor) para que el hilo no diga "Agente".
  let autorId: string | null = null, autor: string | null = null;
  try { const u: any = await getSessionFromRequest(request); autorId = u?.id || null; autor = u?.nombre || u?.name || u?.email || null; } catch { /* sin sesión */ }
  const firma = { autorId, autor };

  // ── Archivo (multipart) ──
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const convIdIn = String(form.get('conversation_id') || '');
    const caption = String(form.get('caption') || '').trim() || undefined;
    const esVoz = String(form.get('voz') || '') === '1';
    if (!file || !convIdIn) return json({ error: 'Faltan file y conversation_id' }, 400);
    const mimeBase = (file.type || '').split(';')[0].trim().toLowerCase();
    const clase = claseDeMime(mimeBase);
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
        // Copia en Storage para que el agente pueda volver a escucharla en el hilo.
        let link: string | null = null;
        try {
          const path = `wa/${destino.convId}/${Date.now()}_${mime === 'audio/ogg' ? 'voz.ogg' : (file.name || 'audio')}`.replace(/[^\w./-]+/g, '_');
          const { error: eUp } = await supabase.storage.from('quotes').upload(path, bytes, { contentType: mime, upsert: false });
          if (!eUp) link = supabase.storage.from('quotes').getPublicUrl(path).data.publicUrl;
        } catch { /* sin copia: el mensaje igual se mandó */ }
        if (wamid) await registrarMensaje({
          kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
          tipo: 'audio', cuerpo: esVoz ? 'Nota de voz' : (file.name || 'Audio'), status: 'sent', mediaUrl: link, mime,
          metadata: esVoz ? { voz: true } : null,
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
      const r = await enviarMediaLink(destino.telefono, clase as 'image' | 'document', link, nombre, caption, String(form.get('cita') || '') || null);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
        tipo: clase, cuerpo: caption || (clase === 'document' ? nombre : null), mediaUrl: link, mime: mimeBase, filename: nombre, status: 'sent',
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

  // ── Etapa A: interactivos, ubicación, contacto, sticker, reacción ──
  const cita = b.cita ? String(b.cita) : null;
  if (b.interactivo?.tipo) {
    const i = b.interactivo as Interactivo;
    // El botón con link y las tarjetas del carrusel llevan el `sv` del contacto.
    if ((i as any).url) (i as any).url = conSv(String((i as any).url), destino.contactId);
    if (Array.isArray((i as any).tarjetas)) {
      (i as any).tarjetas = (i as any).tarjetas.map((t: any) => t?.url ? { ...t, url: conSv(String(t.url), destino.contactId) } : t);
    }
    if ((i as any).cuerpo) (i as any).cuerpo = textoConSv(String((i as any).cuerpo), destino.contactId);
    try {
      const r = await enviarInteractivo(destino.telefono, i, cita);
      const wamid = r?.messages?.[0]?.id;
      const etiqueta: Record<string, string> = { botones: 'Botones', lista: 'Lista', cta_url: 'Botón con link', pedir_ubicacion: 'Solicitud de ubicación', pedir_contacto: 'Solicitud de contacto', permiso_llamada: 'Solicitud de permiso para llamar', catalogo: 'Catálogo', carrusel: 'Carrusel', producto: 'Producto', productos: 'Productos' };
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
        tipo: 'interactive', cuerpo: (i as any).cuerpo || etiqueta[i.tipo], status: 'sent',
        metadata: { interactivo: i.tipo, enviado: i, ...(cita ? { cita: { wamid: cita } } : {}) },
      });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }
  if (b.ubicacion?.lat != null) {
    try {
      const u = { lat: Number(b.ubicacion.lat), lng: Number(b.ubicacion.lng), nombre: b.ubicacion.nombre, direccion: b.ubicacion.direccion };
      const r = await enviarUbicacion(destino.telefono, u, cita);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma, tipo: 'location', cuerpo: u.nombre || u.direccion || 'Ubicación', status: 'sent', metadata: { lat: u.lat, lng: u.lng, nombre: u.nombre || null, direccion: u.direccion || null } });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }
  if (b.contacto?.nombre) {
    try {
      const r = await enviarContacto(destino.telefono, b.contacto, cita);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma, tipo: 'contacts', cuerpo: `${b.contacto.nombre} ${b.contacto.apellido || ''}`.trim(), status: 'sent', metadata: { contactos: [{ nombre: `${b.contacto.nombre} ${b.contacto.apellido || ''}`.trim(), telefonos: [b.contacto.telefono].filter(Boolean) }] } });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }
  if (b.sticker_url) {
    try {
      const r = await enviarSticker(destino.telefono, { link: String(b.sticker_url) });
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma, tipo: 'sticker', cuerpo: null, mediaUrl: String(b.sticker_url), mime: 'image/webp', status: 'sent' });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }
  if (b.reaccion?.wamid) {
    try {
      const emoji = String(b.reaccion.emoji || '');
      const r = await enviarReaccion(destino.telefono, String(b.reaccion.wamid), emoji);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma, tipo: 'reaction', cuerpo: emoji || null, status: 'sent', metadata: { reacciona_a: String(b.reaccion.wamid), emoji, quitar: !emoji } });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }

  // ── Media desde la biblioteca (URL pública ya existente) ──
  if (b.media_url) {
    const clase = (['image', 'document', 'video'].includes(b.clase) ? b.clase : 'document') as 'image' | 'document' | 'video';
    try {
      const r = await enviarMediaLink(destino.telefono, clase, String(b.media_url), String(b.nombre || 'archivo'), b.caption ? String(b.caption) : undefined, b.cita || null);
      const wamid = r?.messages?.[0]?.id;
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
        tipo: clase, cuerpo: b.caption || b.nombre || null, mediaUrl: String(b.media_url), mime: b.mime || null, filename: b.nombre || null, status: 'sent',
      });
      return json({ ok: true, message_id: wamid || null });
    } catch (e: any) { return errorKapso(e); }
  }

  if (b.plantilla?.nombre) {
    try {
      // ── Un WhatsApp por lead por día ──
      // La cadencia ya se limitaba sola, pero no veía los envíos a mano; por eso
      // a Sugar store le salieron dos plantillas con tres minutos de diferencia.
      // El candado mira los mensajes reales, así que cuenta los dos orígenes.
      // Se puede forzar (`forzar: true`) porque aquí SÍ hay una persona mirando
      // y a veces el segundo mensaje es la respuesta correcta.
      const presion = await puedeMandarWa(destino.telefono, { forzar: !!b.forzar });
      if (!presion.ok) {
        return json({
          error: presion.motivo,
          presion_alta: true,
          libre_en: presion.libreEn?.toISOString() || null,
          se_puede_forzar: true,
        }, 429);
      }

      const params = (Array.isArray(b.plantilla.params) ? b.plantilla.params : []).map(sanearParam);
      const { data: p } = await supabase.from('wa_plantillas')
        .select('cuerpo, header_tipo, header_media_url, botones, tipo_especial').eq('nombre', b.plantilla.nombre).eq('idioma', String(b.plantilla.idioma || 'es_MX')).maybeSingle();
      // Encabezado de media: el de la petición o el guardado al crear la plantilla.
      const ht = String(p?.header_tipo || 'TEXT').toUpperCase();
      const link = b.plantilla.header_media_url || p?.header_media_url || null;
      const headerMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht)
        ? (link ? { tipo: ht.toLowerCase() as 'image' | 'video' | 'document', link: String(link), filename: b.plantilla.header_filename || undefined } : null) : null;
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && !headerMedia) return json({ error: 'Esta plantilla lleva un archivo en el encabezado: elige la imagen/documento a enviar.', falta_header: true }, 400);
      const botonUrl = (p?.botones || []).find((x: any) => x.tipo === 'URL' && /\{\{1\}\}/.test(x.url || ''));
      const r = await enviarPlantilla(destino.telefono, String(b.plantilla.nombre), String(b.plantilla.idioma || 'es_MX'), p?.tipo_especial === 'otp' ? [] : params, {
        headerMedia, botonUrlParam: botonUrl ? String(b.plantilla.boton_url_param || params[params.length - 1] || '') : null,
        otp: p?.tipo_especial === 'otp' ? String(b.plantilla.otp || params[0] || '') : null,
      });
      const wamid = r?.messages?.[0]?.id;
      // El cuerpo espejado es la plantilla con sus params — legible en el hilo.
      let cuerpo = p?.cuerpo || `[plantilla ${b.plantilla.nombre}]`;
      (p?.tipo_especial === 'otp' ? [String(b.plantilla.otp || params[0] || '')] : params).forEach((v: string, i: number) => { cuerpo = cuerpo.replaceAll(`{{${i + 1}}}`, v); });
      if (wamid) await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
        tipo: 'template', cuerpo, status: 'sent', mediaUrl: headerMedia?.link || null, mime: headerMedia ? (headerMedia.tipo === 'image' ? 'image/jpeg' : headerMedia.tipo === 'video' ? 'video/mp4' : 'application/pdf') : null,
        metadata: { plantilla: b.plantilla.nombre, botones: p?.botones || null },
      });
      // E4.1 · Se apunta el uso: es lo que alimenta «las últimas que usaste».
      // No se espera (si falla, el mensaje ya salió y eso es lo que importa).
      supabase.rpc('wa_plantilla_usada', { p_nombre: String(b.plantilla.nombre), p_idioma: String(b.plantilla.idioma || 'es_MX') })
        .then(() => {}, () => {});
      return json({ ok: true, message_id: wamid || null, conversation_id: destino.convId });
    } catch (e: any) { return errorKapso(e); }
  }

  const texto = String(b.texto || '').trim();
  if (!texto) return json({ error: 'Falta texto' }, 400);
  try {
    const cita = b.cita ? String(b.cita) : null;
    // ── Candado anti-duplicado (cola de envío del inbox) ──────────────────
    // El cliente reintenta cuando vuelve la red, y un reintento puede llegar
    // DESPUÉS de que el envío original sí salió (respuesta perdida, no envío
    // perdido). Cada mensaje de la cola trae su marca única: si ya hay un
    // espejo con esa marca, se contesta que ya está y no se manda otra vez.
    const idem = b.idem ? `${destino.convId}:${String(b.idem).slice(0, 64)}` : null;   // por conversación: dos usuarios no se pisan
    if (idem) {
      // Leer-y-luego-mandar dejaba una carrera: el reintento del cliente entraba mientras la primera petición
      // seguía en vuelo y salían DOS mensajes. La reserva atómica (clave primaria) cierra la carrera: quien
      // no logra insertar, espera a que el primero termine y devuelve su wamid.
      const { error: eRes } = await supabase.from('wa_envios_idem').insert({ idem, conversation_id: destino.convId });
      if (eRes) {
        let wamidPrev: string | null = null;
        for (let i = 0; i < 6 && !wamidPrev; i++) {
          const { data: r1 } = await supabase.from('wa_envios_idem').select('wamid').eq('idem', idem).maybeSingle();
          wamidPrev = (r1 as any)?.wamid || null;
          if (!wamidPrev) await new Promise(res => setTimeout(res, 500));
        }
        if (!wamidPrev) return json({ error: 'El envío anterior con esta marca no terminó; vuelve a intentar.' }, 409);
        return json({ ok: true, duplicado: true, message_id: wamidPrev, conversation_id: destino.convId });
      }
    }
    // Los links a NUESTRO sitio se marcan con el `sv` del contacto: así, cuando
    // entre, el CRM sabe que fue él y qué recorrió. Los links ajenos no se tocan.
    const textoEnviado = textoConSv(texto, destino.contactId);
    let r: any;
    try { r = await enviarTexto(destino.telefono, textoEnviado, cita); }
    catch (err) { if (idem) await supabase.from('wa_envios_idem').delete().eq('idem', idem); throw err; }   // libera la marca: el reintento sí debe mandar
    const wamid = r?.messages?.[0]?.id;
    if (idem) { if (wamid) await supabase.from('wa_envios_idem').update({ wamid }).eq('idem', idem); else await supabase.from('wa_envios_idem').delete().eq('idem', idem); }
    if (wamid) await registrarMensaje({
      kapsoMessageId: wamid, telefono: destino.telefono, direccion: 'saliente', ...firma,
      tipo: 'text', cuerpo: textoEnviado, status: 'sent',
      metadata: (cita || idem) ? { ...(cita ? { cita: { wamid: cita } } : {}), ...(idem ? { idem } : {}) } : null,
    });
    return json({ ok: true, message_id: wamid || null, conversation_id: destino.convId });
  } catch (e: any) { return errorKapso(e); }
};
