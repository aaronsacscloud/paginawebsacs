import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET || '';

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
