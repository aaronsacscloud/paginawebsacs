import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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

export const GET: APIRoute = async ({ url }) => {
  const key = url.searchParams.get('key');
  if (key !== 'sacs-cron-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const now = new Date();
  const stats = { reminders_24h: 0, reminders_1h: 0 };

  // ---------- 24h reminders ----------
  // Find bookings where fecha is tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: bookings24h } = await supabase
    .from('bookings')
    .select('id, contact_id, deal_id, fecha, hora_inicio, invitee_nombre, invitee_whatsapp, invitee_email, invitee_empresa, google_meet_link, token_cancelar, token_reagendar, event_types(nombre, routing_rules, duracion_minutos)')
    .eq('fecha', tomorrowStr)
    .eq('recordatorio_24h_enviado', false)
    .eq('estado', 'confirmada');

  if (bookings24h && bookings24h.length > 0) {
    for (const booking of bookings24h) {
      // Log activity
      if (booking.contact_id) {
        await supabase.from('activities').insert({
          contact_id: booking.contact_id,
          deal_id: booking.deal_id || null,
          tipo: 'sistema',
          titulo: `Recordatorio 24h enviado: ${(booking.event_types as { nombre: string } | null)?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
          metadata: {
            booking_id: booking.id,
            reminder_type: '24h',
          },
          automatico: true,
        });
      }

      // Set flag
      await supabase
        .from('bookings')
        .update({ recordatorio_24h_enviado: true })
        .eq('id', booking.id);

      // Send SMS/WhatsApp reminder (Feature 11)
      if ((booking as any).invitee_whatsapp) {
        try {
          const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
          await fetch(`${baseUrl}/api/kapso/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: (booking as any).invitee_whatsapp,
              message: `Recordatorio: Tu demo con SACS es mañana a las ${booking.hora_inicio}. ¡Te esperamos!`,
              channel: 'whatsapp',
            }),
          });
        } catch { /* SMS reminder is non-critical */ }
      }

      // Send email reminder (24h)
      if ((booking as any).invitee_email) {
        const emailCfg24 = (booking.event_types as any)?.routing_rules?.emails?.reminder_24h;
        // Skip if explicitly disabled
        if (emailCfg24?.enabled !== false) {
          const tokenData = {
            nombre: (booking as any).invitee_nombre || '',
            empresa: (booking as any).invitee_empresa || '',
            fecha: booking.fecha,
            hora: booking.hora_inicio,
            duracion: (booking.event_types as any)?.duracion_minutos,
            meet_link: (booking as any).google_meet_link || '',
          };
          const subject24 = replaceEmailTokens(emailCfg24?.subject || '⏰ Recordatorio: Tu demo con SACS es mañana', tokenData);
          const heading24 = replaceEmailTokens(emailCfg24?.heading || '⏰ Recordatorio: Tu demo es mañana', tokenData);
          const body24 = replaceEmailTokens(emailCfg24?.body || 'Hola {{nombre}}, te recordamos tu reunión con SACS.', tokenData);

          let extras24 = `
    <div style="background:#F8F9FB;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;font-size:0.875rem;"><strong>📅 ${booking.fecha}</strong> a las <strong>${booking.hora_inicio}</strong></p>
      ${(booking as any).google_meet_link ? `<p style="margin:8px 0 0;"><a href="${(booking as any).google_meet_link}" style="color:#4B7BE5;font-weight:600;">📹 Unirse a Google Meet</a></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="https://www.sacscloud.com/agendar/reagendar?token=${(booking as any).token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>
      <a href="https://www.sacscloud.com/agendar/cancelar?token=${(booking as any).token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>
    </div>`;

          const reminderHtml = buildEmailHtml(heading24, body24, extras24);
          await sendEmail((booking as any).invitee_email, subject24, reminderHtml);
        }
      }

      stats.reminders_24h++;
    }
  }

  // ---------- 1h reminders ----------
  // Find bookings where fecha is today and hora_inicio is within next 75 minutes
  const todayStr = now.toISOString().slice(0, 10);

  // Get current time in HH:MM and calculate window
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;
  const windowEndMinutes = currentMinutes + 75;

  const windowStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
  const windowEnd = `${String(Math.floor(windowEndMinutes / 60)).padStart(2, '0')}:${String(windowEndMinutes % 60).padStart(2, '0')}`;

  const { data: bookings1h } = await supabase
    .from('bookings')
    .select('id, contact_id, deal_id, fecha, hora_inicio, invitee_nombre, invitee_whatsapp, invitee_email, invitee_empresa, google_meet_link, token_cancelar, token_reagendar, event_types(nombre, routing_rules, duracion_minutos)')
    .eq('fecha', todayStr)
    .eq('recordatorio_1h_enviado', false)
    .eq('estado', 'confirmada')
    .gte('hora_inicio', windowStart)
    .lte('hora_inicio', windowEnd);

  if (bookings1h && bookings1h.length > 0) {
    for (const booking of bookings1h) {
      // Log activity
      if (booking.contact_id) {
        await supabase.from('activities').insert({
          contact_id: booking.contact_id,
          deal_id: booking.deal_id || null,
          tipo: 'sistema',
          titulo: `Recordatorio 1h enviado: ${(booking.event_types as { nombre: string } | null)?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
          metadata: {
            booking_id: booking.id,
            reminder_type: '1h',
          },
          automatico: true,
        });
      }

      // Set flag
      await supabase
        .from('bookings')
        .update({ recordatorio_1h_enviado: true })
        .eq('id', booking.id);

      // Send SMS/WhatsApp reminder (Feature 11)
      if ((booking as any).invitee_whatsapp) {
        try {
          const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
          await fetch(`${baseUrl}/api/kapso/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: (booking as any).invitee_whatsapp,
              message: `Recordatorio: Tu demo con SACS es hoy a las ${booking.hora_inicio}. ¡Te esperamos!`,
              channel: 'whatsapp',
            }),
          });
        } catch { /* SMS reminder is non-critical */ }
      }

      // Send email reminder (1h)
      if ((booking as any).invitee_email) {
        const emailCfg1h = (booking.event_types as any)?.routing_rules?.emails?.reminder_1h;
        // Skip if explicitly disabled
        if (emailCfg1h?.enabled !== false) {
          const tokenData1h = {
            nombre: (booking as any).invitee_nombre || '',
            empresa: (booking as any).invitee_empresa || '',
            fecha: booking.fecha,
            hora: booking.hora_inicio,
            duracion: (booking.event_types as any)?.duracion_minutos,
            meet_link: (booking as any).google_meet_link || '',
          };
          const subject1h = replaceEmailTokens(emailCfg1h?.subject || '⏰ Tu demo con SACS empieza en 1 hora', tokenData1h);
          const heading1h = replaceEmailTokens(emailCfg1h?.heading || '⏰ Tu demo con SACS empieza en 1 hora', tokenData1h);
          const body1h = replaceEmailTokens(emailCfg1h?.body || 'Hola {{nombre}}, te recordamos tu reunión con SACS es hoy.', tokenData1h);

          let extras1h = `
    <div style="background:#F8F9FB;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;font-size:0.875rem;"><strong>📅 ${booking.fecha}</strong> a las <strong>${booking.hora_inicio}</strong></p>
      ${(booking as any).google_meet_link ? `<p style="margin:8px 0 0;"><a href="${(booking as any).google_meet_link}" style="color:#4B7BE5;font-weight:600;">📹 Unirse a Google Meet</a></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="https://www.sacscloud.com/agendar/reagendar?token=${(booking as any).token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>
      <a href="https://www.sacscloud.com/agendar/cancelar?token=${(booking as any).token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>
    </div>`;

          const reminderHtml1h = buildEmailHtml(heading1h, body1h, extras1h);
          await sendEmail((booking as any).invitee_email, subject1h, reminderHtml1h);
        }
      }

      stats.reminders_1h++;
    }
  }

  // ---------- 3. Auto-detect no-shows ----------
  // Bookings that ended 2+ hours ago still marked as confirmada
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const noShowDate = twoHoursAgo.toISOString().slice(0, 10);
  const noShowTime = twoHoursAgo.toISOString().slice(11, 16);

  const { data: potentialNoShows } = await supabase
    .from('bookings')
    .select('id, contact_id, deal_id, host_id, fecha, hora_fin, event_types(nombre)')
    .eq('estado', 'confirmada')
    .lte('fecha', noShowDate);

  let noShowCount = 0;
  for (const booking of (potentialNoShows || [])) {
    // Check if meeting ended 2+ hours ago
    if (booking.fecha < noShowDate || (booking.fecha === noShowDate && booking.hora_fin <= noShowTime)) {
      // Mark as no_show
      await supabase.from('bookings').update({ estado: 'no_show' }).eq('id', booking.id);

      // Log activity
      if (booking.contact_id) {
        await supabase.from('activities').insert({
          contact_id: booking.contact_id,
          deal_id: booking.deal_id,
          tipo: 'demo_no_show',
          titulo: `No show: ${(booking.event_types as any)?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_fin}`,
          metadata: { booking_id: booking.id, auto_detected: true },
          automatico: true,
        });
      }

      noShowCount++;
    }
  }

  return new Response(JSON.stringify({ ...stats, no_shows_detected: noShowCount }));
};
