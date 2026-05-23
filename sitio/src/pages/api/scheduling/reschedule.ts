import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { deleteCalendarEvent, createCalendarEvent } from '../../../lib/google-calendar';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';
import { getCurrentUser } from '../../../lib/auth/scope';
import { canActOnSchedulingOwner } from '../../../lib/scheduling/scope';

export const prerender = false;

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();

function replaceEmailTokens(text: string, data: { nombre?: string; empresa?: string; fecha?: string; hora?: string; duracion?: number; meet_link?: string }): string {
  return (text || '')
    .replace(/\{\{nombre\}\}/g, data.nombre || '')
    .replace(/\{\{empresa\}\}/g, data.empresa || '')
    .replace(/\{\{fecha\}\}/g, data.fecha || '')
    .replace(/\{\{hora\}\}/g, data.hora || '')
    .replace(/\{\{duracion\}\}/g, String(data.duracion || 30))
    .replace(/\{\{meet_link\}\}/g, data.meet_link || '');
}

function buildEmailHtml(heading: string, body: string, extras: string = ''): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td style="background:#4B7BE5;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
    <span style="font-size:1.5rem;font-weight:700;color:#fff;">SACS</span>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;">
    <h2 style="margin:0 0 12px;font-size:1.25rem;color:#1A1A1A;">${heading}</h2>
    <p style="color:#666;margin:0 0 24px;font-size:0.9375rem;line-height:1.6;">${body}</p>
    ${extras}
  </td></tr>
  <tr><td style="background:#FAFAF8;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center;">
    <span style="font-size:0.75rem;color:#bbb;">SACS — Sistema operativo para retailers</span>
  </td></tr>
</table>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'SACS <onboarding@resend.dev>', to: [to], subject, html }),
    });
  } catch {}
}

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
    .from('bookings')
    .select('*, event_types(*)')
    .eq('id', booking_id)
    .single();

  if (bErr || !oldBooking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  // Auth: token público válido (invitado se reagenda) o auth con ownership (host).
  let isAdmin = false;
  const hasValidToken = token && token === oldBooking.token_reagendar;
  if (!hasValidToken) {
    const user = await getCurrentUser(request);
    if (!canActOnSchedulingOwner(user, oldBooking.host_id)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }
    isAdmin = true;
  }

  // Check booking is reschedulable
  if (oldBooking.estado !== 'confirmada') {
    return new Response(
      JSON.stringify({ error: `Booking cannot be rescheduled (current status: ${oldBooking.estado})` }),
      { status: 400 },
    );
  }

  const eventType = oldBooking.event_types;
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
    .from('bookings')
    .update({ estado: 'reagendada' })
    .eq('id', booking_id);

  // Create new booking
  const token_cancelar = generateToken();
  const token_reagendar = generateToken();

  const { data: newBooking, error: nbErr } = await supabase
    .from('bookings')
    .insert({
      event_type_id: eventType.id,
      host_id: oldBooking.host_id,
      contact_id: oldBooking.contact_id,
      deal_id: oldBooking.deal_id,
      fecha: nueva_fecha,
      hora_inicio: nueva_hora,
      hora_fin: nueva_hora_fin,
      timezone: timezone || oldBooking.timezone || 'America/Mexico_City',
      invitee_nombre: oldBooking.invitee_nombre,
      invitee_email: oldBooking.invitee_email,
      invitee_whatsapp: oldBooking.invitee_whatsapp,
      invitee_empresa: oldBooking.invitee_empresa,
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

  // Fire webhook
  fireSchedulingWebhooks('booking.rescheduled', {
    old_booking: oldBooking,
    new_booking: newBooking,
  });

  // Send reschedule email to invitee
  if (oldBooking.invitee_email) {
    try {
      const emailCfgReschedule = (eventType as any)?.routing_rules?.emails?.reschedule || {};
      const tokenData = {
        nombre: oldBooking.invitee_nombre || '',
        empresa: oldBooking.invitee_empresa || '',
        fecha: nueva_fecha,
        hora: nueva_hora,
        duracion: eventType.duracion_minutos,
        meet_link: newBooking.google_meet_link || '',
      };
      const rescheduleSubject = replaceEmailTokens(emailCfgReschedule.subject || '✅ Tu reunión con SACS ha sido reagendada', tokenData);
      const rescheduleHeading = replaceEmailTokens(emailCfgReschedule.heading || '✅ Tu reunión ha sido reagendada', tokenData);
      const rescheduleBody = replaceEmailTokens(emailCfgReschedule.body || 'Tu reunión con SACS ha sido movida a una nueva fecha.', tokenData);

      const extrasReschedule = `
    <div style="background:#FFF3E0;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
      <p style="margin:0;font-size:0.8125rem;color:#999;text-decoration:line-through;">Anterior: ${oldBooking.fecha} a las ${oldBooking.hora_inicio}</p>
    </div>
    <div style="background:#E8F5E9;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      <p style="margin:0;font-size:0.9375rem;font-weight:700;color:#2e7d32;">Nueva: ${nueva_fecha} a las ${nueva_hora}</p>
      ${newBooking.google_meet_link ? `<p style="margin:8px 0 0;"><a href="${newBooking.google_meet_link}" style="color:#4B7BE5;font-weight:600;">📹 Unirse a Google Meet</a></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="https://www.sacscloud.com/agendar/cancelar?token=${newBooking.token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>
    </div>`;

      const rescheduleHtml = buildEmailHtml(rescheduleHeading, rescheduleBody, extrasReschedule);
      await sendEmail(oldBooking.invitee_email, rescheduleSubject, rescheduleHtml);
    } catch { /* Reschedule email is non-critical */ }
  }

  // Send WhatsApp notification
  if (oldBooking.invitee_whatsapp) {
    try {
      const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
      await fetch(`${baseUrl}/api/kapso/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: oldBooking.invitee_whatsapp,
          message: `Tu reunión con SACS ha sido reagendada.\n\nNueva fecha: ${nueva_fecha}\nNueva hora: ${nueva_hora}\n${newBooking.google_meet_link ? 'Link: ' + newBooking.google_meet_link : ''}`,
        }),
      });
    } catch {}
  }

  return new Response(
    JSON.stringify({
      booking: newBooking,
      cancel_url: `/agendar/cancelar?token=${token_cancelar}`,
      reschedule_url: `/agendar/reagendar?token=${token_reagendar}`,
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
    .from('availability_schedules')
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
    .from('availability_overrides')
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
    .from('bookings')
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
