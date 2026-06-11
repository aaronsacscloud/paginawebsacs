// Saldo Sacs — billetera de créditos del padrino (programa Buddy).
//
// Ledger APPEND-ONLY: cada bono/comisión/gasto es una fila inmutable en
// wallet_ledger; el saldo = SUMA. Aquí van los helpers para ACREDITAR (idempotente)
// y para LEER el resumen. La redención (gastar) se construye después.

import { supabase } from './supabase';

// Bono fijo al padrino cuando su amigo activa el año gratis.
export const GIFT_ACTIVATION_BONUS_MXN = 2000;
// Porcentaje de comisión sobre el pago del referido (1 vez/año/cliente).
export const REFERRAL_COMMISSION_PCT = 0.30;

export type WalletKind =
  | 'referral_activation_bonus'
  | 'referral_payment_commission'
  | 'academia_reward'
  | 'spend_plugin'
  | 'spend_consultoria'
  | 'spend_other'
  | 'adjustment';

export interface WalletEntryInput {
  account: string;
  amount_mxn: number;
  kind: WalletKind;
  concepto: string;
  gift_code?: string | null;
  referred_email?: string | null;
  stripe_payment_id?: string | null;
  ref_year?: number | null;
  meta?: Record<string, any>;
}

// Acredita un movimiento. IDEMPOTENTE por diseño: los índices únicos parciales
// (bono por gift_code; comisión por referido+año) hacen que un segundo insert del
// MISMO evento choque con código 23505 → lo tratamos como "ya acreditado" y NO
// es error. Devuelve { credited: boolean }.
export async function creditWallet(input: WalletEntryInput): Promise<{ credited: boolean }> {
  const row = {
    account: input.account,
    amount_mxn: input.amount_mxn,
    kind: input.kind,
    concepto: input.concepto,
    gift_code: input.gift_code ?? null,
    referred_email: input.referred_email ?? null,
    stripe_payment_id: input.stripe_payment_id ?? null,
    ref_year: input.ref_year ?? null,
    meta: input.meta ?? {},
  };
  const { error } = await supabase.from('wallet_ledger').insert(row);
  if (error) {
    if (String(error.code) === '23505') return { credited: false }; // ya existía (idempotente)
    console.error('[wallet] credit error:', error);
    throw error;
  }
  return { credited: true };
}

export interface WalletSummary {
  account: string;
  balance_mxn: number;
  earned_mxn: number;
  spent_mxn: number;
  entries: Array<{
    amount_mxn: number;
    kind: WalletKind;
    concepto: string;
    created_at: string;
  }>;
}

// Lee el resumen del saldo. Los TOTALES (balance/ganado/gastado) se calculan
// sobre TODAS las filas (correctitud del dinero); para mostrar se devuelven solo
// las últimas `displayLimit`. La billetera de referidos tiene pocas filas por
// cuenta, así que traer todas es barato.
export async function getWalletSummary(account: string, displayLimit = 50): Promise<WalletSummary> {
  const { data } = await supabase
    .from('wallet_ledger')
    .select('amount_mxn, kind, concepto, created_at')
    .eq('account', account)
    .order('created_at', { ascending: false });

  const all = (data || []).map((e: any) => ({
    amount_mxn: Number(e.amount_mxn) || 0,
    kind: e.kind as WalletKind,
    concepto: e.concepto || '',
    created_at: e.created_at,
  }));

  let earned = 0;
  let spent = 0;
  for (const e of all) {
    if (e.amount_mxn >= 0) earned += e.amount_mxn;
    else spent += -e.amount_mxn;
  }

  return {
    account,
    balance_mxn: earned - spent,
    earned_mxn: earned,
    spent_mxn: spent,
    entries: all.slice(0, displayLimit),
  };
}
