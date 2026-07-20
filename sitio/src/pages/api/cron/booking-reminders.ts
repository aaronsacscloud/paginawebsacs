// GET /api/cron/booking-reminders?key=... — corre CADA HORA (Vercel cron).
// Recordatorios anti no-show para reuniones confirmadas:
//   - EMAIL cuando faltan ~24 h (ventana [23h, 25h) para no perder ninguna
//     aunque el cron se salte una corrida), con botón de confirmar asistencia.
//   - WHATSAPP cuando falta ~1 h (ventana [1h, 2h)).
// Dedup por hito vía activities.metadata { booking_recordatorio, booking_id }
// (sin DDL: no necesitamos columnas nuevas).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { sendWhatsApp } from '../../../lib/kapso';

export const prerender = false;

const CRON_KEY = import.meta.env.CRM_CRON_KEY || 'sacs-cron-2026';
const BASE = 'https://www.sacscloud.com';
// México abolió el horario de verano: CDMX es UTC-6 fijo.
const MX_OFFSET_MS = 6 * 3600000;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtFecha(f: string) {
  const [y, m, d] = f.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}
function fmtHora(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

async function yaAvisado(bookingId: string, hito: string): Promise<boolean> {
  const { data } = await supabase.from('activities').select('id')
    .contains('metadata', { booking_recordatorio: hito, booking_id: bookingId })
    .limit(1).maybeSingle();
  return !!data;
}

async function marcarAvisado(b: any, hito: string, canal: string) {
  await supabase.from('activities').insert({
    tipo: 'sistema',
    titulo: `Recordatorio ${hito} enviado (${canal}): ${b.invitee_nombre} — ${b.fecha} ${b.hora_inicio}`,
    contact_id: b.contact_id || null,
    deal_id: b.deal_id || null,
    automatico: true,
    metadata: { booking_recordatorio: hito, booking_id: b.id, canal },
  }).select().maybeSingle();
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });

  const now = Date.now();
  const hoyMx = new Date(now - MX_OFFSET_MS).toISOString().slice(0, 10);
  const pasadoMx = new Date(now - MX_OFFSET_MS + 2 * 86400000).toISOString().slice(0, 10);

  // Solo confirmadas de hoy a pasado mañana (las ventanas 1h/24h caen ahí)
  const { data: bookings, error } = await supabase.from('bookings')
    .select('id, fecha, hora_inicio, estado, invitee_nombre, invitee_email, invitee_whatsapp, contact_id, deal_id, google_meet_link, token_cancelar, token_reagendar, event_types(nombre, duracion_minutos)')
    .eq('estado', 'confirmada')
    .gte('fecha', hoyMx).lte('fecha', pasadoMx);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const out = { revisadas: (bookings || []).length, email_24h: 0, whatsapp_1h: 0, errores: [] as string[] };

  for (const b of (bookings || []) as any[]) {
    try {
      if (!b.fecha || !b.hora_inicio) continue;
      const inicioMs = new Date(`${b.fecha}T${String(b.hora_inicio).slice(0, 5)}:00-06:00`).getTime();
      const faltaMs = inicioMs - now;
      if (faltaMs <= 0) continue;
      const evento = b.event_types?.nombre || 'Demo';

      // ── 24 h antes: email ──
      if (faltaMs >= 23 * 3600000 && faltaMs < 25 * 3600000 && b.invitee_email) {
        if (!(await yaAvisado(b.id, '24h'))) {
          const r = await notify({
            channel: 'email', to: b.invitee_email, template: 'booking_reminder',
            data: {
              nombre: b.invitee_nombre, evento, cuando: 'mañana',
              fecha: fmtFecha(b.fecha), hora: fmtHora(b.hora_inicio),
              duracion: b.event_types?.duracion_minutos,
              meet_link: b.google_meet_link || '',
              confirmar_url: b.token_cancelar ? `${BASE}/api/scheduling/confirm-attendance?token=${b.token_cancelar}` : '',
              reagendar_url: b.token_reagendar ? `${BASE}/agendar/reagendar?token=${b.token_reagendar}` : '',
            },
          });
          if (r.ok) { await marcarAvisado(b, '24h', 'email'); out.email_24h++; }
          else out.errores.push(`24h ${b.id}: ${r.reason}`);
        }
      }

      // ── 1 h antes: WhatsApp ──
      if (faltaMs >= 1 * 3600000 && faltaMs < 2 * 3600000 && b.invitee_whatsapp) {
        if (!(await yaAvisado(b.id, '1h'))) {
          const msg = [
            `⏰ *Tu ${evento} con SACS es en 1 hora*`,
            ``,
            `📅 Hoy a las ${fmtHora(b.hora_inicio)} (hora CDMX)`,
            b.google_meet_link ? `📹 ${b.google_meet_link}` : '',
            ``,
            `¿No alcanzas a llegar? Reagenda aquí:`,
            b.token_reagendar ? `${BASE}/agendar/reagendar?token=${b.token_reagendar}` : `${BASE}/agendar/cancelar?token=${b.token_cancelar}`,
          ].filter(Boolean).join('\n');
          const r = await sendWhatsApp(b.invitee_whatsapp, msg);
          if (r.sent) { await marcarAvisado(b, '1h', 'whatsapp'); out.whatsapp_1h++; }
          else out.errores.push(`1h ${b.id}: ${r.error || 'no enviado'}`);
        }
      }
    } catch (e: any) {
      out.errores.push(`${b.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
