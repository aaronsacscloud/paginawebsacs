// Cliente único de Kapso para el Inbox de WhatsApp del CRM.
//
// Kapso expone DOS APIs con la misma API key (header X-API-Key):
//  - Platform: conversaciones, broadcasts, webhooks, inbox embeds.
//  - Meta passthrough: el Cloud API de WhatsApp tal cual (mensajes, plantillas).
//    La versión del grafo en la URL es OBLIGATORIA — sin ella Kapso da 404
//    (aprendizaje del sacs_inbox viejo, capturado en sacs_api/lib/kapso.lib.js).
//
// OJO: src/lib/kapso.ts (sendWhatsApp) usa la API vieja v1/messages/send con
// la apikey en el body. Ese cliente sigue vivo para los envíos transaccionales
// existentes; este es el nuevo, para todo lo del Inbox.

const ENV: any = (import.meta as any).env || process.env || {};
const API_KEY = (ENV.KAPSO_API_KEY || '').trim();
const PHONE_NUMBER_ID = (ENV.KAPSO_PHONE_NUMBER_ID || '').trim();
const BUSINESS_ACCOUNT_ID = (ENV.KAPSO_BUSINESS_ACCOUNT_ID || '').trim();

const PLATFORM = 'https://api.kapso.ai/platform/v1';
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';

export const kapsoConfigurado = () => !!(API_KEY && PHONE_NUMBER_ID);

/** El parámetro de plantilla como Meta lo acepta: sin saltos ni tabs, nunca
 *  vacío (un parámetro vacío al enviar es 400; se sustituye por "—"). */
export const sanearParam = (v: any): string =>
  (String(v ?? '').replace(/[\n\r\t]+/g, ' ').replace(/ {4,}/g, '   ').trim()) || '—';

class KapsoError extends Error {
  status: number;
  detalle: any;
  constructor(status: number, detalle: any) {
    super(`Kapso HTTP ${status}: ${typeof detalle === 'string' ? detalle : JSON.stringify(detalle)}`);
    this.status = status;
    this.detalle = detalle;
  }
}
export { KapsoError };

async function llamar(base: string, ruta: string, init?: RequestInit): Promise<any> {
  if (!API_KEY) throw new KapsoError(0, 'Falta KAPSO_API_KEY');
  const res = await fetch(`${base}${ruta}`, {
    ...init,
    headers: {
      'X-API-Key': API_KEY,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new KapsoError(res.status, cuerpo?.error || cuerpo);
  // Platform envuelve en { data, meta }; Meta passthrough responde plano.
  return cuerpo?.data !== undefined ? cuerpo.data : cuerpo;
}

const platform = (ruta: string, init?: RequestInit) => llamar(PLATFORM, ruta, init);
const meta = (ruta: string, init?: RequestInit) => llamar(META, ruta, init);

// ── Inbox embed ──

/** Crea un inbox embed. token y embed_url SOLO vienen aquí: hay que persistirlos. */
export async function crearEmbed(opts: { allowedOrigins: string[]; expiresAt?: string | null }) {
  return platform('/inbox_embeds', {
    method: 'POST',
    body: JSON.stringify({
      inbox_embed: {
        name: 'CRM SACS',
        scope_type: 'phone_number',
        scope_id: PHONE_NUMBER_ID,
        allowed_origins: opts.allowedOrigins,
        default_mode: 'light',
        language: 'es',
        expires_at: opts.expiresAt ?? null,
      },
    }),
  });
}

/** Los números de WhatsApp del proyecto: para DESCUBRIR el phone_number_id
 *  y el business_account_id desde el diagnóstico cuando aún no están en env. */
export async function listarNumeros() {
  return llamar(PLATFORM, '/whatsapp/phone_numbers');
}

/** Una página del historial de mensajes del número (cursor `paging.next` → after). */
export async function listarMensajesKapso(after?: string | null, limit = 100): Promise<{ data: any[]; next: string | null }> {
  if (!API_KEY) throw new KapsoError(0, 'Falta KAPSO_API_KEY');
  const res = await fetch(`${PLATFORM}/whatsapp/messages?phone_number_id=${PHONE_NUMBER_ID}&limit=${limit}${after ? `&after=${encodeURIComponent(after)}` : ''}`,
    { headers: { 'X-API-Key': API_KEY } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new KapsoError(res.status, j?.error || j);
  return { data: j?.data || [], next: j?.paging?.next || null };
}

// ── Webhooks ──

const EVENTOS = [
  'whatsapp.message.received', 'whatsapp.message.sent', 'whatsapp.message.delivered',
  'whatsapp.message.read', 'whatsapp.message.failed',
  'whatsapp.conversation.created', 'whatsapp.conversation.ended',
  'whatsapp.contact.marketing_preference_changed',
  'whatsapp.conversation.inactive', 'whatsapp.contact.identity_changed',
];
/** Actualiza eventos e inactividad del webhook kapso existente (Etapa E). */
export async function actualizarWebhook(webhookId: string, inactivityMinutes = 60) {
  return platform(`/whatsapp/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify({ whatsapp_webhook: { events: EVENTOS, inactivity_minutes: Math.min(1440, Math.max(1, inactivityMinutes)) } }) });
}

export async function listarWebhooks() {
  return platform(`/whatsapp/phone_numbers/${PHONE_NUMBER_ID}/webhooks`);
}

export async function registrarWebhook(url: string, secreto: string) {
  // El wrapper es `whatsapp_webhook` (con `webhook` responde missing_parameter).
  // `secret_key` se manda explícito para que la firma X-Webhook-Signature se
  // verifique contra NUESTRO KAPSO_WEBHOOK_SECRET y no contra uno generado.
  return platform(`/whatsapp/phone_numbers/${PHONE_NUMBER_ID}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({
      whatsapp_webhook: { url, kind: 'kapso', secret_key: secreto, active: true, events: EVENTOS },
    }),
  });
}

/** Webhook `kind: meta`: Kapso reenvía el payload CRUDO de Meta (trae `calls`, que los eventos kapso no cubren). */
export async function registrarWebhookMeta(url: string, secreto: string) {
  return platform(`/whatsapp/phone_numbers/${PHONE_NUMBER_ID}/webhooks`, {
    method: 'POST',
    body: JSON.stringify({ whatsapp_webhook: { url, kind: 'meta', secret_key: secreto, active: true, events: [] } }),
  });
}

// ── Etapa C: llamadas (Calling API vía Kapso) ──
export async function ajustesLlamadas() { return meta(`/${PHONE_NUMBER_ID}/settings`); }
export async function configurarLlamadas(calling: any) {
  return meta(`/${PHONE_NUMBER_ID}/settings`, { method: 'POST', body: JSON.stringify({ calling }) });
}
export async function permisoLlamada(userWaId: string) {
  return meta(`/${PHONE_NUMBER_ID}/call_permissions?user_wa_id=${encodeURIComponent(userWaId)}`);
}
/** action: connect (to + sdp offer) | pre_accept | accept (call_id + sdp answer) | reject | terminate */
export async function accionLlamada(body: { action: 'connect' | 'pre_accept' | 'accept' | 'reject' | 'terminate'; call_id?: string; to?: string; sdp?: string; sdp_type?: 'offer' | 'answer' }) {
  const b: any = { messaging_product: 'whatsapp', action: body.action };
  if (body.call_id) b.call_id = body.call_id;
  if (body.to) b.to = body.to;
  if (body.sdp) b.session = { sdp_type: body.sdp_type || (body.action === 'connect' ? 'offer' : 'answer'), sdp: body.sdp };
  return meta(`/${PHONE_NUMBER_ID}/calls`, { method: 'POST', body: JSON.stringify(b) });
}
export async function listarLlamadasKapso(params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ limit: '50', ...params }).toString();
  return meta(`/${PHONE_NUMBER_ID}/calls?${qs}`);
}

// ── Envío (Meta passthrough) ──

/** Texto libre. Fuera de la ventana de 24 h Kapso devuelve 422: se propaga. */
export async function enviarTexto(telefono: string, texto: string, citaWamid?: string | null) {
  return meta(`/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: telefono,
      type: 'text', text: { body: texto },
      ...(citaWamid ? { context: { message_id: citaWamid } } : {}),
    }),
  });
}

// ── Etapa A: mensajes interactivos y especiales (formato Cloud API) ──

const mensaje = (telefono: string, cuerpo: any, citaWamid?: string | null) =>
  meta(`/${PHONE_NUMBER_ID}/messages`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: telefono, ...cuerpo, ...(citaWamid ? { context: { message_id: citaWamid } } : {}) }) });

export type Interactivo =
  | { tipo: 'botones'; cuerpo: string; header?: string | null; footer?: string | null; botones: { id: string; titulo: string }[] }
  | { tipo: 'lista'; cuerpo: string; header?: string | null; footer?: string | null; boton: string; secciones: { titulo?: string; filas: { id: string; titulo: string; descripcion?: string }[] }[] }
  | { tipo: 'cta_url'; cuerpo: string; header?: string | null; footer?: string | null; texto_boton: string; url: string }
  | { tipo: 'pedir_ubicacion'; cuerpo: string }
  | { tipo: 'pedir_contacto'; cuerpo: string }
  | { tipo: 'permiso_llamada'; cuerpo: string }
  | { tipo: 'catalogo'; cuerpo: string; thumbnail_product_retailer_id?: string | null }
  | { tipo: 'carrusel'; cuerpo: string; tarjetas: { imagen: string; cuerpo: string; texto_boton: string; url?: string; id?: string }[] }
  | { tipo: 'producto'; cuerpo?: string | null; footer?: string | null; catalog_id: string; product_retailer_id: string }
  | { tipo: 'productos'; cuerpo: string; header: string; footer?: string | null; catalog_id: string; secciones: { titulo: string; product_retailer_ids: string[] }[] };

const recorta = (t: string, n: number) => String(t || '').trim().slice(0, n);

/** Construye el objeto `interactive` de Meta a partir de nuestra forma simple (con los límites de Meta aplicados). */
export function armarInteractivo(i: Interactivo): any {
  const header = (h?: string | null) => h ? { header: { type: 'text', text: recorta(h, 60) } } : {};
  const footer = (f?: string | null) => f ? { footer: { text: recorta(f, 60) } } : {};
  switch (i.tipo) {
    case 'botones':
      return { type: 'button', ...header(i.header), body: { text: recorta(i.cuerpo, 1024) }, ...footer(i.footer),
        action: { buttons: i.botones.slice(0, 3).map((b, n) => ({ type: 'reply', reply: { id: recorta(b.id || `b${n + 1}`, 256), title: recorta(b.titulo, 20) } })) } };
    case 'lista':
      return { type: 'list', ...header(i.header), body: { text: recorta(i.cuerpo, 4096) }, ...footer(i.footer),
        action: { button: recorta(i.boton || 'Elegir', 20), sections: i.secciones.slice(0, 10).map(s => ({ ...(s.titulo ? { title: recorta(s.titulo, 24) } : {}),
          rows: s.filas.slice(0, 10).map((r, n) => ({ id: recorta(r.id || `r${n + 1}`, 200), title: recorta(r.titulo, 24), ...(r.descripcion ? { description: recorta(r.descripcion, 72) } : {}) })) })) } };
    case 'cta_url':
      return { type: 'cta_url', ...header(i.header), body: { text: recorta(i.cuerpo, 1024) }, ...footer(i.footer),
        action: { name: 'cta_url', parameters: { display_text: recorta(i.texto_boton || 'Abrir', 20), url: i.url } } };
    case 'pedir_ubicacion':
      return { type: 'location_request_message', body: { text: recorta(i.cuerpo, 1024) }, action: { name: 'send_location' } };
    case 'pedir_contacto':
      return { type: 'request_contact_info', body: { text: recorta(i.cuerpo, 1024) }, action: { name: 'request_contact_info' } };
    case 'permiso_llamada':
      return { type: 'call_permission_request', body: { text: recorta(i.cuerpo, 1024) }, action: { name: 'call_permission_request' } };
    case 'catalogo':
      return { type: 'catalog_message', body: { text: recorta(i.cuerpo, 1024) }, action: { name: 'catalog_message', ...(i.thumbnail_product_retailer_id ? { parameters: { thumbnail_product_retailer_id: i.thumbnail_product_retailer_id } } : {}) } };
    case 'carrusel':
      return { type: 'carousel', body: { text: recorta(i.cuerpo, 1024) }, action: { cards: i.tarjetas.slice(0, 10).map((t, n) => ({
        card_index: n, type: t.url ? 'cta_url' : 'quick_reply', header: { type: 'image', image: { link: t.imagen } }, body: { text: recorta(t.cuerpo, 160) },
        action: t.url ? { name: 'cta_url', parameters: { display_text: recorta(t.texto_boton || 'Ver', 20), url: t.url } }
          : { buttons: [{ type: 'quick_reply', quick_reply: { id: recorta(t.id || `c${n + 1}`, 256), title: recorta(t.texto_boton || 'Elegir', 20) } }] },
      })) } };
    case 'producto':
      return { type: 'product', ...(i.cuerpo ? { body: { text: recorta(i.cuerpo, 1024) } } : {}), ...footer(i.footer), action: { catalog_id: i.catalog_id, product_retailer_id: i.product_retailer_id } };
    case 'productos':
      return { type: 'product_list', header: { type: 'text', text: recorta(i.header, 60) }, body: { text: recorta(i.cuerpo, 1024) }, ...footer(i.footer),
        action: { catalog_id: i.catalog_id, sections: i.secciones.slice(0, 10).map(s => ({ title: recorta(s.titulo, 24), product_items: s.product_retailer_ids.slice(0, 30).map(id => ({ product_retailer_id: id })) })) } };
  }
}

export const enviarInteractivo = (telefono: string, i: Interactivo, citaWamid?: string | null) =>
  mensaje(telefono, { type: 'interactive', interactive: armarInteractivo(i) }, citaWamid);

export const enviarUbicacion = (telefono: string, u: { lat: number; lng: number; nombre?: string; direccion?: string }, citaWamid?: string | null) =>
  mensaje(telefono, { type: 'location', location: { latitude: u.lat, longitude: u.lng, ...(u.nombre ? { name: recorta(u.nombre, 100) } : {}), ...(u.direccion ? { address: recorta(u.direccion, 200) } : {}) } }, citaWamid);

export const enviarContacto = (telefono: string, c: { nombre: string; apellido?: string; telefono?: string; email?: string; empresa?: string; puesto?: string }, citaWamid?: string | null) =>
  mensaje(telefono, { type: 'contacts', contacts: [{
    name: { formatted_name: `${c.nombre} ${c.apellido || ''}`.trim(), first_name: c.nombre, ...(c.apellido ? { last_name: c.apellido } : {}) },
    ...(c.telefono ? { phones: [{ phone: c.telefono, type: 'WORK', wa_id: c.telefono.replace(/\D/g, '') }] } : {}),
    ...(c.email ? { emails: [{ email: c.email, type: 'WORK' }] } : {}),
    ...(c.empresa || c.puesto ? { org: { ...(c.empresa ? { company: c.empresa } : {}), ...(c.puesto ? { title: c.puesto } : {}) } } : {}),
  }] }, citaWamid);

export const enviarSticker = (telefono: string, ref: { link?: string; id?: string }) =>
  mensaje(telefono, { type: 'sticker', sticker: ref.id ? { id: ref.id } : { link: ref.link } });

export const enviarReaccion = (telefono: string, wamid: string, emoji: string) =>
  mensaje(telefono, { type: 'reaction', reaction: { message_id: wamid, emoji } });   // emoji '' = quitar

/** Confirmación de lectura (palomitas azules) y, opcional, "escribiendo…". */
export async function marcarLeido(wamid: string, escribiendo = false) {
  return meta(`/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp', status: 'read', message_id: wamid,
      ...(escribiendo ? { typing_indicator: { type: 'text' } } : {}),
    }),
  });
}

/**
 * Media ENTRANTE: el id de Meta se cambia por una URL temporal y el binario se
 * baja con la API key (el navegador no la tiene, por eso esto vive en el
 * servidor y /api/crm/whatsapp/media lo sirve como proxy).
 */
export async function descargarMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  if (!API_KEY) throw new KapsoError(0, 'Falta KAPSO_API_KEY');
  // Kapso necesita saber de qué número es la media para enrutar a Meta.
  const info = await meta(`/${mediaId}?phone_number_id=${PHONE_NUMBER_ID}`);
  const url = info?.url;
  if (!url) return null;
  const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) return null;
  return { bytes: await res.arrayBuffer(), mime: res.headers.get('content-type') || info?.mime_type || 'application/octet-stream' };
}

/** Plantilla aprobada. `params` son los valores del BODY, en orden {{1}}..{{n}}. */
export async function enviarPlantilla(telefono: string, nombre: string, idioma: string, params: string[], extra?: {
  headerMedia?: { tipo: 'image' | 'video' | 'document'; link: string; filename?: string } | null;
  botonUrlParam?: string | null;    // valor para {{1}} de un botón URL dinámico
  otp?: string | null;              // plantilla de autenticación: el código va en body y en el botón
}) {
  const components: any[] = [];
  if (extra?.headerMedia) components.push({ type: 'header', parameters: [{ type: extra.headerMedia.tipo, [extra.headerMedia.tipo]: { link: extra.headerMedia.link, ...(extra.headerMedia.tipo === 'document' && extra.headerMedia.filename ? { filename: extra.headerMedia.filename } : {}) } }] });
  if (extra?.otp) {
    components.push({ type: 'body', parameters: [{ type: 'text', text: extra.otp }] });
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: extra.otp }] });
  } else if (params.length) components.push({ type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) });
  if (extra?.botonUrlParam) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: extra.botonUrlParam }] });
  return meta(`/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: telefono,
      type: 'template',
      template: { name: nombre, language: { code: idioma }, components },
    }),
  });
}

/** Imagen o documento por LINK público (WhatsApp lo descarga de ahí). */
export async function enviarMediaLink(telefono: string, clase: 'image' | 'document' | 'video', link: string, nombre?: string, caption?: string, citaWamid?: string | null) {
  const cuerpo: any = { messaging_product: 'whatsapp', to: telefono, type: clase };
  if (citaWamid) cuerpo.context = { message_id: citaWamid };
  cuerpo[clase] = clase === 'document' ? { link, filename: nombre || 'documento' } : { link };
  if (caption) cuerpo[clase].caption = caption;
  return meta(`/${PHONE_NUMBER_ID}/messages`, { method: 'POST', body: JSON.stringify(cuerpo) });
}

/** Sube un binario a Meta vía Kapso y devuelve el media id. */
export async function subirMediaKapso(bytes: Uint8Array | ArrayBuffer, mime: string, nombre = 'archivo'): Promise<string> {
  if (!API_KEY) throw new KapsoError(0, 'Falta KAPSO_API_KEY');
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp');
  fd.append('type', mime);
  fd.append('file', new Blob([bytes as any], { type: mime }), nombre);
  const res = await fetch(`${META}/${PHONE_NUMBER_ID}/media`, { method: 'POST', headers: { 'X-API-Key': API_KEY }, body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new KapsoError(res.status, j?.error || j);
  const id = j?.id || j?.data?.id;
  if (!id) throw new KapsoError(502, 'Kapso no devolvió media id');
  return String(id);
}

/** Envía media por ID de Meta. audio + voice:true = nota de voz. */
export async function enviarMediaId(telefono: string, clase: 'image' | 'document' | 'audio' | 'video', mediaId: string, o: { caption?: string; filename?: string; voice?: boolean } = {}) {
  const cuerpo: any = { messaging_product: 'whatsapp', to: telefono, type: clase };
  cuerpo[clase] = { id: mediaId };
  if (o.caption && clase !== 'audio') cuerpo[clase].caption = o.caption;
  if (o.filename && clase === 'document') cuerpo[clase].filename = o.filename;
  if (o.voice && clase === 'audio') cuerpo[clase].voice = true;
  return meta(`/${PHONE_NUMBER_ID}/messages`, { method: 'POST', body: JSON.stringify(cuerpo) });
}

// ── Plantillas (Meta passthrough) ──

export async function listarPlantillasMeta(): Promise<any[]> {
  if (!BUSINESS_ACCOUNT_ID) throw new KapsoError(0, 'Falta KAPSO_BUSINESS_ACCOUNT_ID');
  const r = await meta(`/${BUSINESS_ACCOUNT_ID}/message_templates?limit=100&fields=id,name,status,language,category,quality_score,rejected_reason,components`);
  return Array.isArray(r) ? r : (r?.data ?? []);
}

/** Sube una URL pública a Meta como "resumable asset" y devuelve el handle (h:…) que exige el HEADER de media de una plantilla. */
export async function ingestarHandle(url: string, mime?: string | null, filename?: string | null): Promise<string> {
  const r = await platform('/whatsapp/media', { method: 'POST', body: JSON.stringify({ media_ingest: { phone_number_id: PHONE_NUMBER_ID, source: url, delivery: 'meta_resumable_asset', ...(mime ? { mime_type: mime } : {}), ...(filename ? { filename } : {}) } }) });
  const h = r?.target?.handle || r?.data?.target?.handle || r?.handle || r?.data?.handle;
  if (!h) throw new KapsoError(502, { error: `Kapso no devolvió handle: ${JSON.stringify(r).slice(0, 200)}` });
  return String(h);
}

export type BotonPlantilla = { tipo?: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'CATALOG' | 'MPM'; texto: string; url?: string; telefono?: string; ejemplo?: string };

export async function crearPlantillaMeta(p: {
  nombre: string; idioma: string; categoria: string;
  cuerpo: string; header?: string | null; footer?: string | null; botones?: BotonPlantilla[];
  ejemplos?: string[];   // un valor de muestra por {{n}} del cuerpo (Meta lo EXIGE si hay variables)
  headerTipo?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | null;
  headerHandle?: string | null;   // h:… (ya ingerido)
  autenticacion?: { expiraMin?: number; recomendacion?: boolean } | null;   // categoría AUTHENTICATION: el cuerpo lo pone Meta
}) {
  if (!BUSINESS_ACCOUNT_ID) throw new KapsoError(0, 'Falta KAPSO_BUSINESS_ACCOUNT_ID');
  const components: any[] = [];
  const ht = (p.headerTipo || 'TEXT').toUpperCase();
  if (ht === 'TEXT' && p.header) {
    const h: any = { type: 'HEADER', format: 'TEXT', text: p.header };
    const nh = (p.header.match(/\{\{\d+\}\}/g) || []).length;
    if (nh) h.example = { header_text: Array.from({ length: nh }, (_, i) => p.ejemplos?.[i] || `Ejemplo ${i + 1}`) };
    components.push(h);
  } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht)) {
    if (!p.headerHandle) throw new KapsoError(400, { error: 'El encabezado de media necesita un archivo (handle de Meta)' });
    components.push({ type: 'HEADER', format: ht, example: { header_handle: [p.headerHandle] } });
  } else if (ht === 'LOCATION') {
    components.push({ type: 'HEADER', format: 'LOCATION' });
  }
  if (p.categoria === 'AUTHENTICATION') {
    components.push({ type: 'BODY', add_security_recommendation: p.autenticacion?.recomendacion !== false });
    if (p.autenticacion?.expiraMin) components.push({ type: 'FOOTER', code_expiration_minutes: Math.min(90, Math.max(1, p.autenticacion.expiraMin)) });
    components.push({ type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] });
  } else {
    const vars = Array.from(new Set((p.cuerpo.match(/\{\{(\d+)\}\}/g) || []).map(v => Number(v.replace(/\D/g, ''))))).sort((a, b) => a - b);
    const body: any = { type: 'BODY', text: p.cuerpo };
    if (vars.length) body.example = { body_text: [vars.map((n, i) => (p.ejemplos?.[n - 1] || p.ejemplos?.[i] || `Ejemplo ${n}`).slice(0, 100))] };
    components.push(body);
    if (p.footer) components.push({ type: 'FOOTER', text: p.footer });
    const botones = (p.botones || []).filter(b => b.texto?.trim() || b.tipo === 'CATALOG' || b.tipo === 'MPM').slice(0, 10);
    if (botones.length) components.push({ type: 'BUTTONS', buttons: botones.map(b => {
      const t = (b.tipo || 'QUICK_REPLY').toUpperCase(); const texto = (b.texto || '').trim().slice(0, 25);
      if (t === 'URL') { const url = String(b.url || '').trim(); return { type: 'URL', text: texto.slice(0, 20), url, ...(/\{\{1\}\}/.test(url) ? { example: [b.ejemplo || 'ejemplo'] } : {}) }; }
      if (t === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: texto.slice(0, 20), phone_number: String(b.telefono || '').replace(/[^\d+]/g, '') };
      if (t === 'COPY_CODE') return { type: 'COPY_CODE', example: b.ejemplo || 'CODIGO10' };
      if (t === 'CATALOG') return { type: 'CATALOG', text: texto || 'Ver catálogo' };
      if (t === 'MPM') return { type: 'MPM', text: texto || 'Ver productos' };
      return { type: 'QUICK_REPLY', text: texto.slice(0, 20) };
    }) });
  }
  return meta(`/${BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({ name: p.nombre, language: p.idioma, category: p.categoria, components }),
  });
}

/** Borra una plantilla (por nombre: todas sus traducciones). */
export async function borrarPlantillaMeta(nombre: string) {
  if (!BUSINESS_ACCOUNT_ID) throw new KapsoError(0, 'Falta KAPSO_BUSINESS_ACCOUNT_ID');
  return meta(`/${BUSINESS_ACCOUNT_ID}/message_templates?name=${encodeURIComponent(nombre)}`, { method: 'DELETE' });
}

/**
 * El id de plantilla que Broadcasts espera es el del CATÁLOGO de Kapso (su
 * cache de las plantillas de Meta), no el de Meta. Se resuelve por
 * nombre+idioma; si el listado de Kapso no está disponible, se intenta con el
 * id de Meta como último recurso.
 */
export async function resolverTemplateId(nombre: string, idioma: string, metaId?: string | null): Promise<string | null> {
  try {
    const r = await platform(`/whatsapp/templates?phone_number_id=${PHONE_NUMBER_ID}`);
    const items = Array.isArray(r) ? r : (r?.templates ?? []);
    const t = items.find((x: any) =>
      (x.name === nombre || x.template_name === nombre) &&
      (!x.language || x.language === idioma || x.language_code === idioma));
    if (t?.id) return String(t.id);
  } catch { /* el listado puede no existir en el plan: se cae al id de Meta */ }
  return metaId || null;
}

// ── Broadcasts (Platform) ──

export async function crearBroadcast(nombre: string, templateId: string) {
  return platform('/whatsapp/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      broadcast: { name: nombre, phone_number_id: PHONE_NUMBER_ID, template_id: templateId },
    }),
  });
}

/** Kapso acepta hasta 1000 por request; aquí se trocea lo que venga. */
export async function agregarDestinatarios(broadcastId: string, destinatarios: Array<{
  phone_number: string; template_components?: any;
}>) {
  for (let i = 0; i < destinatarios.length; i += 1000) {
    await platform(`/whatsapp/broadcasts/${broadcastId}/recipients`, {
      method: 'POST',
      body: JSON.stringify({ recipients: destinatarios.slice(i, i + 1000) }),
    });
  }
}

export const enviarBroadcast = (broadcastId: string) =>
  platform(`/whatsapp/broadcasts/${broadcastId}/send`, { method: 'POST' });

export const programarBroadcast = (broadcastId: string, scheduledAt: string) =>
  platform(`/whatsapp/broadcasts/${broadcastId}/schedule`, {
    method: 'POST', body: JSON.stringify({ scheduled_at: scheduledAt }),
  });

export const obtenerBroadcast = (broadcastId: string) =>
  platform(`/whatsapp/broadcasts/${broadcastId}`);

/** Una página de destinatarios. Kapso NO filtra por status: se filtra en SQL propio. */
export const listarDestinatarios = (broadcastId: string, page = 1, perPage = 100) =>
  platform(`/whatsapp/broadcasts/${broadcastId}/recipients?page=${page}&per_page=${perPage}`);
