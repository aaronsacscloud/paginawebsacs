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

/** Pie en HTML. Tablas y CSS inline: es lo único que Outlook respeta. */
export function footerHtml(t: Tenant, base: string, token: string): string {
  const FA = "font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;";
  const nombre = escapar(t.nombre || t.from_nombre);
  const dir = escapar(t.direccion_fisica || '');
  const motivo = escapar(t.motivo_recepcion || `Recibiste este correo de ${t.nombre}.`);
  const extra = t.footer_extra ? `<div style="font-size:11.5px;color:#94A3B8;margin-top:6px;">${escapar(t.footer_extra)}</div>` : '';
  const aviso = t.aviso_privacidad_url
    ? ` · <a href="${escapar(t.aviso_privacidad_url)}" style="color:#64748B;text-decoration:underline;">Aviso de privacidad</a>`
    : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E5E7EB;">
  <tr><td style="padding-top:16px;text-align:center;${FA}">
    <div style="font-size:12px;color:#94A3B8;line-height:1.6;">${motivo}</div>
    <div style="font-size:11.5px;color:#94A3B8;line-height:1.6;margin-top:4px;"><strong style="color:#64748B;">${nombre}</strong>${dir ? ' · ' + dir : ''}</div>
    ${extra}
    <div style="margin-top:12px;font-size:12px;">
      <a href="${urlBaja(base, token)}" style="color:#2563EB;text-decoration:underline;">Cancelar suscripción</a>
      · <a href="${urlPreferencias(base, token)}" style="color:#64748B;text-decoration:underline;">Preferencias</a>${aviso}
    </div>
  </td></tr>
</table>`;
}

/** Pie en texto plano — la versión text/plain también tiene que cumplir. */
export function footerTexto(t: Tenant, base: string, token: string): string {
  const p = ['', '—', t.motivo_recepcion || `Recibiste este correo de ${t.nombre}.`];
  p.push(`${t.nombre}${t.direccion_fisica ? ' · ' + t.direccion_fisica : ''}`);
  if (t.footer_extra) p.push(t.footer_extra);
  if (t.aviso_privacidad_url) p.push('Aviso de privacidad: ' + t.aviso_privacidad_url);
  p.push('Cancelar suscripción: ' + urlBaja(base, token));
  p.push('Preferencias de correo: ' + urlPreferencias(base, token));
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
