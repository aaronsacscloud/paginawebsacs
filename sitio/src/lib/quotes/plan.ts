// El plan de parcialidades de una cotización, en una sola forma.
//
// Las fechas se pactan al cotizar y viven en el meta de la cotización
// (`meta.plan_pagos`). Antes cada pantalla las leía —o no las leía— a su manera:
// la cobranza solo miraba `cobros_programados`, que es la tabla de las
// SUSCRIPCIONES, así que las parcialidades de una cotización no existían para
// el tablero del mes. Aquí se normalizan una vez y todas leen lo mismo.
//
// La regla de aplicación es la única que no inventa nada: sin recibo por
// parcialidad, el dinero abonado cubre las exhibiciones EN ORDEN DE FECHA.
import { parseMeta } from './meta';

export type Exhibicion = {
  id: string;
  numero: number;
  total: number;
  concepto: string;
  fecha: string;
  monto: number;          // lo que falta de esa exhibición
  monto_original: number;
  cubierto: number;
  estado: 'pagada' | 'pendiente';
  vencida: boolean;
};

/**
 * @param quote  fila de quotes (necesita `id` y `notas`)
 * @param abonado  suma de pagos ligados a esa cotización
 * @param hoy  YYYY-MM-DD
 */
export function planDeCotizacion(quote: any, abonado: number, hoy: string): Exhibicion[] {
  const { meta } = parseMeta(quote?.notas);
  const plan = Array.isArray(meta?.plan_pagos) ? [...meta.plan_pagos] : [];
  if (!plan.length) return [];
  plan.sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));

  let restante = Number(abonado || 0);
  return plan.map((x: any, i: number) => {
    const monto = Number(x.monto || 0);
    const cubierto = Math.min(monto, Math.max(0, restante));
    restante -= cubierto;
    const falta = Math.round((monto - cubierto) * 100) / 100;
    const fecha = String(x.fecha || '').slice(0, 10);
    return {
      id: `${quote.id}:${i}`,
      numero: i + 1,
      total: plan.length,
      concepto: String(x.concepto || `Parcialidad ${i + 1}`),
      fecha,
      monto: falta,
      monto_original: monto,
      cubierto: Math.round(cubierto * 100) / 100,
      estado: falta <= 0.01 ? 'pagada' : 'pendiente',
      // Vencida es la que YA pasó su fecha pactada y sigue sin cubrirse. La
      // vigencia de la cotización no entra aquí: esa caduca el precio, no un
      // pago, y una cotización aceptada que va al corriente de su plan no está
      // vencida por más que su vigencia haya pasado.
      vencida: falta > 0.01 && !!fecha && fecha < hoy,
    };
  });
}

/** La exhibición que toca cobrar: la vencida más vieja o, si no hay, la próxima. */
export function exhibicionExigible(plan: Exhibicion[]): Exhibicion | null {
  const pend = plan.filter(x => x.estado === 'pendiente');
  return pend.find(x => x.vencida) || pend[0] || null;
}
