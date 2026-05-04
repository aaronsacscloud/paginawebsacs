// GET /api/partner-portal/certifications
//   Devuelve catálogo + status (paid/pending/none) por cert para el partner actual.
//
// POST /api/partner-portal/certifications
//   Body: { cert_id: 'basica'|'avanzada'|'multisucursal' }
//   Crea (o reutiliza) un Stripe Checkout Session para esa cert y devuelve { url }.
//   El webhook /api/revenue/stripe-webhook marca como paid cuando se completa.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { CERTIFICATIONS, getCertById } from '../../../data/certifications';
import Stripe from 'stripe';

export const prerender = false;

const STRIPE_KEY = (import.meta.env.STRIPE_SECRET_KEY || '').trim();
const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://www.sacscloud.com').trim();

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonRes({ error: 'unauthenticated' }, 401);

  const { data: rows } = await supabase
    .from('partner_certifications')
    .select('cert_id, status, paid_at, stripe_session_id')
    .eq('partner_id', user.id);

  const byId: Record<string, any> = {};
  for (const r of rows || []) byId[r.cert_id] = r;

  const list = CERTIFICATIONS.map(c => {
    const owned = byId[c.id];
    return {
      ...c,
      status: owned?.status || 'none',
      paid_at: owned?.paid_at || null,
      unlocked: owned?.status === 'paid',
    };
  });

  return jsonRes({ certifications: list });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return jsonRes({ error: 'unauthenticated' }, 401);
  if (!STRIPE_KEY) return jsonRes({ error: 'stripe_not_configured' }, 500);

  const body = await request.json().catch(() => ({})) as { cert_id?: string };
  const certId = body.cert_id;
  const cert = certId ? getCertById(certId) : undefined;
  if (!cert) return jsonRes({ error: 'cert_id inválido' }, 400);

  // Already paid? short-circuit
  const { data: existing } = await supabase
    .from('partner_certifications')
    .select('id, status, stripe_session_id')
    .eq('partner_id', user.id)
    .eq('cert_id', cert.id)
    .maybeSingle();

  if (existing?.status === 'paid') {
    return jsonRes({ error: 'ya tienes esta certificación', already_paid: true }, 400);
  }

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

  // Get partner email for prefill + receipt
  const { data: partner } = await supabase
    .from('team_members')
    .select('email, nombre')
    .eq('id', user.id)
    .maybeSingle();

  // Create Stripe Checkout session (one-time payment)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: cert.precio,
        product_data: {
          name: cert.nombre,
          description: cert.descripcion,
          ...(cert.cover ? { images: [`${SITE_URL}${cert.cover}`] } : {}),
        },
      },
    }],
    customer_email: partner?.email || undefined,
    success_url: `${SITE_URL}/partner/portal#certificaciones?paid=${cert.id}`,
    cancel_url: `${SITE_URL}/partner/portal#certificaciones?cancel=${cert.id}`,
    metadata: {
      type: 'partner_certification',
      cert_id: cert.id,
      partner_id: user.id,
      partner_email: partner?.email || '',
      partner_name: partner?.nombre || '',
    },
    payment_intent_data: {
      metadata: {
        type: 'partner_certification',
        cert_id: cert.id,
        partner_id: user.id,
      },
    },
  });

  // Upsert pending row so we know there's an active checkout
  if (existing) {
    await supabase
      .from('partner_certifications')
      .update({ stripe_session_id: session.id, amount: cert.precio })
      .eq('id', existing.id);
  } else {
    await supabase.from('partner_certifications').insert({
      partner_id: user.id,
      cert_id: cert.id,
      amount: cert.precio,
      status: 'pending',
      stripe_session_id: session.id,
    });
  }

  return jsonRes({ url: session.url, session_id: session.id });
};
