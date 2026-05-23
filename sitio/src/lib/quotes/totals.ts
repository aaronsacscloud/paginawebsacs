export type IvaMode = 'sin' | 'suma' | 'incluido';

export interface QuoteItemLike {
  subtotal?: number;
  monto?: number | string;
  [k: string]: any;
}

export interface QuoteTotalsInput {
  items: QuoteItemLike[];
  descuento_global?: number | string;
  descuento_tipo?: 'pct' | 'monto';
  iva_mode?: IvaMode;
}

export interface QuoteTotals {
  itemsSubtotal: number;
  globalDisc: number;
  afterDisc: number;
  ivaMonto: number;
  grandTotal: number;
}

export function calcQuoteTotals({
  items,
  descuento_global,
  descuento_tipo,
  iva_mode,
}: QuoteTotalsInput): QuoteTotals {
  const itemsSubtotal = (items || []).reduce(
    (s, i) => s + (Number(i.subtotal) || parseFloat(String(i.monto)) || 0),
    0,
  );

  const globalDisc =
    descuento_tipo === 'pct'
      ? itemsSubtotal * (parseFloat(String(descuento_global)) || 0) / 100
      : parseFloat(String(descuento_global)) || 0;

  const afterDisc = itemsSubtotal - globalDisc;

  const ivaMonto =
    iva_mode === 'suma'
      ? afterDisc * 0.16
      : iva_mode === 'incluido'
      ? afterDisc - afterDisc / 1.16
      : 0;

  const grandTotal = iva_mode === 'suma' ? afterDisc + afterDisc * 0.16 : afterDisc;

  return { itemsSubtotal, globalDisc, afterDisc, ivaMonto, grandTotal };
}

export type { QuoteTotals as CalcQuoteTotalsResult };
