import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const sep = '\n---META---\n';
  const idx = notas.indexOf(sep);
  if (idx === -1) return { text: notas, meta: {} };
  try { return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + sep.length)) }; }
  catch { return { text: notas, meta: {} }; }
}

function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + '\n---META---\n' + JSON.stringify(meta);
}

// GET — list comments
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote } = await supabase.from('quotes').select('notas').eq('id', id).single();
  if (!quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const { meta } = parseMeta(quote.notas);
  return new Response(JSON.stringify({ comments: meta.comments || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// POST — add comment
export const POST: APIRoute = async ({ request }) => {
  const { id, from, name, text } = await request.json();
  if (!id || !text) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const { data: quote } = await supabase.from('quotes').select('notas, partner_id').eq('id', id).single();
  if (!quote) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  // Partner ownership: solo puede comentar en sus propias quotes
  const user = await getCurrentUser(request);
  if (user?.role === 'partner' && quote.partner_id && quote.partner_id !== user.id) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const { text: notasText, meta } = parseMeta(quote.notas);
  if (!meta.comments) meta.comments = [];
  meta.comments.push({ from: from || 'prospect', name: name || 'Cliente', text, at: new Date().toISOString() });

  // Also add to timeline
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ event: from === 'admin' ? 'reply' : 'comment', at: new Date().toISOString() });

  await supabase.from('quotes').update({ notas: serializeMeta(notasText, meta) }).eq('id', id);

  return new Response(JSON.stringify({ comments: meta.comments }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
