// Qué se vendió en una oportunidad, y qué tipo de dinero es.
//
// Antes una oportunidad era UN plan y UN valor. Con eso el pipeline sumaba en la
// misma bolsa una licencia de $900/mes y una implementación única de $80,000:
// dos cosas que ni se pronostican igual ni valen lo mismo para el negocio. Y al
// ganar no había con qué armar la suscripción, así que el cierre no generaba
// nada.
//
// Aquí vive la aritmética, en un solo lugar, para que el modal, el API y el
// cierre no calculen cada uno por su cuenta y se separen con el tiempo.

export type CicloItem = 'mensual' | 'anual' | 'unico';

export type DealItem = {
  /** plan | plugin del catálogo · personalizado · unico (implementación, hardware) */
  tipo: 'plan' | 'plugin' | 'personalizado' | 'unico';
  plan_id?: string | null;
  plan_slug?: string | null;
  nombre: string;
  cantidad?: number;
  /** Precio por unidad y por periodo: mensual, anual o el monto del pago único. */
  precio_unitario: number;
  ciclo: CicloItem;
  /** Descuento de ESTA línea (el del trato completo va aparte). */
  descuento_pct?: number;
};

export type TotalesDeal = {
  mrr: number;
  arr: number;
  valor_unico: number;
  /** Valor del PRIMER AÑO: recurrente anualizado + lo que se cobra una vez. */
  valor_total: number;
  tipo_ingreso: 'recurrente' | 'unico' | 'mixto' | null;
  billing_period: 'mensual' | 'anual' | 'unico' | null;
  subtotal_recurrente_periodo: number;   // lo que se cobra cada periodo del ciclo dominante
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineaImporte(it: DealItem): number {
  const cant = Number(it.cantidad || 1) || 1;
  const bruto = Number(it.precio_unitario || 0) * cant;
  const desc = Math.min(100, Math.max(0, Number(it.descuento_pct || 0)));
  return r2(bruto * (1 - desc / 100));
}

/**
 * Reduce las líneas a los tres números que sí se pueden leer.
 *
 * Una línea ANUAL aporta precio/12 al MRR — la misma regla de oro del ARR del
 * CRM (un solo número de recurrencia). Si se sumara el anual completo al MRR, el
 * pipeline mostraría doce veces el ingreso mensual real de ese trato.
 */
export function calcularTotales(items: DealItem[] | null | undefined, descuentoPctGlobal?: number | null): TotalesDeal {
  const lista = Array.isArray(items) ? items : [];
  const factor = 1 - Math.min(100, Math.max(0, Number(descuentoPctGlobal || 0))) / 100;

  let mrr = 0, unico = 0, mensual = 0, anual = 0;
  for (const it of lista) {
    const imp = lineaImporte(it) * factor;
    if (it.ciclo === 'unico') { unico += imp; continue; }
    if (it.ciclo === 'anual') { mrr += imp / 12; anual += imp; }
    else { mrr += imp; mensual += imp; }
  }
  mrr = r2(mrr); unico = r2(unico);

  const hayRec = mrr > 0, hayUnico = unico > 0;
  // El ciclo dominante es el que decide cómo se le va a cobrar: si hay algo
  // mensual, el cobro es mensual aunque también lleve una línea anual.
  const billing: TotalesDeal['billing_period'] = mensual > 0 ? 'mensual' : anual > 0 ? 'anual' : hayUnico ? 'unico' : null;

  return {
    mrr,
    arr: r2(mrr * 12),
    valor_unico: unico,
    valor_total: r2(mrr * 12 + unico),
    tipo_ingreso: hayRec && hayUnico ? 'mixto' : hayRec ? 'recurrente' : hayUnico ? 'unico' : null,
    billing_period: billing,
    subtotal_recurrente_periodo: r2(billing === 'anual' ? anual : mensual),
  };
}

/** Nombre del plan para la suscripción que nace al ganar: la línea recurrente
 *  más cara manda, y si hay más se dice cuántas — "Plan Controla +2". */
export function nombrePlanDeItems(items: DealItem[] | null | undefined, fallback = 'Licencia SACS'): string {
  const rec = (items || []).filter(i => i.ciclo !== 'unico').sort((a, b) => lineaImporte(b) - lineaImporte(a));
  if (!rec.length) return fallback;
  return (rec.length > 1 ? `${rec[0].nombre} +${rec.length - 1}` : rec[0].nombre).slice(0, 160);
}
