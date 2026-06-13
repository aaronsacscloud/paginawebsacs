// GET /api/gifts/referrals?account=<referrer_account> — métricas del Embajador.
//
// Lo consulta sacs3 (admin) para pintar el panel "Invita y gana": cuántos
// referidos invitó (entraron al registro), cuántos pagaron, y cuánto ha ganado
// en créditos por este programa. Protegido por x-gift-secret (mismo patrón que
// /wallet y /status).

import type { APIRoute } from 'astro';
import { giftCorsHeaders, giftOptionsResponse, requireGiftSecret } from '../../../lib/gifts';
import { supabase } from '../../../lib/supabase';
import { CLIENT_REF_COMMISSION_MXN, CLIENT_REF_DISCOUNT_PCT } from '../../../data/referral';

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

    // Referidos de este cliente (los que entraron al registro por su link).
    const { data: refs } = await supabase
      .from('client_referrals')
      .select('referred_email, referred_account, status, paid_at, created_at, meta')
      .eq('referrer_account', account)
      .order('created_at', { ascending: false });

    const all = refs || [];
    const paid = all.filter((r: any) => r.status === 'paid');

    // Créditos ganados por este programa (suma de las comisiones de embajador).
    const { data: credits } = await supabase
      .from('wallet_ledger')
      .select('amount_mxn')
      .eq('account', account)
      .eq('kind', 'client_referral_commission');
    const earned_mxn = (credits || []).reduce((s: number, c: any) => s + (Number(c.amount_mxn) || 0), 0);

    // Lista para el muro de referidos (sin exponer el email completo).
    const lista = all.slice(0, 50).map((r: any) => ({
      empresa: (r.meta && r.meta.empresa) || '',
      email_masked: maskEmail(r.referred_email || ''),
      status: r.status,
      fecha: r.paid_at || r.created_at,
    }));

    return new Response(JSON.stringify({
      success: true,
      invitados: all.length,
      pagaron: paid.length,
      earned_mxn,
      por_referido_mxn: CLIENT_REF_COMMISSION_MXN,
      descuento_pct: Math.round(CLIENT_REF_DISCOUNT_PCT * 100),
      referidos: lista,
    }), { status: 200, headers });
  } catch (err) {
    console.error('[gifts/referrals] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  return email.slice(0, 2) + '***' + email.slice(at);
}
