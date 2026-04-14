import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getFreeBusy } from '../../../lib/google-calendar';

export const prerender = false;

// ---------- helpers ----------

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function timesOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): boolean {
  return startA < endB && startB < endA;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Get day-of-week index (0 = Sunday, 6 = Saturday) for a YYYY-MM-DD date string. */
function dateToDow(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).getDay();
}

/** Generate an array of YYYY-MM-DD strings from `from` to `to` (inclusive). */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const end = new Date(to + 'T00:00:00');
  let cur = new Date(from + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Return "HH:MM" of the current time in a timezone. */
function nowInTimezone(tz: string): { date: string; time: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '00';

  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}`;
  return { date, time };
}

// ---------- types ----------

interface WeeklyDay {
  enabled: boolean;
  ranges: { start: string; end: string }[];
}

type WeeklyHours = Record<string, WeeklyDay>; // keys "0"-"6"

interface Override {
  fecha: string;
  ranges: { start: string; end: string }[] | null;
}

interface Booking {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

// ---------- route ----------

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const tz = url.searchParams.get('tz') || 'America/Mexico_City';

  if (!slug || !from || !to) {
    return new Response(
      JSON.stringify({ error: 'slug, from, and to params required' }),
      { status: 400 },
    );
  }

  // 1. Load event type
  const { data: eventType, error: etErr } = await supabase
    .from('event_types')
    .select('*')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (etErr || !eventType) {
    return new Response(
      JSON.stringify({ error: 'Event type not found' }),
      { status: 404 },
    );
  }

  const {
    duracion_minutos,
    buffer_antes,
    buffer_despues,
    aviso_minimo_horas,
    max_reservas_dia,
    max_dias_adelanto,
    owner_id,
  } = eventType;

  // 2. Load host availability schedule
  const { data: schedules, error: schedErr } = await supabase
    .from('availability_schedules')
    .select('*')
    .eq('team_member_id', owner_id)
    .eq('activo', true)
    .order('es_default', { ascending: false })
    .limit(1);

  if (schedErr || !schedules || schedules.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No availability schedule found for host' }),
      { status: 404 },
    );
  }

  const schedule = schedules[0];
  const hostTz: string = schedule.timezone || 'America/Mexico_City';
  const weeklyHours: WeeklyHours = schedule.weekly_hours;

  // 3. Load overrides for the date range
  const { data: overridesRaw } = await supabase
    .from('availability_overrides')
    .select('fecha, ranges')
    .eq('team_member_id', owner_id)
    .gte('fecha', from)
    .lte('fecha', to);

  const overridesMap = new Map<string, Override>();
  for (const ov of (overridesRaw || []) as Override[]) {
    overridesMap.set(ov.fecha, ov);
  }

  // 4. Load existing confirmed bookings for the host in the date range
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select('fecha, hora_inicio, hora_fin')
    .eq('host_id', owner_id)
    .eq('estado', 'confirmada')
    .gte('fecha', from)
    .lte('fecha', to);

  const bookings = (bookingsRaw || []) as Booking[];

  // Index bookings by date for fast lookup
  const bookingsByDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    const list = bookingsByDate.get(b.fecha) || [];
    list.push(b);
    bookingsByDate.set(b.fecha, list);
  }

  // 4b. Load Google Calendar busy times (if connected)
  const gcalBusy: Array<{ start: string; end: string }> = [];
  try {
    const busy = await getFreeBusy(
      owner_id,
      `${from}T00:00:00-06:00`,
      `${to}T23:59:59-06:00`
    );
    gcalBusy.push(...busy);
  } catch {}

  // Convert Google busy times to per-date HH:MM ranges
  const gcalBusyByDate = new Map<string, Array<{ start: string; end: string }>>();
  for (const b of gcalBusy) {
    if (!b.start || !b.end) continue;
    const startDate = b.start.slice(0, 10);
    const startTime = b.start.slice(11, 16);
    const endTime = b.end.slice(11, 16);
    const list = gcalBusyByDate.get(startDate) || [];
    list.push({ start: startTime, end: endTime });
    gcalBusyByDate.set(startDate, list);
  }

  // 5. Calculate slots for each date
  const now = nowInTimezone(hostTz);
  const nowMinutes = timeToMinutes(now.time);
  const avisoMinutes = (aviso_minimo_horas || 0) * 60;

  // Max date allowed = now + max_dias_adelanto days
  const maxDate = new Date(now.date + 'T00:00:00');
  maxDate.setDate(maxDate.getDate() + (max_dias_adelanto || 60));
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  const dates: Record<string, string[]> = {};
  const allDates = dateRange(from, to);

  for (const dateStr of allDates) {
    // 5a. Skip if beyond max days ahead
    if (dateStr > maxDateStr) continue;

    const dow = dateToDow(dateStr);
    const dowStr = String(dow);

    let dayRanges: { start: string; end: string }[] | null = null;

    // 5b. Check overrides
    const override = overridesMap.get(dateStr);
    if (override) {
      if (override.ranges === null) {
        // Blocked day
        continue;
      }
      dayRanges = override.ranges;
    }

    // 5c. Get weekly hours for day-of-week
    if (!dayRanges) {
      const dayConfig = weeklyHours[dowStr];
      if (!dayConfig || !dayConfig.enabled) continue;
      dayRanges = dayConfig.ranges;
    }

    if (!dayRanges || dayRanges.length === 0) continue;

    const dayBookings = bookingsByDate.get(dateStr) || [];
    const dayBookingCount = dayBookings.length;
    const slots: string[] = [];

    // 5e. Generate slots for each time range
    for (const range of dayRanges) {
      let slotStart = range.start;

      while (true) {
        const slotEnd = addMinutes(slotStart, duracion_minutos);

        // Slot must fit within range
        if (timeToMinutes(slotEnd) > timeToMinutes(range.end)) break;

        const slotStartWithBuffer = addMinutes(slotStart, -(buffer_antes || 0));
        const slotEndWithBuffer = addMinutes(slotEnd, buffer_despues || 0);

        let available = true;

        // Check aviso minimo: slot must be > now + aviso_minimo_horas
        if (dateStr === now.date) {
          const slotMinutes = timeToMinutes(slotStart);
          if (slotMinutes < nowMinutes + avisoMinutes) {
            available = false;
          }
        } else if (dateStr < now.date) {
          available = false;
        }

        // Check max reservas dia
        if (available && max_reservas_dia && dayBookingCount + slots.length >= max_reservas_dia) {
          available = false;
        }

        // Check conflicts with existing bookings (with buffers)
        if (available) {
          for (const booking of dayBookings) {
            if (timesOverlap(slotStartWithBuffer, slotEndWithBuffer, booking.hora_inicio, booking.hora_fin)) {
              available = false;
              break;
            }
          }
        }

        // Check conflicts with Google Calendar busy times
        if (available) {
          const gcalDay = gcalBusyByDate.get(dateStr) || [];
          for (const busy of gcalDay) {
            if (timesOverlap(slotStart, slotEnd, busy.start, busy.end)) {
              available = false;
              break;
            }
          }
        }

        if (available) {
          slots.push(slotStart);
        }

        slotStart = addMinutes(slotStart, duracion_minutos);
      }
    }

    if (slots.length > 0) {
      dates[dateStr] = slots;
    }
  }

  // 6. Return result
  return new Response(
    JSON.stringify({
      dates,
      event_type: eventType,
    }),
  );
};
