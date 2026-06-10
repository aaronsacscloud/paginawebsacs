// GET /api/gifts/validate?code=<uuid> — valida un código de regalo Buddy.
//
// Respuesta: { valid, status, padrino_nombre, expired }
// Si el gift está pending pero ya venció → lo marca 'expired' (lazy).

import type { APIRoute } from 'astro';
import {
  expireGiftIfNeeded,
  getGiftByCode,
  giftCorsHeaders,
  giftOptionsResponse,
} from '../../../lib/gifts';

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const GET: APIRoute = async ({ request, url }) => {
  const headers = giftCorsHeaders(request);
  try {
    const code = (url.searchParams.get('code') || '').trim();
    const found = code ? await getGiftByCode(code) : null;

    if (!found) {
      return new Response(
        JSON.stringify({ valid: false, status: 'not_found', padrino_nombre: null, expired: false }),
        { status: 404, headers },
      );
    }

    const gift = await expireGiftIfNeeded(found);
    const expired = gift.status === 'expired';

    return new Response(
      JSON.stringify({
        valid: gift.status === 'pending',
        status: gift.status,
        padrino_nombre: gift.padrino_nombre || null,
        expired,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('[gifts/validate] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
