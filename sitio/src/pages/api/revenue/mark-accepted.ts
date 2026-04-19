import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateSignatureSVG(name: string): string {
  const clean = String(name || '').trim() || 'Cliente';
  const width = Math.max(280, Math.min(560, clean.length * 24 + 40));
  const height = 96;
  const fontSize = 44;
  const escaped = escapeXml(clean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>.sig{font-family:'Dancing Script','Brush Script MT','Lucida Handwriting','Segoe Script','Apple Chancery',cursive;font-size:${fontSize}px;fill:#1a1a1a;font-style:italic}</style><text x="24" y="${height - 28}" class="sig" transform="rotate(-3 ${width / 2} ${height / 2})">${escaped}</text></svg>`;
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { quoteId, aceptado_por, method, nota_interna } = body || {};

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const nombre = String(aceptado_por || '').trim();
    if (!nombre) {
      return new Response(JSON.stringify({ error: 'aceptado_por requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: quote, error: fetchErr } = await supabase
      .from('quotes')
      .select('notas, estado, contacto, empresa')
      .eq('id', quoteId)
      .single();

    if (fetchErr || !quote) {
      return new Response(JSON.stringify({ error: 'cotización no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (quote.estado === 'paid') {
      return new Response(JSON.stringify({ error: 'la cotización ya está pagada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    if (quote.estado === 'accepted') {
      return new Response(JSON.stringify({ error: 'la cotización ya está aceptada' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const sep = '\n---META---\n';
    const raw = quote.notas || '';
    const idx = raw.indexOf(sep);
    let textPart = raw;
    let meta: any = {};
    if (idx >= 0) {
      textPart = raw.slice(0, idx);
      try { meta = JSON.parse(raw.slice(idx + sep.length)) || {}; } catch { meta = {}; }
    }

    const now = new Date().toISOString();
    const firma = generateSignatureSVG(nombre);

    meta.firma_base64 = firma;
    meta.firma_auto = true;
    meta.aceptacion_method = method || 'admin_manual';
    if (nota_interna) meta.aceptacion_nota = String(nota_interna).slice(0, 1000);
    if (!meta.timeline) meta.timeline = [];
    meta.timeline.push({
      event: 'accepted',
      at: now,
      method: 'admin_manual',
      via: method || null,
      name: nombre,
    });

    const newNotas = textPart + sep + JSON.stringify(meta);

    const { error: updateErr } = await supabase
      .from('quotes')
      .update({
        estado: 'accepted',
        aceptado_por: nombre,
        aceptado_fecha: now,
        notas: newNotas,
      })
      .eq('id', quoteId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, aceptado_por: nombre, aceptado_fecha: now, firma_base64: firma }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
