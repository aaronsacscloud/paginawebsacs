// GET /api/cron/booking-reminders — corre CADA 5 MINUTOS (Vercel cron).
//
// Los recordatorios NO están escritos aquí: cada tipo de reunión trae su lista
// en `event_types.recordatorios` y este cron solo la ejecuta.
//
// WHATSAPP SIEMPRE POR PLANTILLA, sin excepción. Medido el 31-ago: de 280
// conversaciones solo 8 tenían abierta la ventana de 24 h de Meta. Con texto
// libre, el 97% de los recordatorios habría fallado — y en silencio, porque el
// error moría en la respuesta de este endpoint que nadie lee.
//
// Y lo que NO sale, se avisa: cada fallo levanta una notificación en la
// campana del CRM. Un recordatorio que no llegó y nadie supo es igual a no
// tener recordatorios, pero con la ilusión de tenerlos.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { enviarPlantilla } from '../../../lib/whatsapp/kapso-api';
import { registrarMensaje } from '../../../lib/whatsapp/espejo';
import { telefonoWhatsApp } from '../../../lib/telefono';
import {
  MX_OFFSET_MS, aMinutos, etiqueta, leerRecordatorios, inicioMs, datosEmail,
  PLANTILLA_CLIENTE, PLANTILLA_HOST, IDIOMA_PLANTILLA, paramsCliente, paramsHost,
  cuandoLargo, etiquetaSerie,
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

/** Lo que no salió tiene que verse. Uno por reunión y motivo, no por intento. */
async function avisarFalla(b: any, titulo: string, detalle: string, tipo: string) {
  const desde = new Date(Date.now() - 12 * 3600e3).toISOString();
  const { data: ya } = await supabase.from('crm_notificaciones')
    .select('id').eq('tipo', tipo).gte('created_at', desde)
    .contains('metadata', { booking_id: b.id }).limit(1);
  if (ya?.length) return;
  await supabase.from('crm_notificaciones').insert({
    tipo, nivel: 'alerta', titulo, detalle,
    company_id: b.company_id || null, destino: 'agenda',
    metadata: { booking_id: b.id },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });

  const now = Date.now();
  const hoyMx = new Date(now - MX_OFFSET_MS).toISOString().slice(0, 10);
  /* Cubre la anticipación más larga que alguien pueda configurar sin traerse
     la agenda entera en cada corrida. */
  const hastaMx = new Date(now - MX_OFFSET_MS + 30 * 86400000).toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase.from('bookings')
    .select(`id, fecha, hora_inicio, estado, invitee_nombre, invitee_email, invitee_whatsapp, invitee_empresa,
      timezone_invitado, serie_indice, serie_total, contact_id, deal_id, company_id, host_id,
      google_meet_link, token_cancelar, token_reagendar,
      contacts(wa_optout),
      event_types(nombre, duracion_minutos, recordatorios)`)
    .eq('estado', 'confirmada')
    .gte('fecha', hoyMx).lte('fecha', hastaMx);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  /* Una plantilla que Meta todavía no aprueba NO se puede mandar. Sin esta
     revisión el error llega como un código de Meta que no dice nada; así el
     aviso en la campana dice exactamente qué pasa y qué falta. Se consulta una
     vez por corrida, no por reunión. */
  const { data: plts } = await supabase.from('wa_plantillas')
    .select('nombre, status').in('nombre', [PLANTILLA_CLIENTE, PLANTILLA_HOST]);
  const aprobada = (n: string) => (plts || []).some((p: any) => p.nombre === n && p.status === 'APPROVED');
  const okCliente = aprobada(PLANTILLA_CLIENTE);
  const okHost = aprobada(PLANTILLA_HOST);

  const out = {
    plantilla_cliente: okCliente ? 'APPROVED' : 'no disponible',
    plantilla_host: okHost ? 'APPROVED' : 'no disponible',
    revisadas: (bookings || []).length,
    correos: 0, whatsapps: 0, host_whatsapps: 0,
    saltados_optout: 0, sin_liga: 0, fallas: 0, errores: [] as string[],
  };

  for (const b of (bookings || []) as any[]) {
    try {
      if (!b.fecha || !b.hora_inicio) continue;
      const faltaMin = (inicioMs(b.fecha, b.hora_inicio) - now) / 60000;
      if (faltaMin <= 0) continue;   // ya empezó: recordar no sirve de nada

      for (const r of leerRecordatorios(b.event_types?.recordatorios)) {
        const en = aMinutos(r);
        /* Entre `en` y `en + ventana`. Nunca después: un «1 día antes» que
           llega a las 20 horas dice una hora que ya no es. */
        if (!(faltaMin >= en && faltaMin < en + VENTANA_MIN)) continue;
        const cuanto = etiqueta(r);

        /* SIN LIGA DE MEET: el aviso sale igual —la hora es lo que importa—
           pero el host se entera de que falta, que es quien puede ponerla. */
        if (!b.google_meet_link) {
          out.sin_liga++;
          await avisarFalla(b, `Falta la liga de Meet: ${b.invitee_nombre}`,
            `La reunión es en ${cuanto} (${cuandoLargo(b)}) y todavía no tiene liga. El recordatorio salió sin ella.`,
            'agenda_sin_liga');
        }

        // ── Correo al cliente ──
        if (r.email && b.invitee_email && !(await yaAvisado(b.id, r.id, 'email'))) {
          const res = await notify({
            channel: 'email', to: b.invitee_email, template: 'booking_reminder',
            data: { ...datosEmail(b, cuanto), serie: etiquetaSerie(b) },
          });
          if (res.ok) { await marcarAvisado(b, r.id, 'email', cuanto); out.correos++; }
          else {
            out.fallas++; out.errores.push(`${b.id} ${r.id} email: ${res.reason}`);
            await avisarFalla(b, `No salió el recordatorio de ${b.invitee_nombre}`,
              `Correo de ${cuanto} antes: ${res.reason}`, 'agenda_recordatorio_falla');
          }
        }

        // ── WhatsApp al cliente ──
        if (r.whatsapp && b.invitee_whatsapp) {
          /* El opt-out MANDA. Quien pidió no recibir WhatsApp no lo recibe:
             no es preferencia, es cumplimiento. */
          if (b.contacts?.wa_optout) out.saltados_optout++;
          else if (!okCliente) {
            out.fallas++;
            await avisarFalla(b, 'La plantilla del recordatorio no está aprobada',
              `«${PLANTILLA_CLIENTE}» sigue en revisión de Meta, así que los recordatorios por WhatsApp no están saliendo. El correo sí.`,
              'agenda_plantilla_pendiente');
          }
          else if (!(await yaAvisado(b.id, r.id, 'whatsapp'))) {
            const tel = telefonoWhatsApp(b.invitee_whatsapp);
            if (!tel) { out.fallas++; out.errores.push(`${b.id}: teléfono no utilizable`); }
            else {
              try {
                const params = paramsCliente(b, cuanto);
                const rp = await enviarPlantilla(tel, PLANTILLA_CLIENTE, IDIOMA_PLANTILLA, params);
                await marcarAvisado(b, r.id, 'whatsapp', cuanto); out.whatsapps++;
                /* Espejado en el inbox: quien abra el chat ve lo que el cliente
                   recibió, no tiene que confiar en que salió. */
                await registrarMensaje({
                  kapsoMessageId: rp?.messages?.[0]?.id || null, telefono: tel, direccion: 'saliente',
                  tipo: 'template', cuerpo: `Recordatorio de reunión (${cuanto} antes)`, status: 'sent', autor: 'Agenda',
                  metadata: { booking_recordatorio: r.id, booking_id: b.id, plantilla: PLANTILLA_CLIENTE },
                }).catch(() => { /* el espejo no tumba un envío que ya salió */ });
              } catch (e: any) {
                out.fallas++; out.errores.push(`${b.id} ${r.id} wa: ${e?.message || e}`);
                await avisarFalla(b, `No salió el WhatsApp de ${b.invitee_nombre}`,
                  `Recordatorio de ${cuanto} antes: ${e?.message || e}`, 'agenda_recordatorio_falla');
              }
            }
          }
        }

        // ── WhatsApp al HOST ──
        // Antes solo se le avisaba al cliente. Si el vendedor se distrae, el
        // cliente entra a Meet solo, que es peor que si no llega ninguno.
        if (r.whatsapp && okHost && b.host_id && !(await yaAvisado(b.id, r.id, 'host'))) {
          const { data: host } = await supabase.from('team_members')
            .select('nombre, whatsapp').eq('id', b.host_id).maybeSingle();
          const telH = telefonoWhatsApp((host as any)?.whatsapp);
          if (telH) {
            try {
              await enviarPlantilla(telH, PLANTILLA_HOST, IDIOMA_PLANTILLA, paramsHost(b, cuanto));
              await marcarAvisado(b, r.id, 'host', cuanto); out.host_whatsapps++;
            } catch (e: any) {
              out.fallas++; out.errores.push(`${b.id} ${r.id} host: ${e?.message || e}`);
            }
          }
        }
      }
    } catch (e: any) {
      out.errores.push(`${b.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
