import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { supabase } from '../../../lib/supabase';

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
    context: {
      user: {
        email: email ? sha256(email) : undefined,
        phone: e164 ? sha256(e164) : undefined,
      },
    },
    properties: {
      contents: [{ content_id: plan || 'subscription', content_name: plan || 'subscription' }],
      content_type: 'product',
      value: amount,
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

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Webhook error: ${err.message}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // ─── Subscription payment (first after trial or recurring) ───
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (customerId && invoice.subscription) {
      try {
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const sub = await stripe.subscriptions.retrieve(
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
        );
        const plan = sub.metadata?.plan || customer.metadata?.plan || '';
        const email = customer.email || '';
        const phone = customer.phone || '';
        const amount = (invoice.amount_paid || 0) / 100;

        await sendTikTokPayment(email, phone, plan, amount);
      } catch (err) {
        console.error('TikTok event error:', err);
      }
    }
  }

  // ─── Quote payment ───
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quote_id;

    if (quoteId) {
      // Update quote status to paid
      await supabase.from('quotes').update({
        estado: 'paid',
        aceptado_fecha: new Date().toISOString(),
      }).eq('id', quoteId);

      // Add timeline event
      const { data: quote } = await supabase.from('quotes').select('notas').eq('id', quoteId).single();
      if (quote) {
        const sep = '\n---META---\n';
        const idx = (quote.notas || '').indexOf(sep);
        let text = quote.notas || '';
        let meta: any = {};
        if (idx >= 0) {
          text = quote.notas.slice(0, idx);
          try { meta = JSON.parse(quote.notas.slice(idx + sep.length)); } catch {}
        }
        if (!meta.timeline) meta.timeline = [];
        meta.timeline.push({ event: 'paid', at: new Date().toISOString() });
        const newNotas = text + sep + JSON.stringify(meta);
        await supabase.from('quotes').update({ notas: newNotas }).eq('id', quoteId);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
