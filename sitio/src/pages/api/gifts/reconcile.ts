// POST /api/gifts/reconcile — red de seguridad para regalos atorados en
// 'redeeming'.
//
// Por qué existe: el flujo normal es create-subscription (gift→'redeeming' + crea
// la sub de Stripe y escribe stripe_subscription_id) → webhook
// customer.subscription.created → handleGiftRedemption (gift→'redeemed'). Si ese
// webhook NUNCA llega (caída de entrega, el handler murió antes), el gift queda
// atorado en 'redeeming' con una suscripción REAL ya creada. Con el fix de
// expireGiftIfNeeded ya NO se reabre (no hay doble-año), pero queda colgado: el
// padrino nunca ve "redimido". Este endpoint consulta Stripe y cierra el ciclo.
//
// Idempotente y seguro: solo toca gifts en 'redeeming' CON stripe_subscription_id,
// y transiciona con CAS (.eq('status','redeeming')). Lo dispara un cron (Vercel
// cron o pg_cron vía http) cada ~15 min. Protegido por el MISMO x-gift-secret.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';
import {
  giftCorsHeaders,
  giftOptionsResponse,
  requireGiftSecret,
  GIFT_REDEEMING_STALE_MIN,
} from '../../../lib/gifts';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
  maxNetworkRetries: 3,
  timeout: 30000,
});

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const headers = giftCorsHeaders(request);
  const unauthorized = requireGiftSecret(request, headers);
  if (unauthorized) return unauthorized;

  const result = { checked: 0, redeemed: 0, released: 0, stillPending: 0, errors: 0 };
  try {
    // Solo regalos atorados en 'redeeming' con una sub real, viejos (> stale min)
    // para no pisar checkouts en curso normales.
    const staleIso = new Date(Date.now() - GIFT_REDEEMING_STALE_MIN * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from('gifts')
      .select('id, code, stripe_subscription_id, redeeming_at')
      .eq('status', 'redeeming')
      .not('stripe_subscription_id', 'is', null)
      .lt('redeeming_at', staleIso)
      .limit(100);

    for (const g of stuck || []) {
      result.checked++;
      try {
        const sub = await stripe.subscriptions.retrieve(g.stripe_subscription_id as string);
        if (sub.status === 'active' || sub.status === 'trialing') {
          // La sub está viva → el regalo SÍ se redimió, el webhook se perdió.
          const { data: rows } = await supabase
            .from('gifts')
            .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
            .eq('id', g.id)
            .eq('status', 'redeeming')
            .select('id');
          if (rows && rows.length) result.redeemed++;
        } else if (
          sub.status === 'incomplete_expired' ||
          sub.status === 'canceled' ||
          sub.status === 'unpaid'
        ) {
          // El checkout murió de verdad → liberar el regalo para reintentar.
          const { data: rows } = await supabase
            .from('gifts')
            .update({ status: 'pending', redeeming_at: null, redeemed_email: null, stripe_subscription_id: null })
            .eq('id', g.id)
            .eq('status', 'redeeming')
            .select('id');
          if (rows && rows.length) result.released++;
        } else {
          // incomplete / past_due → aún resolviéndose, no tocar.
          result.stillPending++;
        }
      } catch (e) {
        result.errors++;
        console.error('[gifts/reconcile] sub', g.stripe_subscription_id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers });
  } catch (err) {
    console.error('[gifts/reconcile] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno', ...result }), { status: 500, headers });
  }
};
