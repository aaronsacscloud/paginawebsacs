import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { isPartner, canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const activo = url.searchParams.get('activo');
  const slug = url.searchParams.get('slug');
  const publicLookup = !!slug; // /agendar/[slug] consulta sin auth

  let query = supabase
    .from('event_types')
    .select('*')
    .order('created_at', { ascending: false });

  if (activo === 'true') query = query.eq('activo', true);
  if (slug) query = query.eq('slug', slug);

  // Partner solo ve sus event_types salvo que sea lookup público por slug.
  if (!publicLookup && isPartner(user)) {
    query = query.eq('owner_id', user!.id);
  }

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();

  // Partner: owner siempre es él mismo. Founder/cs: pueden crear para cualquiera.
  const owner_id = isPartner(user) ? user.id : (body.owner_id || user.id);

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
      owner_id,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // Verifica ownership antes de actualizar.
  const { data: current, error: curErr } = await supabase
    .from('event_types')
    .select('owner_id')
    .eq('id', id)
    .single();
  if (curErr || !current) {
    return new Response(JSON.stringify({ error: 'Event type no encontrado' }), { status: 404 });
  }
  if (!canActOnSchedulingOwner(user, current.owner_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }
  // Partner no puede transferir ownership a otro team_member.
  if (isPartner(user) && 'owner_id' in updates && updates.owner_id !== user.id) {
    delete updates.owner_id;
  }

  const { data, error } = await supabase
    .from('event_types')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { data: current } = await supabase
    .from('event_types')
    .select('owner_id')
    .eq('id', id)
    .single();
  if (!current) return new Response(JSON.stringify({ error: 'Event type no encontrado' }), { status: 404 });
  if (!canActOnSchedulingOwner(user, current.owner_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { error } = await supabase.from('event_types').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }));
};
