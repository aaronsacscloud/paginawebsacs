// Medición de aperturas y clics — contra NUESTRO dominio.
//
// Por qué propio y no el de SendGrid: el suyo reescribe los links a un dominio
// compartido con miles de remitentes, cuya reputación no controlamos. El
// nuestro los deja en sacscloud.com.
//
// ⚠️ Esto tiene que estar CONECTADO en el pipeline. Apagar el tracking del
// proveedor sin poner el propio deja el sistema midiendo cero: los segmentos
// de "hizo clic", las ramas de embudo por comportamiento y el tablero de salud
// dependen todos de `clicked_at` / `first_opened_at`.
//
// Sobre las aperturas: el pixel se pone porque es barato, pero la señal es
// sucia (Apple Mail abre solo, Outlook bloquea imágenes). La decisión se toma
// con el CLIC.

import crypto from 'node:crypto';

/** Dominios a los que el redirector puede mandar sin firma. */
const PROPIOS = ['sacscloud.com'];

/** ¿La URL apunta a un dominio nuestro? Incluye subdominios, nada más. */
export function esDominioPropio(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return PROPIOS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

/**
 * Firma del par (destino, envío). Es lo que impide que el redirector se use
 * como trampolín hacia un sitio ajeno: sin el secreto no se puede fabricar.
 * Si falta el secreto devuelve cadena vacía — y entonces solo pasan los
 * dominios propios, que es el comportamiento seguro.
 */
export function firmaDeUrl(destino: string, sendId: string): string {
  const sec = (import.meta.env.EMAIL_TOKEN_SECRET || '').trim();
  if (sec.length < 32) return '';
  return crypto.createHmac('sha256', sec).update(sendId + '|' + destino)
    .digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 22);
}

/** Links que NO se reescriben: romperlos sería peor que no medirlos. */
const NO_TOCAR = /^(mailto:|tel:|#)/i;

function esDeBaja(url: string): boolean {
  return /\/email\/(baja|preferencias)\//.test(url) || /baja-one-click/.test(url);
}

/**
 * Reescribe los `href` del HTML para que pasen por el redirector del CRM.
 * NUNCA toca el link de baja: si la medición falla, la baja tiene que seguir
 * funcionando — es lo único que no puede romperse en un correo.
 */
/**
 * Deshace el escape HTML de un href.
 *
 * El compilador escapa los atributos —correcto— así que un link con dos
 * parámetros llega aquí como `...?plan=pro&amp;utm_source=email`. Al meterlo
 * con encodeURIComponent dentro de `?url=`, el `&amp;` viajaba LITERAL y la
 * landing recibía los parámetros llamados `amp;utm_source` y `amp;utm_campaign`.
 * Efecto: la atribución de marketing no veía nada y todo lead que llegaba por
 * correo aterrizaba sin campaña — justo la medición que este módulo existe
 * para dar.
 */
function desescapar(u: string): string {
  return u.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function envolverLinks(html: string, base: string, sendId: string): string {
  const raiz = base.replace(/\/$/, '');
  return String(html || '').replace(/href="([^"]+)"/gi, (todo, url) => {
    const u = desescapar(String(url));
    if (NO_TOCAR.test(u) || esDeBaja(u) || !/^https?:/i.test(u)) return todo;
    if (u.startsWith(`${raiz}/api/email/track-click`)) return todo;   // ya envuelto
    const f = firmaDeUrl(u, sendId);
    return `href="${raiz}/api/email/track-click?sid=${encodeURIComponent(sendId)}&url=${encodeURIComponent(u)}${f ? '&f=' + f : ''}"`;
  });
}

/** El pixel de apertura, justo antes de cerrar el cuerpo. */
export function agregarPixel(html: string, base: string, sendId: string): string {
  const img = `<img src="${base.replace(/\/$/, '')}/api/email/track-open?sid=${encodeURIComponent(sendId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${img}</body>`) : html + img;
}
