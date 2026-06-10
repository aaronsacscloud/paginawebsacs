// Regalo Buddy — helpers compartidos.
//
// Un cliente Sacs (padrino, `account` de sacs3) regala el primer año del
// Plan Vende ($6,000 MXN) a un negocio amigo. Tabla `gifts` en Supabase
// (migración scripts/migration-2026-06-gifts.sql).
//
// APIs: /api/gifts/create (sacs3), /api/gifts/validate (landing),
// /api/gifts/status (sacs3). Checkout: /api/create-subscription con `gift`.

import { supabase } from './supabase';

export const GIFT_TTL_DAYS = 120;
export const GIFT_COUPON_ID = 'GIFT_VENDE_YEAR';
export const GIFT_PLAN_VALUE_MXN = 6000;
// Si un gift queda atorado en 'redeeming' (Stripe colgado / proceso muerto)
// más de este tiempo, se revierte a 'pending' para poder reintentarse.
export const GIFT_REDEEMING_STALE_MIN = 15;

const SITE_URL = 'https://www.sacscloud.com';

export interface GiftRow {
  id: string;
  code: string;
  padrino_account: string;
  padrino_nombre: string | null;
  padrino_email: string | null;
  padrino_whatsapp: string | null;
  status: 'pending' | 'redeeming' | 'redeemed' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  redeemed_by_contact: string | null;
  redeemed_email: string | null;
  redeemed_at: string | null;
  redeeming_at: string | null;
  stripe_subscription_id: string | null;
  meta: Record<string, any> | null;
}

export function giftLink(code: string): string {
  return `${SITE_URL}/regalo/${code}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeEmail(email: string | null | undefined): string {
  const raw = (email || '').trim().toLowerCase();
  if (!raw) return '';
  const at = raw.lastIndexOf('@');
  if (at < 0) return raw;
  let local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  // Gmail ignora puntos en el local-part y todo después de '+' (alias) →
  // normalizar para que el anti auto-regalo no se evada con alias/puntos.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const plus = local.indexOf('+');
    if (plus >= 0) local = local.slice(0, plus);
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

// Solo dígitos, últimos 10 (formato MX sin lada internacional)
export function normalizeWhatsapp(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
}

export function isGiftExpired(gift: Pick<GiftRow, 'expires_at'>): boolean {
  return new Date(gift.expires_at).getTime() < Date.now();
}

export async function getGiftByCode(code: string): Promise<GiftRow | null> {
  if (!isUuid(code)) return null;
  const { data } = await supabase.from('gifts').select('*').eq('code', code).maybeSingle();
  return (data as GiftRow) || null;
}

/**
 * Mantenimiento perezoso del status (lazy):
 *  - pending + vencido → expired.
 *  - redeeming atorado (>15 min sin confirmar el webhook, p.ej. Stripe colgado
 *    o el proceso murió a mitad del checkout) → revierte a pending para poder
 *    reintentarse. Sin esto un gift quedaría bloqueado para siempre.
 * Regresa el gift con el status efectivo.
 */
export async function expireGiftIfNeeded(gift: GiftRow): Promise<GiftRow> {
  if (gift.status === 'pending' && isGiftExpired(gift)) {
    await supabase
      .from('gifts')
      .update({ status: 'expired' })
      .eq('id', gift.id)
      .eq('status', 'pending');
    return { ...gift, status: 'expired' };
  }
  if (gift.status === 'redeeming') {
    const staleMs = GIFT_REDEEMING_STALE_MIN * 60 * 1000;
    const startedAt = gift.redeeming_at ? new Date(gift.redeeming_at).getTime() : 0;
    if (startedAt && startedAt < Date.now() - staleMs) {
      // Revertir SOLO si sigue en redeeming y sigue siendo el mismo lock viejo
      // (condicionar por redeeming_at evita pisar un reintento recién hecho).
      await supabase
        .from('gifts')
        .update({ status: 'pending', redeeming_at: null, redeemed_email: null })
        .eq('id', gift.id)
        .eq('status', 'redeeming')
        .eq('redeeming_at', gift.redeeming_at);
      return { ...gift, status: 'pending', redeeming_at: null };
    }
  }
  return gift;
}

// ─── CORS: sacs3 (app.sacscloud.com) llama create/status desde el admin ───

const ALLOWED_ORIGIN_RE =
  /^(https:\/\/app\.sacscloud\.com|https?:\/\/localhost(:\d+)?|https?:\/\/127\.0\.0\.1(:\d+)?)$/;

export function giftCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allow = ALLOWED_ORIGIN_RE.test(origin) ? origin : 'https://app.sacscloud.com';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-gift-secret',
    Vary: 'Origin',
  };
}

export function giftOptionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: giftCorsHeaders(request) });
}

// ─── Secreto server-to-server (sacs3 → /api/gifts/create y /status) ───
// CORS NO protege de un curl: estos endpoints mintean/exponen un cupón de
// $6,000, así que exigimos un header secreto compartido con el admin sacs3.
const GIFT_API_SECRET = (import.meta.env.GIFT_API_SECRET || '').trim();

/**
 * Verifica el header `x-gift-secret`. Devuelve una Response 401 si:
 *  - el env GIFT_API_SECRET no está seteado (fail-closed, nunca abrimos), o
 *  - el header falta o no coincide.
 * Devuelve null si autoriza (sigue la lógica del endpoint).
 */
export function requireGiftSecret(
  request: Request,
  headers: Record<string, string>,
): Response | null {
  const provided = (request.headers.get('x-gift-secret') || '').trim();
  if (!GIFT_API_SECRET || !provided || provided !== GIFT_API_SECRET) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers });
  }
  return null;
}
