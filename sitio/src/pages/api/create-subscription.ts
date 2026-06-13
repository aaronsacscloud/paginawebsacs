import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { supabase } from '../../lib/supabase';
import { getReferrerFromRequest } from '../../lib/attribution';
import { createCommissionForDeal } from '../../lib/commissions/calculate';
import { provisionAccount, generateUniqueAccountId, isValidAccountId } from '../../lib/register';
import { CLIENT_REF_DISCOUNT_PCT } from '../../data/referral';
import {
  GIFT_COUPON_ID,
  GIFT_PLAN_VALUE_MXN,
  getGiftByCode,
  isGiftExpired,
  logGiftEvent,
  normalizeEmail,
  normalizeWhatsapp,
  type GiftRow,
} from '../../lib/gifts';

// Normaliza un nombre de empresa/persona para comparar (lowercase + colapsa
// espacios + quita acentos) — para el anti-fraude "empresa == padrino_nombre".
function normalizeName(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar marcas diacríticas (acentos)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

const TIKTOK_TOKEN = (import.meta.env.TIKTOK_ACCESS_TOKEN || '').trim();
const TIKTOK_PIXEL = 'CUT9GN3C77UAVCG32N00';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+52' + digits;
  if (digits.length > 10 && !digits.startsWith('0')) return '+' + digits;
  return '+52' + digits;
}

async function sendTikTokEvent(email: string, phone: string, planId: string, value: number, ip: string, ua: string) {
  if (!TIKTOK_TOKEN) return;
  const e164 = toE164(phone);
  const event = {
    pixel_code: TIKTOK_PIXEL,
    event: 'CompletePayment',
    event_id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_time: Math.floor(Date.now() / 1000),
    context: {
      user_agent: ua,
      ip,
      user: {
        email: email ? sha256(email) : undefined,
        phone: e164 ? sha256(e164) : undefined,
      },
    },
    properties: {
      contents: [{ content_id: planId, content_name: planId }],
      content_type: 'product',
      value,
      currency: 'MXN',
    },
  };

  await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': TIKTOK_TOKEN,
    },
    body: JSON.stringify({ event_source: 'web', event_source_id: TIKTOK_PIXEL, data: [event] }),
  }).catch(() => {});
}

// Plan price IDs — replace with real Stripe Price IDs after creating products
const PRICE_MAP: Record<string, { monthly: string; annual: string }> = {
  vende: {
    monthly: import.meta.env.STRIPE_PRICE_VENDE_MONTHLY || '',
    annual: import.meta.env.STRIPE_PRICE_VENDE_ANNUAL || '',
  },
  controla: {
    monthly: import.meta.env.STRIPE_PRICE_CONTROLA_MONTHLY || '',
    annual: import.meta.env.STRIPE_PRICE_CONTROLA_ANNUAL || '',
  },
  fideliza: {
    monthly: import.meta.env.STRIPE_PRICE_FIDELIZA_MONTHLY || '',
    annual: import.meta.env.STRIPE_PRICE_FIDELIZA_ANNUAL || '',
  },
  automatiza: {
    monthly: import.meta.env.STRIPE_PRICE_AUTOMATIZA_MONTHLY || '',
    annual: import.meta.env.STRIPE_PRICE_AUTOMATIZA_ANNUAL || '',
  },
};

// ─── Regalo Buddy: cupón 100% primer año (get-or-create idempotente) ───
// SCOPED al producto Vende (defense-in-depth, B4): el cupón GIFT_VENDE_YEAR
// original era 100%-off GLOBAL → si su id se filtra o se usa desde otro flujo,
// regala CUALQUIER plan gratis. Usamos un id VERSIONADO (_V2) con
// `applies_to.products = [productoVende]`, así aunque se aplique en otro lado
// solo descuenta Vende. Versionado porque los cupones de Stripe son inmutables
// (no se le puede agregar applies_to al viejo). El viejo `GIFT_VENDE_YEAR`, si
// existe en Stripe, queda huérfano (ningún código lo referencia) — borrarlo a
// mano es opcional.
const GIFT_COUPON_ID_SCOPED = `${GIFT_COUPON_ID}_V2`;

async function getOrCreateGiftCoupon(vendePriceId: string): Promise<string> {
  // Idempotente: si ya existe el cupón scopeado, úsalo.
  try {
    await stripe.coupons.retrieve(GIFT_COUPON_ID_SCOPED);
    return GIFT_COUPON_ID_SCOPED;
  } catch (err: any) {
    if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err;
  }
  // Resolver el PRODUCTO Vende desde el price para scopear el cupón. Best-effort:
  // si falla, creamos el cupón SIN scope (mejor sin scope que romper la redención
  // del regalo — el forzado server-side de planId='vende' ya impide stacking en
  // ESTE endpoint; el scope es solo defensa extra).
  let appliesTo: { products: string[] } | undefined;
  try {
    const price = await stripe.prices.retrieve(vendePriceId);
    const productId = typeof price.product === 'string' ? price.product : (price.product as any)?.id;
    if (productId) appliesTo = { products: [productId] };
  } catch (e) {
    console.warn('[gift coupon] no se pudo resolver el producto Vende para scopear:', e);
  }
  try {
    await stripe.coupons.create({
      id: GIFT_COUPON_ID_SCOPED,
      percent_off: 100,
      duration: 'once',
      name: 'Regalo Buddy — Primer año Vende',
      ...(appliesTo ? { applies_to: appliesTo } : {}),
    });
  } catch (err: any) {
    // Carrera: otro request lo creó primero
    if (err?.code !== 'resource_already_exists') throw err;
  }
  return GIFT_COUPON_ID_SCOPED;
}

// ─── Embajador: cupón 50% primer año Vende (get-or-create idempotente) ───
// Cada cliente Sacs refiere con su link /r/<account>. El referido paga su
// PRIMER AÑO del Plan Vende con 50% off (duration:once → solo el 1er pago;
// renueva a precio normal). Scoped al producto Vende (misma defensa que el gift).
const CLIENT_REF_COUPON_ID = 'CLIENT_REF_VENDE_50';

async function getOrCreateClientRefCoupon(vendePriceId: string): Promise<string> {
  try {
    await stripe.coupons.retrieve(CLIENT_REF_COUPON_ID);
    return CLIENT_REF_COUPON_ID;
  } catch (err: any) {
    if (err?.code !== 'resource_missing' && err?.statusCode !== 404) throw err;
  }
  let appliesTo: { products: string[] } | undefined;
  try {
    const price = await stripe.prices.retrieve(vendePriceId);
    const productId = typeof price.product === 'string' ? price.product : (price.product as any)?.id;
    if (productId) appliesTo = { products: [productId] };
  } catch (e) {
    console.warn('[client-ref coupon] no se pudo resolver el producto Vende para scopear:', e);
  }
  try {
    await stripe.coupons.create({
      id: CLIENT_REF_COUPON_ID,
      percent_off: Math.round(CLIENT_REF_DISCOUNT_PCT * 100), // 50
      duration: 'once',
      name: 'Embajador Sacs — 50% primer año Vende',
      ...(appliesTo ? { applies_to: appliesTo } : {}),
    });
  } catch (err: any) {
    if (err?.code !== 'resource_already_exists') throw err;
  }
  return CLIENT_REF_COUPON_ID;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { nombre, empresa, giro, sucursales, whatsapp, email, paymentMethodId, billing } = body;
    // Credenciales para PROVISIONAR la cuenta real (Firebase/Mongo) tras el pago.
    const password = String(body.password || '');
    const accountIdInput = String(body.account_id || '').trim().toLowerCase();
    let { planId } = body;

    // Validate required fields
    if (!email || !paymentMethodId || !planId) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Password OBLIGATORIO aquí (antes de Stripe): provisionar la cuenta lo
    // necesita y SOLO existe en este request. Sin él crearíamos una suscripción
    // que es estructuralmente imposible de provisionar (cobrar sin poder dar cuenta).
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

    // ─── Regalo Buddy: validar gift code (flujo aditivo, solo entra con code) ───
    const giftCode = typeof body.gift === 'string' ? body.gift.trim() : '';
    let gift: GiftRow | null = null;
    if (giftCode) {
      gift = await getGiftByCode(giftCode);
      if (!gift || gift.status !== 'pending' || isGiftExpired(gift)) {
        if (gift && gift.status === 'pending' && isGiftExpired(gift)) {
          await supabase.from('gifts').update({ status: 'expired' }).eq('id', gift.id).eq('status', 'pending');
        }
        return new Response(JSON.stringify({ error: 'Este regalo ya no es válido o ya fue usado.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Seguridad anti auto-regalo: el padrino no puede redimir su propio regalo
      const emailNorm = normalizeEmail(email);
      const waNorm = normalizeWhatsapp(whatsapp);
      const padrinoEmailNorm = normalizeEmail(gift.padrino_email);
      const padrinoWaNorm = normalizeWhatsapp(gift.padrino_whatsapp);
      // Refuerzo: además del email/whatsapp, bloquear si el NOMBRE de empresa del
      // registrante coincide con el nombre del padrino (mismo dueño, otro correo).
      const empresaNorm = normalizeName(empresa);
      const padrinoNombreNorm = normalizeName(gift.padrino_nombre);
      const selfByContact =
        (padrinoEmailNorm && emailNorm === padrinoEmailNorm) ||
        (padrinoWaNorm && waNorm && waNorm === padrinoWaNorm);
      const selfByName = !!empresaNorm && empresaNorm === padrinoNombreNorm;
      if (selfByContact || selfByName) {
        logGiftEvent({
          event: 'redeemed',
          code: gift.code,
          padrino_account: gift.padrino_account,
          meta: {
            blocked: true,
            reason: selfByName ? 'self_gift_name_match' : 'self_gift_contact_match',
            ip,
            registrante_email: emailNorm || null,
            registrante_empresa: empresaNorm || null,
          },
        }).catch(() => {});
        return new Response(JSON.stringify({ error: 'Este regalo es para un negocio amigo, no para la cuenta que lo regaló.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Rate-limit best-effort: rechazar si ya hubo >3 redenciones exitosas desde
      // la MISMA IP en las últimas 24h (anti-abuso de un solo actor reclamando
      // muchos regalos). Se apoya en gift_events (event 'redeemed', meta.ip /
      // meta.redeem_ip). Si la consulta falla, NO bloqueamos (best-effort).
      if (ip) {
        try {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: recent } = await supabase
            .from('gift_events')
            .select('id, meta')
            .eq('event', 'redeemed')
            .gte('created_at', since)
            .limit(200);
          const fromThisIp = (recent || []).filter((r: any) => {
            const m = r?.meta || {};
            return !m.blocked && (m.ip === ip || m.redeem_ip === ip);
          }).length;
          if (fromThisIp > 3) {
            logGiftEvent({
              event: 'redeemed',
              code: gift.code,
              padrino_account: gift.padrino_account,
              meta: { blocked: true, reason: 'ip_rate_limit', ip, count_24h: fromThisIp },
            }).catch(() => {});
            return new Response(JSON.stringify({ error: 'Demasiadas redenciones desde esta conexión. Intenta más tarde o contáctanos.' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } catch (rlErr) {
          console.warn('[create-subscription] gift IP rate-limit check failed:', rlErr);
        }
      }
    }

    // ─── Embajador: link de referido de un cliente (?ref_account=<account>) ───
    // Solo aplica si NO hay gift (el regalo gratis gana al descuento 50%). El
    // referido paga su PRIMER AÑO del Plan Vende con 50% off. Anti auto-referido:
    // el account referidor no puede ser el mismo email/empresa que se registra.
    const refAccount = (!gift && typeof body.ref_account === 'string')
      ? body.ref_account.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      : '';

    // Gift y Embajador fuerzan plan Vende ANUAL server-side (ignora lo que mande el cliente)
    if (gift || refAccount) planId = 'vende';
    const billingPeriod = (gift || refAccount) ? 'annual' : (billing === 'annual' ? 'annual' : 'monthly');
    const priceId = PRICE_MAP[planId]?.[billingPeriod];

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Plan no válido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create or find customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer: Stripe.Customer;

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        name: nombre,
        phone: whatsapp,
        metadata: {
          empresa,
          giro,
          sucursales,
          source: 'website-prueba-gratis',
        },
      });
    }

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
      // Gift: MERGE sobre la metadata existente — nunca pisar empresa/giro/
      // sucursales/source que ya traía el customer (cliente recurrente o recién
      // creado). Solo agregamos las llaves del regalo.
      ...(gift
        ? {
            metadata: {
              ...(customer.metadata || {}),
              gift_code: gift.code,
              padrino_account: gift.padrino_account,
            },
          }
        : {}),
    });

    // ─── Regalo Buddy: lock optimista ANTES de crear la subscription ───
    // UPDATE ... WHERE status='pending' — si no afecta filas, alguien más lo redimió.
    if (gift) {
      const { data: locked, error: lockErr } = await supabase
        .from('gifts')
        .update({
          status: 'redeeming',
          redeeming_at: new Date().toISOString(),
          redeemed_email: normalizeEmail(email),
          meta: { ...(gift.meta || {}), redeem_ip: ip, redeem_at_attempt: new Date().toISOString() },
        })
        .eq('id', gift.id)
        .eq('status', 'pending')
        .select('id');
      if (lockErr || !locked || locked.length === 0) {
        return new Response(JSON.stringify({ error: 'Este regalo ya fue usado.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ── PROVISIONAR LA CUENTA *ANTES* DE CREAR LA SUSCRIPCIÓN ────────────────
    // Antes se provisionaba DESPUÉS de crear la sub → si fallaba, el cliente
    // quedaba suscrito/por-cobrar SIN cuenta usable y sin recuperación. Ahora va
    // ANTES: si el provisioning falla, NADIE queda con una suscripción imposible
    // de honrar (devolvemos error y, si es regalo, liberamos el lock). Si la sub
    // luego falla, la cuenta ya existe → recuperable, sin cobro de más.
    let accId = isValidAccountId(accountIdInput) ? accountIdInput : await generateUniqueAccountId(empresa || nombre);
    let pr = await provisionAccount({
      account_name: empresa, account_id: accId, nombre, email, password,
      client_ip: ip, whatsapp, giro, sucursales,
      plan: planId, source: gift ? 'web-regalo' : (refAccount ? 'web-referido' : 'web-pago'),
    });
    if (!pr.ok && pr.code === 'account_taken') {
      // Colisión de subdominio → regenerar y reintentar una vez.
      accId = await generateUniqueAccountId((empresa || nombre) + 'sacs');
      pr = await provisionAccount({
        account_name: empresa, account_id: accId, nombre, email, password,
        client_ip: ip, whatsapp, giro, sucursales,
        plan: planId, source: gift ? 'web-regalo' : (refAccount ? 'web-referido' : 'web-pago'),
      });
    }
    if (!pr.ok) {
      // Liberar el gift (si aplica) — nadie se cobró, no se creó ninguna sub.
      if (gift) {
        await supabase.from('gifts')
          .update({ status: 'pending', redeeming_at: null, redeemed_email: null })
          .eq('id', gift.id).eq('status', 'redeeming');
      }
      const msg = pr.code === 'email_taken'
        ? 'Ese correo ya tiene una cuenta. Inicia sesión.'
        : pr.code === 'rate_limited'
          ? 'Demasiados intentos desde esta conexión. Espera un momento.'
          : (pr.error || 'No pudimos crear tu cuenta. Intenta de nuevo.');
      return new Response(JSON.stringify({ error: msg, code: pr.code }), {
        status: pr.code === 'rate_limited' ? 429 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const provisionedAccountId = pr.data?.account_id || accId;

    // Create subscription
    // Flujo normal: trial de 7 días. Flujo gift: SIN trial + cupón 100% 'once'
    // (primer año $0, renueva automático al año 2 a precio normal).
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customer.id,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        empresa,
        giro,
        sucursales,
        plan: planId,
        billing: billingPeriod,
      },
    };
    if (gift) {
      subscriptionParams.discounts = [{ coupon: await getOrCreateGiftCoupon(priceId) }];
      subscriptionParams.metadata = {
        ...subscriptionParams.metadata,
        gift_code: gift.code,
        padrino_account: gift.padrino_account,
      };
      // M4 — Año 1 es gratis (cupón 100% 'once'), pero DEBEMOS validar la tarjeta
      // para que la renovación del año 2 no falle (churn). Mismo patrón que el
      // trial: como no hay cobro inmediato, default_incomplete +
      // save_default_payment_method:'on_subscription' hace que Stripe cree un
      // pending_setup_intent cuyo client_secret confirmamos en el cliente
      // (igual que el trial) para validar y guardar la tarjeta de la renovación.
      subscriptionParams.payment_behavior = 'default_incomplete';
    } else if (refAccount) {
      // Embajador: 50% off el primer año (cobro inmediato del 50%, SIN trial).
      subscriptionParams.discounts = [{ coupon: await getOrCreateClientRefCoupon(priceId) }];
      subscriptionParams.metadata = {
        ...subscriptionParams.metadata,
        client_ref_account: refAccount,
      };
    } else {
      subscriptionParams.trial_period_days = 7;
    }

    let subscription: Stripe.Subscription;
    try {
      // Idempotencia: dos submits del mismo (email+price+método) NO crean 2 subs
      // (anti doble-cobro por doble-click / reintento). Stripe la honra 24h.
      const idemKey = 'sub_' + createHash('sha256').update(email + '|' + priceId + '|' + paymentMethodId).digest('hex').slice(0, 48);
      subscription = await stripe.subscriptions.create(subscriptionParams, { idempotencyKey: idemKey });
    } catch (stripeErr) {
      // Si Stripe falla, liberar el gift para que pueda reintentarse
      if (gift) {
        await supabase
          .from('gifts')
          .update({ status: 'pending', redeeming_at: null, redeemed_email: null })
          .eq('id', gift.id)
          .eq('status', 'redeeming');
      }
      throw stripeErr;
    }

    // Gift: amarrar la subscription al gift (el webhook lo pasa a 'redeemed')
    if (gift) {
      await supabase
        .from('gifts')
        .update({ stripe_subscription_id: subscription.id })
        .eq('id', gift.id);
    }

    // Embajador: registrar el referido (status 'started'). El webhook lo pasa a
    // 'paid' y acredita el 40% al referidor cuando el pago se confirma.
    // Anti auto-referido: si el referidor es la misma cuenta recién provisionada,
    // NO se registra (no se premia referirse a sí mismo).
    if (refAccount && refAccount !== provisionedAccountId) {
      await supabase.from('client_referrals').upsert({
        referrer_account: refAccount,
        referred_email: normalizeEmail(email),
        referred_account: provisionedAccountId,
        stripe_subscription_id: subscription.id,
        status: 'started',
        meta: { empresa, plan: planId, ip },
      }, { onConflict: 'referrer_account,referred_email' });
    }

    // TikTok server-side: CompletePayment (no aplica en gift: cargo $0)
    const planPrices: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 5900 };
    const planValue = gift ? GIFT_PLAN_VALUE_MXN : (planPrices[planId] || 0);
    const ua = request.headers.get('user-agent') || '';
    if (!gift) sendTikTokEvent(email, whatsapp || '', planId, planValue, ip, ua).catch(() => {});

    // ─── Atribución partner + CRM ──────────────────────────────────────
    // 1. Resolver partner referido (cookie sacs_ref o ?ref)
    // 2. Crear/actualizar contact en Supabase
    // 3. Crear deal stage='won' + atribución
    // 4. Disparar venta_directa commission
    try {
      const referrerPartnerId = await getReferrerFromRequest(request);

      // Upsert company
      let company_id: string | null = null;
      if (empresa) {
        const { data: existingCo } = await supabase
          .from('companies')
          .select('id')
          .eq('nombre', empresa)
          .limit(1)
          .maybeSingle();
        if (existingCo) {
          company_id = existingCo.id;
        } else {
          const { data: newCo } = await supabase
            .from('companies')
            .insert({ nombre: empresa, giro: giro || null, sucursales: parseInt(String(sucursales)) || 1 })
            .select('id')
            .single();
          if (newCo) company_id = newCo.id;
        }
      }

      // Upsert contact (by email)
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, referrer_partner_id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();

      let contactId: string | null = null;
      if (existingContact) {
        contactId = existingContact.id;
        const updates: Record<string, any> = {
          lifecycle_stage: 'cliente',
          plan_interes: planId,
          stripe_customer_id: customer.id,
          company_id: company_id || undefined,
        };
        if (referrerPartnerId && !existingContact.referrer_partner_id) {
          updates.referrer_partner_id = referrerPartnerId;
          updates.fuente = 'partner-link';
        }
        await supabase.from('contacts').update(updates).eq('id', contactId);
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            nombre: nombre || 'Sin nombre',
            email,
            whatsapp: whatsapp || null,
            tipo: 'lead',
            lifecycle_stage: 'cliente',
            // Fuente real: create-subscription SIEMPRE implica tarjeta/Stripe
            // (la prueba gratis SIN tarjeta va por /api/register-account). Por
            // eso el fallback es 'website-pago', NO 'website-prueba-gratis'.
            fuente: gift ? 'regalo-buddy' : (refAccount ? 'cliente-referido' : (referrerPartnerId ? 'partner-link' : 'website-pago')),
            company_id,
            plan_interes: planId,
            giro: giro || null,
            sucursales_interes: parseInt(String(sucursales)) || null,
            stripe_customer_id: customer.id,
            referrer_partner_id: referrerPartnerId,
          })
          .select('id')
          .single();
        if (newContact) contactId = newContact.id;
      }

      // Upsert deal — reusar el deal abierto del contact si existe (creado al agendar demo)
      // Gift: el deal + activity los crea el webhook al confirmar la redención
      // (origen regalo-buddy, valor $6,000, stage ganado) — aquí solo el contact.
      let dealId: string | null = null;
      if (contactId && !gift) {
        const { data: openDeal } = await supabase
          .from('deals')
          .select('id, referrer_partner_id')
          .eq('contact_id', contactId)
          .not('stage', 'in', '(cerrada_ganada,cerrada_perdida)')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openDeal) {
          dealId = openDeal.id;
          const updates: Record<string, any> = {
            stage: 'cerrada_ganada',
            closed_at: new Date().toISOString(),
            valor_total: planValue,
            valor_mensual: billingPeriod === 'monthly' ? planValue : Math.round((planValue / 12) * 100) / 100,
            plan: planId,
            billing_period: billingPeriod === 'monthly' ? 'mensual' : 'anual',
            probabilidad: 100,
          };
          if (referrerPartnerId && !openDeal.referrer_partner_id) {
            updates.referrer_partner_id = referrerPartnerId;
          }
          await supabase.from('deals').update(updates).eq('id', dealId);
        } else {
          const { data: newDeal } = await supabase
            .from('deals')
            .insert({
              nombre: `Plan ${planId} · ${empresa || nombre || email}`,
              contact_id: contactId,
              company_id,
              stage: 'cerrada_ganada',
              valor_total: planValue,
              valor_mensual: billingPeriod === 'monthly' ? planValue : Math.round((planValue / 12) * 100) / 100,
              closed_at: new Date().toISOString(),
              referrer_partner_id: referrerPartnerId,
              plan: planId,
              billing_period: billingPeriod === 'monthly' ? 'mensual' : 'anual',
              sucursales: parseInt(String(sucursales)) || 1,
              probabilidad: 100,
            })
            .select('id')
            .single();
          if (newDeal) dealId = newDeal.id;
        }
      }

      // Activity log (gift: la registra el webhook con el padrino)
      if (contactId && !gift) {
        await supabase.from('activities').insert({
          contact_id: contactId,
          company_id,
          deal_id: dealId,
          tipo: 'pago_confirmado',
          titulo: `Suscripción ${planId} (${billingPeriod}) · ${empresa || email}`,
          metadata: {
            stripe_subscription_id: subscription.id,
            plan: planId,
            billing: billingPeriod,
            value: planValue,
            referrer_partner_id: referrerPartnerId,
          },
          automatico: true,
        });
      }

      // Comisión venta_directa al partner referido
      if (referrerPartnerId && dealId) {
        try {
          await createCommissionForDeal({
            deal_id: dealId,
            partner_id: referrerPartnerId,
            deal_value: planValue,
          });
        } catch (e) {
          console.warn('[create-subscription] createCommissionForDeal failed:', e);
        }
      }
    } catch (crmErr) {
      console.error('[create-subscription] CRM sync error:', crmErr);
    }

    // La cuenta YA se provisionó antes de crear la suscripción (provisionedAccountId).
    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        account_id: provisionedAccountId,
        provision_pending: false,
        clientSecret: subscription.pending_setup_intent
          ? (typeof subscription.pending_setup_intent === 'string'
              ? subscription.pending_setup_intent
              : subscription.pending_setup_intent.client_secret)
          : null,
        status: subscription.status,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
