// Commission settlement — moves pending → earned when customer pays, earned → paid when SACS pays partner.

import { supabase } from '../supabase';

/**
 * Mark commission as 'earned' when the deal's invoice gets paid.
 * Called from stripe-webhook on invoice.paid for that deal.
 */
export async function markCommissionEarned(deal_id: string): Promise<{ ok: boolean; commission_id?: string; reason?: string }> {
  const { data, error } = await supabase
    .from('partner_commissions')
    .update({ status: 'earned', earned_at: new Date().toISOString() })
    .eq('deal_id', deal_id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: 'no pending commission for deal' };
  return { ok: true, commission_id: data.id };
}

/**
 * Mark commission as 'paid' — admin action when SACS pays the partner.
 */
export async function markCommissionPaid(commission_id: string, payment_reference: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await supabase
    .from('partner_commissions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference,
    })
    .eq('id', commission_id)
    .eq('status', 'earned');

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export interface CommissionSummary {
  pending_amount: number;
  earned_amount: number;
  paid_amount: number;
  total_deals: number;
}

export async function getPartnerCommissionSummary(partner_id: string): Promise<CommissionSummary> {
  const { data } = await supabase
    .from('partner_commissions')
    .select('status, commission_amount')
    .eq('partner_id', partner_id);

  const summary: CommissionSummary = {
    pending_amount: 0,
    earned_amount: 0,
    paid_amount: 0,
    total_deals: (data || []).length,
  };

  for (const row of data || []) {
    const amt = Number(row.commission_amount) || 0;
    if (row.status === 'pending') summary.pending_amount += amt;
    else if (row.status === 'earned') summary.earned_amount += amt;
    else if (row.status === 'paid') summary.paid_amount += amt;
  }

  return summary;
}
