// POST /api/partner-portal/push-test
//   Body: { type?: 'pago' | 'lead' | 'demo' | 'partner' | 'achievement', title?, body?, url? }
// Manda una notificación de prueba a TODAS las suscripciones del partner actual.
// Requiere VAPID keys configuradas en env. Si no hay, responde indicando setup pendiente.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { sendPushTo } from '../../../lib/push/send';

export const prerender = false;

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const PRESETS: Record<string, { title: string; body: string; url?: string }> = {
  pago: {
    title: '💰 Pago confirmado',
    body: 'Tu próximo pago de $3,500 quedó confirmado · se deposita el día 1.',
    url: '/partner/portal#dinero',
  },
  lead: {
    title: '✨ Lead nuevo',
    body: 'Carlos Méndez (Méndez Boutique · CDMX) llegó vía tu link hace 2 min.',
    url: '/partner/portal#leads',
  },
  demo: {
    title: '📅 Demo agendada',
    body: 'Mariana López agendó demo para mañana 15:00 con Aaron.',
    url: '/partner/portal#leads',
  },
  partner: {
    title: '🎉 Invitación aceptada',
    body: 'Lucía Torres aceptó tu invitación · ahora en tu red.',
    url: '/partner/portal#red',
  },
  achievement: {
    title: '🏆 Logro desbloqueado',
    body: 'Llegaste a 5 sucursales activas · Master Partner Nv 1 activado.',
    url: '/partner/portal#nivel',
  },
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const body: any = await request.json().catch(() => ({}));
  const type = body.type || 'pago';
  const preset = PRESETS[type] || PRESETS.pago;
  const payload = {
    title: body.title || preset.title,
    body:  body.body  || preset.body,
    url:   body.url   || preset.url,
    tag:   `sacs-test-${type}`,
  };

  // Trae suscripciones activas del partner
  const { data: subs } = await supabase
    .from('partner_push_subscriptions')
    .select('id, endpoint, p256dh, auth, prefs')
    .eq('partner_id', user.id)
    .eq('active', true);

  if (!subs || subs.length === 0) {
    return j({ ok: false, error: 'no_subscriptions', message: 'Activa las notificaciones primero desde el portal' }, 400);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const sub of subs) {
    const result = await sendPushTo({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, payload);
    results.push({ id: sub.id, ok: result.ok, error: result.error });
  }

  return j({ ok: true, sent: results.length, results });
};
