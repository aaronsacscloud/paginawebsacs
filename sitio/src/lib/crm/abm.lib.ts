// ══ Motor Account-Based · lo que comparten todas las rutas ═══════════════════
//
// "Cuentas objetivo" son PROSPECTOS de moda investigados en frío (tablas abm_*).
// Tres reglas que valen para todo lo que hay aquí:
//
// 1. Un prospecto NO es un cliente. Nunca escriben en companies/subscriptions:
//    si se mezclan, el ARR y el reporte ejecutivo dejan de significar algo. La
//    cuenta se convierte en cliente al ganarse, y hasta entonces.
// 2. Todo dato tiene procedencia. Cada correo, teléfono o conteo guarda de
//    dónde salió y con qué confianza; el vendedor necesita saber si el correo
//    viene del aviso de privacidad (alta) o de un directorio ajeno (baja).
// 3. Lo investigado y lo confirmado son dos verdades. Lo que dijo el prospecto
//    cuando contestó GANA siempre sobre lo que encontramos nosotros, y se
//    guarda aparte con quién lo confirmó.
import { supabase } from '../supabase';
import { getCurrentUser } from '../auth/scope';

export const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: any) => typeof v === 'string' && UUID.test(v);
export const limpiar = (v: any, max = 500) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export type Quien = { id: string; nombre: string; role: string };

/** La identidad SIEMPRE de la cookie; el navegador nunca dice quién es. */
export async function quien(request: Request): Promise<Quien | null> {
  const u = await getCurrentUser(request);
  if (!u) return null;
  return { id: (u as any).id, nombre: (u as any).name || (u as any).email || 'equipo', role: (u as any).role || 'cs' };
}

// ── Los quince giros del estudio, con su nombre en la pantalla ──────────────
export const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes',
  novias: 'Novias', zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano',
  joyeria: 'Joyería', charro: 'Charro y danza', scrubs: 'Uniformes médicos', telas: 'Telas y mercería',
  tallas: 'Tallas extra, maternidad y bebé', operadores: 'Operadores y concept stores',
  aliados: 'Consultoras y escuelas', canal: 'Canal mayorista',
};

export const ETAPAS = ['sin_tocar', 'en_cadencia', 'respondio', 'reunion', 'diagnostico', 'propuesta', 'ganada', 'perdida', 'no_contactar'] as const;
export const ETAPA_ETIQ: Record<string, string> = {
  sin_tocar: 'Sin tocar', en_cadencia: 'En cadencia', respondio: 'Respondió', reunion: 'Reunión',
  diagnostico: 'Diagnóstico', propuesta: 'Propuesta', ganada: 'Ganada', perdida: 'Perdida', no_contactar: 'No contactar',
};

export const CANAL_ETIQ: Record<string, string> = {
  email_direccion: 'Correo de dirección', email_generico: 'Correo general',
  whatsapp_tienda: 'WhatsApp de la tienda', whatsapp_dueno: 'WhatsApp del dueño',
  telefono: 'Teléfono', dm_ig: 'Instagram', dm_fb: 'Facebook', linkedin: 'LinkedIn',
};

export const METODO_ETIQ: Record<string, string> = {
  sitio_oficial: 'su sitio oficial', aviso_privacidad: 'el aviso de privacidad de su sitio',
  facebook_info: 'la sección Información de su Facebook', google_maps: 'su ficha de Google',
  localizador: 'su localizador de tiendas', instagram: 'su Instagram', prensa: 'una nota de prensa',
  directorio: 'un directorio de terceros', escaner: 'el escaneo de su sitio', investigacion: 'la investigación',
};

/** Puntaje 0-100: encaje (0-40) + dolor (0-35) + accesibilidad (0-25). */
export function calcularPuntaje(c: any): { encaje: number; dolor: number; accesibilidad: number; puntaje: number } {
  const suc = Number(c.sucursales || 0);
  const encaje = Math.min(40, 10 + (suc >= 2 ? 12 : 0) + (suc >= 5 ? 10 : 0) + (suc >= 15 ? 8 : 0));
  let dolor = 0;
  if (['Shopify', 'VTEX', 'WooCommerce', 'Wix', 'Tiendanube'].includes(c.plataforma_web) && suc >= 3) dolor += 15;
  if (c.sitio_http === 0 || Number(c.sitio_http || 200) >= 400) dolor += 12;
  if (c.sitio_carrito === false) dolor += 8;
  if (c.senal_expansion) dolor += 10;
  if (c.google_rating && Number(c.google_rating) < 4.5 && suc >= 3) dolor += 10;
  dolor = Math.min(35, dolor);
  const acc = Math.min(25, (c.tiene_email ? 12 : 0) + (c.tiene_wa ? 8 : 0) + (c.tiene_persona ? 5 : 0));
  return { encaje, dolor, accesibilidad: acc, puntaje: encaje + dolor + acc };
}

/** La ruta la decide el tamaño: cinco sucursales o más merecen diagnóstico. */
export const rutaDe = (suc: number | null) => (Number(suc || 0) >= 5 ? 'diagnostico' : 'demo');

/** Deja rastro en la bitácora. Todo lo que le pasa a una cuenta pasa por aquí. */
export async function apuntar(cuenta_id: string, canal: string, tipo: string, extra: Record<string, any> = {}) {
  const { error } = await supabase.from('abm_actividad').insert({
    cuenta_id, canal, tipo,
    persona_id: extra.persona_id || null, toque_id: extra.toque_id || null,
    texto: extra.texto ? limpiar(extra.texto, 4000) : null,
    transcripcion: extra.transcripcion ? limpiar(extra.transcripcion, 20000) : null,
    detalle: extra.detalle || {},
    ocurrio_at: extra.ocurrio_at || new Date().toISOString(),
  });
  if (error) console.error('[abm] no se pudo apuntar la actividad:', error.message);
}
