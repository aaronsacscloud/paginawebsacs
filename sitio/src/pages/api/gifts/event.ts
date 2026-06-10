// POST /api/gifts/event — telemetría del embudo Regalo Buddy.
//
// Body: { code?, account, event, meta? }   event ∈ created|shared|opened|redeemed
// Inserta una fila en gift_events. Si event==='shared' y hay code → además
// marca gifts.shared_at=now() (la 1ª vez basta, pero re-marcar es inocuo).
// Respuesta: { ok: true }
//
// Exige el header x-gift-secret igual que create/status (server-to-server).
// Lo llama sacs3 (Compartir/WhatsApp) y la landing del regalo (opened).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import {
  giftCorsHeaders,
  giftOptionsResponse,
  isUuid,
  logGiftEvent,
  requireGiftSecret,
  type GiftEventType,
} from '../../../lib/gifts';

export const prerender = false;

const VALID_EVENTS: GiftEventType[] = ['created', 'shared', 'opened', 'redeemed'];

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const headers = giftCorsHeaders(request);
  // 🔴 Mismo secreto que create/status: la telemetría toca gifts.shared_at.
  const unauthorized = requireGiftSecret(request, headers);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json().catch(() => ({}));

    const event = String(body.event || '').trim() as GiftEventType;
    if (!VALID_EVENTS.includes(event)) {
      return new Response(JSON.stringify({ error: 'event inválido' }), { status: 400, headers });
    }

    const account = body.account ? String(body.account).trim().toLowerCase().slice(0, 120) : null;
    const code = typeof body.code === 'string' && isUuid(body.code.trim()) ? body.code.trim() : null;
    const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};

    await logGiftEvent({ event, code, padrino_account: account, meta });

    // event 'shared' + code → estampar gifts.shared_at (cuándo se compartió 1ª vez)
    if (event === 'shared' && code) {
      await supabase
        .from('gifts')
        .update({ shared_at: new Date().toISOString() })
        .eq('code', code)
        .is('shared_at', null);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    console.error('[gifts/event] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
