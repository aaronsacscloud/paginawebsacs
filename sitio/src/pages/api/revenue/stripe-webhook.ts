import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { supabase } from '../../../lib/supabase';
import { sendAcuseEmail } from '../../../lib/payments/send-acuse';
import { notify } from '../../../lib/notify';
import { sendWhatsApp } from '../../../lib/kapso';
import { logGiftEvent } from '../../../lib/gifts';
import { creditWallet, GIFT_ACTIVATION_BONUS_MXN, REFERRAL_COMMISSION_PCT } from '../../../lib/wallet';
import { CLIENT_REF_COMMISSION_MXN } from '../../../data/referral';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET || '';
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

async function sendTikTokPayment(email: string, phone: string, plan: string, amount: number) {
  if (!TIKTOK_TOKEN) return;
  const e164 = toE164(phone);
  const event = {
    pixel_code: TIKTOK_PIXEL,
    event: 'CompletePayment',
    event_id: `stripe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_time: Math.floor(Date.now() / 1000),
    context: { user: { email: email ? sha256(email) : undefined, phone: e164 ? sha256(e164) : undefined } },
    properties: {
      contents: [{ content_id: plan || 'subscription', content_name: plan || 'subscription' }],
      content_type: 'product',
      value: amount,
      currency: 'MXN',
    },
  };
  await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': TIKTOK_TOKEN },
    body: JSON.stringify({ event_source: 'web', event_source_id: TIKTOK_PIXEL, data: [event] }),
  }).catch(() => {});
}

// ─── Idempotency: skip if event already processed ───
async function alreadyProcessed(eventId: string, eventType: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('stripe_events_processed').select('event_id').eq('event_id', eventId).maybeSingle();
    if (data) return true;
    await supabase.from('stripe_events_processed').insert({ event_id: eventId, event_type: eventType });
    return false;
  } catch (err) {
    // Table may not exist yet — fall through to allow processing (at-least-once semantics)
    console.warn('[stripe-webhook] idempotency table unavailable:', err);
    return false;
  }
}

// ─── Helpers: quote meta + timeline ───
async function appendQuoteTimeline(quoteId: string, event: Record<string, any>) {
  const { data } = await supabase.from('quotes').select('notas').eq('id', quoteId).single();
  if (!data) return;
  const sep = '\n---META---\n';
  const raw = data.notas || '';
  const idx = raw.indexOf(sep);
  let text = raw;
  let meta: any = {};
  if (idx >= 0) {
    text = raw.slice(0, idx);
    try { meta = JSON.parse(raw.slice(idx + sep.length)) || {}; } catch {}
  }
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ ...event, at: event.at || new Date().toISOString() });
  await supabase.from('quotes').update({ notas: text + sep + JSON.stringify(meta) }).eq('id', quoteId);
}

async function insertPayment(row: {
  quote_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  fecha: string;
  monto: number;
  metodo: string;
  referencia?: string | null;
  stripe_payment_id?: string | null;
}) {
  // insert — if column doesn't exist (e.g., stripe_payment_id before migration), retry without it
  const payload: any = {
    fecha: row.fecha,
    monto: row.monto,
    metodo: row.metodo,
    referencia: row.referencia || null,
    contact_id: row.contact_id || null,
    company_id: row.company_id || null,
    quote_id: row.quote_id || null,
  };
  if (row.stripe_payment_id) payload.stripe_payment_id = row.stripe_payment_id;
  let res = await supabase.from('payments').insert(payload).select().maybeSingle();
  // Retry path: drop columns that may not exist yet (pre-migration environments)
  if (res.error) {
    const msg = String(res.error.message || '');
    if (msg.includes('quote_id')) { delete payload.quote_id; res = await supabase.from('payments').insert(payload).select().maybeSingle(); }
    if (res.error && String(res.error.message || '').includes('stripe_payment_id')) {
      delete payload.stripe_payment_id;
      res = await supabase.from('payments').insert(payload).select().maybeSingle();
    }
  }
  return res;
}

async function insertInvoice(row: {
  quote_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  payment_id?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  moneda?: string;
  tipo?: 'unica' | 'recurrente' | 'credito' | 'complemento_pago' | 'parcial';
  estado?: 'borrador' | 'emitida' | 'pagada' | 'cancelada' | 'parcial';
  stripe_invoice_id?: string | null;
  pdf_url?: string | null;
  emitida_at?: string | null;
  pagada_at?: string | null;
}) {
  try {
    return await supabase.from('invoices').insert({
      quote_id: row.quote_id || null,
      contact_id: row.contact_id || null,
      company_id: row.company_id || null,
      payment_id: row.payment_id || null,
      subtotal: row.subtotal,
      iva: row.iva,
      total: row.total,
      moneda: row.moneda || 'MXN',
      tipo: row.tipo || 'unica',
      estado: row.estado || 'pagada',
      stripe_invoice_id: row.stripe_invoice_id || null,
      pdf_url: row.pdf_url || null,
      emitida_at: row.emitida_at || new Date().toISOString(),
      pagada_at: row.pagada_at || null,
    }).select().maybeSingle();
  } catch (err) {
    console.warn('[stripe-webhook] invoices table not available:', err);
    return { data: null, error: err };
  }
}

async function syncSubscriptionToCompany(subscriptionId: string, customerId: string, quoteId?: string) {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    const item = sub.items?.data?.[0];
    const mrr = item?.price?.unit_amount ? (item.price.unit_amount / 100) * (item.quantity || 1) : 0;

    // Try find company via quote
    let companyId: string | null = null;
    if (quoteId) {
      const { data: q } = await supabase.from('quotes').select('company_id').eq('id', quoteId).single();
      companyId = q?.company_id || null;
    }
    if (!companyId) {
      const { data: c } = await supabase.from('companies').select('id').eq('stripe_customer_id', customerId).maybeSingle();
      companyId = c?.id || null;
    }
    if (!companyId) return;

    const updates: any = {
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      fecha_renovacion: periodEnd,
      estado_cuenta: sub.status === 'active' || sub.status === 'trialing' ? 'activo' : sub.status === 'past_due' ? 'vencido' : sub.status === 'canceled' ? 'cancelado' : 'activo',
    };
    if (mrr > 0) { updates.mrr = mrr; updates.arr = mrr * 12; }

    await supabase.from('companies').update(updates).eq('id', companyId);
  } catch (err) {
    console.error('[stripe-webhook] syncSubscriptionToCompany error:', err);
  }
}

// ─── Regalo Buddy: confirmar redención cuando la subscription queda activa ───
// La subscription gift trae metadata.gift_code (la setea create-subscription, que
// dejó el gift en 'redeeming'). Aquí: gift → 'redeemed' + contact + deal + activity.
// Idempotente: el UPDATE condicionado por status solo transiciona una vez.
async function handleGiftRedemption(sub: Stripe.Subscription) {
  const giftCode = sub.metadata?.gift_code;
  if (!giftCode) return;
  if (sub.status !== 'active' && sub.status !== 'trialing') return;

  const { data: rows } = await supabase
    .from('gifts')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      stripe_subscription_id: sub.id,
    })
    .eq('code', giftCode)
    // M3 — SOLO transicionar desde 'redeeming'. Si el gift ya fue revertido a
    // 'pending' (lock viejo expirado / checkout abortado), NO lo marcamos
    // redeemed: hacerlo regalaría el plan sin un checkout activo que lo respalde.
    .eq('status', 'redeeming')
    .select('*');

  const gift = rows?.[0];
  if (!gift) return; // ya redimido (retry de Stripe), revertido a pending o revocado

  // 💰 Bono al PADRINO por que su amigo activó el año gratis = 40% del valor
  // de la licencia ($2,400 con Vende anual $6,000). Idempotente:
  // el índice único parcial (gift_code WHERE kind='referral_activation_bonus')
  // impide pagar doble aunque el webhook se repita. Best-effort: si falla, NO
  // tumba la redención (el regalo ya quedó 'redeemed').
  try {
    await creditWallet({
      account: gift.padrino_account,
      amount_mxn: GIFT_ACTIVATION_BONUS_MXN,
      kind: 'referral_activation_bonus',
      concepto: 'Bono por activación de tu Buddy — 40% de la licencia (Plan Vende)',
      gift_code: gift.code,
      referred_email: gift.redeemed_email || null,
    });
  } catch (e) {
    console.error('[stripe-webhook] gift activation bonus error:', e);
  }

  try {
    // Resolver email del redentor: gift.redeemed_email o el customer de Stripe
    let email: string = gift.redeemed_email || '';
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    if (!email && customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        email = (customer.email || '').trim().toLowerCase();
      } catch {}
    }

    // Crear/actualizar contact con la nota del padrino
    let contactId: string | null = null;
    let companyId: string | null = null;
    if (email) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
      if (contact) {
        contactId = contact.id;
        companyId = contact.company_id || null;
        await supabase
          .from('contacts')
          .update({
            fuente: 'regalo-buddy',
            fuente_detalle: `Regalo Buddy de ${gift.padrino_account}${gift.padrino_nombre ? ` (${gift.padrino_nombre})` : ''}`,
            lifecycle_stage: 'cliente',
          })
          .eq('id', contactId);
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            nombre: email,
            email,
            tipo: 'lead',
            lifecycle_stage: 'cliente',
            fuente: 'regalo-buddy',
            fuente_detalle: `Regalo Buddy de ${gift.padrino_account}${gift.padrino_nombre ? ` (${gift.padrino_nombre})` : ''}`,
            plan_interes: 'vende',
            stripe_customer_id: customerId || null,
          })
          .select('id')
          .single();
        if (newContact) contactId = newContact.id;
      }
    }

    if (contactId) {
      await supabase.from('gifts').update({ redeemed_by_contact: contactId }).eq('id', gift.id);
    }

    // Deal ganado: origen regalo-buddy, plan Vende anual, valor $6,000
    let dealId: string | null = null;
    if (contactId) {
      const { data: newDeal } = await supabase
        .from('deals')
        .insert({
          nombre: `Regalo Buddy · Plan Vende anual · ${sub.metadata?.empresa || email}`,
          contact_id: contactId,
          company_id: companyId,
          stage: 'cerrada_ganada',
          plan: 'vende',
          billing_period: 'anual',
          valor_total: 6000,
          valor_mensual: 500,
          probabilidad: 100,
          closed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (newDeal) dealId = newDeal.id;
    }

    // Activity en el contact
    if (contactId) {
      await supabase.from('activities').insert({
        contact_id: contactId,
        company_id: companyId,
        deal_id: dealId,
        tipo: 'sistema',
        titulo: `Redimió regalo Buddy de ${gift.padrino_account}`,
        metadata: {
          origen: 'regalo-buddy',
          gift_code: gift.code,
          padrino_account: gift.padrino_account,
          padrino_nombre: gift.padrino_nombre,
          stripe_subscription_id: sub.id,
          valor: 6000,
        },
        automatico: true,
      });
    }

    // ─── M3 — NOTIFICAR AL PADRINO: su ahijado activó el regalo ───
    // Resolver un nombre legible del redentor (empresa del subscription, nombre
    // del contact, o el email). Mandar por WhatsApp (Kapso) y/o Email (Resend)
    // según los datos del padrino. best-effort: nunca rompe la redención.
    let notifyDelivered = false;
    let notifyAttempted = false;
    try {
      let redentorNombre: string | null = sub.metadata?.empresa || null;
      if (!redentorNombre && contactId) {
        const { data: rc } = await supabase.from('contacts').select('nombre').eq('id', contactId).maybeSingle();
        redentorNombre = rc?.nombre || null;
      }
      if (!redentorNombre) redentorNombre = email || 'tu negocio amigo';
      const padrinoNombre = gift.padrino_nombre || '';
      const mensajeWa = `🤝 ${redentorNombre} activó tu regalo del Plan Vende — ya son Buddys${padrinoNombre ? `, ${padrinoNombre}` : ''}. ¡Gracias por sumar a otro negocio a la red SACS!`;

      // WhatsApp (Kapso) — solo si el padrino dejó número
      if (gift.padrino_whatsapp) {
        notifyAttempted = true;
        const wa = await sendWhatsApp(gift.padrino_whatsapp, mensajeWa);
        if (wa?.sent) notifyDelivered = true;
      }
      // Email (Resend) — solo si el padrino dejó email
      if (gift.padrino_email) {
        notifyAttempted = true;
        const em = await notify({
          channel: 'email',
          to: gift.padrino_email,
          template: 'gift_redeemed_padrino',
          data: {
            padrino: padrinoNombre,
            redentor: redentorNombre,
            adminUrl: 'https://app.sacscloud.com',
          },
        });
        if (em?.ok) notifyDelivered = true;
      }
    } catch (notifyErr) {
      console.error('[stripe-webhook] gift padrino notify error:', notifyErr);
    }

    // Bitácora de telemetría: 'redeemed'. Si NO se pudo notificar (sin infra /
    // sin contacto del padrino / proveedor caído) → flag notify_pending para
    // reintentar/seguir a mano. (No inventamos credenciales — si no hay canal,
    // queda registrado el intento.)
    logGiftEvent({
      event: 'redeemed',
      code: gift.code,
      padrino_account: gift.padrino_account,
      meta: {
        redeemed_email: email || null,
        // IP de la redención (la guardó el lock optimista en gifts.meta.redeem_ip)
        // — la usa el rate-limit por IP de create-subscription.
        ip: gift.meta?.redeem_ip || null,
        redeem_ip: gift.meta?.redeem_ip || null,
        stripe_subscription_id: sub.id,
        notify_attempted: notifyAttempted,
        notify_delivered: notifyDelivered,
        // TODO si notify_pending: revisar canal del padrino / proveedor (Kapso/Resend)
        notify_pending: !notifyDelivered,
      },
    }).catch(() => {});
  } catch (err) {
    console.error('[stripe-webhook] gift redemption CRM error:', err);
  }
}

// 💸 Comisión del 40% al PADRINO cuando su referido PAGA (renovación año 2 o
// upgrade). Se dispara en invoice.paid con monto > 0 sobre una subscription que
// trae metadata.gift_code (la puso create-subscription al redimir). Tope "1 vez
// al año por cliente": el índice único parcial (referred_email, ref_year) lo
// hace cumplir a nivel DB → aunque haya 2 invoices pagados el mismo año, solo el
// primero acredita. Además, cada comisión DESBLOQUEA una nueva licencia para
// regalar (lo cuenta create.ts). Best-effort: nunca tumba el procesamiento del
// invoice.
async function handleReferralCommission(invoice: Stripe.Invoice) {
  try {
    const subId = (invoice as any).subscription
      ? (typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : (invoice as any).subscription.id)
      : null;
    if (!subId) return;
    const amount = (invoice.amount_paid || 0) / 100;
    if (amount <= 0) return;

    const sub = await stripe.subscriptions.retrieve(subId);
    const giftCode = sub.metadata?.gift_code;
    const padrinoAccount = sub.metadata?.padrino_account;
    if (!giftCode || !padrinoAccount) return; // no es una subscription de regalo

    // Datos del referido (para el concepto y el tope por cliente).
    const { data: giftRow } = await supabase
      .from('gifts')
      .select('redeemed_email, padrino_email, padrino_whatsapp')
      .eq('code', giftCode)
      .maybeSingle();
    const referredEmail = (giftRow?.redeemed_email || '').toLowerCase() || null;
    const refYear = new Date().getFullYear();
    const commission = Math.round(amount * REFERRAL_COMMISSION_PCT * 100) / 100;

    const nombreRef = referredEmail || 'tu referido';
    const { credited } = await creditWallet({
      account: padrinoAccount,
      amount_mxn: commission,
      kind: 'referral_payment_commission',
      concepto: `${Math.round(REFERRAL_COMMISSION_PCT * 100)}% del pago de ${nombreRef} (gracias por traerlo a Sacs)`,
      gift_code: giftCode,
      referred_email: referredEmail,
      stripe_payment_id: invoice.id,
      ref_year: refYear,
      meta: { invoice_amount: amount, pct: REFERRAL_COMMISSION_PCT },
    });

    // Solo notificar si ESTA llamada fue la que acreditó (no en duplicados).
    // WhatsApp (Kapso) free-form — mismo canal que usa la notificación de redención.
    if (credited && giftRow?.padrino_whatsapp) {
      const msg = `💸 ¡Tu Buddy pagó su plan en Sacs! Ganaste $${commission.toLocaleString('es-MX')} MXN en créditos (Saldo Sacs) y se te desbloqueó otra licencia para regalar. 🎁`;
      sendWhatsApp(giftRow.padrino_whatsapp, msg).catch(() => {});
    }
  } catch (err) {
    console.error('[stripe-webhook] referral commission error:', err);
  }
}

// 🤝 EMBAJADOR: 40% del valor de la licencia ($2,400 fijo) al CLIENTE referidor
// cuando su referido PAGA (su primer año del Plan Vende, con 50% off). Se dispara
// en invoice.payment_succeeded con monto > 0 sobre una subscription que trae
// metadata.client_ref_account (la puso create-subscription). Idempotente: el
// índice único parcial (referred_email WHERE kind='client_referral_commission')
// garantiza UNA sola comisión por referido. Best-effort: nunca tumba el invoice.
async function handleClientReferralCommission(invoice: Stripe.Invoice) {
  try {
    const subId = (invoice as any).subscription
      ? (typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : (invoice as any).subscription.id)
      : null;
    if (!subId) return;
    const amount = (invoice.amount_paid || 0) / 100;
    if (amount <= 0) return; // solo pagos reales (el 50% del primer año)

    const sub = await stripe.subscriptions.retrieve(subId);
    const refAccount = sub.metadata?.client_ref_account;
    if (!refAccount) return; // no es un referido del programa Embajador

    // Email del referido (para concepto + tope idempotente).
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    let referredEmail = '';
    if (customerId) {
      try {
        const cu = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        referredEmail = (cu.email || '').trim().toLowerCase();
      } catch {}
    }

    const { credited } = await creditWallet({
      account: refAccount,
      amount_mxn: CLIENT_REF_COMMISSION_MXN,
      kind: 'client_referral_commission',
      concepto: `40% de la licencia por tu referido${referredEmail ? ' ' + referredEmail : ''} (gracias por traerlo a Sacs)`,
      referred_email: referredEmail || null,
      stripe_payment_id: invoice.id,
      meta: { invoice_amount: amount, program: 'embajador' },
    });

    // Marcar el referido como pagado en el tracking (para métricas en sacs3).
    if (referredEmail) {
      await supabase
        .from('client_referrals')
        .update({ status: 'paid', commission_credited: credited, paid_at: new Date().toISOString() })
        .eq('referrer_account', refAccount)
        .eq('referred_email', referredEmail);
    }

    // CRM: deja rastro de que un referido de cliente pagó (solo si acreditó ahora).
    if (credited) {
      try {
        await supabase.from('activities').insert({
          tipo: 'sistema',
          titulo: `Embajador: ${refAccount} ganó $${CLIENT_REF_COMMISSION_MXN.toLocaleString('es-MX')} en créditos (su referido ${referredEmail || ''} pagó)`,
          metadata: { referrer_account: refAccount, referred_email: referredEmail, amount: CLIENT_REF_COMMISSION_MXN, program: 'embajador' },
          automatico: true,
        });
      } catch {}
    }
  } catch (err) {
    console.error('[stripe-webhook] client referral commission error:', err);
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  // FAIL-CLOSED: sin el secreto del webhook NUNCA confiamos en el body. Antes
  // se hacía `JSON.parse(body)` cuando endpointSecret estaba vacío — eso permitía
  // forjar un evento `customer.subscription.created` con metadata.gift_code y
  // redimir un regalo (flip a 'redeemed' + CRM + notificación al padrino) sin
  // pagarle un centavo a Stripe. En producción el secreto SIEMPRE está seteado;
  // si falta, es un error de configuración y rechazamos, no abrimos la puerta.
  if (!endpointSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET no configurado — rechazando (fail-closed)');
    return new Response(JSON.stringify({ error: 'Webhook no configurado' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Webhook error: ${err.message}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Idempotency guard
  if (await alreadyProcessed(event.id, event.type)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // ─── checkout.session.completed (quote first charge) ───
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Partner Certification fast path: distinct from quote/subscription flow
      if (session.metadata?.type === 'partner_certification') {
        const certId = session.metadata?.cert_id;
        const partnerId = session.metadata?.partner_id;
        const stripePaymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        if (certId && partnerId) {
          // Upsert by (partner_id, cert_id) — UNIQUE constraint
          await supabase
            .from('partner_certifications')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_session_id: session.id,
              stripe_payment_id: stripePaymentId,
            })
            .eq('partner_id', partnerId)
            .eq('cert_id', certId);
          // Log activity
          try {
            await supabase.from('activities').insert({
              tipo: 'sistema',
              titulo: `Partner pagó certificación ${certId} ($${(session.amount_total || 0) / 100} MXN)`,
              metadata: { partner_id: partnerId, cert_id: certId, amount: session.amount_total, stripe_session_id: session.id },
              automatico: true,
            });
          } catch {}
        }
        return new Response(JSON.stringify({ received: true, partner_certification: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const quoteId = session.metadata?.quote_id;

      if (quoteId) {
        const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).single();

        // Mark quote paid
        await supabase.from('quotes').update({
          estado: 'paid',
          aceptado_fecha: quote?.aceptado_fecha || new Date().toISOString(),
        }).eq('id', quoteId);

        // Insert payment record
        const amount = (session.amount_total || 0) / 100;
        const stripePaymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const paymentRes = await insertPayment({
          quote_id: quoteId,
          contact_id: quote?.contact_id || null,
          company_id: quote?.company_id || null,
          fecha: new Date().toISOString(),
          monto: amount,
          metodo: 'stripe',
          referencia: stripePaymentId,
          stripe_payment_id: stripePaymentId,
        });

        // Insert invoice record
        const ivaIncluded = quote?.iva_incluido ? amount - (amount / 1.16) : 0;
        await insertInvoice({
          quote_id: quoteId,
          contact_id: quote?.contact_id || null,
          company_id: quote?.company_id || null,
          payment_id: paymentRes?.data?.id || null,
          subtotal: amount - ivaIncluded,
          iva: ivaIncluded,
          total: amount,
          moneda: (session.currency || 'mxn').toUpperCase(),
          tipo: 'unica',
          estado: 'pagada',
          stripe_invoice_id: typeof session.invoice === 'string' ? session.invoice : null,
          emitida_at: new Date().toISOString(),
          pagada_at: new Date().toISOString(),
        });

        await appendQuoteTimeline(quoteId, { event: 'paid', source: 'stripe', amount });

        // Auto-enviar acuse de pago al cliente (best-effort)
        if (paymentRes?.data?.id) {
          try {
            await sendAcuseEmail(paymentRes.data.id);
          } catch (err) {
            console.error('[stripe-webhook] sendAcuseEmail error:', err);
          }
        }

        // Activity
        await supabase.from('activities').insert({
          contact_id: quote?.contact_id,
          company_id: quote?.company_id,
          deal_id: quote?.deal_id,
          tipo: 'pago',
          titulo: `Pago recibido — Cotización ${quote?.numero || ''}`,
          metadata: { quote_id: quoteId, monto: amount, stripe_session_id: session.id, stripe_payment_id: stripePaymentId },
          automatico: true,
        });

        // Commission: mark earned when payment received for a deal.
        // Si no existe commission pending todavía (deal cerrado sin pasar por
        // sync-quote-deal), créala primero usando atribución del deal.
        if (quote?.deal_id) {
          try {
            const { markCommissionEarned } = await import('../../../lib/commissions/settle');
            const result = await markCommissionEarned(quote.deal_id);
            if (!result.ok && result.reason === 'no pending commission for deal') {
              // Fallback: create commission then mark earned
              const { data: dealRow } = await supabase
                .from('deals')
                .select('referrer_partner_id, owner_id, valor_total')
                .eq('id', quote.deal_id)
                .maybeSingle();
              const partnerId = (dealRow as any)?.referrer_partner_id || dealRow?.owner_id;
              if (partnerId) {
                const { createCommissionForDeal } = await import('../../../lib/commissions/calculate');
                const c = await createCommissionForDeal({
                  deal_id: quote.deal_id,
                  partner_id: partnerId,
                  deal_value: dealRow?.valor_total ?? amount,
                  notes: 'Auto-created from Stripe webhook',
                });
                if (c.ok) await markCommissionEarned(quote.deal_id);
              }
            }
          } catch (err) {
            console.error('[stripe-webhook] commission settle error:', err);
          }
        }

        // TikTok event
        if (quote) {
          await sendTikTokPayment(
            quote.email || '',
            quote.whatsapp || '',
            'cotizacion-' + (quote.empresa || '').slice(0, 20),
            amount,
          );
        }
      }
    }

    // ─── customer.subscription.created / updated ───
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const quoteId = sub.metadata?.quote_id;
      await syncSubscriptionToCompany(sub.id, customerId, quoteId);
      // Regalo Buddy: confirmar redención (solo subscriptions con metadata.gift_code)
      await handleGiftRedemption(sub);
    }

    // ─── invoice.paid (renewal) ───
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      const amount = (invoice.amount_paid || 0) / 100;
      const stripePaymentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id;

      // Find company
      let companyId: string | null = null;
      if (customerId) {
        const { data: c } = await supabase.from('companies').select('id, contact_id').eq('stripe_customer_id', customerId).maybeSingle();
        companyId = c?.id || null;

        if (companyId && amount > 0) {
          const paymentRes = await insertPayment({
            company_id: companyId,
            contact_id: (c as any)?.contact_id || null,
            fecha: new Date().toISOString(),
            monto: amount,
            metodo: 'stripe_subscription',
            referencia: stripePaymentId,
            stripe_payment_id: stripePaymentId,
          });

          await insertInvoice({
            company_id: companyId,
            contact_id: (c as any)?.contact_id || null,
            payment_id: paymentRes?.data?.id || null,
            subtotal: amount,
            iva: 0,
            total: amount,
            moneda: (invoice.currency || 'mxn').toUpperCase(),
            tipo: 'recurrente',
            estado: 'pagada',
            stripe_invoice_id: invoice.id,
            pdf_url: invoice.invoice_pdf || null,
            emitida_at: new Date().toISOString(),
            pagada_at: new Date().toISOString(),
          });
        }
      }

      // Sync period / renewal
      if (invoice.subscription) {
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
        if (customerId) await syncSubscriptionToCompany(subId, customerId);
      }

      // 💸 Comisión 40% al padrino si este pago es de un referido (Buddy).
      await handleReferralCommission(invoice);
      // 🤝 Comisión 40% ($2,400) al cliente referidor si es del programa Embajador.
      await handleClientReferralCommission(invoice);

      // TikTok event
      if (customerId) {
        try {
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          const plan = customer.metadata?.plan || '';
          await sendTikTokPayment(customer.email || '', customer.phone || '', plan, amount);
        } catch {}
      }
    }

    // ─── invoice.payment_failed ───
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const { data: c } = await supabase.from('companies').select('id, contact_id').eq('stripe_customer_id', customerId).maybeSingle();
        if (c?.id) {
          await supabase.from('companies').update({ estado_cuenta: 'vencido' }).eq('id', c.id);
          await supabase.from('activities').insert({
            contact_id: (c as any)?.contact_id || null,
            company_id: c.id,
            tipo: 'pago',
            titulo: `Pago fallido — $${((invoice.amount_due || 0) / 100).toFixed(0)} ${(invoice.currency || 'mxn').toUpperCase()}`,
            metadata: { event: 'pago_vencido', stripe_invoice_id: invoice.id, amount_due: invoice.amount_due },
            automatico: true,
          });
        }
      }
    }

    // ─── customer.subscription.deleted (churn) ───
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const { data: c } = await supabase.from('companies').select('id, contact_id, mrr').eq('stripe_customer_id', customerId).maybeSingle();
      if (c?.id) {
        await supabase.from('companies').update({ estado_cuenta: 'cancelado' }).eq('id', c.id);
        if ((c as any)?.contact_id) {
          await supabase.from('contacts').update({ lifecycle_stage: 'churned', tipo: 'churned' }).eq('id', (c as any).contact_id);
        }
        // Insert churn event (if table exists)
        try {
          await supabase.from('churn_events').insert({
            company_id: c.id,
            contact_id: (c as any)?.contact_id || null,
            reason: 'otro',
            mrr_lost: (c as any)?.mrr || 0,
            cancelled_at: new Date().toISOString(),
          });
        } catch {}
        await supabase.from('activities').insert({
          contact_id: (c as any)?.contact_id || null,
          company_id: c.id,
          tipo: 'sistema',
          titulo: 'Suscripción cancelada',
          metadata: { event: 'subscription_deleted', stripe_subscription_id: sub.id },
          automatico: true,
        });
      }
    }
  } catch (handlerErr) {
    console.error('[stripe-webhook] handler error:', handlerErr, 'event:', event.type);
    // still return 200 to prevent Stripe retries (error logged)
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
