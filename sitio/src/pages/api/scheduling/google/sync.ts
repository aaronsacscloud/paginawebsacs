import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getAuthenticatedClient } from '../../../../lib/google-calendar';
import { google } from 'googleapis';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-cron-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const stats = { checked: 0, updated: 0, cancelled: 0, errors: 0 };

  try {
    // 1. Load all active calendar connections
    const { data: connections, error: connErr } = await supabase
      .from('calendar_connections')
      .select('id, team_member_id, calendar_id')
      .eq('provider', 'google')
      .eq('activo', true);

    if (connErr || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ ...stats, message: 'No active connections' }));
    }

    // 2. For each connection, check Google Calendar for recent changes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    for (const conn of connections) {
      try {
        const auth = await getAuthenticatedClient(conn.team_member_id);
        if (!auth) continue;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        // 3. Query events modified in the last 30 minutes
        const eventsRes = await calendar.events.list({
          calendarId: auth.calendarId,
          updatedMin: thirtyMinutesAgo,
          showDeleted: true,
          singleEvents: true,
          maxResults: 100,
        });

        const events = eventsRes.data.items || [];
        stats.checked += events.length;

        for (const event of events) {
          if (!event.id) continue;

          // 4. Check if this Google event matches any booking
          const { data: booking } = await supabase
            .from('bookings')
            .select('id, fecha, hora_inicio, hora_fin, contact_id, deal_id, estado, event_types(nombre)')
            .eq('google_event_id', event.id)
            .single();

          if (!booking) continue;

          // Skip bookings already cancelled locally
          if (booking.estado === 'cancelada') continue;

          // 5. If event was cancelled/deleted in Google
          if (event.status === 'cancelled') {
            const { error: upErr } = await supabase
              .from('bookings')
              .update({
                estado: 'cancelada',
                cancelacion_motivo: 'Cancelado desde Google Calendar',
                cancelado_por: 'google_sync',
              })
              .eq('id', booking.id);

            if (!upErr) {
              stats.cancelled++;

              // Log activity
              if (booking.contact_id) {
                await supabase.from('activities').insert({
                  contact_id: booking.contact_id,
                  deal_id: booking.deal_id || null,
                  tipo: 'demo_cancelada',
                  titulo: `Demo cancelada (Google Calendar sync): ${(booking as any).event_types?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
                  metadata: {
                    booking_id: booking.id,
                    motivo: 'Cancelado desde Google Calendar',
                    cancelado_por: 'google_sync',
                    source: 'calendar_sync',
                  },
                  automatico: true,
                });
              }
            }
            continue;
          }

          // 6. If event time was changed in Google
          if (event.start?.dateTime && event.end?.dateTime) {
            const newStartDT = new Date(event.start.dateTime);
            const newEndDT = new Date(event.end.dateTime);

            const newFecha = newStartDT.toISOString().slice(0, 10);
            const newHoraInicio = `${String(newStartDT.getHours()).padStart(2, '0')}:${String(newStartDT.getMinutes()).padStart(2, '0')}`;
            const newHoraFin = `${String(newEndDT.getHours()).padStart(2, '0')}:${String(newEndDT.getMinutes()).padStart(2, '0')}`;

            // Check if time actually changed
            if (
              newFecha !== booking.fecha ||
              newHoraInicio !== booking.hora_inicio ||
              newHoraFin !== booking.hora_fin
            ) {
              const { error: upErr } = await supabase
                .from('bookings')
                .update({
                  fecha: newFecha,
                  hora_inicio: newHoraInicio,
                  hora_fin: newHoraFin,
                })
                .eq('id', booking.id);

              if (!upErr) {
                stats.updated++;

                // Log activity
                if (booking.contact_id) {
                  await supabase.from('activities').insert({
                    contact_id: booking.contact_id,
                    deal_id: booking.deal_id || null,
                    tipo: 'sistema',
                    titulo: `Demo reagendada (Google Calendar sync): ${newFecha} ${newHoraInicio}`,
                    metadata: {
                      booking_id: booking.id,
                      old_fecha: booking.fecha,
                      old_hora_inicio: booking.hora_inicio,
                      new_fecha: newFecha,
                      new_hora_inicio: newHoraInicio,
                      source: 'calendar_sync',
                    },
                    automatico: true,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Sync error for connection ${conn.id}:`, err);
        stats.errors++;
      }
    }

    return new Response(JSON.stringify(stats));
  } catch (err) {
    console.error('Calendar sync cron failed:', err);
    return new Response(
      JSON.stringify({ ...stats, error: 'Sync failed' }),
      { status: 500 },
    );
  }
};
