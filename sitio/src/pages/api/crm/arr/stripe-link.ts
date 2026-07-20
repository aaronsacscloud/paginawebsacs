// POST /api/crm/arr/stripe-link — genera un link de pago Stripe (Checkout) para
// la renovación de una suscripción manual. Al pagarse, el webhook existente
// (rama arr_renewal) registra el pago, activa la sub y recorre la factura.
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' as any });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const subId = body?.subscription_id;
  if (!subId) return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  if (!import.meta.env.STRIPE_SECRET_KEY) return new Response(JSON.stringify({ error: 'Stripe no configurado' }), { status: 500 });

  const { data: sub, error } = await supabase.from('subscriptions')
    .select('*, companies(nombre), contacts(email, nombre)').eq('id', subId).single();
  if (error || !sub) return new Response(JSON.stringify({ error: 'suscripción no encontrada' }), { status: 404 });

  const monto = Number(body?.monto ?? sub.monto_proximo ?? sub.precio) || 0;
  if (monto <= 0) return new Response(JSON.stringify({ error: 'monto inválido' }), { status: 400 });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'mxn',
      line_items: [{
        price_data: {
          currency: 'mxn',
          unit_amount: Math.round(monto * 100),
          product_data: { name: `${sub.nombre_plan} — renovación ${sub.ciclo} (${(sub as any).companies?.nombre || 'SACS'})` },
        },
        quantity: 1,
      }],
      customer_email: (sub as any).contacts?.email || undefined,
      metadata: { type: 'arr_renewal', subscription_id: sub.id, company_id: sub.company_id || '' },
      success_url: 'https://www.sacscloud.com/acuse?pago=ok',
      cancel_url: 'https://www.sacscloud.com/acuse?pago=cancelado',
    });
    await supabase.from('activities').insert({
      tipo: 'sistema', titulo: `🔗 Link de pago Stripe generado: ${sub.nombre_plan} · $${monto.toLocaleString('es-MX')}`,
      company_id: sub.company_id, contact_id: sub.contact_id, automatico: true,
      metadata: { stripe_session: session.id, subscription_id: sub.id },
    }).select().maybeSingle();
    return new Response(JSON.stringify({ ok: true, url: session.url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
};
