import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getAuthenticatedClient } from '../../../../lib/google-calendar';
import { google } from 'googleapis';
import { isAuthorizedCron } from '../../../../lib/auth/cron';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) {
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

            /* La hora que guarda el CRM es SIEMPRE hora del centro de México:
               `inicioMs` le pega el -06:00 y los recordatorios la anuncian tal
               cual. `getHours()` devuelve la hora del SERVIDOR, y en Vercel el
               servidor es UTC — así que este bloque le sumaba 6 horas a cada
               reunión que tocaba, 24 segundos después de agendarla, y lo
               anotaba como si el cliente la hubiera movido.

               Medido antes del arreglo: 14 saltos desde mayo, TODOS de +6:00
               exactas. El caso que lo destapó: Natalia agendó a las 4:00 p.m.,
               el registro quedó en 21:00, y los tres recordatorios le
               anunciaron «9:00 p.m.» y salieron seis horas después de que su
               reunión ya había pasado. */
            const enMx = (d: Date) => {
              const p = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Mexico_City', hourCycle: 'h23',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              }).formatToParts(d).reduce((a: any, x) => { a[x.type] = x.value; return a; }, {});
              return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
            };
            const inicioMx = enMx(newStartDT);
            const newFecha = inicioMx.fecha;
            const newHoraInicio = inicioMx.hora;
            const newHoraFin = enMx(newEndDT).hora;

            /* Postgres guarda `time` con segundos («21:00:00») y aquí se arma
               sin ellos («21:00»): comparados en crudo NUNCA son iguales, así
               que todo evento que pasara por aquí se reescribía y dejaba una
               «Demo reagendada» falsa en la bitácora del cliente. */
            const hhmm = (x: any) => String(x || '').slice(0, 5);
            if (
              newFecha !== booking.fecha ||
              newHoraInicio !== hhmm(booking.hora_inicio) ||
              newHoraFin !== hhmm(booking.hora_fin)
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
