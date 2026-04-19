// GET /api/partners/commissions
// Partner ve solo las suyas; founder ve todas (con filtro ?partner_id=X opcional).
// POST /api/partners/commissions (admin only) — marca una commission como 'paid' con referencia.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope, AccessDenied } from '../../../lib/auth/scope';
import { markCommissionPaid, getPartnerCommissionSummary } from '../../../lib/commissions/settle';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });

  const status = url.searchParams.get('status');        // 'pending'|'earned'|'paid'|'cancelled'
  const filter_partner_id = url.searchParams.get('partner_id');

  let query = supabase
    .from('partner_commissions')
    .select('id, created_at, deal_id, partner_id, rate_pct, deal_value, commission_amount, status, earned_at, paid_at, payment_reference, notes, deals(nombre, stage)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  // Partner scope: partners only see theirs
  query = applyPartnerScope(query, user, 'partner_id');

  // Founder can further filter by partner_id
  if (user.role === 'founder' && filter_partner_id) {
    query = query.eq('partner_id', filter_partner_id);
  }

  const { data, error } = await query.limit(500);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Add summary for the partner
  const partner_id_for_summary = user.role === 'partner' ? user.id : filter_partner_id;
  let summary = null;
  if (partner_id_for_summary) {
    summary = await getPartnerCommissionSummary(partner_id_for_summary);
  }

  return new Response(JSON.stringify({ rows: data || [], summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Admin: mark commission as paid (SACS paid the partner)
export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  if (user.role !== 'founder') return new Response(JSON.stringify({ error: 'only founder can mark paid' }), { status: 403 });

  try {
    const body = await request.json();
    const { commission_id, payment_reference } = body || {};
    if (!commission_id || !payment_reference) {
      return new Response(JSON.stringify({ error: 'commission_id and payment_reference required' }), { status: 400 });
    }
    const result = await markCommissionPaid(commission_id, payment_reference);
    return new Response(JSON.stringify(result), { status: result.ok ? 200 : 400 });
  } catch (err: any) {
    if (err instanceof AccessDenied) {
      return new Response(JSON.stringify({ error: err.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
