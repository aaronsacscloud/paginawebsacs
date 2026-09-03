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
import { parseMeta } from './meta.ts';   // con extensión: así el contrato corre con `node` sin bundler

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

/**
 * Las parcialidades que hay que COBRAR en un mes.
 *
 * Dos reglas, y la segunda es la que se olvida: entran las que vencen en el
 * mes, y también las VENCIDAS de meses anteriores — ese dinero sigue sin
 * entrar y ya debía haber entrado, así que se persigue ahora, no se pierde al
 * pasar la hoja del calendario.
 *
 * @param quotes    cotizaciones aceptadas (necesitan `id`, `numero`, `notas`)
 * @param abonado   cuánto se lleva pagado de cada una, por id
 * @param m         'YYYY-MM'
 * @param hoy       'YYYY-MM-DD'
 */
export function parcialidadesDelMes(quotes: any[], abonado: Map<string, number>, m: string, hoy: string) {
  const filas: any[] = [];
  const conPlan = new Set<string>();
  for (const q of quotes || []) {
    const plan = planDeCotizacion(q, abonado.get(q.id) || 0, hoy);
    if (!plan.length) continue;
    conPlan.add(q.id);
    for (const x of plan) {
      if (x.estado !== 'pendiente') continue;
      const mes = x.fecha.slice(0, 7);
      if (mes !== m && !(x.vencida && mes < m)) continue;
      filas.push({
        id: x.id, quote_id: q.id, numero: q.numero, tipo: 'parcialidad',
        companies: q.companies, contacts: q.contacts,
        nombre_plan: `${q.numero || 'Cotización'} · ${x.concepto}`,
        ciclo: `${x.numero} de ${x.total}`, proxima_factura: x.fecha,
        monto: x.monto, vencida: x.vencida, mes_original: mes,
      });
    }
  }
  return { filas, conPlan };
}
