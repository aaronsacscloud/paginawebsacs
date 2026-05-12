// POST /api/partner-portal/push-subscribe
//   Body: { endpoint, keys: { p256dh, auth }, prefs? }
// Guarda la suscripción de push del partner actual.
//
// DELETE /api/partner-portal/push-subscribe?endpoint=...
//   Da de baja la suscripción.
//
// PUT /api/partner-portal/push-subscribe
//   Body: { endpoint, prefs }
//   Actualiza preferencias de tipos de notificación.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return j({ error: 'invalid json' }, 400); }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  const userAgent = body?.user_agent || request.headers.get('user-agent') || null;
  const prefs = body?.prefs || undefined;

  if (!endpoint || !p256dh || !auth) {
    return j({ error: 'endpoint + keys.p256dh + keys.auth required' }, 400);
  }

  // Upsert por (partner_id, endpoint)
  const payload: any = {
    partner_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    last_seen_at: new Date().toISOString(),
    active: true,
    failure_count: 0,
  };
  if (prefs) payload.prefs = prefs;

  const { data, error } = await supabase
    .from('partner_push_subscriptions')
    .upsert(payload, { onConflict: 'partner_id,endpoint' })
    .select('id')
    .maybeSingle();

  if (error) {
    // Si la tabla no existe (migration pendiente), responder gracefully
    if (/relation .* does not exist/i.test(error.message)) {
      return j({ ok: false, error: 'table_missing', message: 'partner_push_subscriptions table not migrated yet' }, 503);
    }
    return j({ error: error.message }, 500);
  }

  return j({ ok: true, id: data?.id });
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return j({ error: 'endpoint required' }, 400);

  const { error } = await supabase
    .from('partner_push_subscriptions')
    .delete()
    .eq('partner_id', user.id)
    .eq('endpoint', endpoint);

  if (error) return j({ error: error.message }, 500);
  return j({ ok: true });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const body: any = await request.json().catch(() => ({}));
  const { endpoint, prefs } = body;
  if (!endpoint || !prefs) return j({ error: 'endpoint + prefs required' }, 400);

  const { error } = await supabase
    .from('partner_push_subscriptions')
    .update({ prefs })
    .eq('partner_id', user.id)
    .eq('endpoint', endpoint);

  if (error) return j({ error: error.message }, 500);
  return j({ ok: true });
};

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data } = await supabase
    .from('partner_push_subscriptions')
    .select('id, endpoint, prefs, user_agent, created_at, active')
    .eq('partner_id', user.id)
    .eq('active', true);

  return j({ subscriptions: data || [] });
};
