import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

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

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const { booking_id, token, nueva_fecha, nueva_hora, timezone } = body;

  if (!booking_id || !nueva_fecha || !nueva_hora) {
    return new Response(
      JSON.stringify({ error: 'booking_id, nueva_fecha, and nueva_hora required' }),
      { status: 400 },
    );
  }

  // Load old booking
  const { data: oldBooking, error: bErr } = await supabase
    .from('scheduling_bookings')
    .select('*, scheduling_event_types(*)')
    .eq('id', booking_id)
    .single();

  if (bErr || !oldBooking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  // Verify token
  if (!token || token !== oldBooking.token_reagendar) {
    return new Response(JSON.stringify({ error: 'Invalid reschedule token' }), { status: 403 });
  }

  // Check booking is reschedulable
  if (oldBooking.estado !== 'confirmada') {
    return new Response(
      JSON.stringify({ error: `Booking cannot be rescheduled (current status: ${oldBooking.estado})` }),
      { status: 400 },
    );
  }

  const eventType = oldBooking.scheduling_event_types;
  if (!eventType) {
    return new Response(JSON.stringify({ error: 'Event type not found' }), { status: 500 });
  }

  // Validate new slot is available
  const slotValid = await validateSlotForReschedule(eventType, nueva_fecha, nueva_hora, booking_id);
  if (!slotValid.available) {
    return new Response(
      JSON.stringify({ error: slotValid.reason || 'New slot is not available' }),
      { status: 409 },
    );
  }

  const nueva_hora_fin = addMinutes(nueva_hora, eventType.duracion_minutos);

  // Mark old booking as reagendada
  await supabase
    .from('scheduling_bookings')
    .update({ estado: 'reagendada' })
    .eq('id', booking_id);

  // Create new booking
  const token_cancelar = generateToken();
  const token_reagendar = generateToken();

  const { data: newBooking, error: nbErr } = await supabase
    .from('scheduling_bookings')
    .insert({
      event_type_id: eventType.id,
      host_id: oldBooking.host_id,
      contact_id: oldBooking.contact_id,
      deal_id: oldBooking.deal_id,
      fecha: nueva_fecha,
      hora_inicio: nueva_hora,
      hora_fin: nueva_hora_fin,
      timezone: timezone || oldBooking.timezone || 'America/Mexico_City',
      nombre_invitado: oldBooking.nombre_invitado,
      email_invitado: oldBooking.email_invitado,
      whatsapp_invitado: oldBooking.whatsapp_invitado,
      empresa_invitado: oldBooking.empresa_invitado,
      notas: oldBooking.notas,
      estado: 'confirmada',
      token_cancelar,
      token_reagendar,
      reagendada_desde_id: booking_id,
      utm_source: oldBooking.utm_source,
      utm_medium: oldBooking.utm_medium,
      utm_campaign: oldBooking.utm_campaign,
    })
    .select()
    .single();

  if (nbErr) return new Response(JSON.stringify({ error: nbErr.message }), { status: 500 });

  // Log activity
  if (oldBooking.contact_id) {
    await supabase.from('activities').insert({
      contact_id: oldBooking.contact_id,
      deal_id: oldBooking.deal_id || null,
      tipo: 'demo_reagendada',
      titulo: `Demo reagendada: ${eventType.nombre} - ${nueva_fecha} ${nueva_hora}`,
      metadata: {
        old_booking_id: booking_id,
        new_booking_id: newBooking.id,
        old_fecha: oldBooking.fecha,
        old_hora: oldBooking.hora_inicio,
        nueva_fecha,
        nueva_hora,
      },
      automatico: true,
    });
  }

  return new Response(
    JSON.stringify({
      booking: newBooking,
      cancel_url: `/scheduling/cancel?token=${token_cancelar}`,
      reschedule_url: `/scheduling/reschedule?token=${token_reagendar}`,
    }),
    { status: 201 },
  );
};

// ---------- Slot validation for reschedule ----------

async function validateSlotForReschedule(
  eventType: {
    owner_id: string;
    duracion_minutos: number;
    buffer_antes: number;
    buffer_despues: number;
    aviso_minimo_horas: number;
    max_reservas_dia: number | null;
    max_dias_adelanto: number;
  },
  fecha: string,
  hora_inicio: string,
  excludeBookingId: string,
): Promise<{ available: boolean; reason?: string }> {
  const {
    owner_id,
    duracion_minutos,
    buffer_antes,
    buffer_despues,
    aviso_minimo_horas,
    max_reservas_dia,
    max_dias_adelanto,
  } = eventType;

  // Load host schedule
  const { data: schedules } = await supabase
    .from('scheduling_availability')
    .select('*')
    .eq('team_member_id', owner_id)
    .eq('activo', true)
    .order('es_default', { ascending: false })
    .limit(1);

  if (!schedules || schedules.length === 0) {
    return { available: false, reason: 'No availability schedule' };
  }

  const schedule = schedules[0];
  const hostTz: string = schedule.timezone || 'America/Mexico_City';

  // Current time in host timezone
  const now = new Date();
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: hostTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    nowParts.find((p) => p.type === type)?.value || '00';

  const nowDate = `${get('year')}-${get('month')}-${get('day')}`;
  const nowTime = `${get('hour')}:${get('minute')}`;
  const nowMinutes = timeToMinutes(nowTime);

  // Check max days ahead
  const maxDate = new Date(nowDate + 'T00:00:00');
  maxDate.setDate(maxDate.getDate() + (max_dias_adelanto || 60));
  if (fecha > maxDate.toISOString().slice(0, 10)) {
    return { available: false, reason: 'Date is too far in the future' };
  }

  // Check aviso minimo
  if (fecha === nowDate) {
    const slotMinutes = timeToMinutes(hora_inicio);
    if (slotMinutes < nowMinutes + (aviso_minimo_horas || 0) * 60) {
      return { available: false, reason: 'Not enough advance notice' };
    }
  } else if (fecha < nowDate) {
    return { available: false, reason: 'Date is in the past' };
  }

  // Check override
  const { data: overrides } = await supabase
    .from('scheduling_availability_overrides')
    .select('ranges')
    .eq('team_member_id', owner_id)
    .eq('fecha', fecha)
    .limit(1);

  const dow = new Date(fecha + 'T00:00:00').getDay();
  let dayRanges: { start: string; end: string }[] | null = null;

  if (overrides && overrides.length > 0) {
    if (overrides[0].ranges === null) {
      return { available: false, reason: 'Day is blocked' };
    }
    dayRanges = overrides[0].ranges;
  } else {
    const dayConfig = schedule.weekly_hours[String(dow)];
    if (!dayConfig || !dayConfig.enabled) {
      return { available: false, reason: 'Day is not available' };
    }
    dayRanges = dayConfig.ranges;
  }

  if (!dayRanges || dayRanges.length === 0) {
    return { available: false, reason: 'No time ranges for this day' };
  }

  // Check slot fits within a range
  const hora_fin = addMinutes(hora_inicio, duracion_minutos);
  const slotFits = dayRanges.some(
    (r) => hora_inicio >= r.start && timeToMinutes(hora_fin) <= timeToMinutes(r.end),
  );
  if (!slotFits) {
    return { available: false, reason: 'Slot does not fit within available hours' };
  }

  // Check existing bookings (excluding the one being rescheduled)
  const { data: dayBookings } = await supabase
    .from('scheduling_bookings')
    .select('hora_inicio, hora_fin')
    .eq('host_id', owner_id)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada')
    .neq('id', excludeBookingId);

  if (dayBookings) {
    if (max_reservas_dia && dayBookings.length >= max_reservas_dia) {
      return { available: false, reason: 'Maximum bookings for this day reached' };
    }

    const slotStartWithBuffer = addMinutes(hora_inicio, -(buffer_antes || 0));
    const slotEndWithBuffer = addMinutes(hora_fin, buffer_despues || 0);

    for (const b of dayBookings) {
      if (timesOverlap(slotStartWithBuffer, slotEndWithBuffer, b.hora_inicio, b.hora_fin)) {
        return { available: false, reason: 'Slot conflicts with existing booking' };
      }
    }
  }

  return { available: true };
}
