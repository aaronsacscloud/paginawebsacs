import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const META_SEP = '\n---META---\n';

function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const idx = notas.indexOf(META_SEP);
  if (idx === -1) return { text: notas, meta: {} };
  try { return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + META_SEP.length)) }; }
  catch { return { text: notas, meta: {} }; }
}

function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + META_SEP + JSON.stringify(meta);
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const { id, days } = body || {};
  const n = Number(days);

  if (!id || typeof id !== 'string') return json({ error: 'Falta el id de la cotización' }, 400);
  if (!Number.isFinite(n) || n < 1 || n > 60) return json({ error: 'Los días deben ser un número entre 1 y 60' }, 400);

  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, numero, vigencia, estado, notas')
    .eq('id', id)
    .single();
  if (fetchErr || !quote) return json({ error: 'Cotización no encontrada' }, 404);

  if (quote.estado === 'paid' || quote.estado === 'accepted' || quote.estado === 'rejected') {
    return json({ error: `No se puede extender una cotización en estado ${quote.estado}` }, 400);
  }

  // Calculate new vigencia from a date-only base (avoids timezone drift with timestamp formats)
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let currentVig: Date | null = null;
  if (quote.vigencia) {
    const datePart = String(quote.vigencia).slice(0, 10);
    const parsed = new Date(datePart + 'T12:00:00');
    if (!isNaN(parsed.getTime())) currentVig = parsed;
  }
  const baseDate = (!currentVig || currentVig < today) ? today : currentVig;
  const newVigDate = new Date(baseDate.getTime() + n * 86400000);
  const newVigencia = newVigDate.toISOString().slice(0, 10);

  // Update meta — track extension
  const { text, meta } = parseMeta(quote.notas);
  if (!Array.isArray(meta.extensions)) meta.extensions = [];
  meta.extensions.push({
    at: new Date().toISOString(),
    days: n,
    prev_vigencia: quote.vigencia || null,
    new_vigencia: newVigencia,
  });
  if (!Array.isArray(meta.timeline)) meta.timeline = [];
  meta.timeline.push({ event: 'extended', at: new Date().toISOString(), days: n });
  const newNotas = serializeMeta(text, meta);

  // If was expired, restore to 'sent' so timer reappears
  const newEstado = quote.estado === 'expired' ? 'sent' : quote.estado;

  const { data: updated, error: updErr } = await supabase
    .from('quotes')
    .update({ vigencia: newVigencia, estado: newEstado, notas: newNotas })
    .eq('id', id)
    .select()
    .single();
  if (updErr) return json({ error: updErr.message }, 500);

  return json({
    ok: true,
    id,
    vigencia: newVigencia,
    estado: newEstado,
    extension_count: meta.extensions.length,
    days_added: n,
    quote: updated,
  });
};

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
