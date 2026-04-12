import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createHash } from 'crypto';

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { nombre, empresa, giro, sucursales, whatsapp, email, paymentMethodId, planId, billing } = body;

    // Validate required fields
    if (!email || !paymentMethodId || !planId) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const billingPeriod = billing === 'annual' ? 'annual' : 'monthly';
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
    });

    // Create subscription with 7-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 7,
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
    });

    // TikTok server-side: CompletePayment
    const planPrices: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 2900 };
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    const ua = request.headers.get('user-agent') || '';
    sendTikTokEvent(email, whatsapp || '', planId, planPrices[planId] || 0, ip, ua).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
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
