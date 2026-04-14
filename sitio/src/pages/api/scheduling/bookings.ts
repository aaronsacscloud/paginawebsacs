import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const host_id = url.searchParams.get('host_id');
  const estado = url.searchParams.get('estado');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('scheduling_bookings')
    .select('*, scheduling_event_types(id, nombre, slug, color, duracion_minutos)')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (host_id) query = query.eq('host_id', host_id);
  if (estado) query = query.eq('estado', estado);
  if (from) query = query.gte('fecha', from);
  if (to) query = query.lte('fecha', to);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // Get current booking before update
  const { data: current, error: curErr } = await supabase
    .from('scheduling_bookings')
    .select('*, scheduling_event_types(nombre)')
    .eq('id', id)
    .single();

  if (curErr || !current) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  const { data, error } = await supabase
    .from('scheduling_bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Side effects based on estado change
  if (updates.estado === 'realizada') {
    // Update deal stage to demo_realizada
    if (current.deal_id) {
      await supabase
        .from('deals')
        .update({ stage: 'demo_realizada' })
        .eq('id', current.deal_id);
    }

    // Log activity
    await supabase.from('activities').insert({
      contact_id: current.contact_id,
      company_id: null,
      deal_id: current.deal_id,
      tipo: 'demo_realizada',
      titulo: `Demo realizada: ${current.scheduling_event_types?.nombre || 'Demo'} - ${current.fecha}`,
      metadata: {
        booking_id: id,
        fecha: current.fecha,
        hora_inicio: current.hora_inicio,
      },
      automatico: true,
    });
  }

  if (updates.estado === 'no_show') {
    // Log activity
    await supabase.from('activities').insert({
      contact_id: current.contact_id,
      company_id: null,
      deal_id: current.deal_id,
      tipo: 'demo_no_show',
      titulo: `No show: ${current.scheduling_event_types?.nombre || 'Demo'} - ${current.fecha}`,
      metadata: {
        booking_id: id,
        fecha: current.fecha,
        hora_inicio: current.hora_inicio,
      },
      automatico: true,
    });
  }

  return new Response(JSON.stringify(data));
};
