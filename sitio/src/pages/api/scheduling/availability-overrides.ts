import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const team_member_id = url.searchParams.get('team_member_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!team_member_id) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  let query = supabase
    .from('scheduling_availability_overrides')
    .select('*')
    .eq('team_member_id', team_member_id)
    .order('fecha', { ascending: true });

  if (from) query = query.gte('fecha', from);
  if (to) query = query.lte('fecha', to);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.team_member_id || !body.fecha) {
    return new Response(JSON.stringify({ error: 'team_member_id and fecha required' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('scheduling_availability_overrides')
    .insert({
      team_member_id: body.team_member_id,
      fecha: body.fecha,
      ranges: body.ranges || null,
      motivo: body.motivo || null,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json();
  if (!body.id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  }

  const { error } = await supabase
    .from('scheduling_availability_overrides')
    .delete()
    .eq('id', body.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }));
};
