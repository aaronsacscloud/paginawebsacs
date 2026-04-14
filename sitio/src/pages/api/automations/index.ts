import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado');

  let query = supabase
    .from('automations')
    .select('*, automation_steps(id)', { count: 'exact' })
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (estado) query = query.eq('estado', estado);

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Transform to include step_count instead of raw steps
  const automations = (data || []).map((a: any) => ({
    ...a,
    step_count: a.automation_steps?.length || 0,
    automation_steps: undefined,
  }));

  return new Response(JSON.stringify({ automations, total: count }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.nombre) {
    return new Response(JSON.stringify({ error: 'nombre is required' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('automations')
    .insert({
      nombre: body.nombre,
      descripcion: body.descripcion || null,
      tipo: body.tipo || 'lifecycle',
      estado: 'borrador',
      enrollment_triggers: body.enrollment_triggers || null,
      goal_criteria: body.goal_criteria || null,
      suppression_stages: body.suppression_stages || null,
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

  const { data, error } = await supabase
    .from('automations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
