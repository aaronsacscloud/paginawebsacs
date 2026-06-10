// POST /api/gifts/create — sacs3 (admin) crea el regalo Buddy del padrino.
//
// Body: { account, nombre?, email?, whatsapp? }
// IDEMPOTENTE: si ya existe un gift para ese account regresa el MISMO
// { code, link, status, expires_at } — nunca crea un segundo (UNIQUE en
// padrino_account lo blinda también a nivel DB).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import {
  GIFT_TTL_DAYS,
  giftCorsHeaders,
  giftLink,
  giftOptionsResponse,
  logGiftEvent,
  normalizeEmail,
  requireGiftSecret,
  type GiftRow,
} from '../../../lib/gifts';

export const prerender = false;

function giftResponse(gift: GiftRow, headers: Record<string, string>, status = 200): Response {
  return new Response(
    JSON.stringify({
      code: gift.code,
      link: giftLink(gift.code),
      status: gift.status,
      expires_at: gift.expires_at,
    }),
    { status, headers },
  );
}

export const OPTIONS: APIRoute = async ({ request }) => giftOptionsResponse(request);

export const POST: APIRoute = async ({ request }) => {
  const headers = giftCorsHeaders(request);
  // 🔴 Barrera real (CORS no protege server-to-server): exigir el secreto ANTES
  // de cualquier lógica. Sin esto, cualquiera mintea cupones de $6,000 con curl.
  const unauthorized = requireGiftSecret(request, headers);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json().catch(() => ({}));

    // Validación + sanitizado del account (slug de cuenta sacs3)
    const account = String(body.account || '').trim().toLowerCase();
    if (!account || account.length > 120 || !/^[a-z0-9][a-z0-9._-]*$/.test(account)) {
      return new Response(JSON.stringify({ error: 'account inválido' }), { status: 400, headers });
    }

    // Email del padrino OBLIGATORIO: sin él, el anti auto-regalo es evadible
    // (el padrino podría redimir su propio regalo sin que lo detectemos).
    const email = normalizeEmail(body.email).slice(0, 200);
    if (!email) {
      return new Response(JSON.stringify({ error: 'email del padrino requerido' }), { status: 400, headers });
    }

    const nombre = body.nombre ? String(body.nombre).trim().slice(0, 200) : null;
    const whatsapp = body.whatsapp ? String(body.whatsapp).trim().slice(0, 30) : null;

    // Idempotencia + RE-EMISIÓN: si ya existe gift para este account...
    const { data: existing } = await supabase
      .from('gifts')
      .select('*')
      .eq('padrino_account', account)
      .maybeSingle();

    if (existing) {
      const prev = existing as GiftRow;
      // 'redeemed' → NUNCA re-emitir: el ahijado ya activó el plan. Devolver el
      // redimido tal cual (status incluido) para que sacs3 pinte "ya canjeado".
      // pending / redeeming → idempotente: mismo regalo de siempre.
      // 'expired' (o 'revoked') → RE-EMITIR: nuevo code, status pending, +120d,
      // shared_at/created_at reseteados. Reusa la misma fila (UNIQUE por account).
      if (prev.status === 'expired' || prev.status === 'revoked') {
        const nowIso = new Date().toISOString();
        const newExpiresAt = new Date(Date.now() + GIFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data: reissued, error: reErr } = await supabase
          .from('gifts')
          .update({
            code: crypto.randomUUID(),
            status: 'pending',
            expires_at: newExpiresAt,
            shared_at: null,
            created_at: nowIso,
            redeeming_at: null,
            redeemed_email: null,
            // datos del padrino refrescados por si cambiaron
            padrino_nombre: nombre,
            padrino_email: email,
            padrino_whatsapp: whatsapp,
          })
          .eq('id', prev.id)
          // Solo si SIGUE expired/revoked (anti-carrera con una redención en vuelo)
          .in('status', ['expired', 'revoked'])
          .select('*')
          .maybeSingle();
        if (reErr) {
          console.error('[gifts/create] reissue error:', reErr);
          return new Response(JSON.stringify({ error: 'No se pudo reemitir el regalo' }), { status: 500, headers });
        }
        if (reissued) {
          logGiftEvent({
            event: 'created',
            code: (reissued as GiftRow).code,
            padrino_account: account,
            meta: { reissued_from: prev.code, previous_status: prev.status },
          }).catch(() => {});
          return giftResponse(reissued as GiftRow, headers);
        }
        // Carrera: alguien lo movió de expired — re-leer y devolver el estado real
        const { data: raced } = await supabase
          .from('gifts')
          .select('*')
          .eq('padrino_account', account)
          .maybeSingle();
        return giftResponse((raced || prev) as GiftRow, headers);
      }
      return giftResponse(prev, headers);
    }

    const expiresAt = new Date(Date.now() + GIFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error } = await supabase
      .from('gifts')
      .insert({
        padrino_account: account,
        padrino_nombre: nombre,
        padrino_email: email,
        padrino_whatsapp: whatsapp,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) {
      // Carrera contra el UNIQUE(padrino_account): re-leer y regresar el existente
      if (String(error.code) === '23505') {
        const { data: raced } = await supabase
          .from('gifts')
          .select('*')
          .eq('padrino_account', account)
          .maybeSingle();
        if (raced) return giftResponse(raced as GiftRow, headers);
      }
      console.error('[gifts/create] insert error:', error);
      return new Response(JSON.stringify({ error: 'No se pudo crear el regalo' }), { status: 500, headers });
    }

    // Telemetría del embudo (best-effort, no bloquea la respuesta)
    logGiftEvent({
      event: 'created',
      code: (created as GiftRow).code,
      padrino_account: account,
    }).catch(() => {});

    return giftResponse(created as GiftRow, headers, 201);
  } catch (err) {
    console.error('[gifts/create] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
