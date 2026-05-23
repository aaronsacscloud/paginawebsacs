import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

// Helper: verifica que el user pueda actuar sobre las preguntas de un event_type.
async function assertOwnsEventType(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  eventTypeId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!user) return { ok: false, status: 401, error: 'No autenticado' };
  const { data } = await supabase
    .from('event_types')
    .select('owner_id')
    .eq('id', eventTypeId)
    .single();
  if (!data) return { ok: false, status: 404, error: 'Event type no encontrado' };
  if (!canActOnSchedulingOwner(user, data.owner_id)) {
    return { ok: false, status: 403, error: 'No autorizado' };
  }
  return { ok: true };
}

async function lookupEventTypeIdByQuestion(questionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('booking_questions')
    .select('event_type_id')
    .eq('id', questionId)
    .single();
  return data?.event_type_id || null;
}

export const GET: APIRoute = async ({ request, url }) => {
  const eventTypeId = url.searchParams.get('event_type_id');
  if (!eventTypeId) return new Response(JSON.stringify([]), { status: 200 });

  // La página pública /agendar/[slug] lee booking_questions vía supabase directo
  // (no este endpoint), así que aquí podemos restringir a usuarios con ownership.
  // Esto evita enumeración de event_types privados/inactivos.
  const { data: et } = await supabase
    .from('event_types')
    .select('owner_id')
    .eq('id', eventTypeId)
    .maybeSingle();
  if (!et) return new Response(JSON.stringify([]), { status: 404 });

  const user = await getCurrentUser(request);
  if (!canActOnSchedulingOwner(user, et.owner_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { data, error } = await supabase
    .from('booking_questions')
    .select('*')
    .eq('event_type_id', eventTypeId)
    .order('orden');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json();

  if (body.action === 'add') {
    const auth = await assertOwnsEventType(user, body.event_type_id);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });

    const { data, error } = await supabase
      .from('booking_questions')
      .insert({
        event_type_id: body.event_type_id,
        tipo: body.tipo || 'text',
        label: body.label,
        placeholder: body.placeholder || null,
        required: body.required || false,
        options: body.options || null,
        orden: body.orden || 99,
        activo: true,
      })
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data), { status: 201 });
  }

  if (body.action === 'update' || body.action === 'delete' || body.action === 'toggle') {
    if (!body.id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const etId = await lookupEventTypeIdByQuestion(body.id);
    if (!etId) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
    const auth = await assertOwnsEventType(user, etId);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });

    if (body.action === 'update') {
      const { id, action: _a, ...updates } = body;
      const { data, error } = await supabase
        .from('booking_questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      return new Response(JSON.stringify(data));
    }

    if (body.action === 'delete') {
      await supabase.from('booking_questions').delete().eq('id', body.id);
      return new Response(JSON.stringify({ success: true }));
    }

    // toggle
    const { data: current } = await supabase.from('booking_questions').select('activo').eq('id', body.id).single();
    const { data, error } = await supabase
      .from('booking_questions')
      .update({ activo: !(current?.activo) })
      .eq('id', body.id)
      .select()
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify(data));
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
};
