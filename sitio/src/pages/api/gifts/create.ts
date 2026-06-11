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
  isGiftExpired,
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

    // MULTI-BUDDY: una cuenta puede tener MUCHOS regalos a lo largo del tiempo,
    // pero solo UNO ACTIVO (pending/redeeming) a la vez, y solo crea uno nuevo si
    // tiene "licencia disponible":
    //   disponibles = 1 (inicial) + nº de referidos que YA PAGARON (comisiones)
    //   usadas      = regalos que consumieron licencia (pending/redeeming/redeemed)
    // Los expirados/revocados NO cuentan como usadas (nadie activó) → re-armables.
    const { data: allGifts } = await supabase
      .from('gifts')
      .select('*')
      .eq('padrino_account', account)
      .order('created_at', { ascending: false });
    const gifts = (allGifts || []) as GiftRow[];

    // Marcar pendientes VENCIDOS como expired (best-effort) y reflejarlo local.
    for (const g of gifts) {
      if (g.status === 'pending' && isGiftExpired(g)) {
        await supabase.from('gifts').update({ status: 'expired' }).eq('id', g.id).eq('status', 'pending');
        g.status = 'expired';
      }
    }

    // 1) ¿Hay un regalo ACTIVO? → idempotente, devolver ese (no crear otro).
    const active = gifts.find((g) => g.status === 'pending' || g.status === 'redeeming');
    if (active) return giftResponse(active, headers);

    // 2) Calcular licencias disponibles vs usadas.
    let commissionCount = 0;
    try {
      const { count } = await supabase
        .from('wallet_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('account', account)
        .eq('kind', 'referral_payment_commission');
      commissionCount = count || 0;
    } catch {
      // wallet_ledger aún no existe (migración pendiente) → 0 comisiones.
      commissionCount = 0;
    }
    const available = 1 + commissionCount;
    const used = gifts.filter(
      (g) => g.status === 'pending' || g.status === 'redeeming' || g.status === 'redeemed',
    ).length;

    if (used >= available) {
      // Sin licencias: ya regaló y aún no convierte a pago. Se desbloquea otra
      // cuando su Buddy pague (handleReferralCommission en el webhook).
      return new Response(
        JSON.stringify({
          error: 'Ya usaste tu licencia para regalar. Se desbloqueará otra cuando tu Buddy active y pague su plan. 🎁',
          locked: true,
          available,
          used,
        }),
        { status: 409, headers },
      );
    }
    // 3) Hay licencia. Si existe una fila EXPIRED/REVOKED, la RE-ARMAMOS (nuevo
    //    code, pending, +120d) en vez de acumular filas muertas — y así también
    //    es compatible con el esquema viejo (UNIQUE por cuenta, pre-migración).
    //    Si no hay reusable, insertamos una fila nueva (multi-Buddy).
    const reusable = gifts.find((g) => g.status === 'expired' || g.status === 'revoked');
    if (reusable) {
      const nowIso = new Date().toISOString();
      const newExpiresAt = new Date(Date.now() + GIFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: reissued } = await supabase
        .from('gifts')
        .update({
          code: crypto.randomUUID(),
          status: 'pending',
          expires_at: newExpiresAt,
          shared_at: null,
          created_at: nowIso,
          redeeming_at: null,
          redeemed_email: null,
          stripe_subscription_id: null,
          padrino_nombre: nombre,
          padrino_email: email,
          padrino_whatsapp: whatsapp,
        })
        .eq('id', reusable.id)
        .in('status', ['expired', 'revoked'])
        .select('*')
        .maybeSingle();
      if (reissued) {
        logGiftEvent({
          event: 'created',
          code: (reissued as GiftRow).code,
          padrino_account: account,
          meta: { reissued_from: reusable.code, previous_status: reusable.status },
        }).catch(() => {});
        return giftResponse(reissued as GiftRow, headers);
      }
      // Carrera: alguien lo movió — cae al insert normal.
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
      // Carrera contra el índice único parcial (1 activo) o el UNIQUE viejo:
      // re-leer el activo y regresarlo.
      if (String(error.code) === '23505') {
        const { data: raced } = await supabase
          .from('gifts')
          .select('*')
          .eq('padrino_account', account)
          .in('status', ['pending', 'redeeming'])
          .order('created_at', { ascending: false })
          .limit(1)
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
