import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { resolveSchedulingTarget, canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const team_member_id = resolveSchedulingTarget(user, url.searchParams.get('team_member_id'));
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!team_member_id) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  let query = supabase
    .from('availability_overrides')
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
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();

  const team_member_id = resolveSchedulingTarget(user, body.team_member_id);
  if (!team_member_id || !body.fecha) {
    return new Response(JSON.stringify({ error: 'team_member_id and fecha required' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('availability_overrides')
    .insert({
      team_member_id,
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
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();
  if (!body.id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  }

  const { data: current } = await supabase
    .from('availability_overrides')
    .select('team_member_id')
    .eq('id', body.id)
    .single();
  if (!current) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
  if (!canActOnSchedulingOwner(user, current.team_member_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', body.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }));
};
