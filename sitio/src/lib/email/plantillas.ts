// COMPILADOR DE PLANTILLAS — bloques (JSON) → HTML de correo.
//
// Se compila en el SERVIDOR y no en el navegador por dos razones: el HTML
// resultante es el que de verdad se envía (nadie puede mandar HTML arbitrario
// desde el panel), y el escape de valores ocurre en un solo lugar.
//
// ── Por qué tablas y CSS inline ──
// Outlook de escritorio usa el motor de Word: no entiende flexbox, grid, ni
// hojas de estilo externas. Un correo "moderno" con divs se ve destrozado en
// el cliente que más usan las empresas. Tablas anidadas con `style=` inline es
// feo de escribir y es lo único que se ve igual en todos lados.
//
// ── Personalización con red de seguridad ──
// `{{nombre|Hola}}` — el texto tras la barra es el respaldo. Un correo que
// dice "Hola null" quema más confianza que no personalizar; por eso una
// variable sin respaldo es un ERROR de validación, no una advertencia.
import { escapar } from './footer';
import type { Tenant } from './tenant';

export type TipoBloque =
  | 'hero' | 'encabezado' | 'texto' | 'imagen' | 'boton' | 'separador'
  | 'espaciador' | 'dos_columnas' | 'cita' | 'lista' | 'firma' | 'planes'
  | 'cuenta' | 'aviso' | 'metricas';

export interface Bloque { id: string; tipo: TipoBloque; [k: string]: any }

export interface Contexto {
  nombre?: string | null; apellido?: string | null; empresa?: string | null;
  email?: string | null; plan?: string | null; monto_renovacion?: string | number | null;
  giro?: string | null; sucursales?: number | null; [k: string]: any;
}

const FA = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const ANCHO = 600;

/** Variables ofrecidas por la UI. Una sola lista para el editor y el validador. */
export const VARIABLES = [
  { id: 'nombre', etiqueta: 'Nombre de pila' },
  { id: 'apellido', etiqueta: 'Apellido' },
  { id: 'empresa', etiqueta: 'Empresa' },
  { id: 'plan', etiqueta: 'Plan contratado' },
  { id: 'monto_renovacion', etiqueta: 'Monto de renovación' },
  { id: 'giro', etiqueta: 'Giro' },
  { id: 'sucursales', etiqueta: 'Sucursales' },
] as const;

const RE_VAR = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi;

/** Sustituye variables. Sin dato y sin respaldo → cadena vacía, nunca "null". */
export function interpolar(texto: string, ctx: Contexto): string {
  return String(texto ?? '').replace(RE_VAR, (_m, campo, respaldo) => {
    const v = (ctx as any)?.[String(campo).toLowerCase()];
    if (v === null || v === undefined || String(v).trim() === '') return String(respaldo ?? '').trim();
    return String(v);
  });
}

/** Variables SIN respaldo — el editor bloquea guardar hasta que tengan uno. */
export function variablesSinRespaldo(bloques: Bloque[]): string[] {
  const malas = new Set<string>();
  const revisar = (s: unknown) => {
    for (const m of String(s ?? '').matchAll(RE_VAR)) {
      if (m[2] === undefined || String(m[2]).trim() === '') malas.add(m[1]);
    }
  };
  for (const b of bloques || []) for (const [k, v] of Object.entries(b)) {
    if (typeof v === 'string' && k !== 'id' && k !== 'tipo') revisar(v);
    if (Array.isArray(v)) for (const it of v) if (typeof it === 'string') revisar(it); else if (it && typeof it === 'object') Object.values(it).forEach(revisar);
  }
  return [...malas];
}

const txt = (s: unknown, ctx: Contexto) => escapar(interpolar(String(s ?? ''), ctx));
// ── Negritas dentro de un párrafo: **así** ──
// El editor solo da formato por BLOQUES, y un correo de venta necesita poder
// resaltar media frase ("**Fase 1:** ..."). Se aplica SIEMPRE después de
// escapar: para cuando corre, el texto ya no tiene < ni >, así que lo único
// que puede aparecer es el <strong> que ponemos aquí. Nunca al revés.
const negritas = (s: string) => s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
const rico = (s: unknown, ctx: Contexto) => negritas(txt(s, ctx));
/** Una URL que no sea `javascript:` ni `data:` — el correo no ejecuta scripts. */
const url = (s: unknown, ctx: Contexto) => {
  const u = interpolar(String(s ?? ''), ctx).trim();
  return /^(https?:|mailto:|tel:)/i.test(u) ? escapar(u) : '#';
};
const fila = (contenido: string) => `<tr><td class="em-pad" style="padding:0 32px;">${contenido}</td></tr>`;

function bloqueHtml(b: Bloque, ctx: Contexto, t: Tenant): string {
  const acento = escapar(b.color || t.color_acento || '#5B4BD6');
  switch (b.tipo) {
    case 'hero': {
      const fondo = escapar(b.fondo || '#1a1633');
      const logo = t.logo_url
        ? `<img src="${escapar(t.logo_url)}" alt="${escapar(t.nombre)}" width="130" style="display:block;margin-bottom:16px;border:0;max-width:130px;height:auto;">`
        : '';
      return `<tr><td style="background:${fondo};padding:32px;">${logo}
        <div style="${FA}color:#fff;font-size:26px;line-height:1.25;font-weight:800;">${txt(b.titulo, ctx)}</div>
        ${b.subtitulo ? `<div style="${FA}color:#ffffffb8;font-size:15px;line-height:1.5;margin-top:8px;">${txt(b.subtitulo, ctx)}</div>` : ''}
      </td></tr>`;
    }
    case 'encabezado': {
      const n = Math.min(3, Math.max(1, Number(b.nivel) || 2));
      const tam = [26, 21, 17][n - 1];
      return fila(`<div class="em-tinta ${n === 1 ? 'em-h1' : ''}" style="${FA}font-size:${tam}px;font-weight:800;color:#1a1633;line-height:1.3;padding-top:20px;">${txt(b.texto, ctx)}</div>`);
    }
    case 'texto':
      return fila(`<div class="em-tinta" style="${FA}font-size:15px;line-height:1.65;color:#333;padding-top:12px;white-space:pre-line;">${rico(b.texto, ctx)}</div>`);
    case 'imagen': {
      // `ancho` (px) la hace logo/sello en vez de imagen a todo lo ancho;
      // `align` la acomoda. Sin ancho, se comporta como siempre.
      const w = Math.min(Number(b.ancho) || (ANCHO - 64), ANCHO - 64);
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left';
      const img = `<img src="${url(b.src, ctx)}" alt="${txt(b.alt || '', ctx)}" width="${w}" style="display:${b.ancho ? 'inline-block' : 'block'};width:${b.ancho ? `${w}px` : '100%'};max-width:${w}px;height:auto;border:0;${b.ancho ? '' : 'border-radius:10px;'}">`;
      const pie = b.pie ? `<div style="${FA}font-size:12px;font-weight:600;color:#8a8590;margin-top:8px;text-align:center;">${txt(b.pie, ctx)}</div>` : '';
      return fila(`<div style="padding-top:16px;text-align:${align};">${b.href ? `<a href="${url(b.href, ctx)}">${img}</a>` : img}${pie}</div>`);
    }
    case 'boton': {
      // Botón como tabla: un <a> con padding se rompe en Outlook.
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left';
      return fila(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;" align="${align}"><tr>
        <td style="background:${acento};border-radius:9px;">
          <a href="${url(b.href, ctx)}" class="em-btn" style="${FA}display:inline-block;padding:13px 26px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${txt(b.texto || 'Ver más', ctx)}</a>
        </td></tr></table>${b.sub ? `<div style="${FA}font-size:12px;font-weight:600;color:#8a8590;margin-top:9px;text-align:${['left', 'center', 'right'].includes(b.align) ? b.align : 'left'};">${txt(b.sub, ctx)}</div>` : ''}`);
    }
    case 'aviso':
      // Destacado suave: el dato que NO se puede perder (p. ej. "te va a
      // llegar un WhatsApp"). Fondo agua fijo + tinta del acento del tenant.
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
        <td style="background:#EEECFE;border-radius:12px;padding:14px 18px;">
          <div style="${FA}font-size:14.5px;line-height:1.6;font-weight:600;color:${acento};">${rico(b.texto || '', ctx)}</div>
        </td></tr></table>`);
    case 'metricas': {
      // Sellos de confianza: 2-4 columnas de cifra + texto ("+14 años",
      // "★ 4.8/5"...). Cifra en el acento, texto chico en gris.
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 4);
      if (!items.length) return '';
      const celdas = items.map((it: any) => `
        <td align="center" style="padding-top:16px;width:${Math.floor(100 / items.length)}%;">
          <div style="${FA}font-size:17px;font-weight:800;color:${acento};">${txt(it.cifra || '', ctx)}</div>
          <div style="${FA}font-size:11px;line-height:1.4;font-weight:600;color:#8a8590;margin-top:4px;">${txt(it.texto || '', ctx)}</div>
        </td>`).join('');
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #f0eff5;"><tr>${celdas}</tr></table>`);
    }
    case 'separador':
      return fila(`<div class="em-linea" style="border-top:1px solid #E8E5F0;margin-top:24px;"></div>`);
    case 'espaciador':
      return `<tr><td style="height:${Math.min(80, Math.max(4, Number(b.alto) || 20))}px;line-height:1px;font-size:1px;">&nbsp;</td></tr>`;
    case 'dos_columnas': {
      // `em-col` apila las columnas en móvil: 73% de las aperturas de esta
    // cuenta son webmail/teléfono, y dos columnas a 300px son ilegibles.
    const col = (c: any) => `<td width="50%" valign="top" class="em-col em-tinta" style="${FA}font-size:14px;line-height:1.6;color:#444;padding:0 8px;">
        ${c?.titulo ? `<div class="em-tinta" style="font-weight:700;color:#1a1633;margin-bottom:4px;font-size:15px;">${txt(c.titulo, ctx)}</div>` : ''}
        ${rico(c?.texto || '', ctx)}</td>`;
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>${col(b.izquierda)}${col(b.derecha)}</tr></table>`);
    }
    case 'cita':
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>
        <td style="border-left:3px solid ${acento};padding:4px 0 4px 16px;${FA}">
          <div class="em-tinta" style="font-size:15px;line-height:1.6;color:#333;font-style:italic;">"${rico(b.texto, ctx)}"</div>
          ${b.autor ? `<div class="em-suave" style="font-size:13px;color:#8a8a92;margin-top:7px;">— ${txt(b.autor, ctx)}</div>` : ''}
        </td></tr></table>`);
    case 'lista': {
      const items = (Array.isArray(b.items) ? b.items : []).map((i: any) =>
        `<tr><td valign="top" style="${FA}font-size:15px;line-height:1.6;color:${acento};padding:5px 9px 0 0;font-weight:800;">&bull;</td>
             <td class="em-tinta" style="${FA}font-size:15px;line-height:1.6;color:#333;padding-top:5px;">${rico(i, ctx)}</td></tr>`).join('');
      return fila(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">${items}</table>`);
    }
    case 'planes': {
      const planes = (Array.isArray(b.planes) ? b.planes : []).slice(0, 3);
      const ancho = Math.floor(100 / Math.max(1, planes.length));
      const celdas = planes.map((p: any) => `<td width="${ancho}%" valign="top" style="padding:0 5px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-linea em-tarjeta" style="border:1px solid #E8E5F0;border-radius:10px;"><tr>
          <td style="${FA}padding:16px;text-align:center;">
            <div style="font-size:13px;font-weight:800;color:${acento};text-transform:uppercase;letter-spacing:.5px;">${txt(p?.nombre, ctx)}</div>
            <div class="em-tinta" style="font-size:22px;font-weight:800;color:#1a1633;margin-top:6px;">${txt(p?.precio, ctx)}</div>
            <div class="em-suave" style="font-size:13px;color:#6a6a72;line-height:1.5;margin-top:6px;">${txt(p?.detalle || '', ctx)}</div>
          </td></tr></table></td>`).join('');
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>${celdas}</tr></table>`);
    }
    case 'cuenta': {
      // Un correo que le habla a alguien de SUS datos se lee distinto a uno
      // genérico. Los renglones se arman solo con lo que de verdad se sabe:
      // un dato vacío no se pinta, en vez de dejar "Plan: —".
      const filas: Array<[string, string]> = [];
      const agrega = (etiqueta: string, valor: unknown) => {
        const v = String(valor ?? '').trim();
        if (v) filas.push([etiqueta, v]);
      };
      agrega('Empresa', ctx.empresa);
      agrega('Plan', ctx.plan);
      agrega('Renovación', (ctx as any).renovacion);
      agrega(b.etiqueta_monto || 'Monto', ctx.monto_renovacion ? String(ctx.monto_renovacion) : '');
      agrega('Sucursales', ctx.sucursales);
      if (!filas.length) return '';   // sin datos no se pinta una tarjeta vacía
      const renglones = filas.map(([k, v]) => `
        <tr>
          <td class="em-suave" style="${FA}font-size:13px;color:#8a8a92;padding:5px 12px 5px 0;white-space:nowrap;">${escapar(k)}</td>
          <td class="em-tinta" style="${FA}font-size:14px;color:#1a1633;font-weight:700;padding:5px 0;">${escapar(v)}</td>
        </tr>`).join('');
      return fila(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-cita em-linea" style="margin-top:20px;background:#F8F7FC;border:1px solid #E8E5F0;border-radius:10px;"><tr><td style="padding:14px 16px;">
        ${b.titulo ? `<div class="em-suave" style="${FA}font-size:11px;font-weight:800;color:#8a8a92;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">${txt(b.titulo, ctx)}</div>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0">${renglones}</table>
      </td></tr></table>`);
    }
    case 'firma': {
      // La firma sale del INQUILINO: un partner firma con su nombre, no el nuestro.
      const foto = b.foto_url || t.logo_url;
      const nombre = b.nombre || t.from_nombre;
      return fila(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;"><tr>
        ${foto ? `<td width="52" valign="top"><img src="${escapar(foto)}" width="44" height="44" alt="" style="border-radius:50%;display:block;border:0;"></td>` : ''}
        <td valign="middle" style="${FA}">
          <div class="em-tinta" style="font-size:14px;font-weight:700;color:#1a1633;">${escapar(nombre)}</div>
          ${b.puesto ? `<div class="em-suave" style="font-size:13px;color:#8a8a92;">${escapar(b.puesto)}</div>` : ''}
        </td></tr></table>`);
    }
    default:
      return '';
  }
}

/**
 * PREHEADER — la segunda línea que se ve en la bandeja, junto al asunto.
 *
 * Sin esto, Gmail la rellena con las primeras palabras del correo (casi
 * siempre el título del hero, o sea información repetida). Es una línea de
 * venta gratis en cada envío y estaba desperdiciada: `preview_text` se
 * guardaba en la base pero nunca llegaba al HTML.
 *
 * El relleno de después existe porque, sin él, el cliente sigue "leyendo"
 * texto del cuerpo hasta llenar su vista previa.
 */
function preheader(texto?: string | null): string {
  const t = String(texto || '').trim();
  if (!t) return '';
  return `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">`
    + escapar(t)
    + '&#8199;&#65279;&#847; '.repeat(60)
    + '</div>';
}

/**
 * MODO OSCURO.
 *
 * Gmail —que es el 68% de las aperturas de esta cuenta— invierte los colores
 * por su cuenta cuando el correo no declara nada. Un hero oscuro con texto
 * blanco puede quedar con texto blanco sobre fondo blanco. Declarando
 * `color-scheme` y dando una paleta explícita, el cliente respeta el diseño en
 * vez de inventarlo.
 *
 * Apple Mail e iOS respetan las media queries; Gmail en móvil hace su propia
 * inversión pero `color-scheme` la vuelve predecible. Outlook las ignora y se
 * queda con la versión clara, que es correcta.
 */
const ESTILOS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .em-fondo   { background:#14131A !important; }
    .em-tarjeta { background:#1E1C27 !important; }
    .em-tinta   { color:#ECEAF3 !important; }
    .em-suave   { color:#A9A4B8 !important; }
    .em-linea   { border-color:#332F40 !important; }
    .em-cita    { background:#231F30 !important; }
  }
  @media only screen and (max-width:620px) {
    .em-pad  { padding-left:20px !important; padding-right:20px !important; }
    .em-h1   { font-size:23px !important; }
    .em-col  { display:block !important; width:100% !important; padding:0 0 14px 0 !important; }
    .em-btn  { display:block !important; text-align:center !important; }
  }
`;

/** El HTML completo del correo (sin el pie legal: ese lo pone el pipeline). */
export function compilar(bloques: Bloque[], ctx: Contexto, t: Tenant, preview?: string | null): string {
  const cuerpo = (bloques || []).map(b => bloqueHtml(b, ctx, t)).join('\n');
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapar(t.nombre)}</title>
<style type="text/css">${ESTILOS}</style>
</head>
<body class="em-fondo" style="margin:0;padding:0;background:#F4F3F7;">
${preheader(preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-fondo" style="background:#F4F3F7;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="${ANCHO}" cellpadding="0" cellspacing="0" class="em-tarjeta" style="width:100%;max-width:${ANCHO}px;background:#fff;border-radius:14px;overflow:hidden;">
    ${cuerpo}
    <tr><td style="height:28px;line-height:1px;font-size:1px;">&nbsp;</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Versión text/plain — obligatoria: sin ella el correo pesa más como spam. */
export function compilarTexto(bloques: Bloque[], ctx: Contexto): string {
  const p: string[] = [];
  for (const b of bloques || []) {
    // Los ** de las negritas se quitan: en texto plano son ruido.
    const i = (s: unknown) => interpolar(String(s ?? ''), ctx).replace(/\*\*([^*\n]+)\*\*/g, '$1');
    switch (b.tipo) {
      case 'hero': p.push(i(b.titulo).toUpperCase(), b.subtitulo ? i(b.subtitulo) : ''); break;
      case 'encabezado': p.push('', i(b.texto).toUpperCase()); break;
      case 'texto': p.push(i(b.texto)); break;
      case 'boton': p.push(`${i(b.texto || 'Ver más')}: ${i(b.href)}`); break;
      case 'aviso': p.push(i(b.texto || '')); break;
      case 'metricas': p.push((Array.isArray(b.items) ? b.items : []).map((it: any) => `${i(it?.cifra || '')} ${i(it?.texto || '')}`.trim()).join(' · ')); break;
      case 'cita': p.push(`"${i(b.texto)}"${b.autor ? ' — ' + i(b.autor) : ''}`); break;
      case 'lista': for (const it of (b.items || [])) p.push('· ' + i(it)); break;
      case 'dos_columnas': p.push(i(b.izquierda?.texto || ''), i(b.derecha?.texto || '')); break;
      case 'planes': for (const pl of (b.planes || [])) p.push(`${i(pl?.nombre)}: ${i(pl?.precio)} — ${i(pl?.detalle || '')}`); break;
      case 'cuenta': {
        for (const [k, v] of [['Empresa', ctx.empresa], ['Plan', ctx.plan], ['Sucursales', ctx.sucursales]] as any[]) {
          if (String(v ?? '').trim()) p.push(`${k}: ${v}`);
        }
        break;
      }
      case 'firma': p.push('', i(b.nombre || ''), i(b.puesto || '')); break;
      case 'separador': p.push('—'); break;
    }
  }
  return p.filter(x => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Peso del HTML: Gmail recorta arriba de ~102 KB y se lleva el link de baja. */
export const pesoKb = (html: string): number => Math.round(Buffer.byteLength(html, 'utf8') / 1024 * 10) / 10;
export const LIMITE_GMAIL_KB = 102;
