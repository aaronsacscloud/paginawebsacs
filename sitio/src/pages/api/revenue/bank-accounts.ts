import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('bank_accounts').select('*').eq('activa', true).order('es_default', { ascending: false });
  if (error) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // If setting as default, unset others first
  if (body.es_default) {
    await supabase.from('bank_accounts').update({ es_default: false }).eq('es_default', true);
  }
  const { data, error } = await supabase.from('bank_accounts').insert(body).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body;
  if (rest.es_default) {
    await supabase.from('bank_accounts').update({ es_default: false }).eq('es_default', true);
  }
  const { data, error } = await supabase.from('bank_accounts').update(rest).eq('id', id).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request }) => {
  const { id } = await request.json();
  await supabase.from('bank_accounts').update({ activa: false }).eq('id', id);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
