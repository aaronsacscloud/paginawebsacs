import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { deleteCalendarEvent } from '../../../lib/google-calendar';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const body = await request.json();
  const isAdmin = url.searchParams.get('admin') === '1';

  const { booking_id, token, motivo, cancelado_por } = body;

  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), { status: 400 });
  }

  // Load booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, event_types(nombre)')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  // Verify token (unless admin)
  if (!isAdmin) {
    if (!token || token !== booking.token_cancelar) {
      return new Response(JSON.stringify({ error: 'Invalid cancellation token' }), { status: 403 });
    }
  }

  // Check booking is still cancellable
  if (booking.estado !== 'confirmada') {
    return new Response(
      JSON.stringify({ error: `Booking cannot be cancelled (current status: ${booking.estado})` }),
      { status: 400 },
    );
  }

  // Update booking
  const { data: updated, error: upErr } = await supabase
    .from('bookings')
    .update({
      estado: 'cancelada',
      cancelacion_motivo: motivo || null,
      cancelado_por: cancelado_por || (isAdmin ? 'admin' : 'invitado'),
    })
    .eq('id', booking_id)
    .select()
    .single();

  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  // Delete Google Calendar event if exists
  if (booking.google_event_id && booking.host_id) {
    try {
      await deleteCalendarEvent(booking.host_id, booking.google_event_id);
    } catch {}
  }

  // Log activity
  if (booking.contact_id) {
    await supabase.from('activities').insert({
      contact_id: booking.contact_id,
      deal_id: booking.deal_id || null,
      tipo: 'demo_cancelada',
      titulo: `Demo cancelada: ${booking.event_types?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
      metadata: {
        booking_id,
        motivo: motivo || null,
        cancelado_por: cancelado_por || (isAdmin ? 'admin' : 'invitado'),
      },
      automatico: true,
    });
  }

  // Check for waitlist entries on this date and notify
  try {
    const { data: waitlistEntries } = await supabase
      .from('activities')
      .select('*')
      .eq('tipo', 'sistema')
      .like('titulo', `Waitlist:%${booking.fecha}%`)
      .limit(10);

    if (waitlistEntries && waitlistEntries.length > 0) {
      for (const entry of waitlistEntries) {
        const meta = entry.metadata || {};
        if (!meta.waitlist) continue;

        // Log a system activity to flag the available space
        await supabase.from('activities').insert({
          contact_id: entry.contact_id || null,
          tipo: 'sistema',
          titulo: `Espacio disponible - notificar a ${meta.nombre || 'contacto'}`,
          metadata: {
            waitlist_notification: true,
            original_waitlist_id: entry.id,
            fecha: booking.fecha,
            event_type_slug: meta.event_type_slug,
            nombre: meta.nombre,
            email: meta.email,
            whatsapp: meta.whatsapp,
          },
          automatico: true,
        });
      }
    }
  } catch {
    // Waitlist check is non-critical
  }

  return new Response(JSON.stringify({ booking: updated }));
};
