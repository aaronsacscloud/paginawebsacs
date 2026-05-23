import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { resolveSchedulingTarget, canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  // Force partner a su propio team_member_id; founder/cs pueden pasar otro.
  const team_member_id = resolveSchedulingTarget(user, url.searchParams.get('team_member_id'));
  if (!team_member_id) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  // Get schedules
  const { data: schedules, error: schedError } = await supabase
    .from('availability_schedules')
    .select('*')
    .eq('team_member_id', team_member_id)
    .eq('activo', true)
    .order('es_default', { ascending: false });

  if (schedError) return new Response(JSON.stringify({ error: schedError.message }), { status: 500 });

  // Get overrides
  const { data: overrides, error: overError } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('team_member_id', team_member_id)
    .gte('fecha', new Date().toISOString().slice(0, 10))
    .order('fecha', { ascending: true });

  if (overError) return new Response(JSON.stringify({ error: overError.message }), { status: 500 });

  return new Response(JSON.stringify({ schedules: schedules || [], overrides: overrides || [] }));
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();

  // Partner solo puede crear para sí mismo.
  const team_member_id = resolveSchedulingTarget(user, body.team_member_id);
  if (!team_member_id || !body.weekly_hours) {
    return new Response(JSON.stringify({ error: 'team_member_id and weekly_hours required' }), { status: 400 });
  }

  // If setting as default, unset other defaults for this team member
  if (body.es_default) {
    await supabase
      .from('availability_schedules')
      .update({ es_default: false })
      .eq('team_member_id', team_member_id)
      .eq('es_default', true);
  }

  const { data, error } = await supabase
    .from('availability_schedules')
    .insert({
      team_member_id,
      weekly_hours: body.weekly_hours,
      timezone: body.timezone || 'America/Mexico_City',
      es_default: body.es_default || false,
      activo: true,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Defensive cleanup: si por race entre dos POSTs concurrentes quedaron
  // múltiples defaults, este insert "gana" y se borra el flag en los demás.
  if (body.es_default && data?.id) {
    await supabase
      .from('availability_schedules')
      .update({ es_default: false })
      .eq('team_member_id', team_member_id)
      .eq('es_default', true)
      .neq('id', data.id);
  }
  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { data: current } = await supabase
    .from('availability_schedules')
    .select('team_member_id')
    .eq('id', id)
    .single();
  if (!current) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
  if (!canActOnSchedulingOwner(user, current.team_member_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  // Partner no puede transferir su schedule a otro team_member.
  if ('team_member_id' in updates && updates.team_member_id !== current.team_member_id) {
    if (user.role === 'partner') delete updates.team_member_id;
  }

  if (updates.es_default) {
    await supabase
      .from('availability_schedules')
      .update({ es_default: false })
      .eq('team_member_id', current.team_member_id)
      .eq('es_default', true)
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('availability_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Defensive cleanup post-update: si dos PUTs concurrentes marcaron como
  // default, este "gana" y reset al resto.
  if (updates.es_default) {
    await supabase
      .from('availability_schedules')
      .update({ es_default: false })
      .eq('team_member_id', current.team_member_id)
      .eq('es_default', true)
      .neq('id', id);
  }
  return new Response(JSON.stringify(data));
};
