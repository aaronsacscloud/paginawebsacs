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
  event_type_id?: string;
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
    slot_interval_minutos,
  } = eventType;

  // Determine which hosts to check availability for (Feature 13: Round-Robin)
  const isRoundRobin = eventType.tipo_reunion === 'round_robin' && eventType.host_ids?.length > 0;
  const hostIds: string[] = isRoundRobin ? eventType.host_ids : [owner_id];

  // 2. Load availability schedules, overrides, bookings, and gcal busy for ALL hosts
  interface HostData {
    hostTz: string;
    weeklyHours: WeeklyHours;
    overridesMap: Map<string, Override>;
    bookingsByDate: Map<string, Booking[]>;
    gcalBusyByDate: Map<string, Array<{ start: string; end: string }>>;
  }

  const hostsData = new Map<string, HostData>();

  for (const hostId of hostIds) {
    // Load schedule
    const { data: schedules } = await supabase
      .from('availability_schedules')
      .select('*')
      .eq('team_member_id', hostId)
      .eq('activo', true)
      .order('es_default', { ascending: false })
      .limit(1);

    if (!schedules || schedules.length === 0) continue;

    const schedule = schedules[0];
    const hostTz: string = schedule.timezone || 'America/Mexico_City';
    const weeklyHours: WeeklyHours = schedule.weekly_hours;

    // Load overrides
    const { data: overridesRaw } = await supabase
      .from('availability_overrides')
      .select('fecha, ranges')
      .eq('team_member_id', hostId)
      .gte('fecha', from)
      .lte('fecha', to);

    const overridesMap = new Map<string, Override>();
    for (const ov of (overridesRaw || []) as Override[]) {
      overridesMap.set(ov.fecha, ov);
    }

    // Load bookings
    const { data: bookingsRaw } = await supabase
      .from('bookings')
      .select('fecha, hora_inicio, hora_fin, event_type_id')
      .eq('host_id', hostId)
      .eq('estado', 'confirmada')
      .gte('fecha', from)
      .lte('fecha', to);

    const bookingsByDate = new Map<string, Booking[]>();
    for (const b of (bookingsRaw || []) as Booking[]) {
      const list = bookingsByDate.get(b.fecha) || [];
      list.push(b);
      bookingsByDate.set(b.fecha, list);
    }

    // Load Google Calendar busy times
    const gcalBusyByDate = new Map<string, Array<{ start: string; end: string }>>();
    try {
      const busy = await getFreeBusy(
        hostId,
        `${from}T00:00:00-06:00`,
        `${to}T23:59:59-06:00`
      );
      for (const b of busy) {
        if (!b.start || !b.end) continue;
        const startDate = b.start.slice(0, 10);
        const startTime = b.start.slice(11, 16);
        const endTime = b.end.slice(11, 16);
        const list = gcalBusyByDate.get(startDate) || [];
        list.push({ start: startTime, end: endTime });
        gcalBusyByDate.set(startDate, list);
      }
    } catch {}

    hostsData.set(hostId, { hostTz, weeklyHours, overridesMap, bookingsByDate, gcalBusyByDate });
  }

  if (hostsData.size === 0) {
    return new Response(
      JSON.stringify({ error: 'No availability schedule found for host' }),
      { status: 404 },
    );
  }

  // Use the first host's timezone as the reference timezone
  const firstHostData = hostsData.values().next().value!;
  const hostTz = firstHostData.hostTz;

  // 5. Calculate slots for each date
  const now = nowInTimezone(hostTz);
  const nowMinutes = timeToMinutes(now.time);
  const avisoMinutes = (aviso_minimo_horas || 0) * 60;

  // Max date allowed = now + max_dias_adelanto days
  const maxDate = new Date(now.date + 'T00:00:00');
  maxDate.setDate(maxDate.getDate() + (max_dias_adelanto || 60));
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  const dates: Record<string, string[]> = {};
  const fullDatesSet: string[] = [];
  const slotCapacity: Record<string, Record<string, number>> = {}; // date -> time -> remaining spots (group events only)
  const isGroupEvent = eventType.tipo_reunion === 'grupal';
  const allDates = dateRange(from, to);

  for (const dateStr of allDates) {
    // 5a. Skip if beyond max days ahead
    if (dateStr > maxDateStr) continue;

    const dow = dateToDow(dateStr);
    const dowStr = String(dow);
    const slots: string[] = [];

    // Collect all unique time ranges across all hosts for this date
    const allTimeRanges: { start: string; end: string }[] = [];

    for (const [, hd] of hostsData) {
      let dayRanges: { start: string; end: string }[] | null = null;

      const override = hd.overridesMap.get(dateStr);
      if (override) {
        if (override.ranges === null) continue; // This host blocked
        dayRanges = override.ranges;
      }

      if (!dayRanges) {
        const dayConfig = hd.weeklyHours[dowStr];
        if (!dayConfig || !dayConfig.enabled) continue;
        dayRanges = dayConfig.ranges;
      }

      if (dayRanges) {
        for (const r of dayRanges) {
          // Add if not already present
          if (!allTimeRanges.some(existing => existing.start === r.start && existing.end === r.end)) {
            allTimeRanges.push(r);
          }
        }
      }
    }

    if (allTimeRanges.length === 0) continue;

    // Sort ranges by start time
    allTimeRanges.sort((a, b) => a.start.localeCompare(b.start));

    // Generate candidate slot times from all ranges
    // slot_interval_minutos controls the spacing between slots (default = duracion_minutos)
    const interval = slot_interval_minutos || duracion_minutos;
    const candidateSlots = new Set<string>();
    for (const range of allTimeRanges) {
      let slotStart = range.start;
      while (true) {
        const slotEnd = addMinutes(slotStart, duracion_minutos);
        if (timeToMinutes(slotEnd) > timeToMinutes(range.end)) break;
        candidateSlots.add(slotStart);
        slotStart = addMinutes(slotStart, interval);
      }
    }

    // For each candidate slot, check if ANY host is available
    for (const slotStart of Array.from(candidateSlots).sort()) {
      const slotEnd = addMinutes(slotStart, duracion_minutos);

      // Check aviso minimo
      if (dateStr === now.date) {
        const slotMinutes = timeToMinutes(slotStart);
        if (slotMinutes < nowMinutes + avisoMinutes) continue;
      } else if (dateStr < now.date) {
        continue;
      }

      let anyHostAvailable = false;

      for (const [, hd] of hostsData) {
        // Check if this host has this time range available
        let dayRanges: { start: string; end: string }[] | null = null;
        const override = hd.overridesMap.get(dateStr);
        if (override) {
          if (override.ranges === null) continue;
          dayRanges = override.ranges;
        }
        if (!dayRanges) {
          const dayConfig = hd.weeklyHours[dowStr];
          if (!dayConfig || !dayConfig.enabled) continue;
          dayRanges = dayConfig.ranges;
        }
        if (!dayRanges) continue;

        // Slot must fit within one of the host's ranges
        const fitsRange = dayRanges.some(
          (r) => slotStart >= r.start && timeToMinutes(slotEnd) <= timeToMinutes(r.end),
        );
        if (!fitsRange) continue;

        const dayBookings = hd.bookingsByDate.get(dateStr) || [];

        // Check max reservas dia (for non-group events, this is a daily limit)
        if (eventType.tipo_reunion !== 'grupal' && max_reservas_dia && dayBookings.length >= max_reservas_dia) continue;

        // Check booking conflicts
        let conflict = false;
        if (eventType.tipo_reunion === 'grupal') {
          // For group events, multiple bookings at the same time are OK up to a limit
          // Repurpose max_reservas_dia as max participants per slot for group events
          const sameTimeBookings = dayBookings.filter(b => b.hora_inicio === slotStart);
          if (max_reservas_dia && sameTimeBookings.length >= max_reservas_dia) {
            conflict = true;
          }
          // Don't check overlap for group events - only exact time matches matter
        } else {
          // Smart buffer: increase buffer when adjacent booking is a different event type
          const dynamicBufferBefore = (() => {
            const prevBooking = dayBookings
              .filter((b) => b.hora_fin <= slotStart)
              .sort((a, b) => b.hora_fin.localeCompare(a.hora_fin))[0];

            if (prevBooking && prevBooking.event_type_id !== eventType.id) {
              return Math.ceil((buffer_antes || 0) * 1.5);
            }
            return buffer_antes || 0;
          })();

          const dynamicBufferAfter = (() => {
            const nextBooking = dayBookings
              .filter((b) => b.hora_inicio >= slotEnd)
              .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0];

            if (nextBooking && nextBooking.event_type_id !== eventType.id) {
              return Math.ceil((buffer_despues || 0) * 1.5);
            }
            return buffer_despues || 0;
          })();

          const slotStartWithBuffer = addMinutes(slotStart, -dynamicBufferBefore);
          const slotEndWithBuffer = addMinutes(slotEnd, dynamicBufferAfter);

          for (const booking of dayBookings) {
            if (timesOverlap(slotStartWithBuffer, slotEndWithBuffer, booking.hora_inicio, booking.hora_fin)) {
              conflict = true;
              break;
            }
          }
        }
        if (conflict) continue;

        // Check Google Calendar conflicts
        const gcalDay = hd.gcalBusyByDate.get(dateStr) || [];
        let gcalConflict = false;
        for (const busy of gcalDay) {
          if (timesOverlap(slotStart, slotEnd, busy.start, busy.end)) {
            gcalConflict = true;
            break;
          }
        }
        if (gcalConflict) continue;

        // This host is available for this slot
        anyHostAvailable = true;
        break;
      }

      if (anyHostAvailable) {
        slots.push(slotStart);

        // Track remaining capacity for group events
        if (isGroupEvent && max_reservas_dia) {
          let maxBooked = 0;
          for (const [, hd] of hostsData) {
            const dayBookings = hd.bookingsByDate.get(dateStr) || [];
            const sameTimeCount = dayBookings.filter(b => b.hora_inicio === slotStart).length;
            if (sameTimeCount > maxBooked) maxBooked = sameTimeCount;
          }
          const remaining = max_reservas_dia - maxBooked;
          if (!slotCapacity[dateStr]) slotCapacity[dateStr] = {};
          slotCapacity[dateStr][slotStart] = remaining;
        }
      }
    }

    if (slots.length > 0) {
      dates[dateStr] = slots;
    } else if (candidateSlots.size > 0 && max_reservas_dia) {
      // Date had candidate slots but none are available — check if it's because max_reservas_dia was hit
      // If any host has bookings >= max_reservas_dia, this date is "full"
      let anyHostMaxed = false;
      for (const [, hd] of hostsData) {
        const dayBookings = hd.bookingsByDate.get(dateStr) || [];
        if (dayBookings.length >= max_reservas_dia) {
          anyHostMaxed = true;
          break;
        }
      }
      if (anyHostMaxed) {
        fullDatesSet.push(dateStr);
      }
    }
  }

  // 6. Return result
  return new Response(
    JSON.stringify({
      dates,
      full_dates: fullDatesSet,
      event_type: eventType,
      ...(isGroupEvent && Object.keys(slotCapacity).length > 0 ? { slot_capacity: slotCapacity } : {}),
    }),
  );
};
