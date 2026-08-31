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

/** Tope explícito de la consulta. PostgREST corta en 1000 aunque no se pida. */
const TOPE = 1000;

/* Los hitos VIEJOS del cron anterior ('24h' de correo, '1h' de WhatsApp)
   valen como el nuevo que ocupa su lugar. Sin esto, el día del despliegue una
   reunión que ya recibió el correo de 24 h no tiene marcador `r1` y lo vuelve
   a recibir: dos correos idénticos con menos de una hora de diferencia. */
const HITOS_VIEJOS: Record<string, string[]> = { r1: ['24h'], r2: [], r3: ['1h'] };

async function yaAvisado(bookingId: string, hito: string, canal: string): Promise<boolean> {
  for (const h of [hito, ...(HITOS_VIEJOS[hito] || [])]) {
    const { data } = await supabase.from('activities').select('id')
      .contains('metadata', { booking_recordatorio: h, booking_id: bookingId, canal })
      .limit(1);
    if (data && data.length) return true;
  }
  return false;
}

/**
 * Marca el hito. Devuelve si de VERDAD quedó marcado.
 *
 * Es el único candado contra el doble envío —la ventana (6 min) es más ancha
 * que la corrida (5 min) a propósito, para que ninguna se caiga entre dos—,
 * así que si este insert falla y nadie lo mira, cinco minutos después el
 * cliente recibe otra vez la misma plantilla y el mismo correo, y el cron
 * reporta dos envíos buenos.
 */
async function marcarAvisado(b: any, hito: string, canal: string, cuanto: string): Promise<boolean> {
  const { error } = await supabase.from('activities').insert({
    tipo: 'sistema',
    titulo: `Recordatorio de ${cuanto} antes enviado por ${canal}: ${b.invitee_nombre} — ${b.fecha} ${b.hora_inicio}`,
    contact_id: b.contact_id || null,
    deal_id: b.deal_id || null,
    automatico: true,
    metadata: { booking_recordatorio: hito, booking_id: b.id, canal },
  });
  return !error;
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

  /* El horizonte sale de la anticipación MÁS LARGA que esté configurada, no
     de un número fijo. Con 30 días escritos a mano, un «5 semanas antes»
     —que la pantalla deja poner— nunca disparaba: cuando la reunión entraba
     a su ventana estaba a 35 días y la consulta solo miraba 30. Se
     configuraba, se guardaba y no salía nada. */
  const { data: tipos } = await supabase.from('event_types').select('recordatorios').is('archived_at', null);
  const maxMin = Math.max(1440, ...(tipos || []).flatMap((t: any) => leerRecordatorios(t.recordatorios).map(aMinutos)));
  const hastaMx = new Date(now - MX_OFFSET_MS + (maxMin + VENTANA_MIN) * 60000).toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase.from('bookings')
    .select(`id, fecha, hora_inicio, estado, invitee_nombre, invitee_email, invitee_whatsapp, invitee_empresa,
      timezone_invitado, serie_indice, serie_total, contact_id, deal_id, company_id, host_id,
      google_meet_link, token_cancelar, token_reagendar,
      contacts(wa_optout),
      event_types(nombre, duracion_minutos, recordatorios)`)
    .eq('estado', 'confirmada')
    .gte('fecha', hoyMx).lte('fecha', hastaMx)
    /* Orden y tope EXPLÍCITOS. PostgREST corta en 1000 filas por su cuenta y
       sin decir nada: con más reuniones que eso, las de más allá no recibían
       ningún recordatorio, sin error y sin aviso. Ahora el orden es por fecha
       —lo más próximo primero, que es lo que urge— y si se llega al tope se
       dice en la respuesta en vez de fingir que se revisó todo. */
    .order('fecha', { ascending: true }).order('hora_inicio', { ascending: true })
    .limit(TOPE);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  /* Una plantilla que Meta todavía no aprueba NO se puede mandar. Sin esta
     revisión el error llega como un código de Meta que no dice nada; así el
     aviso en la campana dice exactamente qué pasa y qué falta. Se consulta una
     vez por corrida, no por reunión. */
  const { data: plts } = await supabase.from('wa_plantillas')
    /* Con el IDIOMA: `wa_plantillas` es única por (nombre, idioma). Si
       existiera `reunion_recordatorio` en 'es' aprobada y la de 'es_MX'
       pendiente, la puerta abría y Meta tronaba con un 132001 — justo el
       error que este candado quería evitar. */
    .select('nombre, status').eq('idioma', IDIOMA_PLANTILLA).in('nombre', [PLANTILLA_CLIENTE, PLANTILLA_HOST]);
  const aprobada = (n: string) => (plts || []).some((p: any) => p.nombre === n && p.status === 'APPROVED');
  const okCliente = aprobada(PLANTILLA_CLIENTE);
  const okHost = aprobada(PLANTILLA_HOST);

  const out = {
    horizonte_dias: Math.ceil(maxMin / 1440),
    truncado: (bookings || []).length >= TOPE,
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
        /* UNO por corrida, y como la lista viene de mayor a menor
           anticipación, es el más lejano. Sin este corte, dos recordatorios a
           menos de 6 minutos entre sí —«1 hora» y «55 minutos», o un «3
           horas» duplicado como «180 minutos»— le llegaban los dos seguidos
           al cliente. La bandera se levanta al final del bloque. */
        let disparo = false;

        // ── Correo al cliente ──
        if (r.email && b.invitee_email && !(await yaAvisado(b.id, r.id, 'email'))) {
          const res = await notify({
            channel: 'email', to: b.invitee_email, template: 'booking_reminder',
            data: { ...datosEmail(b, cuanto), serie: etiquetaSerie(b) },
          });
          if (res.ok) {
            const marcado = await marcarAvisado(b, r.id, 'email', cuanto);
            out.correos++; disparo = true;
            if (!marcado) {
              out.fallas++;
              await avisarFalla(b, `Riesgo de recordatorio repetido: ${b.invitee_nombre}`,
                `El correo de ${cuanto} antes salió, pero no se pudo dejar la marca que impide repetirlo. Puede volver a salir en la siguiente corrida.`,
                'agenda_marca_falla');
            }
          }
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
                const marcado = await marcarAvisado(b, r.id, 'whatsapp', cuanto);
                out.whatsapps++; disparo = true;
                if (!marcado) {
                  out.fallas++;
                  await avisarFalla(b, `Riesgo de recordatorio repetido: ${b.invitee_nombre}`,
                    `El WhatsApp de ${cuanto} antes salió, pero no se pudo dejar la marca que impide repetirlo.`,
                    'agenda_marca_falla');
                }
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
              await marcarAvisado(b, r.id, 'host', cuanto); out.host_whatsapps++; disparo = true;
            } catch (e: any) {
              out.fallas++; out.errores.push(`${b.id} ${r.id} host: ${e?.message || e}`);
            }
          }
        }

        /* SIN LIGA DE MEET. Va DESPUÉS de enviar y solo si de verdad salió
           algo: antes se levantaba de entrada y afirmaba «el recordatorio
           salió sin ella» aunque después no saliera nada —por opt-out, por
           plantilla sin aprobar o porque el lead no tiene correo—. El aviso
           sale igual: la hora es lo que importa, y quien puede poner la liga
           es el host. */
        if (disparo && !b.google_meet_link) {
          out.sin_liga++;
          await avisarFalla(b, `Falta la liga de Meet: ${b.invitee_nombre}`,
            `La reunión es en ${cuanto} (${cuandoLargo(b)}) y todavía no tiene liga. El recordatorio salió sin ella.`,
            'agenda_sin_liga');
        }

        // Uno por corrida: ver el comentario de `disparo`.
        if (disparo) break;
      }
    } catch (e: any) {
      out.errores.push(`${b.id}: ${e?.message || String(e)}`);
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
