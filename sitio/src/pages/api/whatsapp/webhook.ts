// POST /api/whatsapp/webhook — todo lo que pasa en WhatsApp, contado por Kapso.
//
// De aquí sale el ESPEJO: la conversación en la ficha 360, el timeline
// (activities) y los estados de entrega. El chat en vivo se ve en el iframe
// del inbox de Kapso; este webhook es lo que hace que el CRM también lo sepa.
//
// ── Reglas duras (molde: api/email/inbound.ts) ──
// 1. SIEMPRE 200. Kapso reintenta (10s/40s/90s) un webhook que falla; un
//    payload raro no puede tumbar la puerta de entrada de todos.
// 2. Doble candado y FALLA CERRADO: sin KAPSO_WEBHOOK_SECRET configurado se
//    descarta todo. `?k=` en la URL (lo que un extraño no tiene) y, si viene
//    la firma X-Webhook-Signature, HMAC-SHA256 hex del CUERPO CRUDO — por eso
//    aquí se lee request.text() ANTES de parsear JSON.
// 3. Dedup en el espejo (UNIQUE kapso_message_id): Kapso entrega
//    at-least-once y el replay no puede duplicar mensajes ni activities.
//
// Esta ruta vive FUERA de /api/crm/ a propósito: el middleware exige cookie
// de founder/cs en /api/crm/* y Kapso no tiene cookies. El candado es propio.
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { registrarMensaje, actualizarStatus, upsertConversacion } from '../../../lib/whatsapp/espejo';
import { esRespuestaDeAgenda, agendarDesdeRespuesta } from '../../../lib/whatsapp/agenda-auto';
import { parsearMensaje } from '../../../lib/whatsapp/parse';
import { explicarError } from '../../../lib/whatsapp/errores';
import { marcarLeido } from '../../../lib/whatsapp/kapso-api';
import { alRecibirMensaje } from '../../../lib/whatsapp/automatizacion';
import { telefonoWhatsApp, telefonoLegible } from '../../../lib/telefono';
import { notificar } from '../../../lib/crm/notificaciones';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const ok = () => new Response('OK', { status: 200 });

function firmaValida(raw: string, header: string | null, secreto: string): boolean {
  if (!header) return true;               // sin firma: el candado es el ?k=
  const dicho = header.replace(/^sha256=/, '').trim();
  const esperado = createHmac('sha256', secreto).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(dicho, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const secreto = (import.meta.env.KAPSO_WEBHOOK_SECRET || '').trim();
    if (!secreto) {
      console.error('[wa-webhook] falta KAPSO_WEBHOOK_SECRET: evento descartado');
      return ok();
    }
    if (url.searchParams.get('k') !== secreto) return ok();

    const raw = await request.text();
    if (!firmaValida(raw, request.headers.get('x-webhook-signature'), secreto)) {
      console.error('[wa-webhook] firma no coincide: evento descartado');
      return ok();
    }

    let payload: any;
    try { payload = JSON.parse(raw); } catch { return ok(); }

    // Payload v2 de Kapso: el nombre del evento viaja en el header X-Webhook-Event,
    // NO en el cuerpo (el cuerpo es { message, conversation, phone_number_id, … }).
    // Leerlo solo del cuerpo hacía que TODO evento real cayera en `default` con 200.
    const evento = String(request.headers.get('x-webhook-event') || request.headers.get('x-kapso-event') || payload?.event || payload?.event_type || '');
    const msj = payload?.message || {};
    const conv = payload?.conversation || {};
    const kapso = msj?.kapso || {};

    // El teléfono del CLIENTE: la conversación lo trae siempre; si no,
    // se deduce de la dirección del mensaje.
    const direccion: 'entrante' | 'saliente' =
      kapso.direction === 'outbound' ? 'saliente' : 'entrante';
    const telefono = String(conv.phone_number || payload?.contact?.phone_number || payload?.contact?.wa_id || (direccion === 'entrante' ? msj.from : msj.to) || '');
    const conv_id = () => conv.id ? String(conv.id) : null;

    switch (evento) {
      case 'whatsapp.message.received':
      case 'whatsapp.message.sent': {
        if (!msj.id || !telefono) return ok();
        const entrante = evento === 'whatsapp.message.received';
        const p = parsearMensaje(msj);
        const r = await registrarMensaje({
          kapsoMessageId: String(msj.id),
          kapsoConversationId: conv.id ? String(conv.id) : null,
          phoneNumberId: kapso.phone_number_id || payload?.phone_number_id || conv.phone_number_id || null,
          telefono,
          direccion: entrante ? 'entrante' : 'saliente',
          tipo: p.tipo,
          cuerpo: p.cuerpo,
          transcript: typeof kapso.transcript === 'object' ? (kapso.transcript?.text || null) : (kapso.transcript || null),   // Kapso transcribe las notas de voz (a veces como {text})
          mediaUrl: p.mediaUrl, mediaId: p.mediaId, mime: p.mime, filename: p.filename,
          timestamp: msj.timestamp ? String(msj.timestamp) : null,
          metadata: p.metadata,
          status: entrante ? 'received' : (kapso.status || 'sent'),
          nombrePerfil: payload?.contact?.name || payload?.contact?.profile_name || null,
        });
        // ── El cliente tocó uno de los horarios que le mandamos ──────────
        // Va ANTES de la automatización: si la respuesta es una reserva, lo
        // que toca es agendar, no dispararle la bienvenida.
        /* `atendido` = este mensaje YA recibió respuesta del sistema, así que
           la bienvenida automática NO debe dispararse encima. Es lo que hacía
           el hilo ilegible: el cliente tocaba «Reagendar», la agenda le
           mandaba su liga, y un segundo después «Te leo 👋 Soy Fernanda, dame
           unos minutos» — dos respuestas al mismo toque, contradiciéndose.
           Medido: 13 «Soy Fernanda» en 10 días, varios encima de un botón. */
        let atendido = false;
        if (entrante && r.inserted && p.metadata?.id && esRespuestaDeAgenda(p.metadata.id)) {
          atendido = true;
          const base = new URL(request.url).origin;
          agendarDesdeRespuesta({ idRespuesta: String(p.metadata.id), telefono, conversationId: r.conversationId || null, base })
            .catch(e => console.warn('[wa-agenda]', e));
        }
        /* ── El cliente tocó «Reagendar» en un recordatorio ──────────────
           Los botones de una plantilla llegan como un mensaje de texto con el
           texto del botón, nada más: sin esto, «Reagendar» caía en el inbox y
           ahí moría. Quien lo toca está diciendo que sí quiere la reunión —es
           de las señales más fuertes que da un lead— y merece la liga en el
           acto, no cuando alguien lea el chat. */
        if (entrante && r.inserted && r.conversationId) {
          const t = String(p.cuerpo || '').trim().toLowerCase();
          /* «Ahí estaré» también se contesta: el cliente confirmó y merece
             saber que lo oímos. Antes su toque caía en el inbox sin respuesta
             y sin dejar rastro de que había confirmado asistencia. */
          /* SOLO el texto exacto de nuestros botones. Antes el regex incluía
             «entendido» y «confirmo», palabras que cualquiera contesta a un
             mensaje de ventas: entraban al flujo de asistencia sin haber
             tocado nada. Y `atendido` se ponía ANTES de saber si la función
             hacía algo, así que un cliente sin reunión futura se quedaba sin
             confirmación Y sin bienvenida: sin ninguna respuesta. */
          if (/^ah[íi] estar[ée]$/.test(t)) {
            const { confirmoAsistencia } = await import('../../../lib/scheduling/reagendar-wa');
            atendido = await confirmoAsistencia(String(r.conversationId), telefono).catch(e => { console.warn('[wa-confirma]', e); return false; });
          }
          if (/^(reagendar|quiero reagendar)$/.test(t)) {
            atendido = true;
            (async () => {
              const { ligaParaReagendar } = await import('../../../lib/scheduling/reagendar-wa');
              await ligaParaReagendar(String(r.conversationId), telefono);
            })().catch(e => console.warn('[wa-reagendar]', e));
          }
        }
        if (entrante && r.inserted && r.conversationId) {
          /* Automatización (bienvenida / fuera de horario / round-robin): SOLO
             entrantes NUEVOS —un replay o un saliente jamás la disparan— y
             SOLO si nadie contestó ya. Un toque de botón que la agenda acaba
             de responder no necesita además que le digan «dame unos
             minutos»: es hablarle dos veces con dos voces distintas. */
          if (!atendido) await alRecibirMensaje(r.conversationId).catch(e => console.warn('[wa-auto]', e));
          // "Escribiendo…" hacia el cliente: señal de que alguien lo vio llegar.
          // La confirmación de LECTURA real la manda el hilo al abrirse.
          await marcarLeido(String(msj.id), true).catch(() => {});
          // E7.1 · Push al equipo. No se espera: el webhook tiene que contestar
          // rápido o Kapso reintenta. El `tag` por conversación hace que cinco
          // mensajes seguidos sean UN aviso que se actualiza, no cinco.
          (async () => {
            const { data: c } = await supabase.from('wa_conversaciones')
              .select('id, telefono, contacts(nombre, apellido)').eq('id', r.conversationId).maybeSingle();
            const ct: any = (c as any)?.contacts;
            const nombre = ct ? [ct.nombre, ct.apellido].filter(Boolean).join(' ') : null;
            const { pushMensajeEntrante } = await import('../../../lib/crm/push-crm');
            await pushMensajeEntrante({ conversationId: String(r.conversationId), telefono, texto: p.cuerpo, nombre });
          })().catch(e => console.warn('[wa-push]', e));
        }
        return ok();
      }

      case 'whatsapp.message.deleted':
      case 'whatsapp.message.revoked': {
        // El cliente borró el mensaje "para todos": se conserva la fila (auditoría)
        // pero el hilo lo enseña como "Mensaje eliminado".
        if (!msj.id) return ok();
        await supabase.from('wa_mensajes').update({ borrado_at: new Date().toISOString() }).eq('kapso_message_id', String(msj.id));
        return ok();
      }
      case 'whatsapp.message.edited':
      case 'whatsapp.message.updated': {
        if (!msj.id) return ok();
        const p = parsearMensaje(msj);
        if (p.cuerpo) await supabase.from('wa_mensajes')
          .update({ cuerpo: p.cuerpo, metadata: { ...(p.metadata || {}), editado: true } })
          .eq('kapso_message_id', String(msj.id));
        return ok();
      }

      case 'whatsapp.conversation.inactive': {
        // X minutos sin mensajes (configurable en Kapso). Si el cliente fue el
        // último en hablar, es una conversación que se nos está enfriando.
        if (!telefono) return ok();
        const conv = await upsertConversacion({ kapsoConversationId: conv_id(), telefono });
        if (!conv) return ok();
        const { data: c } = await supabase.from('wa_conversaciones').select('ultima_direccion, estado_crm, asignado_a, ultimo_mensaje_at, contacts(nombre, apellido)').eq('id', conv.id).maybeSingle();
        const mins = payload?.inactivity_minutes || payload?.conversation?.inactivity_minutes || null;

        /* «Sin actividad», a secas, era el evento MÁS FRECUENTE del inbox —149
           en 30 días— y no decía nada: ni cuánto silencio hubo ni de quién era
           el turno. Kapso manda `inactivity_minutes` solo a veces (124 de 149
           llegaron sin él), así que el hueco se mide aquí, contra la hora del
           último mensaje, que siempre está.

           Se escribe en pasado y con el número: es un hecho de ese momento y
           así sigue siendo verdad cuando alguien lo lea tres días después. */
        const huecoMin = (() => {
          if (mins) return Number(mins);
          const t = (c as any)?.ultimo_mensaje_at ? Date.parse((c as any).ultimo_mensaje_at) : 0;
          return t ? Math.max(1, Math.round((Date.now() - t) / 60000)) : 0;
        })();
        const cuanto = !huecoMin ? ''
          : huecoMin < 60 ? `${huecoMin} min`
          : huecoMin < 1440 ? `${Math.round(huecoMin / 60)} h`
          : `${Math.round(huecoMin / 1440)} d`;
        const deQuien = c?.ultima_direccion === 'entrante'
          ? 'y el cliente sigue esperando respuesta'
          : c?.ultima_direccion === 'saliente' ? 'y el cliente no ha contestado' : '';
        const detalle = cuanto
          ? `Pasaron ${cuanto} sin que nadie escribiera${deQuien ? ` ${deQuien}` : ''}`
          : `Sin actividad${deQuien ? ` — ${deQuien}` : ''}`;
        await supabase.from('wa_eventos').insert({ conversation_id: conv.id, tipo: 'inactiva', autor: null, detalle });
        if (c?.ultima_direccion === 'entrante' && c.estado_crm !== 'resuelta') {
          const nombre = (c as any).contacts ? `${(c as any).contacts.nombre || ''} ${(c as any).contacts.apellido || ''}`.trim() : telefonoLegible(telefono);
          await notificar({ clave: `wa_inactiva_${conv.id}_${new Date().toISOString().slice(0, 13)}`, tipo: 'wa_snooze', destino: 'whatsapp', titulo: `${nombre} lleva${mins ? ` ${mins} min` : ' rato'} esperando respuesta`, metadata: { conversation_id: conv.id, para: c.asignado_a || null } });
        }
        return ok();
      }
      case 'whatsapp.contact.identity_changed': {
        // El cliente reinstaló WhatsApp o cambió de teléfono: nuevo BSUID. Se avisa
        // y se deja rastro en el hilo; el número sigue siendo el ancla del espejo.
        if (!telefono) return ok();
        const conv = await upsertConversacion({ telefono });
        if (conv) {
          await supabase.from('wa_eventos').insert({ conversation_id: conv.id, tipo: 'identidad', autor: null, detalle: 'WhatsApp reporta que el cliente cambió de identidad (reinstaló la app o cambió de dispositivo). Si no contesta, confirma el número.' });
          await supabase.from('wa_conversaciones').update({ alerta: 'El cliente cambió de identidad en WhatsApp: confirma que el número siga siendo suyo' }).eq('id', conv.id);
        }
        return ok();
      }

      case 'whatsapp.contact.marketing_preference_changed': {
        // El cliente pidió (o quitó) el alto a marketing: se respeta en
        // masivos y Nuevo chat vía contacts.wa_optout.
        const tel = telefonoWhatsApp(telefono);
        const stopped = payload?.marketing_preference === 'stopped' || payload?.preference === 'stopped'
          || payload?.contact?.marketing_preference === 'stopped';
        if (tel) await supabase.from('contacts').update({ wa_optout: !!stopped }).eq('whatsapp', tel);
        return ok();
      }

      case 'whatsapp.message.delivered':
      case 'whatsapp.message.read':
      case 'whatsapp.message.failed': {
        if (!msj.id) return ok();
        const status = evento.split('.').pop() as string;
        // En failed, Kapso acumula los errores de Meta en kapso.statuses[].errors.
        // failed: se guarda "<código> <título en español> · <detalle de Meta>" (el
        // detalle crudo va después del separador para soporte).
        // Los errores pueden venir en kapso.statuses[].errors, message.errors, kapso.errors o payload.errors.
        const errs = [
          ...(kapso.statuses || []).flatMap((s: any) => s?.errors || []),
          ...(msj.errors || []), ...(kapso.errors || []), ...(payload?.errors || []), ...(payload?.status?.errors || []),
        ];
        const errores = errs.length
          ? errs.map((e: any) => { const x = explicarError(e); return `${x.codigo ? x.codigo + ' ' : ''}${x.titulo}${x.crudo ? ' · ' + x.crudo.slice(0, 200) : ''}`; }).join(' | ')
          : (status === 'failed' ? 'Meta no dio detalle del fallo' : null);
        await actualizarStatus(String(msj.id), status, status === 'failed' ? errores : null);
        /* NO ENTREGADO: si el mensaje llevaba plan de respaldo, sale ahora.
           Meta acepta la plantilla y reporta el rechazo por aquí, así que este
           es el primer momento en que se sabe de verdad que no llegó —esperar
           al reloj de los diez minutos es dejar al lead sin nada mientras
           tanto—. Ver `respaldoPorFallo`. */
        if (status === 'failed') {
          const { respaldoPorFallo } = await import('../../../lib/whatsapp/plantilla-espejo');
          await respaldoPorFallo(String(msj.id), errores).catch(e => console.warn('[wa-respaldo]', e?.message || e));
        }
        return ok();
      }

      case 'whatsapp.conversation.created': {
        if (!telefono) return ok();
        await upsertConversacion({
          kapsoConversationId: conv.id ? String(conv.id) : null, telefono,
        });
        return ok();
      }
      case 'whatsapp.conversation.ended': {
        if (!telefono) return ok();
        await upsertConversacion({
          kapsoConversationId: conv.id ? String(conv.id) : null, telefono, estado: 'ended',
        });
        return ok();
      }

      default:
        return ok();    // evento que no espejamos: se ignora sin drama
    }
  } catch (e) {
    console.error('[wa-webhook]', e);
    return ok();       // ver regla 1
  }
};
