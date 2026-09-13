// La comisión de un pago que viene de una COTIZACIÓN, no de una suscripción.
//
// El motor sabía clasificar un pago mirando la suscripción de la que colgaba:
// de ahí salía el SKU, de ahí la categoría y de ahí la tarifa. Un pago único
// —una consultoría, una implementación, un plugin vitalicio— no cuelga de
// ninguna suscripción, así que se quedaba sin categoría y la comisión salía en
// cero. Medido antes de escribir esto: 17 pagos, $448,846 cobrados, $0 de
// comisión calculada, y $320,219 de eso con dueño ya asignado.
//
// Una cotización puede cobrar varias cosas a la vez —licencia + plugin +
// consultoría— y cada una tiene su tasa. El pago no dice a cuál corresponde:
// entra un monto contra el documento completo. Así que se reparte a PRORRATA
// entre las partidas y cada una cobra la suya; la línea guarda un porcentaje
// ponderado y el desglose completo en su detalle, que es lo que aguanta un
// reclamo. Un pago = una línea, como siempre: partirlo en varias rompería la
// llave `pago:dueño:tipo` con la que el recálculo reconoce lo que ya escribió.
import { elegirRegla, type Regla, type Origen } from './comisiones.lib';
import { categoriaDePartida } from './pagos-unicos';

export type PlanCat = { id: string; slug: string | null; nombre: string | null; categoria: string | null };

export type PartidaComisionada = {
  nombre: string;
  slug: string | null;
  categoria: string | null;
  /** Lo que pesa esta partida dentro de la cotización, de 0 a 1. */
  parte: number;
  pct: number;
  /** Cobró la tasa de anualidad: la partida dice que es una renovación. */
  renovacion?: boolean;
  regla_id: string | null;
};

export type MezclaCotizacion = {
  /** El porcentaje ponderado que le toca a este pago. */
  pct: number;
  partidas: PartidaComisionada[];
  /** La regla de la partida que más dinero pesa: la que se enseña en la línea. */
  regla_id: string | null;
  plan_id: string | null;
  categoria: string | null;
  concepto: string;
  /** Ninguna partida encontró regla. La línea queda marcada, como siempre. */
  sin_regla: boolean;
};

/** Lo que pesa una partida. `subtotal` manda sobre `monto` porque ya trae el
 *  descuento de línea y porque las partidas de plan NO tienen `monto`. */
const peso = (it: any): number => Number(it?.subtotal) || Number(it?.monto) || 0;

/* Una partida que dice "Renovación" ES una renovación, lo diga o no una
   suscripción. El motor normalmente lo deduce comparando el año del pago con
   el arranque de la suscripción, pero un cobro que solo cuelga de la
   cotización no tiene de dónde deducirlo, y se pagaría la tasa de PRIMERA
   VENTA sobre una anualidad. Eso rompe la regla del marco —las tasas altas
   premian traer la cuenta, no conservarla— y ya había un caso: elenaboutique
   cobró "Renovación Plan Controla" por cotización. Se mira el nombre de la
   partida porque es lo que el cliente firmó. */
const ES_RENOVACION = /renovaci[oó]n/i;

/** El SKU con el que se guardó la partida, si se eligió del catálogo. */
const slugDe = (it: any): string | null => {
  if (it?.plan_slug) return String(it.plan_slug);
  // Una partida de plan guarda el slug en `nombre` ("fideliza"), no el título.
  if (it?.tipo === 'plan' && it?.nombre) return String(it.nombre);
  return null;
};

/**
 * @param items    `quotes.items`
 * @param planes   catálogo completo (`plans`)
 * @param reglas   las del modelo del dueño del pago
 * @param origen   de la cuenta
 * @returns null si la cotización no tiene partidas legibles con monto: sin eso
 *          no hay nada que repartir y el pago se queda como estaba, sin regla.
 */
export function mezclaDeCotizacion(
  items: any,
  planes: PlanCat[],
  reglas: Regla[],
  origen: Origen | null,
): MezclaCotizacion | null {
  const arr = (Array.isArray(items) ? items : [])
    // Una promoción vale $0 y no comisiona. Se descarta antes de repartir para
    // que no se lleve una parte de la prorrata con un peso de cero.
    .filter((it: any) => it && !it.es_promocion && peso(it) > 0);
  if (!arr.length) return null;

  const base = arr.reduce((a: number, it: any) => a + peso(it), 0);
  if (!(base > 0)) return null;

  const porSlug = new Map<string, PlanCat>();
  for (const p of planes || []) if (p.slug) porSlug.set(String(p.slug), p);

  const partidas: PartidaComisionada[] = [];
  let pct = 0;
  let mayor = { peso: -1, regla_id: null as string | null, plan_id: null as string | null, categoria: null as string | null, nombre: '' };

  for (const it of arr) {
    const slug = slugDe(it);
    const plan = slug ? porSlug.get(slug) || null : null;
    /* Sin SKU se cae a la heurística de siempre —la que ya usa Consultoría para
       decidir si una partida es licencia o trabajo—. Es lo que mantiene vivas
       las cotizaciones viejas, escritas a mano, mientras el catálogo se adopta. */
    const categoria = plan?.categoria ?? categoriaDePartida(String(it.nombre || ''));
    const plan_id = plan?.id ?? null;
    const regla = elegirRegla(reglas, { plan_id, categoria, origen });
    const parte = peso(it) / base;
    const renueva = ES_RENOVACION.test(String(it.nombre || '')) && regla?.pct_renovacion != null;
    const suPct = renueva ? Number(regla!.pct_renovacion) : regla ? Number(regla.pct) : 0;
    pct += parte * suPct;

    partidas.push({
      nombre: String(plan?.nombre || it.nombre || 'Concepto'),
      slug, categoria,
      parte: Math.round(parte * 10000) / 10000,
      pct: suPct,
      renovacion: renueva || undefined,
      regla_id: regla?.id ?? null,
    });

    if (peso(it) > mayor.peso) {
      mayor = { peso: peso(it), regla_id: regla?.id ?? null, plan_id, categoria, nombre: String(plan?.nombre || it.nombre || 'Concepto') };
    }
  }

  return {
    pct: Math.round(pct * 100) / 100,
    partidas,
    regla_id: mayor.regla_id,
    plan_id: mayor.plan_id,
    categoria: mayor.categoria,
    concepto: partidas.length === 1 ? mayor.nombre : `${mayor.nombre} y ${partidas.length - 1} concepto${partidas.length === 2 ? '' : 's'} más`,
    sin_regla: partidas.every(p => !p.regla_id),
  };
}
