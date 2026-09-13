// ══ El correo del motor Account-Based, con forma ═════════════════════════════
//
// Arma el HTML de un toque a partir de tres cosas sueltas: el CUERPO EN TEXTO,
// la imagen de ese correo y su botón. El cuerpo nunca trae etiquetas.
//
// POR QUÉ EL DISEÑO VIVE AQUÍ Y NO DENTRO DEL CUERPO
//  · La versión de texto plano tiene que decir lo MISMO que la HTML. Si el
//    diseño estuviera en el cuerpo habría que fabricar la de texto quitando
//    etiquetas, y esa discrepancia la puntúan los filtros.
//  · La IA reescribe el cuerpo para adaptarlo a cada cuenta. Si el cuerpo
//    trajera HTML, lo rompería tarde o temprano.
//  · Cambiar el diseño aquí cambia los 248 correos ya armados, sin regenerar
//    ninguno y sin volver a pagar la IA.
//
// TÉCNICA DE CORREO, NO DE PÁGINA
// El sistema visual del CRM usa degradados y background-clip. En correo eso no
// existe: Outlook renderiza con el motor de Word y se come flex, grid, los
// degradados de CSS y las imágenes webp. Aquí todo es tabla con `bgcolor`,
// estilos en línea y JPEG. La cinta de marca, que en el CRM es un degradado, se
// hace con tres celdas sólidas: se ve igual y aguanta en todos lados.
//
// Paleta del CRM (src/lib/crm/paleta.ts) escrita a mano a propósito: este
// archivo lo consume el cron de envío, que corre en el servidor y no debe
// arrastrar dependencias del navegador para pintar un correo.
const MORADO = '#9B8CFA';
const MORADO_TINTA = '#5B4BD6';
const AZUL = '#7DA6F5';
const ROSA_SUAVE = '#EFA6CA';
const LILA = '#EEECFE';
const TINTA = '#3a3a44';
const GRIS = '#8a8a92';
const LINEA = '#ececec';
const FUENTE = "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

const esc = (x: string) => String(x || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Una URL suelta en el texto se vuelve enlace; el resto se escapa. */
function conEnlaces(linea: string): string {
  // Se muestra sin el "https://" y sin la diagonal final: el href va completo,
  // pero una URL cruda a media frase se ve como correo de robot.
  return esc(linea).replace(/(https?:\/\/[^\s<]+)/g, (u) =>
    `<a href="${u}" style="color:${MORADO_TINTA};text-decoration:underline;">${u.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>`);
}

/** El cuerpo de texto a párrafos. Los renglones que empiezan con · son lista:
 *  se pintan con su punto morado en vez de dejar el carácter suelto, que en
 *  algunos clientes se ve como basura. */
function cuerpoAHtml(texto: string): string {
  const lineas = String(texto || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out: string[] = [];
  let enLista = false;
  for (const l of lineas) {
    const esItem = /^[·•-]\s+/.test(l);
    if (esItem && !enLista) { out.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px;">`); enLista = true; }
    if (!esItem && enLista) { out.push('</table>'); enLista = false; }
    if (esItem) {
      out.push(`<tr><td width="16" valign="top" style="padding:3px 0 3px 0;color:${MORADO};font-size:16px;line-height:22px;font-family:${FUENTE};">&bull;</td>`
        + `<td valign="top" style="padding:3px 0;color:${TINTA};font-size:15px;line-height:22px;font-family:${FUENTE};">${conEnlaces(l.replace(/^[·•-]\s+/, ''))}</td></tr>`);
    } else {
      out.push(`<p style="margin:0 0 14px;color:${TINTA};font-size:15px;line-height:23px;font-family:${FUENTE};">${conEnlaces(l)}</p>`);
    }
  }
  if (enLista) out.push('</table>');
  return out.join('');
}

/** El botón. Lleva su respaldo de VML porque Outlook ignora el padding de un
 *  <a> y el botón se vería como un enlace suelto pegado al texto. */
function boton(txt: string, url: string): string {
  const u = esc(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:6px 0 4px;"><tr><td align="center" bgcolor="${MORADO}" style="background-color:${MORADO};border-radius:8px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="18%" stroke="f" fillcolor="${MORADO}"><w:anchorlock/><center style="color:#ffffff;font-family:${FUENTE};font-size:15px;font-weight:bold;"><![endif]-->
<a href="${u}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-family:${FUENTE};font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">${esc(txt)}</a>
<!--[if mso]></center></v:roundrect><![endif]-->
</td></tr></table>`;
}

export type PartesCorreo = {
  cuerpo: string;
  imagen?: string | null;       // nombre del archivo en /images/mail/
  imagenAlt?: string | null;
  botonTexto?: string | null;
  botonUrl?: string | null;
  pieza?: string | null;        // la tabla visual del giro, del 4º correo en adelante
  sitio?: string;
};

/** El correo completo, listo para mandar. */
export function armarCorreo(p: PartesCorreo): string {
  const base = (p.sitio || 'https://www.sacscloud.com').replace(/\/$/, '');
  const img = p.imagen
    ? `<tr><td style="padding:0;"><img src="${base}/images/mail/${esc(p.imagen)}" width="600" alt="${esc(p.imagenAlt || '')}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>`
    : '';
  const cta = p.botonTexto && p.botonUrl
    ? `<tr><td style="padding:4px 28px 26px;">${boton(p.botonTexto, p.botonUrl)}</td></tr>` : '';
  const pieza = p.pieza ? `<tr><td style="padding:0 28px 26px;">${p.pieza}</td></tr>` : '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f6f6f9;margin:0;padding:0;">
<tr><td align="center" style="padding:22px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border:1px solid ${LINEA};border-radius:12px;overflow:hidden;">

<!-- Cinta de marca. En el CRM es un degradado morado→azul→rosa; aquí son tres
     celdas sólidas porque Outlook no pinta degradados de CSS. -->
<tr><td style="padding:0;font-size:1px;line-height:4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
<td width="45%" bgcolor="${MORADO}" style="background-color:${MORADO};height:4px;font-size:1px;line-height:4px;">&nbsp;</td>
<td width="35%" bgcolor="${AZUL}" style="background-color:${AZUL};height:4px;font-size:1px;line-height:4px;">&nbsp;</td>
<td width="20%" bgcolor="${ROSA_SUAVE}" style="background-color:${ROSA_SUAVE};height:4px;font-size:1px;line-height:4px;">&nbsp;</td>
</tr></table></td></tr>

${img}

<tr><td style="padding:26px 28px 4px;">${cuerpoAHtml(p.cuerpo)}</td></tr>
${cta}
${pieza}

<!-- Pie: solo la marca. El aviso legal y la liga de baja los pone el pipeline
     de envío, y duplicarlos daría dos ligas de baja en el mismo correo. -->
<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td height="1" bgcolor="${LINEA}" style="background-color:${LINEA};height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:16px 28px 24px;">
<p style="margin:0;color:${MORADO_TINTA};font-family:${FUENTE};font-size:14px;font-weight:bold;line-height:18px;">Sacscloud</p>
<p style="margin:4px 0 0;color:${GRIS};font-family:${FUENTE};font-size:12px;line-height:17px;">Inventario y punto de venta para negocios de moda, hecho en México.</p>
</td></tr>

</table>
</td></tr></table>`;
}

/** El bloque lila del CRM, para cuando un correo quiera anclar un dato.
 *  Sin degradado: color plano, por lo mismo que la cinta. */
export function bloqueAncla(titulo: string, detalle: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px;"><tr>
<td bgcolor="${LILA}" style="background-color:${LILA};padding:14px 16px;border-radius:10px;">
<p style="margin:0;color:${MORADO_TINTA};font-family:${FUENTE};font-size:15px;font-weight:bold;line-height:20px;">${esc(titulo)}</p>
<p style="margin:4px 0 0;color:${TINTA};font-family:${FUENTE};font-size:14px;line-height:20px;">${esc(detalle)}</p>
</td></tr></table>`;
}
