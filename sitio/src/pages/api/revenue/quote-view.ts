import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// ─── Meta helpers ───
// We store analytics in the `notas` field using a ---META--- separator
// because we can't add DB columns without psql access.
// Format: "visible notes\n---META---\n{json}"

function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const sep = '\n---META---\n';
  const idx = notas.indexOf(sep);
  if (idx === -1) return { text: notas, meta: {} };
  try {
    return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + sep.length)) };
  } catch {
    return { text: notas, meta: {} };
  }
}

function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + '\n---META---\n' + JSON.stringify(meta);
}

// POST — record a view
export const POST: APIRoute = async ({ request }) => {
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote, error } = await supabase.from('quotes').select('notas').eq('id', id).single();
  if (error || !quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { text, meta } = parseMeta(quote.notas);
  const now = new Date().toISOString();

  // Update analytics
  meta.views = (meta.views || 0) + 1;
  if (!meta.first_viewed_at) meta.first_viewed_at = now;
  meta.last_viewed_at = now;

  // Append timeline event
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ event: 'viewed', at: now });

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ notas: serializeMeta(text, meta) })
    .eq('id', id);

  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ views: meta.views }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// GET — retrieve analytics for a quote
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote, error } = await supabase.from('quotes').select('notas').eq('id', id).single();
  if (error || !quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { meta } = parseMeta(quote.notas);
  return new Response(JSON.stringify({
    views: meta.views || 0,
    first_viewed_at: meta.first_viewed_at || null,
    last_viewed_at: meta.last_viewed_at || null,
    timeline: meta.timeline || [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
