import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { createCalendarEvent } from '../../../lib/google-calendar';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';

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
    recurrence,
  } = body;

  if (!event_type_slug || !fecha || !hora_inicio || !nombre || !email) {
    return new Response(
      JSON.stringify({ error: 'event_type_slug, fecha, hora_inicio, nombre, and email are required' }),
      { status: 400 },
    );
  }

  // 1. Load event type
  const { data: eventType, error: etErr } = await supabase
    .from('event_types')
    .select('*')
    .eq('slug', event_type_slug)
    .eq('activo', true)
    .single();

  if (etErr || !eventType) {
    return new Response(JSON.stringify({ error: 'Event type not found' }), { status: 404 });
  }

  // 1b. Round-robin host assignment (Feature 13)
  let assignedHostId = eventType.owner_id;

  if (eventType.tipo_reunion === 'round_robin' && eventType.host_ids?.length > 0) {
    // Find host with fewest bookings this week for load balancing
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const hostCounts: Record<string, number> = {};
    for (const hid of eventType.host_ids) {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', hid)
        .eq('estado', 'confirmada')
        .gte('fecha', weekStartStr);
      hostCounts[hid] = count || 0;
    }

    // Pick host with minimum bookings
    assignedHostId = eventType.host_ids.reduce((min: string, hid: string) =>
      (hostCounts[hid] || 0) < (hostCounts[min] || 0) ? hid : min
    , eventType.host_ids[0]);
  }

  // 1c. Lead routing rules override (Feature 14)
  if (eventType.routing_rules?.rules?.length > 0) {
    const formData: Record<string, string> = {
      empresa: empresa || '',
      giro: giro || '',
      sucursales: String(sucursales || ''),
      nombre: nombre || '',
      email: email || '',
      whatsapp: whatsapp || '',
    };

    for (const rule of eventType.routing_rules.rules) {
      const { condition, assign_to } = rule;
      if (!condition || !assign_to) continue;

      const fieldValue = formData[condition.field] || '';
      let match = false;

      switch (condition.operator) {
        case 'eq': match = fieldValue === condition.value; break;
        case 'gte': match = parseInt(String(fieldValue)) >= parseInt(condition.value); break;
        case 'lte': match = parseInt(String(fieldValue)) <= parseInt(condition.value); break;
        case 'contains': match = String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase()); break;
        case 'in': match = Array.isArray(condition.value) && condition.value.includes(fieldValue); break;
      }

      if (match) {
        assignedHostId = assign_to;
        break; // First match wins
      }
    }
  }

  // 2. Validate the slot is still available (use assignedHostId for validation)
  const slotValid = await validateSlotAvailable({ ...eventType, owner_id: assignedHostId }, fecha, hora_inicio);
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
        sucursales_interes: parseInt(String(sucursales)) || null,
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
          sucursales: parseInt(String(sucursales)) || 1,
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
      owner_id: assignedHostId,
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
    .from('bookings')
    .insert({
      event_type_id: eventType.id,
      host_id: assignedHostId,
      contact_id,
      deal_id,
      fecha,
      hora_inicio,
      hora_fin,
      timezone_invitado: timezone || 'America/Mexico_City',
      timezone_host: 'America/Mexico_City',
      invitee_nombre: nombre,
      invitee_email: email,
      invitee_whatsapp: whatsapp || null,
      invitee_empresa: empresa || null,
      invitee_giro: giro || null,
      invitee_sucursales: String(sucursales || '') || null,
      invitee_notas: notas || null,
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

    await supabase.from('booking_answers').insert(answerRows);
  }

  // 9. Create Google Calendar event with Meet link
  let google_event_id: string | null = null;
  let google_meet_link: string | null = null;
  try {
    const tz = timezone || 'America/Mexico_City';
    const startDT = `${fecha}T${hora_inicio}:00`;
    const endDT = `${fecha}T${hora_fin}:00`;

    // Load host email
    const { data: hostMember } = await supabase
      .from('team_members')
      .select('email')
      .eq('id', assignedHostId)
      .single();

    const gcalResult = await createCalendarEvent(assignedHostId, {
      summary: `${eventType.nombre} — ${nombre} (${empresa || ''})`,
      description: [
        `Contacto: ${nombre}`,
        email ? `Email: ${email}` : '',
        whatsapp ? `WhatsApp: ${whatsapp}` : '',
        empresa ? `Empresa: ${empresa}` : '',
        giro ? `Giro: ${giro}` : '',
        sucursales ? `Sucursales: ${sucursales}` : '',
        notas ? `\nNotas: ${notas}` : '',
        `\nCRM: https://www.sacscloud.com/admin/crm?tab=pipeline`,
      ].filter(Boolean).join('\n'),
      startDateTime: startDT,
      endDateTime: endDT,
      timezone: tz,
      attendeeEmail: email,
      hostEmail: hostMember?.email,
    });

    if (gcalResult) {
      google_event_id = gcalResult.eventId;
      google_meet_link = gcalResult.meetLink;
      // Update booking with Google data
      await supabase.from('bookings').update({
        google_event_id,
        google_meet_link,
      }).eq('id', booking.id);
    }
  } catch (gcalErr) {
    console.error('Google Calendar event creation failed:', gcalErr);
  }

  // 10. Send confirmation email to host
  try {
    // hostMember was loaded in step 9 for GCal; re-fetch if needed
    let hostEmail: string | null = null;
    const { data: hostForEmail } = await supabase
      .from('team_members')
      .select('email')
      .eq('id', assignedHostId)
      .single();
    if (hostForEmail?.email) {
      hostEmail = hostForEmail.email;
    }

    if (hostEmail) {
      const meetLink = google_meet_link || '';
      const fechaDisplay = (() => {
        const [y, mo, d] = fecha.split('-').map(Number);
        const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        return `${d} ${months[mo - 1]} ${y}`;
      })();
      const horaDisplay = (() => {
        const [h, m] = hora_inicio.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      })();

      // Build answers HTML
      let answersHtml = '';
      if (answers && Array.isArray(answers) && answers.length > 0) {
        answersHtml = `
          <tr><td style="padding:16px 0 8px 0;font-size:0.6875rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Respuestas personalizadas</td></tr>
          ${answers.map((a: { question_id: string; valor: string }) => `<tr><td style="padding:4px 0;font-size:0.875rem;color:#555;">${a.valor}</td></tr>`).join('')}
        `;
      }

      const emailHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td style="background:#1A1A1A;padding:20px 24px;border-radius:12px 12px 0 0;">
    <span style="font-size:1.25rem;font-weight:700;color:#fff;">Sacs</span>
    <span style="font-size:0.625rem;font-weight:700;color:#4B7BE5;background:rgba(75,123,229,0.15);padding:2px 8px;border-radius:4px;margin-left:8px;">NUEVA DEMO</span>
  </td></tr>
  <tr><td style="background:#fff;padding:24px;">
    <h2 style="margin:0 0 20px 0;font-size:1.125rem;font-weight:700;color:#1A1A1A;">Nueva Demo Agendada</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="padding:16px 0 8px 0;font-size:0.6875rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Datos del invitado</td></tr>
      <tr><td style="padding:4px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Nombre</td>
            <td style="padding:6px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${nombre}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Email</td>
            <td style="padding:6px 0;font-size:0.875rem;color:#555;">${email}</td>
          </tr>
          ${whatsapp ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">WhatsApp</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${whatsapp}</td></tr>` : ''}
          ${empresa ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Empresa</td><td style="padding:6px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${empresa}</td></tr>` : ''}
          ${giro ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Giro</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${giro}</td></tr>` : ''}
          ${sucursales ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Sucursales</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${sucursales}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;border-radius:8px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:8px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 0 8px 0;font-size:0.6875rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Detalles de la reunion</td></tr>
          <tr>
            <td style="padding:4px 0;font-size:0.875rem;color:#999;width:110px;">Tipo</td>
            <td style="padding:4px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${eventType.nombre}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:0.875rem;color:#999;width:110px;">Fecha</td>
            <td style="padding:4px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${fechaDisplay}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:0.875rem;color:#999;width:110px;">Hora</td>
            <td style="padding:4px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${horaDisplay}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:0.875rem;color:#999;width:110px;">Duracion</td>
            <td style="padding:4px 0;font-size:0.875rem;color:#555;">${eventType.duracion_minutos} minutos</td>
          </tr>
          ${meetLink ? `<tr><td style="padding:4px 0;font-size:0.875rem;color:#999;width:110px;">Google Meet</td><td style="padding:4px 0;font-size:0.875rem;"><a href="${meetLink}" style="color:#4B7BE5;text-decoration:none;font-weight:600;">${meetLink}</a></td></tr>` : ''}
        </table>
      </td></tr>
    </table>

    ${answersHtml ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">${answersHtml}</table>` : ''}

    ${notas ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="padding:0 0 4px 0;font-size:0.6875rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Notas del invitado</td></tr><tr><td style="padding:4px 0;font-size:0.875rem;color:#555;font-style:italic;">${notas}</td></tr></table>` : ''}
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
    <a href="https://www.sacscloud.com/admin/crm?tab=agenda" style="display:inline-block;padding:12px 32px;background:#4B7BE5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ver en CRM</a>
  </td></tr>
</table>`;

      // Fire-and-forget internal email send
      try {
        const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
        await fetch(`${baseUrl}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: hostEmail,
            subject: `Nueva demo agendada: ${nombre} - ${empresa || ''}`,
            html: emailHtml,
          }),
        });
      } catch (emailFetchErr) {
        console.error('Failed to send host notification email:', emailFetchErr);
      }
    }
  } catch (emailErr) {
    console.error('Host email notification failed:', emailErr);
  }

  // 10b. Send confirmation email to invitee
  try {
    const fechaDisplay = (() => {
      const [y, mo, d] = fecha.split('-').map(Number);
      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const dow = new Date(y, mo-1, d).getDay();
      return `${days[dow]} ${d} de ${months[mo-1]} ${y}`;
    })();
    const horaDisplay = (() => {
      const [h, m] = hora_inicio.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    })();

    const tokenData = { nombre, empresa, fecha: fechaDisplay, hora: horaDisplay, duracion: eventType.duracion_minutos, meet_link: google_meet_link || '' };
    const emailCfg = (eventType.routing_rules as any)?.emails?.confirmation || {};
    const emailSubject = replaceEmailTokens(emailCfg.subject || '✅ Tu demo con SACS está confirmada', tokenData);
    const emailHeading = replaceEmailTokens(emailCfg.heading || '¡Tu demo está confirmada!', tokenData);
    const emailBody = replaceEmailTokens(emailCfg.body || 'Hola {{nombre}}, tu reunión con SACS ha sido agendada.', tokenData);

    // Build extras: meeting details card, Meet link button, reschedule/cancel links
    let extrasHtml = '';

    // Meeting details card
    extrasHtml += `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;border-radius:10px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:8px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:100px;">📅 Fecha</td><td style="padding:6px 0;font-size:0.875rem;font-weight:700;color:#1A1A1A;">${fechaDisplay}</td></tr>
          <tr><td style="padding:6px 0;font-size:0.875rem;color:#999;">⏰ Hora</td><td style="padding:6px 0;font-size:0.875rem;font-weight:700;color:#1A1A1A;">${horaDisplay}</td></tr>
          <tr><td style="padding:6px 0;font-size:0.875rem;color:#999;">⏱ Duración</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${eventType.duracion_minutos} minutos</td></tr>
          ${(emailCfg.show_meet_link !== false) && google_meet_link ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;">📹 Link</td><td style="padding:6px 0;"><a href="${google_meet_link}" style="color:#4B7BE5;font-weight:600;text-decoration:none;">${google_meet_link}</a></td></tr>` : ''}
        </table>
      </td></tr>
    </table>`;

    // Meet link button
    if ((emailCfg.show_meet_link !== false) && google_meet_link) {
      extrasHtml += `<div style="text-align:center;margin-bottom:24px;"><a href="${google_meet_link}" style="display:inline-block;padding:14px 40px;background:#4B7BE5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9375rem;">Unirse a la reunión</a></div>`;
    }

    // Reschedule/cancel links
    const showReschedule = emailCfg.show_reschedule_link !== false;
    const showCancel = emailCfg.show_cancel_link !== false;
    if (showReschedule || showCancel) {
      extrasHtml += `<div style="text-align:center;margin-bottom:16px;">`;
      if (showReschedule) {
        extrasHtml += `<a href="https://www.sacscloud.com/api/scheduling/reschedule?token=${booking.token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>`;
      }
      if (showCancel) {
        extrasHtml += `<a href="https://www.sacscloud.com/api/scheduling/cancel?token=${booking.token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>`;
      }
      extrasHtml += `</div>`;
    }

    const inviteeEmailHtml = buildEmailHtml(emailHeading, emailBody, extrasHtml);

    await sendEmail(email, emailSubject, inviteeEmailHtml);
  } catch (inviteeEmailErr) {
    console.error('Invitee email notification failed:', inviteeEmailErr);
  }

  // 11. Send SMS/WhatsApp confirmation to invitee (Feature 11)
  if (whatsapp) {
    try {
      const [y, mo, d] = fecha.split('-').map(Number);
      const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const dateStr = `${d} ${months[mo - 1]} ${y}`;
      const [h, m] = hora_inicio.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;

      const meetLink = google_meet_link || '';
      const smsMessage = [
        `✅ *Demo confirmada con SACS*`,
        ``,
        `📅 ${dateStr} a las ${timeStr}`,
        `⏱ ${eventType.duracion_minutos} minutos`,
        meetLink ? `📹 ${meetLink}` : '',
        ``,
        `Para reagendar o cancelar:`,
        `https://www.sacscloud.com/api/scheduling/cancel?token=${booking.token_cancelar}`,
      ].filter(Boolean).join('\n');

      const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
      await fetch(`${baseUrl}/api/scheduling/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: whatsapp, message: smsMessage, channel: 'whatsapp' }),
      });
    } catch { /* WhatsApp confirmation is non-critical */ }
  }

  // 12. Log activity
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
      google_meet_link,
    },
    automatico: true,
  });

  // 12b. Auto-enroll in automations triggered by 'demo_agendada'
  try {
    const { data: activeAutomations } = await supabase
      .from('automations')
      .select('id, enrollment_triggers, suppression_stages, total_enrolled')
      .eq('estado', 'activo');

    for (const auto of (activeAutomations || [])) {
      const triggers = auto.enrollment_triggers || [];
      const shouldEnroll = triggers.some((t: any) => {
        if (t.type === 'lifecycle_stage_change' && t.config?.new_stage === 'lead_calificado') return true;
        if (t.type === 'lifecycle_stage_change' && t.config?.new_stage === 'oportunidad') return true;
        return false;
      });

      if (!shouldEnroll) continue;

      // Check suppression
      const contactStage = 'lead_calificado'; // booking sets this
      if (auto.suppression_stages?.includes(contactStage)) continue;

      // Check not already enrolled
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('automation_id', auto.id)
        .eq('contact_id', contact_id)
        .eq('estado', 'activo')
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      // Get first step
      const { data: firstStep } = await supabase
        .from('automation_steps')
        .select('id')
        .eq('automation_id', auto.id)
        .is('parent_step_id', null)
        .order('orden')
        .limit(1)
        .maybeSingle();

      if (firstStep) {
        await supabase.from('automation_enrollments').insert({
          automation_id: auto.id,
          contact_id,
          current_step_id: firstStep.id,
          next_action_at: new Date().toISOString(),
          enrollment_trigger: { type: 'booking_created', booking_id: booking.id },
        });

        await supabase.from('automations').update({
          total_enrolled: (auto.total_enrolled || 0) + 1,
        }).eq('id', auto.id);
      }
    }
  } catch (autoEnrollErr) {
    console.error('Auto-enrollment after booking failed:', autoEnrollErr);
  }

  // 13. Recurring bookings (Feature 21)
  let recurringBookings: Array<{ id: string; fecha: string; hora_inicio: string }> = [];
  if (recurrence && recurrence.frequency && recurrence.count > 1) {
    const seriesId = booking.id; // Use first booking as series anchor
    const intervalDays = recurrence.frequency === 'biweekly' ? 14 : 7;

    for (let i = 1; i < recurrence.count; i++) {
      const nextDate = new Date(fecha + 'T12:00:00');
      nextDate.setDate(nextDate.getDate() + (intervalDays * i));
      const nextDateStr = nextDate.toISOString().slice(0, 10);

      const recurToken = generateToken();

      const { data: recurBooking } = await supabase
        .from('bookings')
        .insert({
          event_type_id: eventType.id,
          host_id: assignedHostId,
          contact_id,
          deal_id,
          fecha: nextDateStr,
          hora_inicio,
          hora_fin,
          timezone_invitado: timezone || 'America/Mexico_City',
          timezone_host: 'America/Mexico_City',
          invitee_nombre: nombre,
          invitee_email: email,
          invitee_whatsapp: whatsapp || null,
          invitee_empresa: empresa || null,
          invitee_notas: `Recurrente ${i + 1}/${recurrence.count} (serie: ${seriesId})`,
          estado: 'confirmada',
          token_cancelar: recurToken,
          token_reagendar: generateToken(),
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
        })
        .select('id, fecha, hora_inicio')
        .single();

      if (recurBooking) {
        recurringBookings.push(recurBooking);

        // Create Google Calendar event for recurring booking
        try {
          const tz = timezone || 'America/Mexico_City';
          const startDT = `${nextDateStr}T${hora_inicio}:00`;
          const endDT = `${nextDateStr}T${hora_fin}:00`;
          const { data: hostMember } = await supabase
            .from('team_members')
            .select('email')
            .eq('id', assignedHostId)
            .single();

          await createCalendarEvent(assignedHostId, {
            summary: `${eventType.nombre} — ${nombre} (${empresa || ''}) [${i + 1}/${recurrence.count}]`,
            description: `Recurrente ${i + 1}/${recurrence.count}\nContacto: ${nombre}\nEmail: ${email}`,
            startDateTime: startDT,
            endDateTime: endDT,
            timezone: tz,
            attendeeEmail: email,
            hostEmail: hostMember?.email,
          });
        } catch { /* GCal for recurring is non-critical */ }
      }
    }

    // Log activity summarizing the series
    await supabase.from('activities').insert({
      contact_id,
      company_id,
      deal_id,
      tipo: 'sistema',
      titulo: `Serie recurrente creada: ${recurrence.count} sesiones ${recurrence.frequency === 'biweekly' ? 'quincenales' : 'semanales'}`,
      metadata: {
        series_id: seriesId,
        frequency: recurrence.frequency,
        count: recurrence.count,
        bookings: [booking.id, ...recurringBookings.map(b => b.id)],
      },
      automatico: true,
    });
  }

  // 14. Fire webhook
  fireSchedulingWebhooks('booking.created', { booking, contact_id, deal_id });

  // 15. Return booking with tokens and Meet link
  return new Response(
    JSON.stringify({
      booking: { ...booking, google_event_id, google_meet_link },
      cancel_url: `/api/scheduling/cancel?token=${booking.token_cancelar}`,
      reschedule_url: `/api/scheduling/reschedule?token=${booking.token_reagendar}`,
      google_meet_link,
      recurring_bookings: recurringBookings.length > 0 ? recurringBookings : undefined,
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

  // Check existing bookings
  const { data: dayBookings } = await supabase
    .from('bookings')
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
