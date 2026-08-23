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
import { alRecibirMensaje } from '../../../lib/whatsapp/automatizacion';
import { telefonoWhatsApp } from '../../../lib/telefono';
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

    const evento = String(payload?.event || payload?.event_type || '');
    const msj = payload?.message || {};
    const conv = payload?.conversation || {};
    const kapso = msj?.kapso || {};

    // El teléfono del CLIENTE: la conversación lo trae siempre; si no,
    // se deduce de la dirección del mensaje.
    const direccion: 'entrante' | 'saliente' =
      kapso.direction === 'outbound' ? 'saliente' : 'entrante';
    const telefono = String(conv.phone_number || (direccion === 'entrante' ? msj.from : msj.to) || '');

    switch (evento) {
      case 'whatsapp.message.received':
      case 'whatsapp.message.sent': {
        if (!msj.id || !telefono) return ok();
        const r = await registrarMensaje({
          kapsoMessageId: String(msj.id),
          kapsoConversationId: conv.id ? String(conv.id) : null,
          telefono,
          direccion: evento === 'whatsapp.message.received' ? 'entrante' : 'saliente',
          tipo: msj.type || kapso.message_type || 'text',
          cuerpo: msj.text?.body || kapso.content || null,
          transcript: kapso.transcript || null,   // Kapso transcribe las notas de voz
          mediaUrl: kapso.media_url || null,
          timestamp: msj.timestamp ? String(msj.timestamp) : null,
        });
        // Automatización (bienvenida / fuera de horario / round-robin): SOLO
        // entrantes NUEVOS — un replay o un saliente jamás la disparan.
        if (evento === 'whatsapp.message.received' && r.inserted && r.conversationId) {
          await alRecibirMensaje(r.conversationId).catch(e => console.warn('[wa-auto]', e));
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
        const errores = (kapso.statuses || [])
          .flatMap((s: any) => s?.errors || [])
          .map((e: any) => [e.code, e.title || e.message].filter(Boolean).join(' '))
          .join('; ') || null;
        await actualizarStatus(String(msj.id), status, status === 'failed' ? errores : null);
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
