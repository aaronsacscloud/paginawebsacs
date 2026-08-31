// GET /api/cron/booking-reminders — corre CADA 5 MINUTOS (Vercel cron).
//
// Los recordatorios ya NO están escritos aquí. Cada tipo de reunión trae su
// lista en `event_types.recordatorios` y este cron solo la ejecuta: la
// política es del negocio y se cambia desde la pantalla, no desplegando.
//
// POR QUÉ CADA 5 MINUTOS y no cada hora: se pidió un recordatorio de 10
// minutos antes. Con una corrida por hora es imposible — la reunión empieza
// antes de que el cron vuelva a mirar. La ventana de disparo es de 6 minutos
// (una corrida + margen), así que ninguno se cae entre dos corridas.
//
// El anti-duplicado va por hito en `activities.metadata`
// { booking_recordatorio, booking_id, canal }: sobrevive a reintentos, a dos
// corridas encimadas y a un redeploy a media hora.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { sendWhatsApp } from '../../../lib/kapso';
import {
  MX_OFFSET_MS, aMinutos, etiqueta, leerRecordatorios, inicioMs,
  textoWhatsApp, datosEmail,
} from '../../../lib/scheduling/recordatorios';

export const prerender = false;

/** Ancho de la ventana: la corrida (5 min) más un minuto de margen. */
const VENTANA_MIN = 6;

async function yaAvisado(bookingId: string, hito: string, canal: string): Promise<boolean> {
  const { data } = await supabase.from('activities').select('id')
    .contains('metadata', { booking_recordatorio: hito, booking_id: bookingId, canal })
    .limit(1);
  return !!(data && data.length);
}

async function marcarAvisado(b: any, hito: string, canal: string, cuanto: string) {
  await supabase.from('activities').insert({
    tipo: 'sistema',
    titulo: `Recordatorio de ${cuanto} antes enviado por ${canal}: ${b.invitee_nombre} — ${b.fecha} ${b.hora_inicio}`,
    contact_id: b.contact_id || null,
    deal_id: b.deal_id || null,
    automatico: true,
    metadata: { booking_recordatorio: hito, booking_id: b.id, canal },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });

  const now = Date.now();
  const hoyMx = new Date(now - MX_OFFSET_MS).toISOString().slice(0, 10);
  /* La ventana de fechas cubre la anticipación MÁS LARGA que alguien pueda
     configurar. Con 30 días alcanza para semanas sin traerse la agenda
     entera en cada corrida. */
  const hastaMx = new Date(now - MX_OFFSET_MS + 30 * 86400000).toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase.from('bookings')
    .select('id, fecha, hora_inicio, estado, invitee_nombre, invitee_email, invitee_whatsapp, contact_id, deal_id, google_meet_link, token_cancelar, token_reagendar, event_types(nombre, duracion_minutos, recordatorios)')
    .eq('estado', 'confirmada')
    .gte('fecha', hoyMx).lte('fecha', hastaMx);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const out = { revisadas: (bookings || []).length, correos: 0, whatsapps: 0, errores: [] as string[] };

  for (const b of (bookings || []) as any[]) {
    try {
      if (!b.fecha || !b.hora_inicio) continue;
      const faltaMin = (inicioMs(b.fecha, b.hora_inicio) - now) / 60000;
      if (faltaMin <= 0) continue;   // ya empezó: recordar no sirve de nada

      for (const r of leerRecordatorios(b.event_types?.recordatorios)) {
        const en = aMinutos(r);
        /* Se dispara cuando faltan ENTRE `en` y `en + ventana` minutos. Nunca
           después: un recordatorio de «1 día antes» que llega a las 20 horas
           dice una hora que ya no es. */
        if (!(faltaMin >= en && faltaMin < en + VENTANA_MIN)) continue;
        const cuanto = etiqueta(r);

        if (r.email && b.invitee_email && !(await yaAvisado(b.id, r.id, 'email'))) {
          const res = await notify({
            channel: 'email', to: b.invitee_email, template: 'booking_reminder',
            data: datosEmail(b, cuanto),
          });
          if (res.ok) { await marcarAvisado(b, r.id, 'email', cuanto); out.correos++; }
          else out.errores.push(`${b.id} ${r.id} email: ${res.reason}`);
        }

        if (r.whatsapp && b.invitee_whatsapp && !(await yaAvisado(b.id, r.id, 'whatsapp'))) {
          const res = await sendWhatsApp(b.invitee_whatsapp, textoWhatsApp(b, cuanto));
          if (res.sent) { await marcarAvisado(b, r.id, 'whatsapp', cuanto); out.whatsapps++; }
          else out.errores.push(`${b.id} ${r.id} whatsapp: ${res.error || 'no enviado'}`);
        }
      }
    } catch (e: any) {
      out.errores.push(`${b.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
