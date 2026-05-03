// Commission calculation — 3 entry points:
//   1. createCommissionForDeal       → venta_directa, cuando un deal se cierra ganado
//   2. createPruebaGratisBonus       → $500 pending cuando un lead se registra por link de partner
//   3. createDemoCompletadaBonus     → $300 earned cuando un demo se marca como realizada
//
// Todos idempotentes (UNIQUE indexes en deal_id, contact_id+tipo, booking_id).

import { supabase } from '../supabase';

export interface CreateCommissionArgs {
  deal_id: string;
  partner_id: string;              // team_members.id
  rate_pct?: number;
  deal_value?: number;
  notes?: string;
}

export async function createCommissionForDeal(args: CreateCommissionArgs): Promise<{ ok: boolean; commission_id?: string; skipped?: boolean; reason?: string }> {
  // Idempotency: check if commission already exists for this deal
  const { data: existing } = await supabase
    .from('partner_commissions')
    .select('id, status')
    .eq('deal_id', args.deal_id)
    .eq('tipo', 'venta_directa')
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
      tipo: 'venta_directa',
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

// ─── Bono por prueba gratis activada ──────────────────────────────
// $500 pending cuando un lead nuevo se registra a la prueba gratis vía
// link de partner. Pasa a 'earned' cuando admin verifica que el lead es real.
//
// Idempotente: UNIQUE (contact_id, tipo='prueba_gratis').
export interface PruebaGratisArgs {
  partnerId: string;
  contactId: string;
  amount?: number;       // default 500
}

export async function createPruebaGratisBonus(args: PruebaGratisArgs): Promise<{ ok: boolean; commission_id?: string; skipped?: boolean; reason?: string }> {
  const amount = args.amount ?? 250;

  // Idempotency: check existing
  const { data: existing } = await supabase
    .from('partner_commissions')
    .select('id, status')
    .eq('contact_id', args.contactId)
    .eq('tipo', 'prueba_gratis')
    .maybeSingle();
  if (existing) return { ok: true, commission_id: existing.id, skipped: true, reason: 'already_exists' };

  const { data, error } = await supabase
    .from('partner_commissions')
    .insert({
      partner_id: args.partnerId,
      contact_id: args.contactId,
      tipo: 'prueba_gratis',
      rate_pct: 0,                            // no es porcentual, es bono fijo
      deal_value: 0,
      commission_amount: amount,
      status: 'pending',
      nota: 'Prueba gratis registrada — pendiente verificación admin',
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, commission_id: data!.id };
}

// ─── Bono por demo completada ─────────────────────────────────────
// $300 earned cuando un booking se marca estado='realizada' Y el booking
// vino atribuido a un partner. Status='earned' directo (no requiere
// verificación adicional — el demo ya pasó).
//
// Idempotente: UNIQUE (booking_id) condicional.
export interface DemoCompletadaArgs {
  partnerId: string;
  bookingId: string;
  amount?: number;       // default 300
  prospectName?: string;
  fechaDemo?: string;
}

export async function createDemoCompletadaBonus(args: DemoCompletadaArgs): Promise<{ ok: boolean; commission_id?: string; skipped?: boolean; reason?: string }> {
  const amount = args.amount ?? 250;

  // Idempotency: check existing
  const { data: existing } = await supabase
    .from('partner_commissions')
    .select('id, status')
    .eq('booking_id', args.bookingId)
    .maybeSingle();
  if (existing) return { ok: true, commission_id: existing.id, skipped: true, reason: 'already_exists' };

  const notaParts: string[] = ['Demo completada'];
  if (args.fechaDemo) notaParts.push(`el ${args.fechaDemo}`);
  if (args.prospectName) notaParts.push(`con ${args.prospectName}`);

  const { data, error } = await supabase
    .from('partner_commissions')
    .insert({
      partner_id: args.partnerId,
      booking_id: args.bookingId,
      tipo: 'demo_completada',
      rate_pct: 0,
      deal_value: 0,
      commission_amount: amount,
      status: 'earned',
      earned_at: new Date().toISOString(),
      nota: notaParts.join(' '),
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
