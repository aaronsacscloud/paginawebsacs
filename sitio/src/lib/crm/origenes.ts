// De dónde llegó la cuenta. UN catálogo para leads y para clientes.
//
// Antes el lead guardaba una "fuente" técnica —website-form, booking-page— y el
// cliente una propiedad aparte con otras opciones. Con dos listas distintas, el
// origen se perdía justo al convertir: nunca se podía responder "de TikTok
// salieron 4 clientes que hoy pagan $96,400", que es la pregunta que decide si
// un canal merece presupuesto.
//
// Las opciones viven TAMBIÉN en crm_propiedades (para el editor genérico de
// campos). Si se agrega una aquí, hay que agregarla allá: la migración las
// siembra desde esta misma lista.
export type Origen = { v: string; l: string; grupo: string; color: string };

export const ORIGENES: Origen[] = [
  // Redes
  { v: 'tiktok', l: 'TikTok', grupo: 'Redes sociales', color: '#1a1a1a' },
  { v: 'facebook', l: 'Facebook', grupo: 'Redes sociales', color: '#4267B2' },
  { v: 'instagram', l: 'Instagram', grupo: 'Redes sociales', color: '#C13584' },
  { v: 'youtube', l: 'YouTube', grupo: 'Redes sociales', color: '#FF0000' },
  { v: 'linkedin', l: 'LinkedIn', grupo: 'Redes sociales', color: '#0A66C2' },
  { v: 'whatsapp', l: 'WhatsApp', grupo: 'Redes sociales', color: '#25D366' },
  // Búsqueda
  { v: 'google', l: 'Google', grupo: 'Búsqueda', color: '#4285F4' },
  { v: 'chatgpt', l: 'ChatGPT / IA', grupo: 'Búsqueda', color: '#10A37F' },
  // Propios
  { v: 'sitio_web', l: 'Sitio web', grupo: 'Canales propios', color: '#9B8CFA' },
  { v: 'tienda_linea', l: 'Tienda en línea', grupo: 'Canales propios', color: '#7DA6F5' },
  { v: 'agenda', l: 'Página de agenda', grupo: 'Canales propios', color: '#7DA6F5' },
  { v: 'cotizacion', l: 'Cotización', grupo: 'Canales propios', color: '#4FBF95' },
  // Personas
  { v: 'referido_cliente', l: 'Recomendación de un cliente', grupo: 'Personas', color: '#F0B84E' },
  { v: 'partner', l: 'Partner', grupo: 'Personas', color: '#F0B84E' },
  { v: 'prospeccion', l: 'Prospección propia', grupo: 'Personas', color: '#F0B84E' },
  // Otros
  { v: 'evento', l: 'Evento o feria', grupo: 'Otros', color: '#C9C7D0' },
  { v: 'marketplace', l: 'Marketplace', grupo: 'Otros', color: '#C9C7D0' },
  { v: 'recompra', l: 'Reactivación / recompra', grupo: 'Otros', color: '#C9C7D0' },
  // Se conserva de lo ya capturado: tres cuentas dicen "redes" sin decir cuál.
  // Borrarla habría perdido el dato; queda para poder afinarla después.
  { v: 'redes', l: 'Redes sociales (sin especificar)', grupo: 'Otros', color: '#8a8a92' },
  { v: 'otro', l: 'Otro', grupo: 'Otros', color: '#C9C7D0' },
];

export const GRUPOS_ORIGEN = ['Redes sociales', 'Búsqueda', 'Canales propios', 'Personas', 'Otros'];

const POR_V: Record<string, Origen> = Object.fromEntries(ORIGENES.map(o => [o.v, o]));
export const origenDe = (v?: string | null): Origen =>
  POR_V[String(v || '')] || { v: '', l: 'Sin definir', grupo: 'Otros', color: '#e0dee6' };

/**
 * De la fuente técnica al origen comercial.
 *
 * Lo que el sistema YA sabe no se pregunta: quien entró por el formulario del
 * sitio nace con "Sitio web". Es un valor por omisión, no una condena — se
 * puede corregir a mano si en realidad venía de un anuncio de TikTok.
 */
const DESDE_FUENTE: Record<string, string> = {
  'website-form': 'sitio_web',
  'booking-page': 'agenda',
  'cotizacion': 'cotizacion',
  'checkout': 'tienda_linea',
  'partner': 'partner',
};

/** El origen de un contacto/empresa: lo capturado gana; si no, lo deducido. */
export function origenDeRegistro(r: any): string {
  const cap = r?.propiedades?.origen_cuenta;
  if (cap) return String(cap);
  const utm = String(r?.utm_source || '').toLowerCase();
  if (utm) {
    if (utm.includes('tiktok')) return 'tiktok';
    if (utm.includes('insta') || utm === 'ig') return 'instagram';
    if (utm.includes('face') || utm === 'fb') return 'facebook';
    if (utm.includes('google')) return 'google';
    if (utm.includes('linkedin')) return 'linkedin';
    if (utm.includes('youtube')) return 'youtube';
  }
  return DESDE_FUENTE[String(r?.fuente || '')] || '';
}
