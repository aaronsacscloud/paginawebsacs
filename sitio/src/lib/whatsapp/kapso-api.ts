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

const API_KEY = (import.meta.env.KAPSO_API_KEY || '').trim();
const PHONE_NUMBER_ID = (import.meta.env.KAPSO_PHONE_NUMBER_ID || '').trim();
const BUSINESS_ACCOUNT_ID = (import.meta.env.KAPSO_BUSINESS_ACCOUNT_ID || '').trim();

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

// ── Webhooks ──

const EVENTOS = [
  'whatsapp.message.received', 'whatsapp.message.sent', 'whatsapp.message.delivered',
  'whatsapp.message.read', 'whatsapp.message.failed',
  'whatsapp.conversation.created', 'whatsapp.conversation.ended',
  'whatsapp.contact.marketing_preference_changed',
];

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

// ── Envío (Meta passthrough) ──

/** Texto libre. Fuera de la ventana de 24 h Kapso devuelve 422: se propaga. */
export async function enviarTexto(telefono: string, texto: string) {
  return meta(`/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: telefono,
      type: 'text', text: { body: texto },
    }),
  });
}

/** Plantilla aprobada. `params` son los valores del BODY, en orden {{1}}..{{n}}. */
export async function enviarPlantilla(telefono: string, nombre: string, idioma: string, params: string[]) {
  const components = params.length ? [{
    type: 'body',
    parameters: params.map((p) => ({ type: 'text', text: p })),
  }] : [];
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
export async function enviarMediaLink(telefono: string, clase: 'image' | 'document' | 'video', link: string, nombre?: string, caption?: string) {
  const cuerpo: any = { messaging_product: 'whatsapp', to: telefono, type: clase };
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
  const r = await meta(`/${BUSINESS_ACCOUNT_ID}/message_templates?limit=100`);
  return Array.isArray(r) ? r : (r?.data ?? []);
}

export async function crearPlantillaMeta(p: {
  nombre: string; idioma: string; categoria: string;
  cuerpo: string; header?: string | null; footer?: string | null; botones?: { texto: string }[];
}) {
  if (!BUSINESS_ACCOUNT_ID) throw new KapsoError(0, 'Falta KAPSO_BUSINESS_ACCOUNT_ID');
  const components: any[] = [];
  if (p.header) components.push({ type: 'HEADER', format: 'TEXT', text: p.header });
  components.push({ type: 'BODY', text: p.cuerpo });
  if (p.footer) components.push({ type: 'FOOTER', text: p.footer });
  const botones = (p.botones || []).filter(b => b.texto?.trim()).slice(0, 3);
  if (botones.length) components.push({ type: 'BUTTONS', buttons: botones.map(b => ({ type: 'QUICK_REPLY', text: b.texto.trim().slice(0, 20) })) });
  return meta(`/${BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({
      name: p.nombre, language: p.idioma, category: p.categoria, components,
    }),
  });
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
