// Web Push wrapper que firma con VAPID y envía a un endpoint.
// Requiere env: VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT (mailto:)

import webpush from 'web-push';
import { supabase } from '../supabase';

const VAPID_PUBLIC  = (import.meta.env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE = (import.meta.env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (import.meta.env.VAPID_SUBJECT || process.env.VAPID_SUBJECT || 'mailto:partners@sacscloud.com').trim();

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
    return true;
  } catch (e) {
    console.warn('[push] setVapidDetails failed:', (e as Error).message);
    return false;
  }
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
};

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function sendPushTo(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  if (!ensureConfigured()) {
    return { ok: false, error: 'vapid_not_configured', statusCode: 503 };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // 24h
    );
    return { ok: true };
  } catch (err: any) {
    const statusCode = err?.statusCode || 500;
    // 404 / 410 = endpoint dead → marcar inactive
    if (statusCode === 404 || statusCode === 410) {
      try {
        await supabase
          .from('partner_push_subscriptions')
          .update({ active: false, last_failure_at: new Date().toISOString() })
          .eq('endpoint', subscription.endpoint);
      } catch { /* ignore */ }
    }
    return { ok: false, error: err?.message || 'send_failed', statusCode };
  }
}

/**
 * Send push a todas las suscripciones activas de un partner que tengan el tipo habilitado.
 * Llamar desde hooks de DB cuando ocurra un evento relevante.
 */
export async function notifyPartner(
  partnerId: string,
  type: 'pago' | 'lead' | 'demo' | 'partner' | 'achievement',
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const { data: subs } = await supabase
    .from('partner_push_subscriptions')
    .select('id, endpoint, p256dh, auth, prefs')
    .eq('partner_id', partnerId)
    .eq('active', true);

  let sent = 0, failed = 0;
  for (const sub of subs || []) {
    if (sub.prefs && sub.prefs[type] === false) continue;
    const result = await sendPushTo(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
    if (result.ok) sent++; else failed++;
  }
  return { sent, failed };
}

export function getPublicKey(): string {
  return VAPID_PUBLIC;
}
