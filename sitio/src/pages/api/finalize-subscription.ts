import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { provisionAccount, generateUniqueAccountId, isValidAccountId } from '../../lib/register';
import { normalizeEmail } from '../../lib/gifts';
import { syncCrmForSubscription, sendTikTokEvent } from './create-subscription';

// ─── FINALIZAR la suscripción del EMBAJADOR tras confirmar el 3DS/SCA ───
// El flujo del embajador (50% off, cobro inmediato) NO se provisiona en
// create-subscription: ahí Stripe crea la sub con `default_incomplete` y el
// cliente confirma el PaymentIntent con stripe.confirmCardPayment() — eso dispara
// el reto del banco SOLO si la tarjeta lo exige (3DS), o pasa transparente si no.
//
// Una vez confirmado el cargo, el cliente llama a ESTE endpoint para crear la
// cuenta real. Verificamos en el servidor que el pago REALMENTE quedó en
// 'succeeded' (no confiamos en el cliente) ANTES de provisionar — así jamás
// creamos cuentas sin pago. Es idempotente: el segundo llamado (doble submit /
// recarga) devuelve la cuenta ya creada vía el marcador en la metadata de la sub.

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
  maxNetworkRetries: 3,
  timeout: 30000,
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const subscriptionId = String(body.subscriptionId || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const nombre = String(body.nombre || '');
    const empresa = String(body.empresa || '');
    const giro = String(body.giro || '');
    const sucursales = String(body.sucursales || '');
    const whatsapp = String(body.whatsapp || '');
    const accountIdInput = String(body.account_id || '').trim().toLowerCase();
    const refAccount = (typeof body.ref_account === 'string')
      ? body.ref_account.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      : '';

    // Embajador fuerza Plan Vende anual (igual que en create-subscription).
    const planId = 'vende';
    const billingPeriod: 'annual' = 'annual';
    // planValue para el CRM: igual base que el flujo síncrono (planPrices.vende).
    const planValue = 600;

    if (!subscriptionId || !email || !refAccount) {
      return json({ error: 'Faltan datos para finalizar el registro.' }, 400);
    }
    // El password debe venir igual que en create-subscription (provisionar lo
    // necesita y solo existe en el request del cliente, nunca en Stripe/webhook).
    if (!password || password.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

    // ── Recuperar la sub de Stripe (fuente de verdad, no el cliente) ──
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      });
    } catch (e) {
      console.error('[finalize-subscription] retrieve sub falló:', e);
      return json({ error: 'No encontramos tu suscripción. Contáctanos si tu tarjeta fue cobrada.', code: 'sub_not_found' }, 404);
    }

    // ── Idempotencia: si ya provisionamos esta sub, devolver la misma cuenta ──
    const already = subscription.metadata?.provisioned_account;
    if (already) {
      return json({ success: true, subscriptionId: subscription.id, account_id: already, provision_pending: false, status: subscription.status }, 200);
    }

    // ── Seguridad: que la sub SEA realmente del programa embajador y del ref enviado ──
    if (subscription.metadata?.client_ref_account !== refAccount) {
      return json({ error: 'La suscripción no corresponde a este registro.', code: 'mismatch' }, 400);
    }

    // ── Anti-tamper: el correo enviado debe ser el del customer de la sub ──
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!customerId) return json({ error: 'Suscripción inválida.', code: 'no_customer' }, 400);
    try {
      const cu = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      if (normalizeEmail(cu.email || '') !== normalizeEmail(email)) {
        return json({ error: 'Los datos no coinciden con la suscripción.', code: 'email_mismatch' }, 400);
      }
    } catch (e) {
      console.error('[finalize-subscription] retrieve customer falló:', e);
      return json({ error: 'No pudimos validar tu suscripción. Intenta de nuevo.', code: 'customer_error' }, 500);
    }

    // ── VERIFICAR que el cargo REALMENTE pasó (3DS confirmado) ──
    // La fuente de verdad del cobro es el PaymentIntent del primer invoice. Tras
    // un confirmCardPayment exitoso debe estar 'succeeded' (y la sub 'active').
    // Si quedó en requires_action / requires_payment_method → el cliente NO
    // completó el reto o la tarjeta se rechazó → NO provisionar.
    const li = subscription.latest_invoice;
    const piRaw = (li && typeof li !== 'string') ? (li as Stripe.Invoice).payment_intent : null;
    const piStatus = (piRaw && typeof piRaw !== 'string') ? (piRaw as Stripe.PaymentIntent).status : null;
    const paid = subscription.status === 'active' || piStatus === 'succeeded';
    if (!paid) {
      return json({
        error: 'Aún no confirmamos el cargo con tu banco. Completa la verificación de tu tarjeta e intenta de nuevo — no se realizó ningún cargo.',
        code: 'payment_not_confirmed',
      }, 402);
    }

    // ── PROVISIONAR la cuenta real (Firebase/Mongo) — DESPUÉS del pago ──
    let provisionedAccountId = '';
    let accId = isValidAccountId(accountIdInput) ? accountIdInput : await generateUniqueAccountId(empresa || nombre);
    let pr = await provisionAccount({
      account_name: empresa, account_id: accId, nombre, email, password,
      client_ip: ip, whatsapp, giro, sucursales, plan: planId, source: 'web-referido',
    });
    if (!pr.ok && pr.code === 'account_taken') {
      accId = await generateUniqueAccountId((empresa || nombre) + 'sacs');
      pr = await provisionAccount({
        account_name: empresa, account_id: accId, nombre, email, password,
        client_ip: ip, whatsapp, giro, sucursales, plan: planId, source: 'web-referido',
      });
    }
    if (!pr.ok) {
      // NO revertimos la sub: el cargo del embajador YA pasó (3DS confirmado).
      // Revertir cancelaría una suscripción pagada. Mejor devolver error claro y
      // permitir reintentar finalize (idempotente) — el pago se conserva.
      const msg = pr.code === 'email_taken'
        ? 'Ese correo ya tiene una cuenta. Inicia sesión.'
        : pr.code === 'rate_limited'
          ? 'Demasiados intentos desde esta conexión. Espera un momento e intenta de nuevo.'
          : (pr.error || 'Tu pago se confirmó pero no pudimos crear la cuenta. Intenta de nuevo o contáctanos.');
      console.error('[finalize-subscription] provisión falló tras pago:', pr.code, 'sub:', subscription.id);
      return json({ error: msg, code: pr.code || 'provision_failed', sub: subscription.id }, pr.code === 'rate_limited' ? 429 : 400);
    }
    provisionedAccountId = pr.data?.account_id || accId;

    // ── Marcar la sub como provisionada (idempotencia para reintentos) ──
    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: { ...(subscription.metadata || {}), provisioned_account: provisionedAccountId },
      });
    } catch (e) {
      // No es fatal: la cuenta ya existe; solo perdemos el atajo idempotente.
      console.warn('[finalize-subscription] no se pudo marcar provisioned_account:', e);
    }

    // ── Registrar el referido (status 'started'). El webhook invoice.paid lo pasa
    // a 'paid' y acredita el 40% al referidor. `ignoreDuplicates` para NO pisar un
    // 'paid' si el webhook ganó la carrera (la comisión es idempotente aparte). ──
    if (refAccount && refAccount !== provisionedAccountId) {
      await supabase.from('client_referrals').upsert({
        referrer_account: refAccount,
        referred_email: normalizeEmail(email),
        referred_account: provisionedAccountId,
        stripe_subscription_id: subscription.id,
        status: 'started',
        meta: { empresa, plan: planId, ip, via: '3ds_finalize' },
      }, { onConflict: 'referrer_account,referred_email', ignoreDuplicates: true });
    }

    // ── TikTok CompletePayment + CRM (best-effort, mismo helper que el flujo síncrono) ──
    const ua = request.headers.get('user-agent') || '';
    sendTikTokEvent(email, whatsapp || '', planId, planValue, ip, ua).catch(() => {});
    await syncCrmForSubscription({
      request, gift: null, refAccount,
      empresa, nombre, email, whatsapp, giro, sucursales,
      planId, billingPeriod, planValue,
      customerId, subscriptionId: subscription.id,
    });

    return json({ success: true, subscriptionId: subscription.id, account_id: provisionedAccountId, provision_pending: false, status: subscription.status }, 200);
  } catch (err: any) {
    console.error('[finalize-subscription] error:', err && err.message);
    return json({ error: 'No pudimos finalizar tu registro. Si tu tarjeta fue cobrada, contáctanos.', code: 'error' }, 500);
  }
};
