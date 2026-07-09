// Cálculo de comisión del partner por CATEGORÍA de concepto.
// Compartido entre el editor de cotizaciones (estimación en vivo), el detalle
// y la sección de resultados (pagado real por periodo).
//
// Reglas:
// - Cada item lleva `categoria_comision` (licencia | plugin | personalizacion |
//   hardware). Si no la trae (quotes viejas), se infiere con la heurística de
//   `defaultCategoria` — los planes SIEMPRE son licencia.
// - Base por item = subtotal (ya trae el descuento de línea). Las promos ($0)
//   no comisionan.
// - El descuento GLOBAL prorratea la comisión: cada punto de descuento también
//   descuenta la comisión (misma regla que ya se le mostraba al partner).
// - La comisión se calcula sobre montos PRE-IVA (el IVA no comisiona).

import {
  COMISION_CATEGORIAS,
  COMISION_RATES,
  type CategoriaComision,
} from './constants';

export interface ComisionBreakdown {
  total: number;
  base: number; // suma de bases comisionables (post descuento global)
  porCategoria: Record<CategoriaComision, { base: number; comision: number }>;
}

// Heurística de categoría para items sin clasificar (quotes creadas antes de
// esta feature, o drafts de IA). El partner puede corregirla en el editor.
export function defaultCategoria(it: any): CategoriaComision {
  if (it && it.tipo === 'plan') return 'licencia';
  const n = `${it?.nombre || ''} ${it?.descripcion || ''}`.toLowerCase();
  if (/hardware|equipo|terminal|impresora|lector|tablet|b[aá]scula|kiosco|smart pos|caj[oó]n/.test(n)) return 'hardware';
  if (/plugin|m[oó]dulo|integraci[oó]n|api|conector/.test(n)) return 'plugin';
  if (/licencia|renovaci[oó]n|suscripci[oó]n|plan /.test(n)) return 'licencia';
  return 'personalizacion';
}

export function categoriaDeItem(it: any): CategoriaComision {
  const c = it?.categoria_comision;
  return (COMISION_CATEGORIAS as readonly string[]).includes(c) ? (c as CategoriaComision) : defaultCategoria(it);
}

export function calcComision(
  items: any[],
  opts?: { descuento_global?: number | string; descuento_tipo?: 'pct' | 'monto' },
): ComisionBreakdown {
  const arr = (Array.isArray(items) ? items : []).filter((it) => it && !it.es_promocion);
  const itemsSubtotal = arr.reduce((s, i) => s + (Number(i.subtotal) || Number(i.monto) || 0), 0);
  const descVal = parseFloat(String(opts?.descuento_global)) || 0;
  const globalDisc = opts?.descuento_tipo === 'pct' ? itemsSubtotal * descVal / 100 : descVal;
  const ratio = itemsSubtotal > 0 ? Math.max(0, (itemsSubtotal - globalDisc) / itemsSubtotal) : 1;

  const porCategoria = {} as ComisionBreakdown['porCategoria'];
  for (const cat of COMISION_CATEGORIAS) porCategoria[cat] = { base: 0, comision: 0 };

  for (const it of arr) {
    const cat = categoriaDeItem(it);
    const base = (Number(it.subtotal) || Number(it.monto) || 0) * ratio;
    porCategoria[cat].base += base;
    porCategoria[cat].comision += base * COMISION_RATES[cat] / 100;
  }

  const total = COMISION_CATEGORIAS.reduce((s, c) => s + porCategoria[c].comision, 0);
  const base = COMISION_CATEGORIAS.reduce((s, c) => s + porCategoria[c].base, 0);
  return { total, base, porCategoria };
}

// Comisión de una quote completa (lista/detalle/resultados).
export function calcComisionQuote(q: {
  items?: any[];
  descuento_global?: number | string;
  descuento_tipo?: 'pct' | 'monto';
}): ComisionBreakdown {
  return calcComision(Array.isArray(q?.items) ? q.items! : [], {
    descuento_global: q?.descuento_global,
    descuento_tipo: q?.descuento_tipo,
  });
}
