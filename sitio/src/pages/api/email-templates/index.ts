import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ── SACS Brand tokens ──────────────────────────────────────────────────
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
  logoUrl: 'https://www.sacscloud.com/images/sacs-logo.svg',
};

// ── Block → HTML compilers ─────────────────────────────────────────────

function compileHeader(block: any): string {
  const bgColor = block.background || BRAND.primary;
  const align = block.align || 'center';
  const padding = block.padding || '24px 32px';
  return `<tr><td align="${align}" style="background-color:${bgColor};padding:${padding};">
    <img src="${block.logo_url || BRAND.logoUrl}" alt="SACS" width="${block.logo_width || 120}" height="${block.logo_height || 40}" style="display:block;border:0;" />
  </td></tr>`;
}

function compileText(block: any): string {
  const fontSize = block.font_size || '16px';
  const color = block.color || BRAND.text;
  const align = block.align || 'left';
  const padding = block.padding || '16px 32px';
  const fontWeight = block.bold ? '700' : '400';
  const lineHeight = block.line_height || '1.6';
  return `<tr><td style="padding:${padding};">
    <p style="margin:0;font-family:${BRAND.fontFamily};font-size:${fontSize};line-height:${lineHeight};color:${color};text-align:${align};font-weight:${fontWeight};">${block.content || ''}</p>
  </td></tr>`;
}

function compileImage(block: any): string {
  const padding = block.padding || '16px 32px';
  const width = block.width || '100%';
  const borderRadius = block.border_radius || '8px';
  return `<tr><td align="center" style="padding:${padding};">
    <img src="${block.src || ''}" alt="${block.alt || ''}" width="${block.img_width || 536}" style="display:block;max-width:${width};height:auto;border:0;border-radius:${borderRadius};" />
  </td></tr>`;
}

function compileHeroImage(block: any): string {
  const img = `<img src="${block.src || ''}" alt="${block.alt || ''}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`;
  const wrapped = block.link ? `<a href="${block.link}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
  return `<tr><td style="padding:0;">${wrapped}</td></tr>`;
}

function compileButton(block: any): string {
  const bgColor = block.color || BRAND.primary;
  const textColor = block.text_color || '#FFFFFF';
  const padding = block.padding || '24px 32px';
  const align = block.align || 'center';
  const borderRadius = block.border_radius || '8px';
  const href = block.href || '#';
  const label = block.label || 'Click here';
  // Bulletproof button that works in Outlook
  return `<tr><td align="${align}" style="padding:${padding};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="background-color:${bgColor};border-radius:${borderRadius};">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" strokecolor="${bgColor}" fillcolor="${bgColor}">
            <w:anchorlock/>
            <center style="color:${textColor};font-family:${BRAND.fontFamily};font-size:16px;font-weight:700;">${label}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BRAND.fontFamily};font-size:16px;font-weight:700;color:${textColor};text-decoration:none;background-color:${bgColor};border-radius:${borderRadius};line-height:1;text-align:center;">${label}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function compileDivider(block: any): string {
  const padding = block.padding || '8px 32px';
  const color = block.color || BRAND.border;
  return `<tr><td style="padding:${padding};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${color};font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>
  </td></tr>`;
}

function compileColumns(block: any): string {
  const padding = block.padding || '16px 32px';
  const columns: any[] = block.columns || [];
  const colWidth = Math.floor(536 / columns.length);
  const cols = columns.map((col: any) => {
    const content = col.content || '';
    const icon = col.icon ? `<img src="${col.icon}" alt="" width="${col.icon_width || 48}" height="${col.icon_height || 48}" style="display:block;margin:0 auto 12px auto;border:0;" />` : '';
    const title = col.title ? `<p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:15px;font-weight:700;color:${BRAND.text};text-align:center;">${col.title}</p>` : '';
    return `<td class="stack-column" width="${colWidth}" valign="top" style="padding:8px;">
      ${icon}${title}
      <p style="margin:0;font-family:${BRAND.fontFamily};font-size:14px;line-height:1.5;color:${BRAND.textLight};text-align:center;">${content}</p>
    </td>`;
  }).join('');
  return `<tr><td style="padding:${padding};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>${cols}</tr>
    </table>
  </td></tr>`;
}

function compileSpacer(block: any): string {
  const height = block.height || '24px';
  return `<tr><td style="height:${height};font-size:1px;line-height:1px;">&nbsp;</td></tr>`;
}

function compileSocialLinks(block: any): string {
  const padding = block.padding || '16px 32px';
  const links: any[] = block.links || [];
  const icons = links.map((l: any) =>
    `<td style="padding:0 8px;">
      <a href="${l.href || '#'}" target="_blank" style="text-decoration:none;">
        <img src="${l.icon}" alt="${l.label || ''}" width="${l.size || 24}" height="${l.size || 24}" style="display:block;border:0;" />
      </a>
    </td>`
  ).join('');
  return `<tr><td align="center" style="padding:${padding};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>${icons}</tr>
    </table>
  </td></tr>`;
}

function compileFooter(block: any): string {
  const padding = block.padding || '24px 32px';
  const text = block.content || 'SACS Cloud &middot; Software de Punto de Venta e Inventario';
  const address = block.address || 'Monterrey, Nuevo Le\u00f3n, M\u00e9xico';
  const unsubscribe = block.unsubscribe_url || '{{unsubscribe_url}}';
  return `<tr><td style="background-color:${BRAND.bg};padding:${padding};border-top:1px solid ${BRAND.borderLight};">
    <p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:13px;line-height:1.5;color:${BRAND.textLight};text-align:center;">${text}</p>
    <p style="margin:0 0 8px 0;font-family:${BRAND.fontFamily};font-size:12px;line-height:1.4;color:#999999;text-align:center;">${address}</p>
    <p style="margin:0;font-family:${BRAND.fontFamily};font-size:12px;line-height:1.4;color:#999999;text-align:center;">
      <a href="${unsubscribe}" style="color:${BRAND.primary};text-decoration:underline;">Cancelar suscripci\u00f3n</a>
    </p>
  </td></tr>`;
}

// ── Master compiler ────────────────────────────────────────────────────

function compileBloques(bloques: any[], subject: string = ''): { html: string; text: string } {
  const blockHtml = bloques.map((b: any) => {
    switch (b.type) {
      case 'header':       return compileHeader(b);
      case 'text':         return compileText(b);
      case 'image':        return compileImage(b);
      case 'hero_image':   return compileHeroImage(b);
      case 'button':       return compileButton(b);
      case 'divider':      return compileDivider(b);
      case 'columns':      return compileColumns(b);
      case 'spacer':       return compileSpacer(b);
      case 'social_links': return compileSocialLinks(b);
      case 'footer':       return compileFooter(b);
      default:             return `<!-- unknown block type: ${b.type} -->`;
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

  // Generate plain-text version
  const text = bloques.map((b: any) => {
    switch (b.type) {
      case 'header':       return '=== SACS ===';
      case 'text':         return (b.content || '').replace(/<[^>]*>/g, '').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ');
      case 'image':        return `[Imagen: ${b.alt || b.src || ''}]`;
      case 'hero_image':   return `[Imagen: ${b.alt || b.src || ''}]`;
      case 'button':       return `${b.label || 'Click'}: ${b.href || ''}`;
      case 'divider':      return '---';
      case 'columns':      return (b.columns || []).map((c: any) => `${c.title || ''}: ${(c.content || '').replace(/<[^>]*>/g, '')}`).join('\n');
      case 'spacer':       return '';
      case 'social_links': return (b.links || []).map((l: any) => `${l.label || ''}: ${l.href || ''}`).join(' | ');
      case 'footer':       return `${(b.content || 'SACS Cloud').replace(/<[^>]*>/g, '')}\n${b.address || ''}\nCancelar suscripción: {{unsubscribe_url}}`;
      default:             return '';
    }
  }).filter(Boolean).join('\n\n');

  return { html, text };
}

// ── GET — list templates ───────────────────────────────────────────────

export const GET: APIRoute = async ({ url }) => {
  const tipo = url.searchParams.get('tipo');
  const search = url.searchParams.get('search') || '';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('email_templates')
    .select('*', { count: 'exact' })
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq('tipo', tipo);
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,asunto.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ templates: data, total: count }));
};

// ── POST — create template ─────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.nombre || !body.asunto) {
    return new Response(JSON.stringify({ error: 'nombre and asunto are required' }), { status: 400 });
  }

  // Compile HTML from bloques
  const bloques = body.bloques || [];
  const { html, text } = compileBloques(bloques, body.asunto);

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      nombre: body.nombre,
      asunto: body.asunto,
      preview_text: body.preview_text || null,
      tipo: body.tipo || 'manual',
      layout: body.layout || 'simple',
      bloques,
      categoria: body.categoria || null,
      html_compilado: html,
      texto_plano: text,
      activo: true,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

// ── PUT — update template ──────────────────────────────────────────────

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // Re-compile HTML if bloques changed
  if (updates.bloques) {
    const subject = updates.asunto || '';
    const { html, text } = compileBloques(updates.bloques, subject);
    updates.html_compilado = html;
    updates.texto_plano = text;
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
