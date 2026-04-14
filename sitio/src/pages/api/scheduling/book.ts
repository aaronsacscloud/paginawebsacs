import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/** Lifecycle stages in order of progression. */
const LIFECYCLE_ORDER = [
  'suscriptor',
  'lead',
  'lead_calificado',
  'oportunidad',
  'cliente',
  'evangelista',
];

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const {
    event_type_slug,
    fecha,
    hora_inicio,
    nombre,
    email,
    whatsapp,
    empresa,
    giro,
    sucursales,
    notas,
    timezone,
    answers,
    utm_source,
    utm_medium,
    utm_campaign,
  } = body;

  if (!event_type_slug || !fecha || !hora_inicio || !nombre || !email) {
    return new Response(
      JSON.stringify({ error: 'event_type_slug, fecha, hora_inicio, nombre, and email are required' }),
      { status: 400 },
    );
  }

  // 1. Load event type
  const { data: eventType, error: etErr } = await supabase
    .from('scheduling_event_types')
    .select('*')
    .eq('slug', event_type_slug)
    .eq('activo', true)
    .single();

  if (etErr || !eventType) {
    return new Response(JSON.stringify({ error: 'Event type not found' }), { status: 404 });
  }

  // 2. Validate the slot is still available
  const slotValid = await validateSlotAvailable(eventType, fecha, hora_inicio);
  if (!slotValid.available) {
    return new Response(
      JSON.stringify({ error: slotValid.reason || 'Slot is no longer available' }),
      { status: 409 },
    );
  }

  // 3. Calculate hora_fin
  const hora_fin = addMinutes(hora_inicio, eventType.duracion_minutos);

  // 4. Find or create contact
  let contact_id: string | null = null;
  let company_id: string | null = null;

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, lifecycle_stage')
    .eq('email', email)
    .limit(1)
    .single();

  if (existingContact) {
    contact_id = existingContact.id;

    // Update lifecycle if currently lower
    const currentIdx = LIFECYCLE_ORDER.indexOf(existingContact.lifecycle_stage || 'lead');
    const targetIdx = LIFECYCLE_ORDER.indexOf('lead_calificado');
    if (currentIdx < targetIdx) {
      await supabase
        .from('contacts')
        .update({ lifecycle_stage: 'lead_calificado' })
        .eq('id', contact_id);
    }
  } else {
    const { data: newContact, error: cErr } = await supabase
      .from('contacts')
      .insert({
        nombre,
        email,
        whatsapp: whatsapp || null,
        tipo: 'lead',
        lifecycle_stage: 'lead_calificado',
        fuente: 'booking-page',
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        giro: giro || null,
        sucursales_interes: sucursales || null,
      })
      .select('id')
      .single();

    if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500 });
    contact_id = newContact.id;
  }

  // 5. Find or create company
  if (empresa) {
    const { data: existingCo } = await supabase
      .from('companies')
      .select('id')
      .eq('nombre', empresa)
      .limit(1)
      .single();

    if (existingCo) {
      company_id = existingCo.id;
    } else {
      const { data: newCo, error: coErr } = await supabase
        .from('companies')
        .insert({
          nombre: empresa,
          giro: giro || null,
          sucursales: sucursales || 1,
        })
        .select('id')
        .single();

      if (!coErr && newCo) {
        company_id = newCo.id;
      }
    }

    // Link contact to company if not linked
    if (company_id && contact_id) {
      await supabase
        .from('contacts')
        .update({ company_id })
        .eq('id', contact_id)
        .is('company_id', null);
    }
  }

  // 6. Create deal
  let deal_id: string | null = null;
  const dealNombre = `Demo - ${empresa || nombre}`;

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .insert({
      nombre: dealNombre,
      contact_id,
      company_id,
      stage: 'demo_agendada',
      owner_id: eventType.owner_id,
    })
    .select('id')
    .single();

  if (!dealErr && deal) {
    deal_id = deal.id;
  }

  // 7. Create booking
  const token_cancelar = generateToken();
  const token_reagendar = generateToken();

  const { data: booking, error: bookErr } = await supabase
    .from('scheduling_bookings')
    .insert({
      event_type_id: eventType.id,
      host_id: eventType.owner_id,
      contact_id,
      deal_id,
      fecha,
      hora_inicio,
      hora_fin,
      timezone: timezone || 'America/Mexico_City',
      nombre_invitado: nombre,
      email_invitado: email,
      whatsapp_invitado: whatsapp || null,
      empresa_invitado: empresa || null,
      notas: notas || null,
      estado: 'confirmada',
      token_cancelar,
      token_reagendar,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
    })
    .select()
    .single();

  if (bookErr) {
    // Handle duplicate booking (unique index violation)
    if (bookErr.code === '23505') {
      return new Response(
        JSON.stringify({ error: 'Este horario ya fue reservado. Por favor selecciona otro.' }),
        { status: 409 },
      );
    }
    return new Response(JSON.stringify({ error: bookErr.message }), { status: 500 });
  }

  // 8. Save booking answers
  if (answers && Array.isArray(answers) && answers.length > 0) {
    const answerRows = answers.map((a: { question_id: string; valor: string }) => ({
      booking_id: booking.id,
      question_id: a.question_id,
      valor: a.valor,
    }));

    await supabase.from('scheduling_booking_answers').insert(answerRows);
  }

  // 9. Log activity
  await supabase.from('activities').insert({
    contact_id,
    company_id,
    deal_id,
    tipo: 'demo_agendada',
    titulo: `Demo agendada: ${eventType.nombre} - ${fecha} ${hora_inicio}`,
    metadata: {
      event_type: eventType.slug,
      fecha,
      hora_inicio,
      hora_fin,
      booking_id: booking.id,
    },
    automatico: true,
  });

  // 10. Return booking with tokens
  return new Response(
    JSON.stringify({
      booking,
      cancel_url: `/scheduling/cancel?token=${token_cancelar}`,
      reschedule_url: `/scheduling/reschedule?token=${token_reagendar}`,
    }),
    { status: 201 },
  );
};

// ---------- Slot validation ----------

async function validateSlotAvailable(
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

  // Check existing bookings
  const { data: dayBookings } = await supabase
    .from('scheduling_bookings')
    .select('hora_inicio, hora_fin')
    .eq('host_id', owner_id)
    .eq('fecha', fecha)
    .eq('estado', 'confirmada');

  if (dayBookings) {
    // Check max reservas
    if (max_reservas_dia && dayBookings.length >= max_reservas_dia) {
      return { available: false, reason: 'Maximum bookings for this day reached' };
    }

    // Check overlap with buffers
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
