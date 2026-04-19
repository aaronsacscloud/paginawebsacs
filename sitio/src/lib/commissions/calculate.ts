// Commission calculation — triggered when a deal closes as 'cerrada_ganada'.
// Creates a pending partner_commissions row. Idempotent (1 commission per deal).

import { supabase } from '../supabase';

export interface CreateCommissionArgs {
  deal_id: string;
  partner_id: string;              // team_members.id — usually deal.owner_id
  rate_pct?: number;               // override; else uses team_members.default_commission_pct
  deal_value?: number;             // override; else uses deals.valor_total
  notes?: string;
}

export async function createCommissionForDeal(args: CreateCommissionArgs): Promise<{ ok: boolean; commission_id?: string; skipped?: boolean; reason?: string }> {
  // Idempotency: check if commission already exists
  const { data: existing } = await supabase
    .from('partner_commissions')
    .select('id, status')
    .eq('deal_id', args.deal_id)
    .maybeSingle();
  if (existing) return { ok: true, commission_id: existing.id, skipped: true, reason: 'already_exists' };

  // Resolve rate
  let rate_pct = args.rate_pct;
  if (rate_pct === undefined) {
    const { data: partner } = await supabase
      .from('team_members')
      .select('default_commission_pct')
      .eq('id', args.partner_id)
      .maybeSingle();
    rate_pct = partner?.default_commission_pct ?? 20;
  }

  // Resolve deal value
  let deal_value = args.deal_value;
  if (deal_value === undefined) {
    const { data: deal } = await supabase
      .from('deals')
      .select('valor_total')
      .eq('id', args.deal_id)
      .maybeSingle();
    deal_value = Number(deal?.valor_total || 0);
  }

  const commission_amount = Math.round(deal_value * (rate_pct / 100) * 100) / 100;

  const { data, error } = await supabase
    .from('partner_commissions')
    .insert({
      deal_id: args.deal_id,
      partner_id: args.partner_id,
      rate_pct,
      deal_value,
      commission_amount,
      status: 'pending',
      notes: args.notes || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, commission_id: data!.id };
}

/** Cancel a commission (e.g., deal reopens after being marked won). */
export async function cancelCommission(deal_id: string, reason?: string): Promise<void> {
  await supabase
    .from('partner_commissions')
    .update({ status: 'cancelled', notes: reason ? `cancelled: ${reason}` : 'cancelled' })
    .eq('deal_id', deal_id)
    .in('status', ['pending', 'earned']);
}
