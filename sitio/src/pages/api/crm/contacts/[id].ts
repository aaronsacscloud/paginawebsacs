import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  // Get contact with company
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*, companies(*)')
    .eq('id', id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404 });

  // Get deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });

  // Get activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Get quotes
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, numero, empresa, total, estado, created_at')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });

  return new Response(JSON.stringify({
    ...contact,
    deals: deals || [],
    activities: activities || [],
    quotes: quotes || [],
  }));
};
