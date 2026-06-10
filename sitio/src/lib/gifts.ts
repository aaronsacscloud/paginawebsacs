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
  return (email || '').trim().toLowerCase();
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
 * Si el gift está pending y ya venció, lo marca expired (lazy expiration).
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
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function giftOptionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: giftCorsHeaders(request) });
}
