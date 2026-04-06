import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get('search') || '';
  const estado = url.searchParams.get('estado') || '';

  let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

  if (search) {
    query = query.or(`empresa.ilike.%${search}%,contacto.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (estado) {
    query = query.eq('estado', estado);
  }

  const { data, error } = await query;

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { data, error } = await supabase.from('clients').insert(body).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body;
  const { data, error } = await supabase.from('clients').update(rest).eq('id', id).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request }) => {
  const { id } = await request.json();
  const { error } = await supabase.from('clients').delete().eq('id', id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
