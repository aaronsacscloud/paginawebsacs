import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { deleteCalendarEvent } from '../../../lib/google-calendar';
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

export const POST: APIRoute = async ({ request, url }) => {
  const body = await request.json();
  const isAdmin = url.searchParams.get('admin') === '1';

  const { booking_id, token, motivo, cancelado_por } = body;

  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id required' }), { status: 400 });
  }

  // Load booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, event_types(nombre, slug, routing_rules, duracion_minutos)')
    .eq('id', booking_id)
    .single();

  if (bErr || !booking) {
    return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
  }

  // Verify token (unless admin)
  if (!isAdmin) {
    if (!token || token !== booking.token_cancelar) {
      return new Response(JSON.stringify({ error: 'Invalid cancellation token' }), { status: 403 });
    }
  }

  // Check booking is still cancellable
  if (booking.estado !== 'confirmada') {
    return new Response(
      JSON.stringify({ error: `Booking cannot be cancelled (current status: ${booking.estado})` }),
      { status: 400 },
    );
  }

  // Update booking
  const { data: updated, error: upErr } = await supabase
    .from('bookings')
    .update({
      estado: 'cancelada',
      cancelacion_motivo: motivo || null,
      cancelado_por: cancelado_por || (isAdmin ? 'admin' : 'invitado'),
    })
    .eq('id', booking_id)
    .select()
    .single();

  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });

  // Delete Google Calendar event if exists
  if (booking.google_event_id && booking.host_id) {
    try {
      await deleteCalendarEvent(booking.host_id, booking.google_event_id);
    } catch {}
  }

  // Log activity
  if (booking.contact_id) {
    await supabase.from('activities').insert({
      contact_id: booking.contact_id,
      deal_id: booking.deal_id || null,
      tipo: 'demo_cancelada',
      titulo: `Demo cancelada: ${booking.event_types?.nombre || 'Demo'} - ${booking.fecha} ${booking.hora_inicio}`,
      metadata: {
        booking_id,
        motivo: motivo || null,
        cancelado_por: cancelado_por || (isAdmin ? 'admin' : 'invitado'),
      },
      automatico: true,
    });
  }

  // Fire webhook
  fireSchedulingWebhooks('booking.cancelled', { booking, motivo: motivo || null });

  // Check for waitlist entries on this date and notify
  try {
    const { data: waitlistEntries } = await supabase
      .from('activities')
      .select('*')
      .eq('tipo', 'sistema')
      .like('titulo', `Waitlist:%${booking.fecha}%`)
      .limit(10);

    if (waitlistEntries && waitlistEntries.length > 0) {
      for (const entry of waitlistEntries) {
        const meta = entry.metadata || {};
        if (!meta.waitlist) continue;

        // Log a system activity to flag the available space
        await supabase.from('activities').insert({
          contact_id: entry.contact_id || null,
          tipo: 'sistema',
          titulo: `Espacio disponible - notificar a ${meta.nombre || 'contacto'}`,
          metadata: {
            waitlist_notification: true,
            original_waitlist_id: entry.id,
            fecha: booking.fecha,
            event_type_slug: meta.event_type_slug,
            nombre: meta.nombre,
            email: meta.email,
            whatsapp: meta.whatsapp,
          },
          automatico: true,
        });
      }
    }
  } catch {
    // Waitlist check is non-critical
  }

  // Generate auto-rescheduling suggestions (Feature 25)
  let suggestions: Array<{ fecha: string; hora: string; url: string }> = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
    const eventSlug = booking.event_types?.slug || 'demo';

    const slotsRes = await fetch(
      `${baseUrl}/api/scheduling/available-slots?slug=${eventSlug}&from=${today}&to=${weekLater}&tz=America/Mexico_City`,
    );
    const slotsData = await slotsRes.json();

    if (slotsData.dates) {
      for (const [date, times] of Object.entries(slotsData.dates)) {
        for (const time of times as string[]) {
          if (suggestions.length >= 3) break;
          suggestions.push({
            fecha: date,
            hora: time,
            url: `${baseUrl}/agendar/${eventSlug}?date=${date}&time=${time}`,
          });
        }
        if (suggestions.length >= 3) break;
      }
    }
  } catch {
    // Suggestions are non-critical
  }

  // Include suggestions in SMS/WhatsApp notification if available
  if (suggestions.length > 0 && booking.invitee_whatsapp) {
    try {
      const baseUrl = import.meta.env.SITE || 'https://www.sacscloud.com';
      const suggestionsText = suggestions
        .map((s, i) => {
          const [, mo, d] = s.fecha.split('-').map(Number);
          const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
          const [h, m] = s.hora.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return `${i + 1}. ${d} ${months[mo - 1]} a las ${h12}:${String(m).padStart(2, '0')} ${ampm}\n   ${s.url}`;
        })
        .join('\n');

      const smsMessage = [
        `Tu reunion ha sido cancelada.`,
        ``,
        `Reagenda facilmente en uno de estos horarios:`,
        suggestionsText,
      ].join('\n');

      await fetch(`${baseUrl}/api/scheduling/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: booking.invitee_whatsapp,
          message: smsMessage,
          channel: 'whatsapp',
        }),
      });
    } catch { /* SMS is non-critical */ }
  }

  // Send cancellation email to invitee
  if (booking.invitee_email) {
    try {
      const emailCfgCancel = (booking.event_types as any)?.routing_rules?.emails?.cancellation || {};
      const tokenData = {
        nombre: booking.invitee_nombre || '',
        empresa: booking.invitee_empresa || '',
        fecha: booking.fecha,
        hora: booking.hora_inicio,
        duracion: (booking.event_types as any)?.duracion_minutos,
        meet_link: booking.google_meet_link || '',
      };
      const cancelSubject = replaceEmailTokens(emailCfgCancel.subject || 'Tu reunión con SACS ha sido cancelada', tokenData);
      const cancelHeading = replaceEmailTokens(emailCfgCancel.heading || 'Tu reunión ha sido cancelada', tokenData);
      const cancelBody = replaceEmailTokens(emailCfgCancel.body || 'La reunión del {{fecha}} a las {{hora}} ha sido cancelada.', tokenData);

      let extrasCancel = '';
      if (motivo) {
        extrasCancel += `<p style="color:#999;font-size:0.8125rem;">Motivo: ${motivo}</p>`;
      }

      // Only show suggestions if not explicitly disabled
      if (emailCfgCancel.show_suggestions !== false && suggestions.length > 0) {
        extrasCancel += `<p style="margin:16px 0 8px;font-size:0.875rem;color:#1A1A1A;font-weight:600;">¿Te gustaría reagendar?</p>
           <div style="display:flex;gap:8px;flex-wrap:wrap;">
           ${suggestions.map((s: any) => `<a href="${s.url}" style="display:inline-block;padding:8px 16px;background:#F8F9FB;border-radius:8px;color:#4B7BE5;text-decoration:none;font-size:0.8125rem;font-weight:600;border:1px solid #e0e0e0;">${s.fecha} ${s.hora}</a>`).join('')}
           </div>`;
      }

      const cancelHtml = buildEmailHtml(cancelHeading, cancelBody, extrasCancel);
      await sendEmail(booking.invitee_email, cancelSubject, cancelHtml);
    } catch { /* Cancellation email is non-critical */ }
  }

  return new Response(
    JSON.stringify({
      booking: updated,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }),
  );
};
