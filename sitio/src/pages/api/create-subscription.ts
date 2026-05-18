import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { supabase } from '../../lib/supabase';
import { getReferrerFromRequest } from '../../lib/attribution';
import { createCommissionForDeal } from '../../lib/commissions/calculate';

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
    const planPrices: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 5900 };
    const planValue = planPrices[planId] || 0;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    const ua = request.headers.get('user-agent') || '';
    sendTikTokEvent(email, whatsapp || '', planId, planValue, ip, ua).catch(() => {});

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
            fuente: referrerPartnerId ? 'partner-link' : 'website-prueba-gratis',
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
      let dealId: string | null = null;
      if (contactId) {
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

      // Activity log
      if (contactId) {
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
