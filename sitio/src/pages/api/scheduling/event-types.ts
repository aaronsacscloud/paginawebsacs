import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { isPartner, canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const activo = url.searchParams.get('activo');
  const slug = url.searchParams.get('slug');
  const publicLookup = !!slug; // /agendar/[slug] consulta sin auth (lookup por slug exacto)

  // Listado general (sin slug) requiere auth — sino expone todos los event_types.
  if (!publicLookup && !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  let query = supabase
    .from('event_types')
    .select('*')
    .order('created_at', { ascending: false });

  if (activo === 'true') query = query.eq('activo', true);
  if (slug) {
    query = query.eq('slug', slug);
    // En lookup público solo exponer event_types activos.
    query = query.eq('activo', true);
  }

  // Partner solo ve sus event_types (en listado interno; el lookup público
  // por slug ya está restringido a activo=true y la página /agendar valida más).
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

  // Pre-check de slug colisión per-owner (UNIQUE (owner_id, slug) tras migración).
  // Devolvemos 409 con mensaje accionable en vez de 500 genérico.
  if (body.slug) {
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('slug', body.slug)
      .eq('owner_id', owner_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({
        error: `Ya tienes un tipo de evento con el slug "${body.slug}". Elige otro.`,
        code: 'slug_taken',
      }), { status: 409 });
    }
  }

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

  if (error) {
    // Race: alguien insertó el mismo slug entre el pre-check y este insert.
    if ((error as any).code === '23505') {
      return new Response(JSON.stringify({
        error: `Ya tienes un tipo de evento con el slug "${body.slug}". Elige otro.`,
        code: 'slug_taken',
      }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
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

  if (error) {
    if ((error as any).code === '23505') {
      return new Response(JSON.stringify({
        error: `El slug "${updates.slug}" ya está en uso por otro tipo de evento.`,
        code: 'slug_taken',
      }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
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

  // Verifica que no haya bookings asociados — borrar el event_type dejaría
  // bookings huérfanos (event_types(...) joins retornarían null y los emails
  // de recordatorio fallarían). Mejor exigir cancelar/archivar bookings primero.
  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('event_type_id', id);
  if ((bookingsCount || 0) > 0) {
    return new Response(JSON.stringify({
      error: `No se puede borrar: tiene ${bookingsCount} citas asociadas. Desactívalo en lugar de borrarlo (PUT { activo: false }).`,
      code: 'has_bookings',
    }), { status: 409 });
  }

  // Limpieza de hijos antes de borrar (booking_questions no tiene ON DELETE CASCADE).
  await supabase.from('booking_questions').delete().eq('event_type_id', id);

  const { error } = await supabase.from('event_types').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }));
};
