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
  };
  if (row.stripe_payment_id) payload.stripe_payment_id = row.stripe_payment_id;
  const res = await supabase.from('payments').insert(payload).select().maybeSingle();
  if (res.error && String(res.error.message || '').includes('stripe_payment_id')) {
    delete payload.stripe_payment_id;
    return supabase.from('payments').insert(payload).select().maybeSingle();
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

  // Idempotency guard
  if (await alreadyProcessed(event.id, event.type)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // ─── checkout.session.completed (quote first charge) ───
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
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

        // Commission: mark earned when payment received for a deal
        if (quote?.deal_id) {
          try {
            const { markCommissionEarned } = await import('../../../lib/commissions/settle');
            await markCommissionEarned(quote.deal_id);
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
