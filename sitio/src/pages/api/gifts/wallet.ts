// GET /api/gifts/wallet?account=<padrino_account> — resumen del Saldo Sacs.
//
// Lo consulta sacs3 (admin) para pintar el ledger del cliente en la Academia:
// total acumulado + cada movimiento con su concepto. Protegido por x-gift-secret
// (mismo patrón que /status). La redención (gastar) se construye después.

import type { APIRoute } from 'astro';
import { giftCorsHeaders, giftOptionsResponse, requireGiftSecret } from '../../../lib/gifts';
import { getWalletSummary } from '../../../lib/wallet';

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const GET: APIRoute = async ({ request, url }) => {
  const headers = giftCorsHeaders(request);
  const unauthorized = requireGiftSecret(request, headers);
  if (unauthorized) return unauthorized;
  try {
    const account = (url.searchParams.get('account') || '').trim().toLowerCase();
    if (!account) {
      return new Response(JSON.stringify({ error: 'account requerido' }), { status: 400, headers });
    }
    const summary = await getWalletSummary(account);
    return new Response(JSON.stringify(summary), { status: 200, headers });
  } catch (err) {
    console.error('[gifts/wallet] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
