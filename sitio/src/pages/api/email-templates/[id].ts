import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404 });
  return new Response(JSON.stringify(data));
};
