// Commission settlement — moves pending → earned when customer pays, earned → paid when SACS pays partner.

import { supabase } from '../supabase';
import { notify } from '../notify';

const tipoLabel: Record<string, string> = {
  prueba_gratis: 'prueba gratis activada',
  demo_completada: 'demo completada',
  venta_directa: 'venta directa',
  manual: 'ajuste manual',
};

async function loadCommissionWithPartner(commission_id: string) {
  const { data: c } = await supabase
    .from('partner_commissions')
    .select('id, partner_id, commission_amount, tipo, nota, status')
    .eq('id', commission_id)
    .maybeSingle();
  if (!c) return null;
  const { data: p } = await supabase
    .from('team_members')
    .select('email, nombre')
    .eq('id', c.partner_id)
    .maybeSingle();
  return { commission: c, partner: p };
}

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

  // Notify partner
  await notifyEarned(data.id);

  return { ok: true, commission_id: data.id };
}

/**
 * Mark a non-deal commission (prueba_gratis o manual) as 'earned' por id.
 * Admin action: usado cuando admin verifica un lead de prueba gratis.
 */
export async function markCommissionEarnedById(commission_id: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await supabase
    .from('partner_commissions')
    .update({ status: 'earned', earned_at: new Date().toISOString() })
    .eq('id', commission_id)
    .eq('status', 'pending');

  if (error) return { ok: false, reason: error.message };

  await notifyEarned(commission_id);
  return { ok: true };
}

/**
 * Mark a commission as 'cancelled' (admin rejects, fraud, etc.)
 */
export async function cancelCommissionById(commission_id: string, reason?: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await supabase
    .from('partner_commissions')
    .update({ status: 'cancelled', nota: reason ? `cancelled: ${reason}` : 'cancelled' })
    .eq('id', commission_id)
    .in('status', ['pending', 'earned']);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
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

  await notifyPaid(commission_id, payment_reference);
  return { ok: true };
}

/**
 * Bulk mark earned commissions as paid in a single payout group.
 * All commissions must belong to the same partner. Returns count + total.
 */
export async function markCommissionsPaidBulk(
  commission_ids: string[],
  payment_reference: string,
): Promise<{ ok: boolean; count?: number; total?: number; reason?: string }> {
  if (!commission_ids.length) return { ok: false, reason: 'no commissions provided' };

  const { data: rows } = await supabase
    .from('partner_commissions')
    .select('id, partner_id, commission_amount, status')
    .in('id', commission_ids);

  if (!rows || rows.length === 0) return { ok: false, reason: 'commissions not found' };

  const earnedRows = rows.filter(r => r.status === 'earned');
  if (earnedRows.length === 0) return { ok: false, reason: 'no earned commissions in selection' };

  const partnerIds = [...new Set(earnedRows.map(r => r.partner_id))];
  if (partnerIds.length > 1) return { ok: false, reason: 'all commissions must belong to same partner for a single payout reference' };

  const earnedIds = earnedRows.map(r => r.id);
  const total = earnedRows.reduce((s, r) => s + Number(r.commission_amount || 0), 0);

  const { error } = await supabase
    .from('partner_commissions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference,
    })
    .in('id', earnedIds);

  if (error) return { ok: false, reason: error.message };

  // Send a single bulk-payment email to partner
  await notifyPaidBulk(partnerIds[0], earnedIds, payment_reference, total);

  return { ok: true, count: earnedIds.length, total };
}

// ── Notification helpers ──
async function notifyEarned(commission_id: string) {
  try {
    const data = await loadCommissionWithPartner(commission_id);
    if (!data || !data.partner?.email) return;
    const tipo = tipoLabel[data.commission.tipo as string] || data.commission.tipo;
    const monto = Number(data.commission.commission_amount || 0);
    await notify({
      channel: 'email',
      to: data.partner.email,
      template: 'partner_commission_earned',
      data: {
        nombre: data.partner.nombre,
        tipo,
        monto,
        portalUrl: 'https://www.sacscloud.com/partner/portal#commissions',
      },
    });
  } catch (e) {
    console.warn('[settle] notifyEarned failed:', e);
  }
}

async function notifyPaid(commission_id: string, payment_reference: string) {
  try {
    const data = await loadCommissionWithPartner(commission_id);
    if (!data || !data.partner?.email) return;
    const tipo = tipoLabel[data.commission.tipo as string] || data.commission.tipo;
    const monto = Number(data.commission.commission_amount || 0);
    await notify({
      channel: 'email',
      to: data.partner.email,
      template: 'partner_commission_paid',
      data: {
        nombre: data.partner.nombre,
        tipo,
        monto,
        payment_reference,
        portalUrl: 'https://www.sacscloud.com/partner/portal#payments',
      },
    });
  } catch (e) {
    console.warn('[settle] notifyPaid failed:', e);
  }
}

async function notifyPaidBulk(
  partner_id: string,
  commission_ids: string[],
  payment_reference: string,
  total: number,
) {
  try {
    const { data: p } = await supabase
      .from('team_members')
      .select('email, nombre')
      .eq('id', partner_id)
      .maybeSingle();
    if (!p?.email) return;

    await notify({
      channel: 'email',
      to: p.email,
      template: 'partner_commission_paid',
      data: {
        nombre: p.nombre,
        tipo: `${commission_ids.length} comisiones`,
        monto: total,
        payment_reference,
        bulk: true,
        portalUrl: 'https://www.sacscloud.com/partner/portal#payments',
      },
    });
  } catch (e) {
    console.warn('[settle] notifyPaidBulk failed:', e);
  }
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
