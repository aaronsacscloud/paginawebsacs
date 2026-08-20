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
export function envolverLinks(html: string, base: string, sendId: string): string {
  const raiz = base.replace(/\/$/, '');
  return String(html || '').replace(/href="([^"]+)"/gi, (todo, url) => {
    const u = String(url);
    if (NO_TOCAR.test(u) || esDeBaja(u) || !/^https?:/i.test(u)) return todo;
    if (u.startsWith(`${raiz}/api/email/track-click`)) return todo;   // ya envuelto
    return `href="${raiz}/api/email/track-click?sid=${encodeURIComponent(sendId)}&url=${encodeURIComponent(u)}"`;
  });
}

/** El pixel de apertura, justo antes de cerrar el cuerpo. */
export function agregarPixel(html: string, base: string, sendId: string): string {
  const img = `<img src="${base.replace(/\/$/, '')}/api/email/track-open?sid=${encodeURIComponent(sendId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${img}</body>`) : html + img;
}
