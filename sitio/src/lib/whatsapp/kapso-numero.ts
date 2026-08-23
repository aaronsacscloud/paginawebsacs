// WHATSAPP · Etapa F: el NÚMERO como activo operativo (salud, calidad, nombre,
// username, perfil, diagnóstico, varios números, setup links).
const ENV: any = (import.meta as any).env || process.env || {};
const API_KEY = (ENV.KAPSO_API_KEY || '').trim();
const DEFAULT_PN = (ENV.KAPSO_PHONE_NUMBER_ID || '').trim();
const PLATFORM = 'https://api.kapso.ai/platform/v1';
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';

export class ErrorKapso extends Error { status: number; detalle: any; constructor(status: number, detalle: any) { super(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)); this.status = status; this.detalle = detalle; } }
async function req(base: string, ruta: string, init?: RequestInit): Promise<any> {
  if (!API_KEY) throw new ErrorKapso(0, 'Falta KAPSO_API_KEY');
  const res = await fetch(`${base}${ruta}`, { ...init, headers: { 'X-API-Key': API_KEY, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) } });
  const j = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorKapso(res.status, j?.error || j);
  return j?.data !== undefined ? j.data : j;
}
export const pn = (id?: string | null) => (id || DEFAULT_PN);

// 41) salud (Kapso + Meta; cache 3 min en Kapso)
export const saludNumero = (id?: string | null) => req(PLATFORM, `/whatsapp/phone_numbers/${pn(id)}/health`);
// 42) calidad, límite de mensajería, estado del nombre
export const infoNumero = (id?: string | null) => req(META, `/${pn(id)}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier,name_status,new_name_status,account_mode,is_official_business_account,throughput,code_verification_status`);
// 43) display name + username
export const solicitudesDisplayName = (id?: string | null) => req(PLATFORM, `/whatsapp/phone_numbers/${pn(id)}/display_name_requests?per_page=10`);
export const pedirDisplayName = (nombre: string, id?: string | null) => req(PLATFORM, `/whatsapp/phone_numbers/${pn(id)}/display_name_requests`, { method: 'POST', body: JSON.stringify({ display_name_request: { new_display_name: nombre.slice(0, 256) } }) });
export const usernameActual = (id?: string | null) => req(META, `/${pn(id)}/username`);
export const sugerenciasUsername = (id?: string | null) => req(META, `/${pn(id)}/username_suggestions`);
export const reservarUsername = (username: string, id?: string | null) => req(META, `/${pn(id)}/username`, { method: 'POST', body: JSON.stringify({ username, transfer_action: 'none' }) });
export const borrarUsername = (id?: string | null) => req(META, `/${pn(id)}/username`, { method: 'DELETE' });
// 44) perfil del negocio
export const perfilNegocio = async (id?: string | null) => { const r = await req(META, `/${pn(id)}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`); return Array.isArray(r) ? r[0] : (r?.data?.[0] || r); };
export const guardarPerfil = (p: { about?: string; address?: string; description?: string; email?: string; websites?: string[]; vertical?: string; profile_picture_handle?: string }, id?: string | null) =>
  req(META, `/${pn(id)}/whatsapp_business_profile`, { method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', ...p }) });
export async function handleDesdeUrl(url: string, id?: string | null): Promise<string> {
  const r = await req(PLATFORM, '/whatsapp/media', { method: 'POST', body: JSON.stringify({ media_ingest: { phone_number_id: pn(id), source: url, delivery: 'meta_resumable_asset' } }) });
  const h = r?.target?.handle || r?.data?.target?.handle; if (!h) throw new ErrorKapso(502, 'Kapso no devolvió handle'); return String(h);
}
// 45) diagnóstico
export const entregasWebhook = (params: Record<string, string> = {}) => req(PLATFORM, `/webhook_deliveries?${new URLSearchParams({ period: '24h', limit: '50', ...params })}`);
export const logsApi = (params: Record<string, string> = {}) => req(PLATFORM, `/api_logs?${new URLSearchParams({ period: '24h', limit: '50', ...params })}`);
// 46) números del proyecto
export const numerosKapso = () => req(PLATFORM, '/whatsapp/phone_numbers');
// 47) setup links (el cliente conecta SU WhatsApp)
export const clientesKapso = () => req(PLATFORM, '/customers?per_page=50');
export const crearClienteKapso = (nombre: string, externalId?: string) => req(PLATFORM, '/customers', { method: 'POST', body: JSON.stringify({ customer: { name: nombre, external_customer_id: externalId || `sacs-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${Date.now().toString(36)}` } }) });
export const crearSetupLink = (customerId: string, successUrl?: string) => req(PLATFORM, `/customers/${customerId}/setup_links`, { method: 'POST', body: JSON.stringify({ setup_link: { ...(successUrl ? { success_redirect_url: successUrl } : {}) } }) });
export const setupLinks = (customerId: string) => req(PLATFORM, `/customers/${customerId}/setup_links`);

/** Resumen con semáforo y frases accionables en español (para Ajustes y para la campana del cron). */
export function resumirSalud(salud: any, info: any): { nivel: 'verde' | 'ambar' | 'rojo'; titulo: string; puntos: { nivel: 'ok' | 'aviso' | 'malo'; texto: string; accion?: string }[] } {
  const puntos: { nivel: 'ok' | 'aviso' | 'malo'; texto: string; accion?: string }[] = [];
  const q = info?.quality_rating;
  if (q === 'GREEN') puntos.push({ nivel: 'ok', texto: 'Calidad del número: alta (verde).' });
  else if (q === 'YELLOW') puntos.push({ nivel: 'aviso', texto: 'Calidad del número: media (amarilla).', accion: 'Baja el volumen de marketing y revisa qué plantillas reportan como spam.' });
  else if (q === 'RED') puntos.push({ nivel: 'malo', texto: 'Calidad del número: baja (roja). Meta puede limitar o pausar los envíos.', accion: 'Detén los masivos, mejora la redacción y deja que la calidad se recupere.' });
  const tier = info?.messaging_limit_tier || salud?.checks?.phone_number_access?.details?.throughput_tier;
  if (tier) puntos.push({ nivel: 'ok', texto: `Límite de mensajería: ${String(tier).replace('TIER_', '').replace('UNLIMITED', 'ilimitado')} conversaciones iniciadas por el negocio cada 24 h.` });
  const ns = info?.name_status;
  if (ns === 'DECLINED') puntos.push({ nivel: 'malo', texto: `Display name "${info?.verified_name}" RECHAZADO por Meta.`, accion: 'Solicita un nombre que coincida con tu marca registrada o sitio (p. ej. "Sacscloud") desde Ajustes → Nombre visible. Mientras tanto el límite de envíos se queda corto.' });
  else if (ns === 'PENDING_REVIEW') puntos.push({ nivel: 'aviso', texto: 'Display name en revisión por Meta.' });
  else if (ns === 'APPROVED' || ns === 'AVAILABLE_WITHOUT_REVIEW') puntos.push({ nivel: 'ok', texto: `Display name "${info?.verified_name}" aprobado.` });
  const ent: any[] = salud?.checks?.messaging_health?.details?.entities || [];
  for (const e of ent) {
    const infos: string[] = e.additional_info || [];
    for (const t of infos) {
      if (/billing/i.test(t)) puntos.push({ nivel: 'malo', texto: 'Facturación de WhatsApp pendiente en Meta.', accion: 'Meta Business Manager → Facturación y pagos: agrega o corrige el método de pago de la WABA. Sin esto los envíos quedan limitados.' });
      else if (/display name/i.test(t)) { /* ya cubierto arriba */ }
      else puntos.push({ nivel: e.can_send_message === 'BLOCKED' ? 'malo' : 'aviso', texto: t });
    }
    for (const er of e.errors || []) puntos.push({ nivel: 'malo', texto: `${er.error_description || er.error_code}`, accion: er.possible_solution });
  }
  const envio = salud?.checks?.messaging_health?.overall_status;
  if (envio === 'BLOCKED') puntos.unshift({ nivel: 'malo', texto: 'Meta tiene BLOQUEADO el envío de mensajes desde este número.' });
  else if (envio === 'LIMITED') puntos.unshift({ nivel: 'aviso', texto: 'Meta tiene LIMITADO el envío (menos conversaciones iniciadas por el negocio).' });
  if (salud?.checks?.webhook_subscription && !salud.checks.webhook_subscription.passed) puntos.push({ nivel: 'malo', texto: 'El webhook de Meta no está suscrito: no llegan mensajes.', accion: 'Reconecta el número en Kapso.' });
  if (info?.code_verification_status === 'EXPIRED') puntos.push({ nivel: 'ok', texto: 'Verificación del número completada (código expirado es normal tras registrar).' });
  const nivel = puntos.some(p => p.nivel === 'malo') ? 'rojo' : puntos.some(p => p.nivel === 'aviso') ? 'ambar' : 'verde';
  const titulo = nivel === 'verde' ? 'Número sano' : nivel === 'ambar' ? 'Número con limitaciones' : 'Número con problemas que afectan los envíos';
  return { nivel, titulo, puntos };
}
