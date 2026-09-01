// WHATSAPP · Parser ÚNICO de un mensaje en formato Kapso/Meta.
// Lo usan el webhook (tiempo real) y el backfill (historial): si un tipo se
// interpreta mal, se arregla AQUÍ y en ningún otro lado.
//
// Verdades del formato (medidas en el referente sacs_inbox y en Kapso):
// - La media NO viene en `kapso.media_url`: viene en `message[type]` como
//   { id, link?, caption?, mime_type?, filename? }. El `id` se resuelve con la
//   API (pide X-API-Key) — por eso el hilo la pide vía /api/crm/whatsapp/media.
// - `message.context.id` = wamid del mensaje que el cliente está citando.
export type MensajeParseado = {
  tipo: string;
  cuerpo: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mime: string | null;
  filename: string | null;
  metadata: Record<string, any> | null;
};

const ETIQUETA: Record<string, string> = { image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento', sticker: 'Sticker' };

export function parsearMensaje(msj: any): MensajeParseado {
  const tipo = String(msj?.type || msj?.kapso?.message_type || 'text');
  const kapso = msj?.kapso || {};
  const base: MensajeParseado = { tipo, cuerpo: null, mediaId: null, mediaUrl: null, mime: null, filename: null, metadata: null };
  const meta: Record<string, any> = {};
  if (msj?.context?.id) meta.cita = { wamid: String(msj.context.id), de: msj.context.from || null };

  switch (tipo) {
    case 'image': case 'video': case 'audio': case 'document': case 'sticker': {
      const m = msj[tipo] || {};
      base.cuerpo = m.caption || null;
      base.mediaId = m.id || null;
      base.mediaUrl = m.link || kapso.media_url || null;
      base.mime = m.mime_type || null;
      base.filename = m.filename || null;
      if (tipo === 'audio' && m.voice) meta.voz = true;
      if (!base.cuerpo && tipo === 'document') base.cuerpo = base.filename || null;
      break;
    }
    case 'location': {
      const l = msj.location || {};
      base.cuerpo = l.name || l.address || 'Ubicación';
      Object.assign(meta, { lat: l.latitude ?? null, lng: l.longitude ?? null, nombre: l.name || null, direccion: l.address || null });
      break;
    }
    case 'contacts': {
      const cs = Array.isArray(msj.contacts) ? msj.contacts : [];
      const lista = cs.map((c: any) => ({
        nombre: c?.name?.formatted_name || [c?.name?.first_name, c?.name?.last_name].filter(Boolean).join(' ') || 'Contacto',
        telefonos: (c?.phones || []).map((p: any) => p?.wa_id || p?.phone).filter(Boolean),
      }));
      base.cuerpo = lista.map((c: any) => c.nombre).join(', ') || 'Contacto compartido';
      meta.contactos = lista;
      break;
    }
    case 'interactive': {
      const it = msj.interactive || {};
      const r = it.button_reply || it.list_reply || null;
      base.cuerpo = r?.title || kapso.content || null;
      Object.assign(meta, { interactivo: it.type || null, id: r?.id || null, descripcion: r?.description || null });
      break;
    }
    case 'button': {
      /* El texto del botón, y si no viene, el payload. Meta manda a veces
         solo el índice («2»), y «Eligió el botón 2» no le dice nada a nadie:
         hay que poder leer QUÉ escogió el cliente sin ir a buscar la
         plantilla. Cuando solo hay número, se deja dicho que es un índice
         para que al menos no se lea como una respuesta del cliente. */
      const txt = String(msj.button?.text || '').trim();
      const pay = String(msj.button?.payload || '').trim();
      const soloNumero = (v: string) => /^\d{1,2}$/.test(v);
      base.cuerpo = txt && !soloNumero(txt) ? txt
        : pay && !soloNumero(pay) ? pay
        : txt || pay ? `Opción ${txt || pay} de la plantilla` : null;
      Object.assign(meta, { interactivo: 'button', id: pay || null, boton_texto: txt || null });
      break;
    }
    case 'reaction': {
      base.cuerpo = msj.reaction?.emoji || kapso.content || null;
      Object.assign(meta, { reacciona_a: msj.reaction?.message_id || kapso.reacted_message_id || null, emoji: base.cuerpo });
      break;
    }
    case 'unsupported': {
      base.cuerpo = 'Mensaje no compatible (WhatsApp no lo entrega a la API)';
      break;
    }
    default: {
      base.cuerpo = msj?.text?.body || kapso.content || null;
    }
  }
  if (tipo === 'template' && !base.cuerpo) base.cuerpo = kapso.content || null;
  base.metadata = Object.keys(meta).length ? meta : null;
  return base;
}

export const etiquetaTipo = (tipo: string) => ETIQUETA[tipo] || tipo;
