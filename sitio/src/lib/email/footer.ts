// El pie legal de todo correo de marketing — construido con los datos del
// INQUILINO, nunca con constantes.
//
// Es lo que separa un remitente serio de un spammer, y es obligatorio:
// quién manda, dónde está físicamente (CAN-SPAM), por qué recibes esto,
// el aviso de privacidad (LFPDPPP) y cómo darte de baja en un clic.
//
// Un partner que use la herramienta verá SU nombre, SU logo y SU dirección.
import type { Tenant } from './tenant';

export const escapar = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function urlBaja(base: string, token: string): string {
  return `${base.replace(/\/$/, '')}/email/baja/${token}`;
}
export function urlPreferencias(base: string, token: string): string {
  return `${base.replace(/\/$/, '')}/email/preferencias/${token}`;
}

/** `https://www.tiktok.com/@sacsoficial` → `@sacsoficial`; un sitio → su dominio sin `https://`. */
export function etiquetaDeUrl(u: string): string {
  const s = String(u || '').trim();
  const arroba = s.match(/@[\w.-]+/);
  if (arroba) return arroba[0];
  return s.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Pie en HTML. Tablas y CSS inline: es lo único que Outlook respeta.
 *
 * Es el pie CORPORATIVO, no solo el legal: el dueño pidió que todo correo se
 * vea formal y diga quién lo manda, dónde está la oficina, el sitio y el
 * TikTok, el aviso de confidencialidad y la nota del papel. Todo sale del
 * inquilino; lo que no tenga, no se pinta.
 */
/** Por qué recibes ESTE correo, cuando el correo es en frío.
 *
 *  El motivo del inquilino («eres cliente o dejaste tus datos en nuestro
 *  sitio») es verdad para los clientes y MENTIRA para un prospecto que nunca
 *  nos dio nada — y además se contradice con el primer correo de la cadencia,
 *  que dice «nadie nos pasó su correo ni usted se registró en ningún lado».
 *  Fuera de México eso es justo la línea que mira la ley (LSSI/RGPD en España,
 *  habeas data en Colombia): el origen del dato tiene que ser cierto. */
export const MOTIVO_FRIO = 'Recibes este correo porque tu negocio aparece en directorios públicos de internet —Google Maps y tu propio sitio— y creemos que Sacs te puede servir. Nadie nos dio tus datos y no estás suscrito a nada: si prefieres que no te escribamos, cancela aquí abajo y no volvemos a hacerlo.';

const motivoDe = (t: Tenant, categoria?: string) =>
  categoria === 'abm' ? MOTIVO_FRIO : (t.motivo_recepcion || `Recibiste este correo de ${t.nombre}.`);

export function footerHtml(t: Tenant, base: string, token: string, categoria?: string): string {
  const FA = "font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;";
  const nombre = escapar(t.nombre || t.from_nombre);
  const dir = escapar(t.direccion_fisica || '');
  const motivo = escapar(motivoDe(t, categoria));
  const extra = t.footer_extra ? `<div style="font-size:11.5px;color:#8A8598;margin-top:4px;">${escapar(t.footer_extra)}</div>` : '';
  const aviso = t.aviso_privacidad_url
    ? ` · <a href="${escapar(t.aviso_privacidad_url)}" style="color:#6B6580;text-decoration:underline;">Aviso de privacidad</a>`
    : '';
  const liga = (u: string) => `<a href="${escapar(u)}" style="${FA}font-size:13.5px;font-weight:800;color:#5B4BD6;text-decoration:none;">${escapar(etiquetaDeUrl(u))}</a>`;
  const rotulo = (s: string) => `<div style="${FA}font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#8A8598;margin-bottom:3px;">${s}</div>`;
  const visitas = (t.sitio_url || t.tiktok_url) ? `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
      ${t.sitio_url ? `<td align="center" style="padding:0 18px 0 0;">${rotulo('Visita nuestro sitio web')}${liga(t.sitio_url)}</td>` : ''}
      ${t.tiktok_url ? `<td align="center" style="padding:0 0 0 18px;${t.sitio_url ? 'border-left:1px solid #D9D4F0;' : ''}">${rotulo('Visita nuestro TikTok')}${liga(t.tiktok_url)}</td>` : ''}
    </tr></table>` : '';
  const confid = t.confidencialidad
    ? `<div style="margin-top:16px;font-size:10.5px;color:#8A8598;line-height:1.55;"><strong style="color:#6B6580;">Aviso de confidencialidad.</strong> ${escapar(t.confidencialidad)}</div>` : '';
  const papel = t.nota_papel
    ? `<div style="margin-top:8px;font-size:10.5px;color:#8A8598;line-height:1.55;">${escapar(t.nota_papel)}</div>` : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
  <tr><td style="padding:0;text-align:center;${FA}">
    ${visitas}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #D9D4F0;font-size:12.5px;font-weight:800;color:#4A4560;">${nombre}</div>
    ${dir ? `<div style="font-size:11.5px;color:#8A8598;line-height:1.6;margin-top:2px;">${dir}</div>` : ''}
    ${extra}
    <div style="font-size:11.5px;color:#8A8598;line-height:1.6;margin-top:10px;">${motivo}</div>
    <div style="margin-top:8px;font-size:12px;">
      <a href="${urlBaja(base, token)}" style="color:#5B4BD6;text-decoration:underline;">Cancelar suscripción</a>
      · <a href="${urlPreferencias(base, token)}" style="color:#6B6580;text-decoration:underline;">Preferencias</a>${aviso}
    </div>
    ${confid}
    ${papel}
  </td></tr>
</table>`;
}

/** Pie en texto plano — la versión text/plain también tiene que cumplir. */
export function footerTexto(t: Tenant, base: string, token: string, categoria?: string): string {
  const p = ['', '—'];
  if (t.sitio_url) p.push('Visita nuestro sitio web: ' + t.sitio_url);
  if (t.tiktok_url) p.push('Visita nuestro TikTok: ' + t.tiktok_url);
  p.push('', `${t.nombre}${t.direccion_fisica ? ' · ' + t.direccion_fisica : ''}`);
  if (t.footer_extra) p.push(t.footer_extra);
  p.push(motivoDe(t, categoria));
  if (t.aviso_privacidad_url) p.push('Aviso de privacidad: ' + t.aviso_privacidad_url);
  p.push('Cancelar suscripción: ' + urlBaja(base, token));
  p.push('Preferencias de correo: ' + urlPreferencias(base, token));
  if (t.confidencialidad) p.push('', 'Aviso de confidencialidad. ' + t.confidencialidad);
  if (t.nota_papel) p.push(t.nota_papel);
  return p.join('\n');
}

/** Headers RFC 8058: el botón nativo de baja de Gmail y Outlook. */
export function headersBaja(base: string, token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${base.replace(/\/$/, '')}/api/email/baja-one-click?t=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** HTML → texto legible, para la versión text/plain cuando no hay una propia. */
export function htmlATexto(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, txt) => `${String(txt).replace(/<[^>]+>/g, '').trim()} (${url})`)
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}
