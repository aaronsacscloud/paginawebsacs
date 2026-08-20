import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { medirConversionEnSegundoPlano } from '../../../lib/openai-conversions';
import { capturarEnServidor } from '../../../lib/posthog';
import { supabase } from '../../../lib/supabase';
import { createCalendarEvent } from '../../../lib/google-calendar';
import { fireSchedulingWebhooks } from '../../../lib/scheduling-webhooks';
import { escapeHtml } from '../../../lib/scheduling/email-utils';
import { sendWhatsApp } from '../../../lib/kapso';
import { resolverAtribucion, columnasUtm, bloqueAtribucion, resumenAtribucion } from '../../../lib/atribucion-marketing';
import { notificar } from '../../../lib/crm/notificaciones';
import { origenDe, origenDeRegistro } from '../../../lib/crm/origenes';

export const prerender = false;

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();
const SHEET_ID = (import.meta.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

function getSheetsAuth() {
  const b64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
  if (!b64) return null;
  try {
    const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    return new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch { return null; }
}

async function appendBookingToSheet(data: {
  nombre: string;
  empresa?: string;
  email: string;
  whatsapp?: string;
  giro?: string;
  sucursales?: number;
  fecha: string;
  hora_inicio: string;
  event_type: string;
}) {
  if (!SHEET_ID) return;
  const auth = getSheetsAuth();
  if (!auth) return;
  const sheets = google.sheets({ version: 'v4', auth });
  const now = new Date();
  const fechaRegistro = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaRegistro = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
  const row = [
    fechaRegistro,
    horaRegistro,
    data.nombre || '',
    data.empresa || '',
    data.email || '',
    data.whatsapp || '',
    data.giro || '',
    String(data.sucursales || ''),
    `Demo ${data.fecha} ${data.hora_inicio}`,
    `📅 BOOKING-${(data.event_type || 'demo').toUpperCase()}`,
    '',
    '',
    '',
    '',
    '',
    '',
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Leads!A:P',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

function replaceEmailTokens(text: string, data: { nombre?: string; empresa?: string; fecha?: string; hora?: string; duracion?: number; meet_link?: string }): string {
  // TODOS escapados. Este correo va HACIA AFUERA, a la dirección que puso quien
  // llenó el formulario, con el membrete y el dominio de envío de SACS: sin
  // escapar, un `nombre` con HTML deja mandar un correo arbitrario con la
  // apariencia de SACS a quien el atacante quiera. `reschedule.ts` y `cancel.ts`
  // ya tenían esta misma función CON escapeHtml; aquí faltaba.
  return (text || '')
    .replace(/\{\{nombre\}\}/g, escapeHtml(data.nombre || ''))
    .replace(/\{\{empresa\}\}/g, escapeHtml(data.empresa || ''))
    .replace(/\{\{fecha\}\}/g, escapeHtml(data.fecha || ''))
    .replace(/\{\{hora\}\}/g, escapeHtml(data.hora || ''))
    .replace(/\{\{duracion\}\}/g, String(data.duracion || 30))
    .replace(/\{\{meet_link\}\}/g, escapeHtml(data.meet_link || ''));
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

/**
 * Qué tan caliente llega. Agendar una demo es la señal más fuerte que da el
 * sitio, así que arranca alto; lo demás afina. Nunca BAJA el puntaje que ya
 * tenía el contacto: un lead que ya venía calificado no se degrada por volver
 * a agendar con menos datos.
 */
function puntajeDeDemo(d: { whatsapp?: any; empresa?: any; giro?: any; sucursales?: any }): number {
  let p = 40;
  if (d.whatsapp) p += 10;
  if (d.empresa) p += 10;
  if (d.giro) p += 5;
  const suc = parseInt(String(d.sucursales || '')) || 0;
  if (suc >= 5) p += 20;
  else if (suc >= 2) p += 10;
  return Math.min(p, 100);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

import { randomBytes } from 'node:crypto';

// CSPRNG-backed token (Math.random was predictable enough to brute-force
// tokens of cancel/reschedule sin rate limit). 24 bytes = 192 bits → 32-char
// base64url, mismo "shape" que el legacy pero criptográficamente seguro.
function generateToken(): string {
  return randomBytes(24).toString('base64url');
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
  // Sin catch, un body malformado (o un Content-Type equivocado) tiraba el
  // endpoint con 500 en vez de decir que la petición venía mal.
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la petición inválido.' }), { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: 'Cuerpo de la petición inválido.' }), { status: 400 });
  }

  const {
    event_type_slug,
    fecha,
    hora_inicio,
    nombre,
    email: emailCrudo,
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
    ref_partner_id,
  } = body;

  // El correo se NORMALIZA una vez y todo lo de abajo hereda el normalizado.
  // Antes se validaba con `.trim()` pero se guardaba y se buscaba CRUDO: " a@x.com "
  // pasaba la validación, `.eq('email', email)` no encontraba al contacto
  // existente y se creaba un duplicado, y Resend rechazaba el destinatario con
  // espacios. Y como la búsqueda distinguía mayúsculas, "Juan@X.com" fallaba el
  // lookup y luego violaría el índice `contacts_email_uniq on lower(email)` que
  // este mismo flujo necesita.
  const email = String(emailCrudo ?? '').trim().toLowerCase();

  // Resolve partner attribution: prefer body field, fallback a cookie/?ref
  const { getReferrerFromBody } = await import('../../../lib/attribution');
  const referrerPartnerId = await getReferrerFromBody(request, ref_partner_id);

  // De dónde venía: body (el widget ya resolvió el caso del iframe) → cookie
  // sacs_attr → utm_* sueltos. Ver src/lib/atribucion-marketing.ts.
  const atribucion = resolverAtribucion(request, body);
  const utm = columnasUtm(atribucion);
  // Cita nacida de una campaña in-app de Outbound (formato "agenda"): el modal
  // de SACS3 arma la URL del embed con ?oc=<campana_id> y BookingPage lo
  // reenvía en el body. Pisa las utm para que la correlación campaña↔cita sea
  // determinista (uuid validado; cualquier otra cosa se ignora).
  const oc = String((body as any).oc || '');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(oc)) {
    utm.utm_source = 'outbound_inapp';
    utm.utm_medium = 'inapp';
    utm.utm_campaign = oc;
  }
  const bloqueAttr = bloqueAtribucion(atribucion, request);
  const puntaje = puntajeDeDemo({ whatsapp, empresa, giro, sucursales });

  if (!event_type_slug || !fecha || !hora_inicio || !nombre || !email) {
    return new Response(
      JSON.stringify({ error: 'event_type_slug, fecha, hora_inicio, nombre, and email are required' }),
      { status: 400 },
    );
  }

  // Los campos venían solo comprobados por truthiness. Dos consecuencias reales:
  // un `email` que no es texto llegaba a `.eq()` como "[object Object]", y un
  // email como "x" creaba contacto, Oportunidad y reunión sin forma de avisarle
  // a nadie. Sin tope de longitud, además, cabía un texto arbitrariamente largo
  // en el correo al vendedor y en la ficha del CRM.
  // `email` ya es texto normalizado (línea de arriba), así que basta el formato.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return new Response(JSON.stringify({ error: 'El correo no tiene un formato válido.' }), { status: 400 });
  }
  if (typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.length > 200) {
    return new Response(JSON.stringify({ error: 'El nombre es obligatorio.' }), { status: 400 });
  }
  if (notas != null && (typeof notas !== 'string' || notas.length > 5000)) {
    return new Response(JSON.stringify({ error: 'Las notas son demasiado largas.' }), { status: 400 });
  }
  if (answers != null && (!Array.isArray(answers) || answers.length > 50 ||
      // OJO con la condición: comprobar `typeof valor === 'string' && length > N`
      // deja pasar cualquier `valor` que NO sea texto (un objeto de 10 MB), o sea
      // que el tope era opcional para quien quisiera saltárselo. Se exige texto.
      answers.some((a: any) => typeof a?.valor !== 'string' || a.valor.length > 2000))) {
    return new Response(JSON.stringify({ error: 'Las respuestas del formulario no son válidas.' }), { status: 400 });
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
  let isNewContact = false;

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, lifecycle_stage, referrer_partner_id, whatsapp, giro, sucursales_interes, utm_source, utm_medium, utm_campaign, propiedades, lead_score, visitor_id, fuente_detalle')
    .eq('email', email)
    .limit(1)
    .single();

  if (existingContact) {
    contact_id = existingContact.id;

    // Update lifecycle if currently lower, y atribuir partner si aún no tiene
    const currentIdx = LIFECYCLE_ORDER.indexOf(existingContact.lifecycle_stage || 'lead');
    const targetIdx = LIFECYCLE_ORDER.indexOf('lead_calificado');
    const updates: Record<string, any> = {};
    if (currentIdx < targetIdx) updates.lifecycle_stage = 'lead_calificado';
    if (referrerPartnerId && !existingContact.referrer_partner_id) {
      updates.referrer_partner_id = referrerPartnerId;
      updates.fuente = 'partner-link';
    }

    // Enriquecer: SOLO lo que venía vacío. Quien ya agendó una vez suele
    // volver con menos datos (el formulario recuerda poco), y pisar el giro o
    // el whatsapp buenos con un campo en blanco es peor que no actualizar.
    if (!existingContact.whatsapp && whatsapp) updates.whatsapp = whatsapp;
    if (!existingContact.giro && giro) updates.giro = giro;
    if (!existingContact.sucursales_interes && sucursales) {
      const n = parseInt(String(sucursales));
      if (Number.isFinite(n)) updates.sucursales_interes = n;
    }
    if (!existingContact.utm_source && utm.utm_source) {
      updates.utm_source = utm.utm_source;
      updates.utm_medium = utm.utm_medium;
      updates.utm_campaign = utm.utm_campaign;
    }
    if (!existingContact.visitor_id && atribucion?.vid) updates.visitor_id = atribucion.vid;
    if (!existingContact.fuente_detalle && bloqueAttr.primer_toque?.landing) {
      updates.fuente_detalle = bloqueAttr.primer_toque.landing;
    }
    // La atribución completa se conserva la PRIMERA vez que se conoce: es el
    // origen del lead, no el de su última visita.
    const propsPrev = (existingContact.propiedades && typeof existingContact.propiedades === 'object')
      ? existingContact.propiedades as Record<string, any>
      : {};
    if (!propsPrev.atribucion && (bloqueAttr.primer_toque || bloqueAttr.ultimo_toque)) {
      updates.propiedades = { ...propsPrev, atribucion: bloqueAttr };
    }
    const puntajePrev = Number(existingContact.lead_score) || 0;
    if (puntaje > puntajePrev) updates.lead_score = puntaje;

    if (Object.keys(updates).length > 0) {
      await supabase.from('contacts').update(updates).eq('id', contact_id);
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
        fuente: referrerPartnerId ? 'partner-link' : 'booking-page',
        fuente_detalle: bloqueAttr.primer_toque?.landing || null,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        giro: giro || null,
        sucursales_interes: parseInt(String(sucursales)) || null,
        referrer_partner_id: referrerPartnerId,
        visitor_id: atribucion?.vid || null,
        page_count: atribucion?.n || null,
        lead_score: puntaje,
        propiedades: { atribucion: bloqueAttr },
      })
      .select('id')
      .single();

    if (cErr) {
      // El mensaje crudo de Postgres nombra columnas y constraints: al log del
      // servidor, no al navegador de un visitante anónimo.
      console.error('[book] no se pudo crear el contacto:', cErr.message);
      return new Response(
        JSON.stringify({ error: 'No pudimos registrar tus datos. Intenta de nuevo en un momento.' }),
        { status: 500 },
      );
    }
    contact_id = newContact.id;
    isNewContact = true;
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
      referrer_partner_id: referrerPartnerId,
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
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      // Sin esto la reunión no se ligaba a la empresa aunque el contacto sí:
      // el tab Reuniones y la ficha del cliente perdían las demos públicas.
      company_id,
      atribucion: bloqueAttr,
      referrer_partner_id: referrerPartnerId,
    })
    .select()
    .single();

  if (bookErr) {
    // El borrado va PRIMERO, antes de cualquier `return`. La Oportunidad se crea
    // en el paso 6 y la reserva en el 7, así que TODO fallo de la reserva la deja
    // huérfana en etapa `demo_agendada` — incluido el 409 por horario duplicado,
    // que además va a volverse el camino MÁS común en cuanto exista el índice
    // único `bookings_slot_uniq` (hoy no existe: `bookings` solo tiene su llave
    // primaria e índices no únicos, así que la rama del 23505 es letra muerta).
    // Tenerlo después del `return` del 409 era arreglar el caso raro y dejar el
    // frecuente.
    if (deal_id) {
      const { error: delErr } = await supabase.from('deals').delete().eq('id', deal_id);
      if (delErr) console.error('[book] quedó una Oportunidad huérfana ' + deal_id + ':', delErr.message);
    }

    if (bookErr.code === '23505') {
      return new Response(
        JSON.stringify({ error: 'Este horario ya fue reservado. Por favor selecciona otro.' }),
        { status: 409 },
      );
    }
    console.error('[book] no se pudo crear la reserva:', bookErr.message);
    return new Response(
      JSON.stringify({ error: 'No pudimos confirmar tu horario. Intenta de nuevo en un momento.' }),
      { status: 500 },
    );
  }


  // OpenAI Conversions API: la demo quedó CONFIRMADA en base.
  // El id es el de la reserva —no un aleatorio— para que si el pixel del
  // navegador reporta la misma cita, OpenAI las una en vez de contarlas dos veces.
  medirConversionEnSegundoPlano({
    id: `booking-${booking.id}`,
    tipo: 'appointment_scheduled',
    sourceUrl: 'https://www.sacscloud.com/agendar',
  });

  // PostHog: el final del embudo. Se identifica por CORREO a proposito — asi
  // esta conversion se pega a toda la navegacion anonima previa de la misma
  // persona y se puede ver por donde entro y que leyo antes de agendar.
  // El agendador vive en un iframe, asi que desde el navegador no hay forma de
  // saber que la cita quedo: tiene que medirse aqui.
  void capturarEnServidor('demo_agendada', email, {
    booking_id: booking.id,
    tipo_evento: event_type_slug,
    fecha,
  });

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
          ${answers.map((a: { question_id: string; valor: string }) => `<tr><td style="padding:4px 0;font-size:0.875rem;color:#555;">${escapeHtml(a.valor)}</td></tr>`).join('')}
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
            <td style="padding:6px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${escapeHtml(nombre)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Email</td>
            <td style="padding:6px 0;font-size:0.875rem;color:#555;">${escapeHtml(email)}</td>
          </tr>
          ${whatsapp ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">WhatsApp</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${escapeHtml(whatsapp)}</td></tr>` : ''}
          ${empresa ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Empresa</td><td style="padding:6px 0;font-size:0.875rem;font-weight:600;color:#1A1A1A;">${escapeHtml(empresa)}</td></tr>` : ''}
          ${giro ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Giro</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${escapeHtml(giro)}</td></tr>` : ''}
          ${sucursales ? `<tr><td style="padding:6px 0;font-size:0.875rem;color:#999;width:110px;">Sucursales</td><td style="padding:6px 0;font-size:0.875rem;color:#555;">${escapeHtml(sucursales)}</td></tr>` : ''}
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

    ${notas ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="padding:0 0 4px 0;font-size:0.6875rem;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;">Notas del invitado</td></tr><tr><td style="padding:4px 0;font-size:0.875rem;color:#555;font-style:italic;">${escapeHtml(notas)}</td></tr></table>` : ''}
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
    <a href="https://www.sacscloud.com/admin/crm?tab=agenda" style="display:inline-block;padding:12px 32px;background:#4B7BE5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ver en CRM</a>
  </td></tr>
</table>`;

      // Envío interno de correo IN-PROCESS (usa la función local sendEmail, ya
      // no el endpoint HTTP público que ahora exige sesión).
      try {
        await sendEmail(
          hostEmail,
          `Nueva demo agendada: ${String(nombre || '').replace(/[\r\n]/g, ' ').slice(0, 80)} - ${String(empresa || '').replace(/[\r\n]/g, ' ').slice(0, 80)}`,
          emailHtml,
        );
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

    // Confirm attendance button
    extrasHtml += `<div style="text-align:center;margin-bottom:20px;"><a href="https://www.sacscloud.com/api/scheduling/confirm-attendance?token=${booking.token_cancelar}" style="display:inline-block;padding:12px 32px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.875rem;">Confirmar mi asistencia</a></div>`;

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
        extrasHtml += `<a href="https://www.sacscloud.com/agendar/reagendar?token=${booking.token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>`;
      }
      if (showCancel) {
        extrasHtml += `<a href="https://www.sacscloud.com/agendar/cancelar?token=${booking.token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>`;
      }
      extrasHtml += `</div>`;
    }

    const inviteeEmailHtml = buildEmailHtml(emailHeading, emailBody, extrasHtml);

    await sendEmail(email, emailSubject, inviteeEmailHtml);
  } catch (inviteeEmailErr) {
    console.error('Invitee email notification failed:', inviteeEmailErr);
  }

  // 10b. Notify host (partner o founder) — email con detalles de la nueva cita
  // y links a su portal para gestionarla.
  try {
    const { data: hostMember } = await supabase
      .from('team_members')
      .select('email, nombre, rol')
      .eq('id', assignedHostId)
      .maybeSingle();

    if (hostMember?.email) {
      const [y, mo, d] = fecha.split('-').map(Number);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const hostDateStr = `${d} ${months[mo - 1]} ${y}`;
      const [hh, mm] = hora_inicio.split(':').map(Number);
      const hostAmpm = hh >= 12 ? 'PM' : 'AM';
      const hostH12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      const hostTimeStr = `${hostH12}:${String(mm).padStart(2, '0')} ${hostAmpm}`;

      const portalUrl = hostMember.rol === 'partner'
        ? 'https://www.sacscloud.com/partner/portal#agenda'
        : 'https://www.sacscloud.com/admin/crm?tab=agenda';

      // Subject va a SMTP envelope — no es HTML, pero saneamos newlines para
      // evitar header injection.
      const safeName = String(nombre || '').replace(/[\r\n]/g, ' ').slice(0, 80);
      const hostSubject = `🗓️ Nueva cita: ${safeName} · ${hostDateStr} ${hostTimeStr}`;
      const hostBody = `Tienes una nueva cita agendada. Aquí están los detalles:`;
      const whatsappDigits = String(whatsapp || '').replace(/\D/g, '');
      const meetLink = google_meet_link && /^https?:\/\//.test(google_meet_link) ? google_meet_link : '';
      const portalUrlSafe = /^https?:\/\//.test(portalUrl) ? portalUrl : '#';
      const hostExtras = `
        <div style="background:#fafbfd;border:1px solid #e8eaf0;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:0.875rem;color:#1a1a1a;line-height:1.7;">
            <strong style="color:#4B7BE5;">${escapeHtml(eventType.nombre)}</strong><br/>
            <strong>${escapeHtml(hostDateStr)}</strong> a las <strong>${escapeHtml(hostTimeStr)}</strong> (${escapeHtml(eventType.duracion_minutos)} min)
          </div>
        </div>
        <div style="font-size:0.875rem;line-height:1.7;margin-bottom:16px;color:#1a1a1a;">
          <strong>Cliente:</strong> ${escapeHtml(nombre)}<br/>
          <strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#4B7BE5;">${escapeHtml(email)}</a>${whatsapp ? `<br/><strong>WhatsApp:</strong> <a href="https://wa.me/${escapeHtml(whatsappDigits)}" style="color:#25D366;">${escapeHtml(whatsapp)}</a>` : ''}${empresa ? `<br/><strong>Empresa:</strong> ${escapeHtml(empresa)}` : ''}
        </div>
        ${meetLink ? `<div style="margin-bottom:16px;"><a href="${escapeHtml(meetLink)}" style="background:#1A73E8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:0.875rem;font-weight:600;display:inline-block;">Abrir Google Meet</a></div>` : ''}
        <div style="text-align:center;margin-top:20px;">
          <a href="${escapeHtml(portalUrlSafe)}" style="color:#4B7BE5;font-size:0.8125rem;">Ver en tu portal →</a>
        </div>
      `;
      const hostEmailHtml = buildEmailHtml('Nueva cita confirmada', hostBody, hostExtras);
      await sendEmail(hostMember.email, hostSubject, hostEmailHtml);
    }
  } catch (hostEmailErr) {
    console.error('Host email notification failed:', hostEmailErr);
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
        `https://www.sacscloud.com/agendar/cancelar?token=${booking.token_cancelar}`,
      ].filter(Boolean).join('\n');

      await sendWhatsApp(whatsapp, smsMessage);
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

  // 12a. Avisar en la campana del CRM.
  //
  // Hasta ahora agendar una demo solo mandaba correo al host: si esa cuenta no
  // se revisaba, la demo existía en la base y en el calendario pero nadie del
  // equipo se enteraba. La campana ya es donde se mira lo que pasó solo.
  try {
    const origenLead = origenDe(origenDeRegistro({
      utm_source: utm.utm_source,
      fuente: referrerPartnerId ? 'partner-link' : 'booking-page',
    }));
    const detalles = [
      `${fecha} ${hora_inicio}`,
      giro || null,
      sucursales ? `${sucursales} sucursales` : null,
      email,
    ].filter(Boolean).join(' · ');

    await notificar({
      clave: `demo_agendada:${booking.id}`,
      tipo: 'demo_agendada',
      nivel: 'info',
      titulo: `Demo agendada — ${empresa || nombre} (${resumenAtribucion(atribucion)})`,
      detalle: detalles,
      company_id,
      destino: 'reuniones',
      metadata: {
        booking_id: booking.id,
        contact_id,
        deal_id,
        event_type: eventType.slug,
        origen: origenLead.v || null,
        origen_label: origenLead.l,
        atribucion: bloqueAttr,
      },
    });
  } catch { /* avisar es efecto secundario: nunca tumba la reserva */ }

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
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          company_id,
          atribucion: bloqueAttr,
          referrer_partner_id: referrerPartnerId,
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

  // 13b. Google Sheets backup (fire-and-forget, marcado como BOOKING)
  try {
    await appendBookingToSheet({
      nombre,
      empresa,
      email,
      whatsapp,
      giro,
      sucursales: typeof sucursales === 'number' ? sucursales : parseInt(sucursales || '') || undefined,
      fecha,
      hora_inicio,
      event_type: eventType.slug,
    });
  } catch (sheetErr) {
    console.error('Google Sheets booking log failed:', sheetErr);
  }

  // 14. Fire webhook
  fireSchedulingWebhooks('booking.created', { booking, contact_id, deal_id });

  // 15. Return booking with tokens and Meet link
  return new Response(
    JSON.stringify({
      booking: { ...booking, google_event_id, google_meet_link },
      cancel_url: `/agendar/cancelar?token=${booking.token_cancelar}`,
      reschedule_url: `/agendar/reagendar?token=${booking.token_reagendar}`,
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
