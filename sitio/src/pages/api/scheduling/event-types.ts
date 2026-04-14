import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const activo = url.searchParams.get('activo');
  const slug = url.searchParams.get('slug');

  let query = supabase
    .from('event_types')
    .select('*')
    .order('created_at', { ascending: false });

  if (activo === 'true') query = query.eq('activo', true);
  if (slug) query = query.eq('slug', slug);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const { data, error } = await supabase
    .from('event_types')
    .insert({
      nombre: body.nombre,
      slug: body.slug,
      descripcion: body.descripcion || null,
      duracion_minutos: body.duracion_minutos,
      buffer_antes: body.buffer_antes || 0,
      buffer_despues: body.buffer_despues || 0,
      aviso_minimo_horas: body.aviso_minimo_horas || 1,
      max_reservas_dia: body.max_reservas_dia || null,
      max_dias_adelanto: body.max_dias_adelanto || 60,
      tipo_reunion: body.tipo_reunion || 'one_on_one',
      ubicacion_tipo: body.ubicacion_tipo || 'google_meet',
      color: body.color || '#4B7BE5',
      owner_id: body.owner_id,
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
    .from('event_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
