import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const cancelToken = url.searchParams.get('cancel_token');
  const rescheduleToken = url.searchParams.get('reschedule_token');

  let query = supabase
    .from('bookings')
    .select('*, event_types(nombre, duracion_minutos, slug, color, ubicacion_tipo, owner_id)');

  if (cancelToken) {
    query = query.eq('token_cancelar', cancelToken);
  } else if (rescheduleToken) {
    query = query.eq('token_reagendar', rescheduleToken);
  } else {
    return new Response(JSON.stringify({ error: 'Token required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Don't return sensitive tokens
  const { token_cancelar, token_reagendar, ...safe } = data;

  return new Response(JSON.stringify(safe), {
    headers: { 'Content-Type': 'application/json' },
  });
};
