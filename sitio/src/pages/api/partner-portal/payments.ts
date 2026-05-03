// GET /api/partner-portal/payments
// Historial de pagos: comisiones con status='paid', agrupadas por payment_reference.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data: rows } = await supabase
    .from('partner_commissions')
    .select('id, tipo, commission_amount, paid_at, payment_reference, nota, deal_id, booking_id, contact_id')
    .eq('partner_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false });

  const all = rows || [];

  // Agrupar por payment_reference (cada payout = 1 grupo)
  const groups = new Map<string, {
    payment_reference: string;
    paid_at: string;
    total: number;
    items: any[];
  }>();

  for (const r of all) {
    const key = r.payment_reference || `singleton-${r.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        payment_reference: r.payment_reference || '(sin referencia)',
        paid_at: r.paid_at || '',
        total: 0,
        items: [],
      });
    }
    const g = groups.get(key)!;
    g.total += Number(r.commission_amount || 0);
    g.items.push(r);
  }

  const payments = Array.from(groups.values()).sort((a, b) =>
    (b.paid_at || '').localeCompare(a.paid_at || ''),
  );

  return j({ payments, total_paid_lifetime: all.reduce((acc, r) => acc + Number(r.commission_amount || 0), 0) });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
