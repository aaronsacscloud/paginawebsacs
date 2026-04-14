import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const host_id = url.searchParams.get('host_id');
  const estado = url.searchParams.get('estado');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('bookings')
    .select('*, event_types(id, nombre, slug, color, duracion_minutos)')
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
    .from('bookings')
    .select('*, event_types(nombre)')
    .eq('id', id)
    .single();

  if (curErr || !current) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  const { data, error } = await supabase
    .from('bookings')
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
      titulo: `Demo realizada: ${current.event_types?.nombre || 'Demo'} - ${current.fecha}`,
      metadata: {
        booking_id: id,
        fecha: current.fecha,
        hora_inicio: current.hora_inicio,
      },
      automatico: true,
    });

    // Post-meeting automation
    try {
      // 1. Enroll contact in post-demo automation if it exists
      if (current.contact_id) {
        const { data: automations } = await supabase
          .from('automations')
          .select('id')
          .eq('estado', 'activo')
          .eq('tipo', 'onboarding')
          .limit(1);

        if (automations?.length) {
          const autoId = automations[0].id;
          // Check not already enrolled
          const { data: existing } = await supabase
            .from('automation_enrollments')
            .select('id')
            .eq('automation_id', autoId)
            .eq('contact_id', current.contact_id)
            .eq('estado', 'activo')
            .limit(1)
            .single();

          if (!existing) {
            const { data: firstStep } = await supabase
              .from('automation_steps')
              .select('id')
              .eq('automation_id', autoId)
              .order('orden')
              .limit(1)
              .single();

            if (firstStep) {
              await supabase.from('automation_enrollments').insert({
                automation_id: autoId,
                contact_id: current.contact_id,
                current_step_id: firstStep.id,
                next_action_at: new Date(Date.now() + 30 * 60000).toISOString(), // 30 min after demo
                enrollment_trigger: { type: 'demo_realizada', booking_id: id },
              });
            }
          }
        }
      }
    } catch {}

    // Fire webhook
    fireSchedulingWebhooks('booking.completed', { booking: data });
  }

  if (updates.estado === 'no_show') {
    // Log activity
    await supabase.from('activities').insert({
      contact_id: current.contact_id,
      company_id: null,
      deal_id: current.deal_id,
      tipo: 'demo_no_show',
      titulo: `No show: ${current.event_types?.nombre || 'Demo'} - ${current.fecha}`,
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
