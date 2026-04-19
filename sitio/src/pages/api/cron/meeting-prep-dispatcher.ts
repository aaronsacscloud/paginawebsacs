// Vercel Cron cada 15 min — /api/cron/meeting-prep-dispatcher
// Busca bookings próximos (25-35 min antes del inicio) y dispara meeting_prep agent event.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { inngest } from '../../../inngest/client';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  // Target window: bookings starting in [25, 35] minutes
  const now = new Date();
  const minTime = new Date(now.getTime() + 25 * 60 * 1000);
  const maxTime = new Date(now.getTime() + 35 * 60 * 1000);
  const minDate = minTime.toISOString().slice(0, 10);
  const minHour = minTime.toISOString().slice(11, 16);
  const maxDate = maxTime.toISOString().slice(0, 10);
  const maxHour = maxTime.toISOString().slice(11, 16);

  // Fetch bookings in window, not cancelled, with contact_id
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, fecha, hora_inicio, timezone_host, invitee_nombre, invitee_email, contact_id, host_id, deal_id, estado')
    .eq('estado', 'confirmada')
    .eq('fecha', minDate)   // simplified: only same-day; can be expanded with timezone math
    .gte('hora_inicio', minHour)
    .lte('hora_inicio', maxHour);

  const results: any = { dispatched: 0, skipped: 0, errors: [] as string[] };

  for (const booking of bookings || []) {
    try {
      if (!booking.contact_id) { results.skipped++; continue; }

      // Skip if we already sent a prep for this booking (check agent_runs by trigger_ref)
      const { data: existing } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('agent_name', 'meeting_prep')
        .eq('trigger_ref', `booking-${booking.id}`)
        .limit(1)
        .maybeSingle();

      if (existing) { results.skipped++; continue; }

      if (dryRun) {
        results.dispatched++;
        continue;
      }

      // Dispatch Inngest event
      await inngest.send({
        name: 'agent/meeting-prep.requested',
        id: `booking-${booking.id}`,   // idempotency key
        data: {
          meeting_id: booking.id,
          contact_id: booking.contact_id,
          owner_id: booking.host_id,
          company_id: null,
          scheduled_at: `${booking.fecha}T${booking.hora_inicio}`,
        },
      });

      results.dispatched++;
    } catch (err: any) {
      results.errors.push(`booking ${booking.id}: ${err?.message || String(err)}`);
    }
  }

  return new Response(JSON.stringify({
    ...results,
    window: { from: minTime.toISOString(), to: maxTime.toISOString() },
    bookings_found: (bookings || []).length,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
