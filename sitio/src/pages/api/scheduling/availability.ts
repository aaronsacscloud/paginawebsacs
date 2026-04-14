import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const team_member_id = url.searchParams.get('team_member_id');
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
  const body = await request.json();

  if (!body.team_member_id || !body.weekly_hours) {
    return new Response(JSON.stringify({ error: 'team_member_id and weekly_hours required' }), { status: 400 });
  }

  // If setting as default, unset other defaults for this team member
  if (body.es_default) {
    await supabase
      .from('availability_schedules')
      .update({ es_default: false })
      .eq('team_member_id', body.team_member_id)
      .eq('es_default', true);
  }

  const { data, error } = await supabase
    .from('availability_schedules')
    .insert({
      team_member_id: body.team_member_id,
      weekly_hours: body.weekly_hours,
      timezone: body.timezone || 'America/Mexico_City',
      es_default: body.es_default || false,
      activo: true,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // If setting as default, unset other defaults for this team member
  if (updates.es_default) {
    const { data: current } = await supabase
      .from('availability_schedules')
      .select('team_member_id')
      .eq('id', id)
      .single();

    if (current) {
      await supabase
        .from('availability_schedules')
        .update({ es_default: false })
        .eq('team_member_id', current.team_member_id)
        .eq('es_default', true)
        .neq('id', id);
    }
  }

  const { data, error } = await supabase
    .from('availability_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
