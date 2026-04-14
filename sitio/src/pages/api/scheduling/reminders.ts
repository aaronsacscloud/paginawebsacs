import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const RESEND_API_KEY = (import.meta.env.RESEND_API_KEY || '').trim();

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
    .select('id, contact_id, deal_id, fecha, hora_inicio, nombre_invitado, whatsapp_invitado, email_invitado, google_meet_link, token_cancelar, token_reagendar, event_types(nombre)')
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
      if ((booking as any).whatsapp_invitado) {
        try {
          const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
          await fetch(`${baseUrl}/api/scheduling/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: (booking as any).whatsapp_invitado,
              message: `Recordatorio: Tu demo con SACS es mañana a las ${booking.hora_inicio}. ¡Te esperamos!`,
              channel: 'whatsapp',
            }),
          });
        } catch { /* SMS reminder is non-critical */ }
      }

      // Send email reminder (24h)
      if ((booking as any).email_invitado) {
        const reminderHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td style="background:#fff;padding:32px;border-radius:12px;border:1px solid #f0f0f0;">
    <h2 style="margin:0 0 8px;font-size:1.125rem;color:#1A1A1A;">⏰ Recordatorio: Tu demo es mañana</h2>
    <p style="color:#888;margin:0 0 16px;">Hola ${(booking as any).nombre_invitado}, te recordamos tu reunión con SACS.</p>
    <div style="background:#F8F9FB;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;font-size:0.875rem;"><strong>📅 ${booking.fecha}</strong> a las <strong>${booking.hora_inicio}</strong></p>
      ${(booking as any).google_meet_link ? `<p style="margin:8px 0 0;"><a href="${(booking as any).google_meet_link}" style="color:#4B7BE5;font-weight:600;">📹 Unirse a Google Meet</a></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="https://www.sacscloud.com/api/scheduling/reschedule?token=${(booking as any).token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>
      <a href="https://www.sacscloud.com/api/scheduling/cancel?token=${(booking as any).token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>
    </div>
  </td></tr>
</table>`;
        await sendEmail((booking as any).email_invitado, '⏰ Recordatorio: Tu demo con SACS es mañana', reminderHtml);
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
    .select('id, contact_id, deal_id, fecha, hora_inicio, nombre_invitado, whatsapp_invitado, email_invitado, google_meet_link, token_cancelar, token_reagendar, event_types(nombre)')
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
      if ((booking as any).whatsapp_invitado) {
        try {
          const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
          await fetch(`${baseUrl}/api/scheduling/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: (booking as any).whatsapp_invitado,
              message: `Recordatorio: Tu demo con SACS es hoy a las ${booking.hora_inicio}. ¡Te esperamos!`,
              channel: 'whatsapp',
            }),
          });
        } catch { /* SMS reminder is non-critical */ }
      }

      // Send email reminder (1h)
      if ((booking as any).email_invitado) {
        const reminderHtml1h = `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">
  <tr><td style="background:#fff;padding:32px;border-radius:12px;border:1px solid #f0f0f0;">
    <h2 style="margin:0 0 8px;font-size:1.125rem;color:#1A1A1A;">⏰ Tu demo con SACS empieza en 1 hora</h2>
    <p style="color:#888;margin:0 0 16px;">Hola ${(booking as any).nombre_invitado}, te recordamos tu reunión con SACS es hoy.</p>
    <div style="background:#F8F9FB;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;font-size:0.875rem;"><strong>📅 ${booking.fecha}</strong> a las <strong>${booking.hora_inicio}</strong></p>
      ${(booking as any).google_meet_link ? `<p style="margin:8px 0 0;"><a href="${(booking as any).google_meet_link}" style="color:#4B7BE5;font-weight:600;">📹 Unirse a Google Meet</a></p>` : ''}
    </div>
    <div style="text-align:center;">
      <a href="https://www.sacscloud.com/api/scheduling/reschedule?token=${(booking as any).token_reagendar}" style="color:#4B7BE5;font-size:0.8125rem;margin-right:16px;">Reagendar</a>
      <a href="https://www.sacscloud.com/api/scheduling/cancel?token=${(booking as any).token_cancelar}" style="color:#999;font-size:0.8125rem;">Cancelar</a>
    </div>
  </td></tr>
</table>`;
        await sendEmail((booking as any).email_invitado, '⏰ Tu demo con SACS empieza en 1 hora', reminderHtml1h);
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
