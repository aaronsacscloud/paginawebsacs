import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-cron-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const now = new Date();
  const stats = { reminders_24h: 0, reminders_1h: 0 };

  // ---------- 24h reminders ----------
  // Find bookings where fecha is tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: bookings24h } = await supabase
    .from('scheduling_bookings')
    .select('id, contact_id, deal_id, fecha, hora_inicio, nombre_invitado, scheduling_event_types(nombre)')
    .eq('fecha', tomorrowStr)
    .eq('recordatorio_24h_enviado', false)
    .eq('estado', 'confirmada');

  if (bookings24h && bookings24h.length > 0) {
    for (const booking of bookings24h) {
      // Log activity
      if (booking.contact_id) {
        await supabase.from('activities').insert({
          contact_id: booking.contact_id,
          deal_id: booking.deal_id || null,
          tipo: 'sistema',
          titulo: `Recordatorio 24h enviado: ${(booking.scheduling_event_types as { nombre: string } | null)?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
          metadata: {
            booking_id: booking.id,
            reminder_type: '24h',
          },
          automatico: true,
        });
      }

      // Set flag
      await supabase
        .from('scheduling_bookings')
        .update({ recordatorio_24h_enviado: true })
        .eq('id', booking.id);

      stats.reminders_24h++;
    }
  }

  // ---------- 1h reminders ----------
  // Find bookings where fecha is today and hora_inicio is within next 75 minutes
  const todayStr = now.toISOString().slice(0, 10);

  // Get current time in HH:MM and calculate window
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;
  const windowEndMinutes = currentMinutes + 75;

  const windowStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
  const windowEnd = `${String(Math.floor(windowEndMinutes / 60)).padStart(2, '0')}:${String(windowEndMinutes % 60).padStart(2, '0')}`;

  const { data: bookings1h } = await supabase
    .from('scheduling_bookings')
    .select('id, contact_id, deal_id, fecha, hora_inicio, nombre_invitado, scheduling_event_types(nombre)')
    .eq('fecha', todayStr)
    .eq('recordatorio_1h_enviado', false)
    .eq('estado', 'confirmada')
    .gte('hora_inicio', windowStart)
    .lte('hora_inicio', windowEnd);

  if (bookings1h && bookings1h.length > 0) {
    for (const booking of bookings1h) {
      // Log activity
      if (booking.contact_id) {
        await supabase.from('activities').insert({
          contact_id: booking.contact_id,
          deal_id: booking.deal_id || null,
          tipo: 'sistema',
          titulo: `Recordatorio 1h enviado: ${(booking.scheduling_event_types as { nombre: string } | null)?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
          metadata: {
            booking_id: booking.id,
            reminder_type: '1h',
          },
          automatico: true,
        });
      }

      // Set flag
      await supabase
        .from('scheduling_bookings')
        .update({ recordatorio_1h_enviado: true })
        .eq('id', booking.id);

      stats.reminders_1h++;
    }
  }

  return new Response(JSON.stringify(stats));
};
