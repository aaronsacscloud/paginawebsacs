import type { APIRoute } from 'astro';
import { notificar } from '../../../lib/crm/notificaciones';
import { supabase } from '../../../lib/supabase';
import { permitido } from '../../../lib/whatsapp/permisos';
import { deleteCalendarEvent, createCalendarEvent } from '../../../lib/google-calendar';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';
import { getCurrentUser } from '../../../lib/auth/scope';
import { canActOnSchedulingOwner } from '../../../lib/scheduling/scope';
import { sendWhatsApp } from '../../../lib/kapso';

export const prerender = false;

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();

import { escapeHtml } from '../../../lib/scheduling/email-utils';

function replaceEmailTokens(text: string, data: { nombre?: string; empresa?: string; fecha?: string; hora?: string; duracion?: number; meet_link?: string }): string {
  const meetUrl = data.meet_link && /^https?:\/\//.test(data.meet_link) ? data.meet_link : '';
  return (text || '')
    .replace(/\{\{nombre\}\}/g, escapeHtml(data.nombre || ''))
    .replace(/\{\{empresa\}\}/g, escapeHtml(data.empresa || ''))
    .replace(/\{\{fecha\}\}/g, escapeHtml(data.fecha || ''))
    .replace(/\{\{hora\}\}/g, escapeHtml(data.hora || ''))
    .replace(/\{\{duracion\}\}/g, String(data.duracion || 30))
    .replace(/\{\{meet_link\}\}/g, escapeHtml(meetUrl));
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

import { randomBytes } from 'node:crypto';

// CSPRNG token — ver book.ts mismo cambio. 24 bytes = 192 bits.
function generateToken(): string {
  return randomBytes(24).toString('base64url');
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
  const hasValidToken = token && token === oldBooking.token_reagendar;
  if (!hasValidToken) {
    const user = await getCurrentUser(request);
    if (!canActOnSchedulingOwner(user, oldBooking.host_id)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }
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

  /* ══ EL CANDADO CONTRA LA CARRERA ══
     La transición se hace ANTES y de forma CONDICIONAL: solo gana quien
     encuentre la reunión todavía en 'confirmada'. Con la verificación suelta
     y el update después, dos POST a la vez (doble clic en la página pública,
     reintento del navegador) leían las dos 'confirmada', insertaban dos
     reservas y —desde que esto toca Google— creaban DOS eventos con
     invitación al cliente, dos correos y dos WhatsApps. Si no movió fila,
     alguien más ya reagendó y aquí no hay nada que hacer. */
  const { data: gano } = await supabase.from('bookings')
    .update({ estado: 'reagendada' })
    .eq('id', booking_id).eq('estado', 'confirmada')
    .select('id');
  if (!gano?.length) {
    return new Response(JSON.stringify({
      error: 'Esa reunión ya se movió (o se canceló) hace un momento. Recarga para ver cómo quedó.',
      code: 'ya_reagendada',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  }

  // Create new booking FIRST — si el insert falla, la reunión vieja debe
  // seguir confirmada (marcarla antes dejaba al lead SIN ninguna cita).
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
      timezone_invitado: timezone || oldBooking.timezone_invitado || 'America/Mexico_City',
      timezone_host: oldBooking.timezone_host || 'America/Mexico_City',
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

  if (nbErr) {
    /* La vieja ya está en 'reagendada' por el candado: si la nueva no nació,
       hay que devolverla a 'confirmada' o el lead se queda SIN ninguna cita. */
    await supabase.from('bookings').update({ estado: 'confirmada' }).eq('id', booking_id);
    return new Response(JSON.stringify({ error: nbErr.message }), { status: 500 });
  }

  /* ══ EL CALENDARIO. Esto FALTABA por completo ══
     `createCalendarEvent` y `deleteCalendarEvent` estaban importados en la
     primera línea de este archivo y no se llamaban en ninguna parte: reagendar
     movía la fila en la base y NO tocaba Google. Resultado real (caso Jakob,
     31-ago): la reunión nueva quedó `confirmada` sin evento y sin liga de
     Meet, el evento viejo siguió vivo en el calendario, y al cliente se le
     escribió «te llega la invitación actualizada a tu calendario» — una
     promesa que el código no cumplía. Los recordatorios salían después
     apuntando a una reunión sin dónde conectarse.

     Orden a propósito: PRIMERO se crea el nuevo (si Google falla, el cliente
     conserva el evento viejo en su calendario, que es mejor que quedarse sin
     ninguno) y solo si el nuevo existe se borra el anterior. */
  let gEventId: string | null = null;
  let gMeet: string | null = null;
  try {
    const { data: hostMember } = await supabase.from('team_members')
      .select('email').eq('id', oldBooking.host_id).maybeSingle();
    /* EL HUSO DEL HOST, no el del invitado. `nueva_hora` viene de
       available-slots, que devuelve horarios de la agenda del host (CDMX), y
       `timezone` es el del navegador del cliente. Crear el evento con el huso
       del cliente movía la reunión: alguien en Madrid que reagenda a las
       12:00 CDMX obtenía un evento a las 12:00 de Madrid — ocho horas antes
       de la reunión real, con su invitación y su Meet a esa hora falsa. */
    const tzNueva = oldBooking.timezone_host || 'America/Mexico_City';
    const gcal = await createCalendarEvent(oldBooking.host_id, {
      summary: `${eventType.nombre} — ${oldBooking.invitee_nombre || ''} (${oldBooking.invitee_empresa || ''})`,
      description: [
        `Contacto: ${oldBooking.invitee_nombre || ''}`,
        oldBooking.invitee_email ? `Email: ${oldBooking.invitee_email}` : '',
        oldBooking.invitee_whatsapp ? `WhatsApp: ${oldBooking.invitee_whatsapp}` : '',
        oldBooking.invitee_empresa ? `Empresa: ${oldBooking.invitee_empresa}` : '',
        `\nReagendada desde ${oldBooking.fecha} ${String(oldBooking.hora_inicio).slice(0, 5)}`,
        `CRM: https://www.sacscloud.com/admin/crm?tab=reuniones`,
      ].filter(Boolean).join('\n'),
      startDateTime: `${nueva_fecha}T${String(nueva_hora).slice(0, 5)}:00`,
      endDateTime: `${nueva_fecha}T${String(nueva_hora_fin).slice(0, 5)}:00`,
      timezone: tzNueva,
      attendeeEmail: oldBooking.invitee_email || undefined,
      hostEmail: hostMember?.email,
    });
    if (gcal) {
      gEventId = gcal.eventId; gMeet = gcal.meetLink;
      await supabase.from('bookings')
        .update({ google_event_id: gEventId, google_meet_link: gMeet }).eq('id', newBooking.id);
      (newBooking as any).google_event_id = gEventId;
      (newBooking as any).google_meet_link = gMeet;
      /* El viejo se borra SOLO cuando el nuevo ya existe. Y si NO se puede
         borrar, se dice: el cliente se queda con dos reuniones en su
         calendario y nadie lo sabría — el error se tragaba con un catch. */
      if (oldBooking.google_event_id) {
        try {
          await deleteCalendarEvent(oldBooking.host_id, oldBooking.google_event_id);
        } catch (e) {
          await notificar({
            clave: `evento-viejo:${oldBooking.google_event_id}`,
            tipo: 'agenda_evento_viejo_vivo', nivel: 'alerta', destino: 'agenda',
            company_id: oldBooking.company_id || null,
            titulo: `Quedó la reunión vieja en el calendario: ${oldBooking.invitee_nombre || 'un cliente'}`,
            detalle: `Se creó la nueva del ${nueva_fecha}, pero la del ${oldBooking.fecha} no se pudo borrar de Google. El cliente ve DOS reuniones: bórrala a mano.`,
            metadata: { booking_id: newBooking.id, evento_viejo: oldBooking.google_event_id },
          });
        }
      }
    }
  } catch (e) {
    console.error('[reagendar] Google Calendar falló:', e);
  }

  /* Si el calendario NO respondió, la reunión existe pero sin invitación ni
     liga: eso NO puede quedarse callado, porque al cliente ya se le dijo que
     le llegaría. Sale aviso para que una persona la ponga a mano. */
  if (!gEventId) {
    await notificar({
      clave: `reagenda-sin-cal:${newBooking.id}`,
      tipo: 'agenda_reagendada_sin_calendario', nivel: 'alerta', destino: 'agenda',
      company_id: oldBooking.company_id || null,
      titulo: `Reagendada sin invitación: ${oldBooking.invitee_nombre || 'un cliente'}`,
      detalle: `La reunión quedó el ${nueva_fecha} a las ${String(nueva_hora).slice(0, 5)}, pero Google Calendar no respondió: no hay evento ni liga de Meet. Créala a mano o vuelve a reagendar.`,
      metadata: { booking_id: newBooking.id },
    });
  }

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

  // Send WhatsApp notification — PLANTILLA primero: el texto libre fuera de
  // la ventana de 24 h se "acepta" pero WhatsApp lo tira en silencio.
  if (oldBooking.invitee_whatsapp) {
    const nombreInv = String(oldBooking.invitee_nombre || '').trim().split(/\s+/)[0] || 'Hola';
    try {
      if (await permitido('agenda_seguimiento')) {
        const { mandarPlantilla } = await import('../../../lib/whatsapp/plantilla-espejo');
        /* Espejada: era de las cuatro que salían sin quedar en el inbox. */
        const r = await mandarPlantilla({
          telefono: oldBooking.invitee_whatsapp, plantilla: 'sesion_reagendada',
          params: [nombreInv, `${nueva_fecha} a las ${nueva_hora}`],
          metadata: { booking_id: newBooking?.id || null, motivo: 'reagendo' },
        });
        if (!r.enviado) throw new Error(r.motivo || 'plantilla no disponible');
      }
    } catch {
      try {
        await sendWhatsApp(
          oldBooking.invitee_whatsapp,
          `Tu reunión con SACS ha sido reagendada.\n\nNueva fecha: ${nueva_fecha}\nNueva hora: ${nueva_hora}\n${newBooking.google_meet_link ? 'Link: ' + newBooking.google_meet_link : ''}`,
        );
      } catch {}
    }
  }

  // La SECUENCIA de demo se reinicia: nueva fecha = cadencia nueva (día 1 hoy),
  // sin repetir lo ya enviado a favor — enviados se limpia a propósito para
  // que el lead reciba otra vez la preparación rumbo a la fecha nueva.
  if (oldBooking.contact_id) {
    try {
      const { data: secsDemo } = await supabase.from('crm_secuencias').select('id, nombre').eq('objetivo', 'demo_hecha');
      for (const sd of secsDemo || []) {
        const { data: mm } = await supabase.from('crm_secuencia_miembros')
          .select('id').eq('secuencia_id', sd.id).eq('contact_id', oldBooking.contact_id).maybeSingle();
        if (!mm) continue;
        await supabase.from('crm_secuencia_miembros')
          .update({ inicio: new Date().toISOString(), enviados: {}, detenida_at: null, motivo: null }).eq('id', mm.id);
        const { data: conv } = await supabase.from('wa_conversaciones').select('id')
          .eq('contact_id', oldBooking.contact_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (conv) await supabase.from('wa_notas').insert({ conversation_id: conv.id, contact_id: oldBooking.contact_id, autor: 'Secuencias',
          texto: `Reagendó su sesión (${nueva_fecha} ${nueva_hora}): la secuencia "${sd.nombre}" se reinicia en día 1 rumbo a la fecha nueva.` });
      }
    } catch (e) { console.warn('[reschedule] reset secuencia', e); }
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
