import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

const CURRENCY_MAP: Record<string, string> = {
  MXN: 'mxn',
  USD: 'usd',
  EUR: 'eur',
};

export const POST: APIRoute = async ({ request }) => {
  const { quote_id, numero, empresa, email, total, moneda, items, vigencia } = await request.json();

  if (!total || !quote_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const currency = CURRENCY_MAP[moneda] || 'mxn';
  const amount = Math.round(total * 100); // Stripe uses cents

  // Build line items from quote items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      if (item.es_promocion) continue; // Skip $0 promos
      const itemAmount = Math.round((item.subtotal || item.monto || 0) * 100);
      if (itemAmount <= 0) continue;
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: item.tipo === 'plan' ? `Plan ${item.nombre}` : (item.nombre || 'Concepto'),
            description: item.descripcion || undefined,
          },
          unit_amount: itemAmount,
        },
        quantity: 1,
      });
    }
  }

  // Fallback: if no line items, create a single one
  if (lineItems.length === 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: `Cotización ${numero || ''}`.trim(),
          description: `Cotización para ${empresa || 'cliente'}`,
        },
        unit_amount: amount,
      },
      quantity: 1,
    });
  }

  // Calculate expiration (max 30 days for Stripe)
  let expiresAt: number | undefined;
  if (vigencia) {
    const vigenciaTime = new Date(vigencia + 'T23:59:59').getTime();
    const now = Date.now();
    const diffSecs = Math.floor((vigenciaTime - now) / 1000);
    // Stripe minimum: 30 min, maximum: 30 days
    if (diffSecs > 1800 && diffSecs < 2592000) {
      expiresAt = Math.floor(vigenciaTime / 1000);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: email || undefined,
      metadata: {
        quote_id,
        numero: numero || '',
      },
      success_url: `https://www.sacscloud.com/cotizacion/${quote_id}?paid=1`,
      cancel_url: `https://www.sacscloud.com/cotizacion/${quote_id}`,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
