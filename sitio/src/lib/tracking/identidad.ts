// TRACKING · Saber QUIÉN está navegando el sitio.
//
// El rastreador guardaba visitas anónimas: 2,524 filas y una sola con correo.
// Sin identificar al visitante, "qué ha visto de SACS" no existe.
//
// La pieza que faltaba es un token FIRMADO que viaja en los links que nosotros
// mandamos (correos y WhatsApp): `?sv=<id firmado>`. El sitio lo lee, se lo
// pasa a /api/tracking/identify y ahí —y solo ahí, tras verificar la firma— se
// liga el visitor_id del navegador con el contacto, incluidas sus visitas
// anteriores.
//
// Va FIRMADO a propósito: si fuera el uuid pelón, cualquiera podría mandarle a
// un tercero un link con el id de otro contacto y ensuciarle el historial (o
// dispararle automatizaciones por visita). Sin el secreto no se fabrica.
import crypto from 'node:crypto';

const SECRETO = () => ((import.meta as any).env?.EMAIL_TOKEN_SECRET || process.env.EMAIL_TOKEN_SECRET || '').trim();
const b64 = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** contactId → token `sv`. Cadena vacía si no hay secreto configurado. */
export function firmarContacto(contactId: string): string {
  const sec = SECRETO();
  if (!contactId || sec.length < 32) return '';
  const cuerpo = b64(Buffer.from(contactId));
  const firma = b64(crypto.createHmac('sha256', sec).update(cuerpo).digest()).slice(0, 16);
  return `${cuerpo}.${firma}`;
}

/** token `sv` → contactId, o null si la firma no cuadra. */
export function verificarSv(sv: string | null | undefined): string | null {
  const sec = SECRETO();
  if (!sv || sec.length < 32) return null;
  const [cuerpo, firma] = String(sv).split('.');
  if (!cuerpo || !firma) return null;
  const esperada = b64(crypto.createHmac('sha256', sec).update(cuerpo).digest()).slice(0, 16);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  } catch { return null; }
  const id = Buffer.from(cuerpo.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

const PROPIOS = /^https?:\/\/([a-z0-9-]+\.)*sacscloud\.com(\/|$|\?)/i;

/** Le pega el `sv` a una URL NUESTRA. Las ajenas se devuelven intactas: no se
 *  le manda el identificador de un cliente a un dominio de terceros. */
export function conSv(url: string, contactId: string | null | undefined): string {
  if (!url || !contactId || !PROPIOS.test(url)) return url;
  const sv = firmarContacto(contactId);
  if (!sv) return url;
  if (/[?&]sv=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'sv=' + encodeURIComponent(sv);
}

/** Reescribe TODAS las URLs propias de un texto (para mensajes de WhatsApp). */
export function textoConSv(texto: string, contactId: string | null | undefined): string {
  if (!texto || !contactId) return texto;
  return texto.replace(/https?:\/\/[^\s<>"')]+/gi, u => conSv(u, contactId));
}
