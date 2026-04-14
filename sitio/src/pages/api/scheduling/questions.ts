import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const eventTypeId = url.searchParams.get('event_type_id');
  if (!eventTypeId) return new Response(JSON.stringify([]), { status: 200 });

  const { data, error } = await supabase
    .from('booking_questions')
    .select('*')
    .eq('event_type_id', eventTypeId)
    .order('orden');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (body.action === 'add') {
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

  if (body.action === 'update') {
    const { id, ...updates } = body;
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

  if (body.action === 'toggle') {
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
