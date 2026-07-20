import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';
import { getCurrentUser } from '../../../lib/auth/scope';
import { isPartner, canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const host_id = url.searchParams.get('host_id');
  const estado = url.searchParams.get('estado');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('bookings')
    .select('*, event_types(id, nombre, slug, color, duracion_minutos)')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  // Partner scope: solo ve sus propios bookings (ignora host_id externo).
  if (isPartner(user)) {
    query = query.eq('host_id', user.id);
  } else if (host_id) {
    query = query.eq('host_id', host_id);
  }
  if (estado) query = query.eq('estado', estado);
  if (from) query = query.gte('fecha', from);
  if (to) query = query.lte('fecha', to);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
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

  // Partner solo puede editar bookings cuyo host es él mismo.
  if (!canActOnSchedulingOwner(user, current.host_id)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Side effects based on estado change
  const cambioEstado = updates.estado && updates.estado !== current.estado;

  if (updates.estado === 'realizada' && cambioEstado) {
    // Update deal stage to demo_realizada
    if (current.deal_id) {
      await supabase
        .from('deals')
        .update({ stage: 'demo_realizada' })
        .eq('id', current.deal_id);
    }

    // Log activity con audit trail: quién marcó la cita como realizada.
    // Crítico para fraud prevention: el bono $300 (createDemoCompletadaBonus)
    // se dispara aquí, así que necesitamos saber si el partner se auto-marcó.
    const selfMarked = !!(current.referrer_partner_id && user?.id === current.referrer_partner_id);
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
        changed_by_user_id: user?.id || null,
        changed_by_role: user?.role || null,
        self_marked: selfMarked, // partner marcó su propio booking → revisar comisión
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

    // Bono $300 al partner que refirió este lead
    if (current.referrer_partner_id) {
      try {
        const { createDemoCompletadaBonus } = await import('../../../lib/commissions/calculate');
        await createDemoCompletadaBonus({
          partnerId: current.referrer_partner_id,
          bookingId: id,
          amount: 300,
          prospectName: current.invitee_nombre || undefined,
          fechaDemo: current.fecha,
        });
      } catch (e) {
        console.warn('[bookings.PUT] createDemoCompletadaBonus failed:', e);
      }
    }

    // Fire webhook
    fireSchedulingWebhooks('booking.completed', { booking: data });
  }

  if (updates.estado === 'no_show' && cambioEstado) {
    // Follow-up automático: invitar a reagendar en 1 clic (email + WhatsApp).
    // Best-effort: si falla el envío, el no-show queda marcado igual.
    try {
      const { notify } = await import('../../../lib/notify');
      const reagendarUrl = current.token_reagendar
        ? `https://www.sacscloud.com/agendar/reagendar?token=${current.token_reagendar}`
        : 'https://www.sacscloud.com/agendar/demo';
      const evento = current.event_types?.nombre || 'Demo';
      if (current.invitee_email) {
        await notify({
          channel: 'email', to: current.invitee_email, template: 'booking_noshow',
          data: { nombre: current.invitee_nombre, evento, fecha: current.fecha, hora: current.hora_inicio, reagendar_url: reagendarUrl },
        });
      }
      if (current.invitee_whatsapp) {
        const { sendWhatsApp } = await import('../../../lib/kapso');
        await sendWhatsApp(current.invitee_whatsapp,
          `Hola ${current.invitee_nombre || ''} 👋 teníamos tu ${evento} de SACS hoy y no logramos coincidir. Reagenda en 1 minuto aquí:\n${reagendarUrl}`);
      }
    } catch { /* no bloquear el marcado */ }

    // Log activity con audit trail
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
        changed_by_user_id: user?.id || null,
        changed_by_role: user?.role || null,
      },
      automatico: true,
    });
  }

  return new Response(JSON.stringify(data));
};
