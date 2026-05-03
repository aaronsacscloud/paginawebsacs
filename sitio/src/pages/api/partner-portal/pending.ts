// GET /api/partner-portal/pending
// Comisiones pending + earned (lo que aún no se ha pagado), detallado.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data: rows } = await supabase
    .from('partner_commissions')
    .select(`
      id, tipo, status, commission_amount, rate_pct, deal_value,
      created_at, earned_at, nota, notes,
      deal_id, booking_id, contact_id
    `)
    .eq('partner_id', user.id)
    .in('status', ['pending', 'earned'])
    .order('created_at', { ascending: false });

  const all = rows || [];

  // Enrich con info contextual: prospecto/deal/booking
  const contactIds = [...new Set(all.map(r => r.contact_id).filter(Boolean))] as string[];
  const dealIds    = [...new Set(all.map(r => r.deal_id).filter(Boolean))] as string[];
  const bookingIds = [...new Set(all.map(r => r.booking_id).filter(Boolean))] as string[];

  const [contactsRes, dealsRes, bookingsRes] = await Promise.all([
    contactIds.length
      ? supabase.from('contacts').select('id, nombre, email').in('id', contactIds)
      : Promise.resolve({ data: [] as any[] }),
    dealIds.length
      ? supabase.from('deals').select('id, nombre, valor_total, stage').in('id', dealIds)
      : Promise.resolve({ data: [] as any[] }),
    bookingIds.length
      ? supabase.from('bookings').select('id, invitee_nombre, fecha, estado').in('id', bookingIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const contactsMap = Object.fromEntries((contactsRes.data || []).map(c => [c.id, c]));
  const dealsMap    = Object.fromEntries((dealsRes.data    || []).map(d => [d.id, d]));
  const bookingsMap = Object.fromEntries((bookingsRes.data || []).map(b => [b.id, b]));

  const enriched = all.map(r => ({
    ...r,
    contact: r.contact_id ? contactsMap[r.contact_id as string] : null,
    deal:    r.deal_id    ? dealsMap[r.deal_id as string]    : null,
    booking: r.booking_id ? bookingsMap[r.booking_id as string] : null,
  }));

  const earnedSum = enriched.filter(r => r.status === 'earned').reduce((s, r) => s + Number(r.commission_amount || 0), 0);
  const pendingSum = enriched.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.commission_amount || 0), 0);

  return j({ commissions: enriched, earnedSum, pendingSum });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
