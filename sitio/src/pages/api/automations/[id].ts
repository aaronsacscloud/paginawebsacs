import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  // Get automation
  const { data: automation, error } = await supabase
    .from('automations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404 });

  // Get steps ordered by orden
  const { data: steps } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', id)
    .order('orden', { ascending: true });

  // Get enrollment stats
  const { count: active } = await supabase
    .from('automation_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', id)
    .eq('estado', 'activo');

  const { count: completed } = await supabase
    .from('automation_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', id)
    .eq('estado', 'completado');

  const { count: goal_achieved } = await supabase
    .from('automation_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', id)
    .eq('estado', 'goal_achieved');

  return new Response(JSON.stringify({
    ...automation,
    steps: steps || [],
    stats: {
      active: active || 0,
      completed: completed || 0,
      goal_achieved: goal_achieved || 0,
    },
  }));
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;

  const { data, error } = await supabase
    .from('automations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ archived: true, id: data.id }));
};
