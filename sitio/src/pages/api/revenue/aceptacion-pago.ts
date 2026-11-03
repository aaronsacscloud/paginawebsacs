import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

/* Prende o apaga «Aceptada con recepción de pago» en una cotización
   (meta.aceptacion_por_pago). Con ella, la página pública cierra sin la firma
   que el CRM genera sola y sin ninguna fecha de aceptación o pago: es para las
   ventas que se cerraron con el pago y cuya fecha real no está confirmada.
   Solo administración: /api/revenue/* pasa por el candado del middleware. */
const SEP = '\n---META---\n';
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { quoteId, activo } = await request.json().catch(() => ({}));
    if (!quoteId || typeof activo !== 'boolean') return json({ error: 'quoteId y activo (true/false) requeridos' }, 400);

    const { data: quote, error: e1 } = await supabase.from('quotes').select('id, notas').eq('id', quoteId).maybeSingle();
    if (e1) return json({ error: e1.message }, 500);
    if (!quote) return json({ error: 'cotización no encontrada' }, 404);

    const raw = quote.notas || '';
    const idx = raw.indexOf(SEP);
    const texto = idx >= 0 ? raw.slice(0, idx) : raw;
    let meta: any = {};
    if (idx >= 0) {
      try { meta = JSON.parse(raw.slice(idx + SEP.length)) || {}; }
      catch { return json({ error: 'los datos internos de la cotización no se pudieron leer; no se tocó nada' }, 409); }
    }
    meta.aceptacion_por_pago = activo;

    const { error: e2 } = await supabase.from('quotes').update({ notas: texto + SEP + JSON.stringify(meta) }).eq('id', quoteId);
    if (e2) return json({ error: e2.message }, 500);
    return json({ ok: true, aceptacion_por_pago: activo });
  } catch (e: any) {
    return json({ error: e?.message || 'error' }, 500);
  }
};
