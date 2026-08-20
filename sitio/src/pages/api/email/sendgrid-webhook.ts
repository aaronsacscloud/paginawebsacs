// POST /api/email/sendgrid-webhook — eventos de entrega de SendGrid.
//
// Es la única fuente fiable de lo que pasó DESPUÉS de que el correo salió:
// entregado, rebotado, marcado como spam, dado de baja. El pixel y el
// redirect propios miden lectura; esto mide entrega y reputación.
//
// Firma verificada (Ed25519) cuando hay clave pública configurada: sin ella
// cualquiera podría inventar rebotes y suprimir a media cartera. Sin clave, se
// aceptan eventos pero se registra la advertencia — mejor medir que no medir
// mientras se configura, y el daño posible es acotado.
//
// SIEMPRE responde 200: SendGrid reintenta y desactiva webhooks que fallan.
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { supabase } from '../../../lib/supabase';
import { darDeBaja } from '../../../lib/email/bajas';

export const prerender = false;
const ok = () => new Response('OK', { status: 200 });

/** Rebote duro / queja / baja → supresión. Rebote suave → solo se registra. */
const A_SUPRESION: Record<string, 'rebote_duro' | 'rebote_suave' | 'queja' | 'baja' | 'dropped'> = {
  bounce: 'rebote_duro',
  dropped: 'dropped',
  spamreport: 'queja',
  unsubscribe: 'baja',
  group_unsubscribe: 'baja',
};

function firmaValida(raw: string, sig: string | null, ts: string | null): boolean {
  const pub = (import.meta.env.SENDGRID_WEBHOOK_KEY || '').trim();
  // FALLA CERRADO. Antes esto devolvía `true` cuando no había clave, y como la
  // ruta está exenta de CSRF, cualquiera en internet podía mandar un arreglo de
  // eventos `spamreport` con los correos de la cartera y suprimirla entera,
  // cancelando de paso sus inscripciones a embudos. Sin clave no se procesa
  // nada — y el log lo dice, para que no sea un silencio.
  if (!pub) {
    console.warn('[sendgrid-webhook] falta SENDGRID_WEBHOOK_KEY: evento descartado');
    return false;
  }
  if (!sig || !ts) return false;
  try {
    const verifier = crypto.createVerify('sha256');
    verifier.update(ts + raw);
    const key = crypto.createPublicKey({
      key: Buffer.from(pub, 'base64'), format: 'der', type: 'spki',
    });
    return verifier.verify(key, Buffer.from(sig, 'base64'));
  } catch { return false; }
}

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text().catch(() => '');
  const firmaOk = firmaValida(raw, request.headers.get('x-twilio-email-event-webhook-signature'),
                              request.headers.get('x-twilio-email-event-webhook-timestamp'));

  let eventos: any[] = [];
  try { eventos = JSON.parse(raw); } catch { eventos = []; }
  if (!Array.isArray(eventos)) eventos = [];

  // BITÁCORA. Se escribe SIEMPRE, pase o no la firma. Un webhook que se
  // descarta en silencio deja las métricas en cero sin que nadie sepa por qué
  // — y ese silencio cuesta días de diagnóstico. Aquí queda el rastro.
  // La MUESTRA solo lleva correo cuando el evento es NUESTRO (trae `tenant`).
  // Este webhook es de toda la cuenta de SendGrid, que comparte el producto:
  // los demás eventos son de compradores de las tiendas de los clientes, y esa
  // gente no tiene nada que hacer en la base del CRM comercial.
  const muestra = eventos.slice(0, 3).map((e: any) => (
    e?.tenant
      ? { event: e.event, email: e.email, send: e.send || null }
      : { event: e?.event, ajeno: true }
  ));
  await supabase.from('email_webhook_log').insert({
    origen: 'sendgrid',
    firma_ok: firmaOk,
    eventos: eventos.length,
    muestra,
    nota: firmaOk ? null : 'firma inválida o ausente: eventos descartados',
  }).then(() => {}, () => {});

  if (!firmaOk) return ok();

  for (const ev of eventos) {
    const tenantId = ev.tenant || null;
    const sendId = ev.send || null;
    const email = String(ev.email || '').toLowerCase();
    const tipo = String(ev.event || '');
    const cuando = ev.timestamp ? new Date(ev.timestamp * 1000).toISOString() : new Date().toISOString();
    if (!email) continue;

    // Estado del envío. Los eventos llegan desordenados: no se degrada un
    // estado avanzado (clicked) por uno anterior (delivered) que llega tarde.
    if (sendId) {
      const parche: Record<string, any> = {};
      if (tipo === 'delivered') { parche.estado = 'delivered'; parche.delivered_at = cuando; }
      else if (tipo === 'bounce' || tipo === 'blocked') {
        parche.estado = 'bounced'; parche.bounced_at = cuando;
        parche.bounce_type = ev.type || 'unknown'; parche.bounce_reason = String(ev.reason || '').slice(0, 400);
      } else if (tipo === 'dropped') { parche.estado = 'bounced'; parche.bounced_at = cuando; parche.bounce_reason = 'dropped: ' + String(ev.reason || ''); }
      else if (tipo === 'spamreport') { parche.estado = 'spam'; }
      if (Object.keys(parche).length) {
        // El comentario prometía no degradar y el update era incondicional: un
        // `delivered` que llega tarde pisaba la baja o la queja del mismo
        // correo, y el reporte de la campaña que quemó la lista mostraba cero
        // bajas. Estos estados son terminales y no se sobrescriben.
        await supabase.from('email_sends').update(parche).eq('id', sendId)
          .not('estado', 'in', '(unsubscribed,spam,bounced)');
      }
    }

    const motivo = A_SUPRESION[tipo];
    if (motivo && tenantId) {
      // Un rebote SUAVE no suprime a la primera: el buzón puede estar lleno
      // hoy y libre mañana. Solo se suprime al tercero.
      if (tipo === 'bounce' && String(ev.type || '').toLowerCase() === 'blocked') {
        const { count } = await supabase.from('email_sends')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('email_to', email).eq('estado', 'bounced');
        if ((count || 0) < 3) continue;
      }
      await darDeBaja({
        tenantId, email, sendId, motivo,
        origen: 'sendgrid:' + tipo,
        detalle: String(ev.reason || ev.status || '').slice(0, 400),
      });
    }
  }
  return ok();
};
