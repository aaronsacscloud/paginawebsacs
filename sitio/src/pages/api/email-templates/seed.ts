import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ── Seed templates ─────────────────────────────────────────────────────
// GET /api/email-templates/seed?key=sacs-seed-2026

const TEMPLATES = [
  // ── 1. Bienvenida ────────────────────────────────────────────────────
  {
    nombre: 'Bienvenida',
    asunto: 'Bienvenido a SACS, {{contact.nombre}} \u{1F389}',
    preview_text: 'Tu prueba gratuita de 7 d\u00edas ya est\u00e1 activa. Descubre todo lo que puedes lograr.',
    tipo: 'automatizado',
    layout: 'bienvenida',
    categoria: 'onboarding',
    bloques: [
      {
        type: 'header',
        background: '#4B7BE5',
        logo_url: 'https://www.sacscloud.com/images/sacs-logo-white.svg',
        logo_width: 130,
        logo_height: 44,
        padding: '28px 32px',
      },
      { type: 'spacer', height: '8px' },
      {
        type: 'text',
        content: 'Bienvenido a SACS, {{contact.nombre}}',
        font_size: '26px',
        bold: true,
        align: 'center',
        color: '#1A1A1A',
        padding: '32px 32px 8px 32px',
      },
      {
        type: 'text',
        content: 'Tu prueba gratuita de 7 d\u00edas ya est\u00e1 activa. Estos son los tres pasos para sacarle el m\u00e1ximo provecho a tu sistema de punto de venta e inventario.',
        font_size: '16px',
        align: 'center',
        color: '#555555',
        padding: '0 40px 24px 40px',
      },
      { type: 'divider', padding: '0 32px', color: '#F0F0F0' },
      {
        type: 'text',
        content: '<strong style="color:#4B7BE5;">Paso 1 \u2014 Configura tu negocio</strong><br/>Agrega el nombre de tu tienda, logo y datos fiscales. Solo toma 2 minutos.',
        font_size: '15px',
        padding: '20px 32px 4px 32px',
      },
      {
        type: 'text',
        content: '<strong style="color:#4B7BE5;">Paso 2 \u2014 Sube tu cat\u00e1logo</strong><br/>Importa tus productos desde Excel o agr\u00e9galos uno por uno. Incluye precios, c\u00f3digos de barras y stock inicial.',
        font_size: '15px',
        padding: '12px 32px 4px 32px',
      },
      {
        type: 'text',
        content: '<strong style="color:#4B7BE5;">Paso 3 \u2014 Haz tu primera venta</strong><br/>Abre tu punto de venta, escanea o busca un producto y cobra. As\u00ed de f\u00e1cil.',
        font_size: '15px',
        padding: '12px 32px 8px 32px',
      },
      { type: 'spacer', height: '8px' },
      {
        type: 'button',
        label: 'Empezar mi prueba gratis',
        href: 'https://app.sacscloud.com',
        color: '#4B7BE5',
        text_color: '#FFFFFF',
        padding: '16px 32px 32px 32px',
        border_radius: '8px',
      },
      {
        type: 'text',
        content: '\u00bfTienes dudas? Responde a este correo o escr\u00edbenos por <a href="https://wa.me/528183331741" style="color:#2AB5A0;text-decoration:underline;">WhatsApp</a>. Estamos para ayudarte.',
        font_size: '14px',
        align: 'center',
        color: '#999999',
        padding: '0 32px 24px 32px',
      },
      {
        type: 'footer',
        content: 'SACS Cloud &middot; Software de Punto de Venta e Inventario',
        address: 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico',
      },
    ],
  },

  // ── 2. Seguimiento Demo ──────────────────────────────────────────────
  {
    nombre: 'Seguimiento Demo',
    asunto: '{{contact.nombre}}, \u00bfc\u00f3mo te fue con la demo?',
    preview_text: 'Recapitulamos lo que vimos y los siguientes pasos para tu negocio.',
    tipo: 'automatizado',
    layout: 'seguimiento',
    categoria: 'ventas',
    bloques: [
      {
        type: 'header',
        background: '#4B7BE5',
        logo_url: 'https://www.sacscloud.com/images/sacs-logo-white.svg',
        logo_width: 130,
        logo_height: 44,
        padding: '28px 32px',
      },
      { type: 'spacer', height: '12px' },
      {
        type: 'text',
        content: 'Hola {{contact.nombre}},',
        font_size: '20px',
        bold: true,
        padding: '24px 32px 8px 32px',
      },
      {
        type: 'text',
        content: 'Fue un gusto platicar contigo sobre c\u00f3mo SACS puede ayudar a <strong>{{company.nombre}}</strong> a tener control total de su inventario y ventas. Aqu\u00ed va un resumen de lo que vimos:',
        font_size: '16px',
        padding: '0 32px 16px 32px',
      },
      {
        type: 'text',
        content: '\u2705 <strong>Punto de Venta r\u00e1pido</strong> \u2014 Cobra en segundos con lector de c\u00f3digos o b\u00fasqueda inteligente.<br/>\u2705 <strong>Inventario en tiempo real</strong> \u2014 Sabe cu\u00e1nto tienes en cada sucursal, sin hojas de Excel.<br/>\u2705 <strong>Reportes claros</strong> \u2014 Ve qu\u00e9 se vende, qu\u00e9 no, y cu\u00e1ndo resurtir.',
        font_size: '15px',
        padding: '4px 32px 20px 32px',
        line_height: '1.8',
      },
      {
        type: 'text',
        content: 'El siguiente paso es agendar una sesi\u00f3n donde configuramos SACS con los datos reales de tu negocio. Te toma 30 minutos y sales con el sistema listo para operar.',
        font_size: '16px',
        padding: '0 32px 16px 32px',
      },
      {
        type: 'button',
        label: 'Agenda tu siguiente sesi\u00f3n',
        href: '/agendar/configuracion',
        color: '#4B7BE5',
        text_color: '#FFFFFF',
        padding: '8px 32px 24px 32px',
      },
      { type: 'divider', padding: '0 32px', color: '#F0F0F0' },
      {
        type: 'text',
        content: '<em>P.D. Si tienes m\u00e1s de 2 sucursales, preg\u00fantame por el plan Multi-Tienda \u2014 tiene precios especiales este mes.</em>',
        font_size: '14px',
        color: '#999999',
        padding: '16px 32px 24px 32px',
      },
      {
        type: 'footer',
        content: 'SACS Cloud &middot; Software de Punto de Venta e Inventario',
        address: 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico',
      },
    ],
  },

  // ── 3. Caso de \u00c9xito ──────────────────────────────────────────────────
  {
    nombre: 'Caso de \u00c9xito',
    asunto: 'As\u00ed creci\u00f3 {{company.nombre}} con SACS',
    preview_text: 'Descubre c\u00f3mo negocios como el tuyo optimizaron sus ventas e inventario.',
    tipo: 'automatizado',
    layout: 'promocional',
    categoria: 'ventas',
    bloques: [
      {
        type: 'header',
        background: '#4B7BE5',
        logo_url: 'https://www.sacscloud.com/images/sacs-logo-white.svg',
        logo_width: 130,
        logo_height: 44,
        padding: '28px 32px',
      },
      {
        type: 'hero_image',
        src: 'https://www.sacscloud.com/images/email/caso-exito-hero.jpg',
        alt: 'Caso de \u00e9xito SACS',
        link: 'https://www.sacscloud.com/casos-de-exito',
      },
      {
        type: 'text',
        content: 'As\u00ed creci\u00f3 {{company.nombre}} con SACS',
        font_size: '24px',
        bold: true,
        align: 'center',
        padding: '28px 32px 8px 32px',
      },
      {
        type: 'text',
        content: 'Desde que implementaron SACS, redujeron las diferencias de inventario un <strong>87%</strong>, aceleraron el cobro en caja un <strong>60%</strong> y ahora toman decisiones con reportes en tiempo real.',
        font_size: '16px',
        align: 'center',
        color: '#555555',
        padding: '0 32px 24px 32px',
      },
      { type: 'divider', padding: '0 32px', color: '#F0F0F0' },
      {
        type: 'columns',
        padding: '24px 16px',
        columns: [
          {
            icon: 'https://www.sacscloud.com/images/email/icon-pos.png',
            icon_width: 48,
            icon_height: 48,
            title: 'Punto de Venta',
            content: 'Cobra r\u00e1pido, acepta m\u00faltiples m\u00e9todos de pago y genera tickets autom\u00e1ticos.',
          },
          {
            icon: 'https://www.sacscloud.com/images/email/icon-inventory.png',
            icon_width: 48,
            icon_height: 48,
            title: 'Inventario',
            content: 'Control en tiempo real por sucursal. Alertas de stock bajo y traspasos entre tiendas.',
          },
          {
            icon: 'https://www.sacscloud.com/images/email/icon-crm.png',
            icon_width: 48,
            icon_height: 48,
            title: 'CRM',
            content: 'Conoce a tus clientes, su historial de compras y env\u00edales promociones personalizadas.',
          },
        ],
      },
      { type: 'spacer', height: '8px' },
      {
        type: 'button',
        label: 'Quiero resultados as\u00ed',
        href: 'https://www.sacscloud.com/precios',
        color: '#2AB5A0',
        text_color: '#FFFFFF',
        padding: '8px 32px 32px 32px',
      },
      {
        type: 'footer',
        content: 'SACS Cloud &middot; Software de Punto de Venta e Inventario',
        address: 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico',
      },
    ],
  },

  // ── 4. Reactivaci\u00f3n ──────────────────────────────────────────────────
  {
    nombre: 'Reactivaci\u00f3n',
    asunto: 'Te extra\u00f1amos, {{contact.nombre}}',
    preview_text: 'Tenemos algo especial para que regreses a SACS.',
    tipo: 'automatizado',
    layout: 'simple',
    categoria: 'retencion',
    bloques: [
      {
        type: 'header',
        background: '#4B7BE5',
        logo_url: 'https://www.sacscloud.com/images/sacs-logo-white.svg',
        logo_width: 130,
        logo_height: 44,
        padding: '28px 32px',
      },
      { type: 'spacer', height: '12px' },
      {
        type: 'text',
        content: 'Te extra\u00f1amos, {{contact.nombre}}',
        font_size: '24px',
        bold: true,
        align: 'center',
        padding: '28px 32px 12px 32px',
      },
      {
        type: 'text',
        content: 'Notamos que llevas un tiempo sin entrar a SACS. Sabemos que administrar un negocio es demandante, por eso queremos ponerte las cosas f\u00e1ciles.',
        font_size: '16px',
        align: 'center',
        color: '#555555',
        padding: '0 32px 20px 32px',
      },
      { type: 'divider', padding: '0 48px', color: '#F0F0F0' },
      {
        type: 'text',
        content: 'Como gesto especial, te ofrecemos un <strong style="color:#2AB5A0;">30% de descuento</strong> en tu primer mes si reactivas tu cuenta antes del <strong>{{offer.fecha_limite}}</strong>.',
        font_size: '16px',
        align: 'center',
        padding: '20px 32px 8px 32px',
      },
      {
        type: 'text',
        content: 'Adem\u00e1s, hemos agregado nuevas funciones desde tu \u00faltima visita:',
        font_size: '15px',
        padding: '8px 32px 4px 32px',
      },
      {
        type: 'text',
        content: '\u2728 <strong>Reportes avanzados</strong> con gr\u00e1ficas interactivas<br/>\u2728 <strong>App m\u00f3vil</strong> para consultar ventas desde tu celular<br/>\u2728 <strong>Integraciones</strong> con Mercado Libre y Shopify',
        font_size: '15px',
        padding: '4px 32px 24px 32px',
        line_height: '1.8',
      },
      {
        type: 'button',
        label: 'Regresar a SACS',
        href: 'https://app.sacscloud.com?utm_source=email&utm_campaign=reactivacion',
        color: '#2AB5A0',
        text_color: '#FFFFFF',
        padding: '8px 32px 32px 32px',
      },
      {
        type: 'text',
        content: 'Si necesitas ayuda para retomar tu cuenta, responde a este correo o ll\u00e1manos al <strong>(81) 8333-1741</strong>.',
        font_size: '14px',
        align: 'center',
        color: '#999999',
        padding: '0 32px 24px 32px',
      },
      {
        type: 'footer',
        content: 'SACS Cloud &middot; Software de Punto de Venta e Inventario',
        address: 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico',
      },
    ],
  },

  // ── 5. Newsletter ────────────────────────────────────────────────────
  {
    nombre: 'Newsletter Mensual',
    asunto: 'Novedades SACS \u2014 {{newsletter.mes}} {{newsletter.anio}}',
    preview_text: 'Nuevas funciones, tips de inventario y casos de \u00e9xito de negocios como el tuyo.',
    tipo: 'newsletter',
    layout: 'newsletter',
    categoria: 'contenido',
    bloques: [
      {
        type: 'header',
        background: '#4B7BE5',
        logo_url: 'https://www.sacscloud.com/images/sacs-logo-white.svg',
        logo_width: 130,
        logo_height: 44,
        padding: '28px 32px',
      },
      {
        type: 'hero_image',
        src: 'https://www.sacscloud.com/images/email/newsletter-hero.jpg',
        alt: 'Newsletter SACS',
        link: 'https://www.sacscloud.com/blog',
      },
      {
        type: 'text',
        content: 'Novedades del mes',
        font_size: '24px',
        bold: true,
        align: 'center',
        padding: '28px 32px 8px 32px',
      },
      {
        type: 'text',
        content: 'Hola {{contact.nombre}}, aqu\u00ed van las novedades m\u00e1s importantes del mes para tu negocio.',
        font_size: '16px',
        align: 'center',
        color: '#555555',
        padding: '0 32px 24px 32px',
      },
      {
        type: 'columns',
        padding: '8px 16px',
        columns: [
          {
            icon: 'https://www.sacscloud.com/images/email/icon-feature.png',
            icon_width: 40,
            icon_height: 40,
            title: 'Nueva funci\u00f3n: Traspasos',
            content: 'Mueve inventario entre sucursales con un solo clic. Tu stock siempre donde lo necesitas.',
          },
          {
            icon: 'https://www.sacscloud.com/images/email/icon-tip.png',
            icon_width: 40,
            icon_height: 40,
            title: 'Tip: Conteo c\u00edclico',
            content: 'Cuenta una secci\u00f3n de inventario cada semana en lugar de hacer un conteo total mensual.',
          },
        ],
      },
      { type: 'spacer', height: '4px' },
      {
        type: 'columns',
        padding: '8px 16px',
        columns: [
          {
            icon: 'https://www.sacscloud.com/images/email/icon-case.png',
            icon_width: 40,
            icon_height: 40,
            title: 'Caso: Abarrotes Don Pedro',
            content: 'Con SACS redujeron el robo hormiga un 45% en solo 3 meses. Lee su historia completa.',
          },
          {
            icon: 'https://www.sacscloud.com/images/email/icon-webinar.png',
            icon_width: 40,
            icon_height: 40,
            title: 'Webinar: Inventario 101',
            content: 'Aprende a configurar categor\u00edas, alertas de stock bajo y reportes de merma. Jueves 5pm.',
          },
        ],
      },
      { type: 'divider', padding: '16px 32px', color: '#F0F0F0' },
      {
        type: 'button',
        label: 'Ver todas las novedades',
        href: 'https://www.sacscloud.com/blog',
        color: '#4B7BE5',
        text_color: '#FFFFFF',
        padding: '16px 32px 24px 32px',
      },
      {
        type: 'social_links',
        padding: '8px 32px 16px 32px',
        links: [
          {
            label: 'Facebook',
            href: 'https://www.facebook.com/sacscloud',
            icon: 'https://www.sacscloud.com/images/email/icon-facebook.png',
            size: 28,
          },
          {
            label: 'Instagram',
            href: 'https://www.instagram.com/sacscloud',
            icon: 'https://www.sacscloud.com/images/email/icon-instagram.png',
            size: 28,
          },
          {
            label: 'TikTok',
            href: 'https://www.tiktok.com/@sacscloud',
            icon: 'https://www.sacscloud.com/images/email/icon-tiktok.png',
            size: 28,
          },
          {
            label: 'LinkedIn',
            href: 'https://www.linkedin.com/company/sacscloud',
            icon: 'https://www.sacscloud.com/images/email/icon-linkedin.png',
            size: 28,
          },
        ],
      },
      {
        type: 'footer',
        content: 'SACS Cloud &middot; Software de Punto de Venta e Inventario',
        address: 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico',
      },
    ],
  },
];

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-seed-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const results: any[] = [];
  const errors: any[] = [];

  for (const tpl of TEMPLATES) {
    // Call the compile endpoint logic inline
    const bloques = tpl.bloques;
    const { html, text } = compileBloquesSeed(bloques, tpl.asunto);

    const { data, error } = await supabase
      .from('email_templates')
      .upsert(
        {
          nombre: tpl.nombre,
          asunto: tpl.asunto,
          preview_text: tpl.preview_text,
          tipo: tpl.tipo,
          layout: tpl.layout,
          categoria: tpl.categoria,
          bloques: tpl.bloques,
          html_compilado: html,
          texto_plano: text,
          activo: true,
        },
        { onConflict: 'nombre' }
      )
      .select()
      .single();

    if (error) {
      errors.push({ nombre: tpl.nombre, error: error.message });
    } else {
      results.push({ id: data.id, nombre: data.nombre });
    }
  }

  return new Response(
    JSON.stringify({ seeded: results, errors, total: results.length }),
    { status: errors.length > 0 && results.length === 0 ? 500 : 200 }
  );
};

// ── Inline compiler (mirrors the one in index.ts) ──────────────────────
// Duplicated here to keep seed.ts self-contained without circular imports.

const BRAND = {
  fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif",
  primary: '#4B7BE5',
  secondary: '#2AB5A0',
  text: '#1A1A1A',
  textLight: '#555555',
  bg: '#FAFAF8',
  white: '#FFFFFF',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
};

function compileBloquesSeed(bloques: any[], subject: string): { html: string; text: string } {
  const blockHtml = bloques.map((b: any) => {
    switch (b.type) {
      case 'header': {
        const bgColor = b.background || BRAND.primary;
        const align = b.align || 'center';
        const padding = b.padding || '24px 32px';
        return `<tr><td align="${align}" style="background-color:${bgColor};padding:${padding};"><img src="${b.logo_url || 'https://www.sacscloud.com/images/sacs-logo.svg'}" alt="SACS" width="${b.logo_width || 120}" height="${b.logo_height || 40}" style="display:block;border:0;" /></td></tr>`;
      }
      case 'text': {
        const fontSize = b.font_size || '16px';
        const color = b.color || BRAND.text;
        const align = b.align || 'left';
        const padding = b.padding || '16px 32px';
        const fontWeight = b.bold ? '700' : '400';
        const lineHeight = b.line_height || '1.6';
        return `<tr><td style="padding:${padding};"><p style="margin:0;font-family:${BRAND.fontFamily};font-size:${fontSize};line-height:${lineHeight};color:${color};text-align:${align};font-weight:${fontWeight};">${b.content || ''}</p></td></tr>`;
      }
      case 'image': {
        const padding = b.padding || '16px 32px';
        const borderRadius = b.border_radius || '8px';
        return `<tr><td align="center" style="padding:${padding};"><img src="${b.src || ''}" alt="${b.alt || ''}" width="${b.img_width || 536}" style="display:block;max-width:100%;height:auto;border:0;border-radius:${borderRadius};" /></td></tr>`;
      }
      case 'hero_image': {
        const img = `<img src="${b.src || ''}" alt="${b.alt || ''}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`;
        const wrapped = b.link ? `<a href="${b.link}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
        return `<tr><td style="padding:0;">${wrapped}</td></tr>`;
      }
      case 'button': {
        const bgColor = b.color || BRAND.primary;
        const textColor = b.text_color || '#FFFFFF';
        const padding = b.padding || '24px 32px';
        const align = b.align || 'center';
        const borderRadius = b.border_radius || '8px';
        return `<tr><td align="${align}" style="padding:${padding};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" style="background-color:${bgColor};border-radius:${borderRadius};"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${b.href || '#'}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" strokecolor="${bgColor}" fillcolor="${bgColor}"><w:anchorlock/><center style="color:${textColor};font-family:${BRAND.fontFamily};font-size:16px;font-weight:700;">${b.label || 'Click'}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${b.href || '#'}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BRAND.fontFamily};font-size:16px;font-weight:700;color:${textColor};text-decoration:none;background-color:${bgColor};border-radius:${borderRadius};line-height:1;text-align:center;">${b.label || 'Click'}</a><!--<![endif]--></td></tr></table></td></tr>`;
      }
      case 'divider': {
        const padding = b.padding || '8px 32px';
        const color = b.color || BRAND.border;
        return `<tr><td style="padding:${padding};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${color};font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`;
      }
      case 'columns': {
        const padding = b.padding || '16px 32px';
        const columns: any[] = b.columns || [];
        const colWidth = Math.floor(536 / columns.length);
        const cols = columns.map((col: any) => {
          const icon = col.icon ? `<img src="${col.icon}" alt="" width="${col.icon_width || 48}" height="${col.icon_height || 48}" style="display:block;margin:0 auto 12px auto;border:0;" />` : '';
          const title = col.title ? `<p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:15px;font-weight:700;color:${BRAND.text};text-align:center;">${col.title}</p>` : '';
          return `<td class="stack-column" width="${colWidth}" valign="top" style="padding:8px;">${icon}${title}<p style="margin:0;font-family:${BRAND.fontFamily};font-size:14px;line-height:1.5;color:${BRAND.textLight};text-align:center;">${col.content || ''}</p></td>`;
        }).join('');
        return `<tr><td style="padding:${padding};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cols}</tr></table></td></tr>`;
      }
      case 'spacer': {
        const height = b.height || '24px';
        return `<tr><td style="height:${height};font-size:1px;line-height:1px;">&nbsp;</td></tr>`;
      }
      case 'social_links': {
        const padding = b.padding || '16px 32px';
        const links: any[] = b.links || [];
        const icons = links.map((l: any) => `<td style="padding:0 8px;"><a href="${l.href || '#'}" target="_blank" style="text-decoration:none;"><img src="${l.icon}" alt="${l.label || ''}" width="${l.size || 24}" height="${l.size || 24}" style="display:block;border:0;" /></a></td>`).join('');
        return `<tr><td align="center" style="padding:${padding};"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${icons}</tr></table></td></tr>`;
      }
      case 'footer': {
        const padding = b.padding || '24px 32px';
        const text = b.content || 'SACS Cloud';
        const address = b.address || 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico';
        const unsubscribe = b.unsubscribe_url || '{{unsubscribe_url}}';
        return `<tr><td style="background-color:${BRAND.bg};padding:${padding};border-top:1px solid ${BRAND.borderLight};"><p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:13px;line-height:1.5;color:${BRAND.textLight};text-align:center;">${text}</p><p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:12px;line-height:1.4;color:#999999;text-align:center;">${address}</p><p style="margin:0;font-family:${BRAND.fontFamily};font-size:12px;line-height:1.4;color:#999999;text-align:center;"><a href="${unsubscribe}" style="color:${BRAND.primary};text-decoration:underline;">Cancelar suscripci\u00f3n</a></p></td></tr>`;
      }
      default: return '';
    }
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:${BRAND.fontFamily};">
  <center>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg};">
      <tr><td align="center" style="padding:24px 16px;">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
${blockHtml}
        </table>
      </td></tr>
    </table>
  </center>
</body>
</html>`;

  const text = bloques.map((b: any) => {
    switch (b.type) {
      case 'header':       return '=== SACS ===';
      case 'text':         return (b.content || '').replace(/<[^>]*>/g, '').replace(/&middot;/g, '\u00b7').replace(/&nbsp;/g, ' ');
      case 'image':        return `[Imagen: ${b.alt || b.src || ''}]`;
      case 'hero_image':   return `[Imagen: ${b.alt || b.src || ''}]`;
      case 'button':       return `${b.label || 'Click'}: ${b.href || ''}`;
      case 'divider':      return '---';
      case 'columns':      return (b.columns || []).map((c: any) => `${c.title || ''}: ${(c.content || '').replace(/<[^>]*>/g, '')}`).join('\n');
      case 'spacer':       return '';
      case 'social_links': return (b.links || []).map((l: any) => `${l.label || ''}: ${l.href || ''}`).join(' | ');
      case 'footer':       return `${(b.content || 'SACS Cloud').replace(/<[^>]*>/g, '')}\n${b.address || ''}\nCancelar suscripci\u00f3n: {{unsubscribe_url}}`;
      default:             return '';
    }
  }).filter(Boolean).join('\n\n');

  return { html, text };
}
