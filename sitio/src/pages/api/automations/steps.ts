import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const automation_id = url.searchParams.get('automation_id');
  if (!automation_id) {
    return new Response(JSON.stringify({ error: 'automation_id required' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automation_id)
    .order('orden', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.automation_id || !body.tipo) {
    return new Response(JSON.stringify({ error: 'automation_id and tipo are required' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('automation_steps')
    .insert({
      automation_id: body.automation_id,
      orden: body.orden || 1,
      tipo: body.tipo,
      config: body.config || {},
      parent_step_id: body.parent_step_id || null,
      branch_key: body.branch_key || null,
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
    .from('automation_steps')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { error } = await supabase
    .from('automation_steps')
    .delete()
    .eq('id', body.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ deleted: true, id: body.id }));
};
