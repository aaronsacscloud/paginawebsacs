// Motor de comisiones: resolución de reglas y cálculo de una línea.
//
// Está aparte de los endpoints a propósito: el cálculo es la parte que se
// audita cuando alguien reclama su pago, y tiene que poder leerse (y probarse)
// sin levantar la base.
//
// Cuatro decisiones que explican todo lo demás:
//
//  1. Se comisiona el PAGO COBRADO, no lo facturado ni lo prometido. Por eso la
//     línea cuelga de payments y su `fecha` es la del pago: esa fecha es la que
//     decide en qué periodo se paga.
//  2. Un pago sin regla NO desaparece: genera línea en ceros con sin_regla.
//     El hueco tiene que verse en la pantalla; si lo filtráramos, un SKU sin
//     tarifa se volvería invisible justo para quien tiene que notarlo.
//  3. Lo ya PAGADO o CANCELADO a mano no se recalcula. Cambiar el modelo no
//     reescribe la historia, y una cancelación manual no revive sola.
//  4. Ante un dato que falta, NO se castiga. Si nadie evaluó las condiciones de
//     renovación de una cuenta, se paga la tasa completa: bajar la comisión por
//     un dato que nadie capturó es peor que no tener la regla.

export type Origen = 'lead_sacs' | 'referido' | 'recuperada' | 'heredado';
export type Cuenta = 'corporativa' | 'pagadora' | 'ninguna';
export type TipoLinea = 'venta' | 'override_partner';

export const ORIGENES: { v: Origen; label: string; ayuda: string }[] = [
  { v: 'lead_sacs',  label: 'Lead de Sacs',   ayuda: 'Llegó por los canales de marketing de la empresa.' },
  { v: 'referido',   label: 'Referido',       ayuda: 'Lo refirió otro cliente o vino por prospección propia del consultor.' },
  { v: 'recuperada', label: 'Recuperada',     ayuda: 'Había dejado de usar el sistema y se logró reactivar.' },
  { v: 'heredado',   label: 'Ya era cliente', ayuda: 'Cuenta que ya existía en Sacs y el consultor empezó a atender.' },
];
export const ORIGEN_LABEL: Record<string, string> =
  Object.fromEntries(ORIGENES.map(o => [o.v, o.label]));

export const CUENTAS: { v: Cuenta; label: string; ayuda: string }[] = [
  { v: 'corporativa', label: 'Cuenta corporativa', ayuda: 'Se descuenta el IVA antes de calcular la comisión.' },
  { v: 'pagadora',    label: 'Cuenta pagadora',    ayuda: 'Se descuenta el costo de dispersión.' },
  { v: 'ninguna',     label: 'Sin descuento',      ayuda: 'La comisión se calcula sobre el monto completo.' },
];

/** Un pago anulado no es dinero: es el rastro de una captura duplicada. */
export const ESTADOS_ANULADOS = ['anulado', 'cancelado', 'duplicado'];

/** Estados de línea que el recálculo NO debe tocar. */
export const ESTADOS_CONGELADOS = ['pagada', 'cancelada'];

export type Modelo = {
  id: string; nombre: string; descripcion?: string | null;
  activo: boolean; es_default: boolean;
  desc_corporativa_pct: number; desc_pagadora_pct: number;
  cuenta_default: Cuenta;
  tasa_incumplimiento_pct: number | null;
  tope_descuento_pct: number;
  override_partner_pct: number | null;
  /** Días de margen para cobrar la renovación. NULL = no se evalúa. */
  dias_gracia_cobro: number | null;
};

export type Regla = {
  id: string; modelo_id: string;
  plan_id: string | null; categoria: string | null; origen: Origen | null;
  pct: number;
  /** Tasa cuando el pago es renovación (anualidad de ARR). Nulo = usa `pct`. */
  pct_renovacion?: number | null;
  nota?: string | null; created_at?: string;
};

export type ContextoPago = {
  plan_id: string | null;
  categoria: string | null;
  origen: Origen | null;
};

export const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Qué tan específica es una regla. El SKU exacto pesa más que la categoría, y
 * la categoría más que el origen, porque así es como se lee en voz alta:
 * "este plugin en particular" gana a "los plugins" y eso gana a "los referidos".
 */
export function especificidad(r: Regla): number {
  return (r.plan_id ? 4 : 0) + (r.categoria ? 2 : 0) + (r.origen ? 1 : 0);
}

function aplica(r: Regla, c: ContextoPago): boolean {
  if (r.plan_id && r.plan_id !== c.plan_id) return false;
  if (r.categoria && r.categoria !== c.categoria) return false;
  if (r.origen && r.origen !== c.origen) return false;
  return true;
}

/**
 * La regla que gana, o null si ninguna cubre el caso.
 *
 * El desempate entre reglas de la MISMA especificidad es por created_at y luego
 * por id: sin un criterio estable, dos reglas empatadas darían un porcentaje
 * distinto en cada recálculo y la comisión bailaría sola de un día a otro.
 */
export function elegirRegla(reglas: Regla[], c: ContextoPago): Regla | null {
  const candidatas = reglas.filter(r => aplica(r, c));
  if (!candidatas.length) return null;
  candidatas.sort((a, b) => {
    const d = especificidad(b) - especificidad(a);
    if (d !== 0) return d;
    const ta = a.created_at || '', tb = b.created_at || '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  return candidatas[0];
}

export function descuentoDe(modelo: Modelo, cuenta: Cuenta): number {
  if (cuenta === 'corporativa') return Number(modelo.desc_corporativa_pct || 0);
  if (cuenta === 'pagadora') return Number(modelo.desc_pagadora_pct || 0);
  return 0;
}

/**
 * Cuánto del descuento otorgado sale de la comisión.
 *
 * El marco lo dice con un ejemplo: lista $100,000, se cierra al 40% de
 * descuento, el cliente paga $60,000 y los $5,000 del 5% excedente los pone el
 * consultor. Sobre el monto efectivamente cobrado eso es:
 *
 *     exceso = cobrado × (descuento − tope) / (100 − descuento)
 *            = 60,000 × 5 / 60 = 5,000 ✓
 *
 * Expresarlo contra lo cobrado y no contra el precio de lista es lo que hace
 * que funcione igual con pagos parciales: cada parcialidad aporta su parte.
 */
export function excesoDescuento(cobrado: number, descuentoPct: number, topePct: number): number {
  if (!(descuentoPct > topePct) || descuentoPct >= 100) return 0;
  return r2(cobrado * (descuentoPct - topePct) / (100 - descuentoPct));
}

export type EntradaCalculo = {
  pago: { id: string; fecha: string; monto: number | string; comision_cuenta?: Cuenta | null;
          company_id?: string | null; subscription_id?: string | null };
  concepto: string | null;
  plan_id: string | null;
  categoria: string | null;
  origen: Origen | null;
  owner_id: string;
  modelo: Modelo;
  reglas: Regla[];
  /** % de descuento con el que se cerró la venta (precio de lista vs. precio). */
  descuento_venta_pct?: number;
  /** El pago corresponde a una renovación, no al primer año. */
  es_renovacion?: boolean;
  /** false SOLO si alguien evaluó la cuenta y no cumplió. undefined = sin evaluar. */
  cumple_condiciones?: boolean;
  /** Días entre el vencimiento y el cobro. Negativo = pagó antes. null = sin dato. */
  dias_atraso?: number | null;
};

export type LineaCalculada = {
  payment_id: string; owner_id: string; modelo_id: string; regla_id: string | null;
  tipo: TipoLinea;
  company_id: string | null; subscription_id: string | null; plan_id: string | null;
  fecha: string; concepto: string | null; categoria: string | null; origen: Origen | null;
  monto_bruto: number; cuenta: Cuenta; descuento_pct: number;
  base: number; pct: number; monto: number;
  es_renovacion: boolean; tasa_reducida: boolean; tasa_de_renovacion: boolean;
  pct_manual: number | null; pct_manual_nota: string | null; pct_manual_at: string | null;
  cuenta_manual: Cuenta | null;
  dias_atraso: number | null; fuera_de_tiempo: boolean;
  descuento_venta_pct: number; descuento_exceso: number;
  origen_owner_id: string | null;
  sin_regla: boolean;
  detalle: Record<string, any>;
};

/**
 * El cálculo, en el orden en que se explica:
 *   monto cobrado → menos el descuento de la cuenta receptora → sobre ESA base
 *   el porcentaje → menos el exceso de descuento que puso el consultor.
 * Nunca sobre el bruto.
 */
export function calcularLinea(e: EntradaCalculo): LineaCalculada {
  const bruto = r2(Number(e.pago.monto || 0));
  const cuenta: Cuenta = (e.pago.comision_cuenta || e.modelo.cuenta_default || 'corporativa') as Cuenta;
  const descuento_pct = descuentoDe(e.modelo, cuenta);
  const base = r2(bruto * (1 - descuento_pct / 100));

  const regla = elegirRegla(e.reglas, { plan_id: e.plan_id, categoria: e.categoria, origen: e.origen });
  let pct = regla ? Number(regla.pct) : 0;

  // La anualidad no se paga como primera venta. Las tasas altas —35% del lead
  // de Sacs, 55% del referido, 70% de la recuperada— son premio de ADQUISICIÓN
  // y se cobran una vez; el recurrente de ARR va a su propia tasa. Si la regla
  // no la define (servicios de arranque, personalización), no hay anualidad que
  // renovar y se queda con la de siempre.
  const tasa_de_renovacion = e.es_renovacion === true && regla?.pct_renovacion != null;
  if (tasa_de_renovacion) pct = Number(regla!.pct_renovacion);

  // ── Las tres condiciones de la renovación ──
  // A y B llegan resueltas en `cumple_condiciones` (seguimiento y crecimiento).
  // C es la puntualidad del cobro y se resuelve aquí, porque es una propiedad
  // de ESTE pago y no del año: una cuenta puede ir bien y aun así haber
  // cobrado tarde una anualidad concreta.
  const incumple = e.es_renovacion === true && e.cumple_condiciones === false;

  const gracia = e.modelo.dias_gracia_cobro;
  const dias_atraso = e.dias_atraso == null ? null : Math.round(Number(e.dias_atraso));
  // Sin fecha de vencimiento no se puede afirmar que llegó tarde: no castiga.
  const fuera_de_tiempo =
    e.es_renovacion === true && gracia != null && dias_atraso != null && dias_atraso > Number(gracia);

  const tasa_reducida = (incumple || fuera_de_tiempo) && e.modelo.tasa_incumplimiento_pct != null && !!regla;
  if (tasa_reducida) pct = Number(e.modelo.tasa_incumplimiento_pct);

  const descuento_venta_pct = r2(Number(e.descuento_venta_pct || 0));
  const descuento_exceso = excesoDescuento(bruto, descuento_venta_pct, Number(e.modelo.tope_descuento_pct ?? 35));

  // El exceso de descuento no puede volver negativa la comisión: como mucho la
  // deja en cero. Una comisión negativa se cobraría contra otras ventas y eso
  // no es lo que dice el marco.
  const bruta = r2(base * pct / 100);
  const monto = r2(Math.max(0, bruta - descuento_exceso));

  return {
    payment_id: e.pago.id,
    owner_id: e.owner_id,
    modelo_id: e.modelo.id,
    regla_id: regla?.id ?? null,
    tipo: 'venta',
    company_id: e.pago.company_id ?? null,
    subscription_id: e.pago.subscription_id ?? null,
    plan_id: e.plan_id,
    fecha: e.pago.fecha,
    concepto: e.concepto,
    categoria: e.categoria,
    origen: e.origen,
    monto_bruto: bruto,
    cuenta,
    descuento_pct,
    base,
    pct,
    monto,
    es_renovacion: e.es_renovacion === true,
    tasa_reducida,
    tasa_de_renovacion: tasa_de_renovacion && !tasa_reducida,
    pct_manual: null, pct_manual_nota: null, pct_manual_at: null, cuenta_manual: null,
    dias_atraso,
    fuera_de_tiempo,
    descuento_venta_pct,
    descuento_exceso,
    origen_owner_id: null,
    sin_regla: !regla,
    detalle: {
      regla_nota: regla?.nota ?? null,
      especificidad: regla ? especificidad(regla) : undefined,
      comision_antes_de_exceso: descuento_exceso > 0 ? bruta : undefined,
      motivo_tasa_reducida: tasa_reducida ? (fuera_de_tiempo ? 'cobro fuera de tiempo' : 'no cumplió seguimiento o crecimiento') : undefined,
      pct_primera_venta: tasa_de_renovacion && !tasa_reducida ? Number(regla!.pct) : undefined,
    },
  };
}

/**
 * El override de quien reclutó al partner: un % sobre la MISMA venta, a cargo
 * de Sacs. No toca la comisión del vendedor — son dos líneas del mismo pago,
 * que es justo por lo que el índice único incluye el tipo.
 */
export function calcularOverride(
  venta: LineaCalculada,
  reclutador_id: string,
  modeloReclutador: Modelo,
): LineaCalculada | null {
  const pct = modeloReclutador.override_partner_pct;
  if (pct == null || Number(pct) <= 0) return null;
  return {
    ...venta,
    owner_id: reclutador_id,
    modelo_id: modeloReclutador.id,
    regla_id: null,
    tipo: 'override_partner',
    pct: Number(pct),
    // El override se calcula sobre la misma base y NO carga con el exceso de
    // descuento: ese lo puso el vendedor, no quien lo reclutó.
    descuento_exceso: 0,
    monto: r2(venta.base * Number(pct) / 100),
    tasa_reducida: false,
    tasa_de_renovacion: false,
    pct_manual: null, pct_manual_nota: null, pct_manual_at: null, cuenta_manual: null,
    fuera_de_tiempo: false,
    origen_owner_id: venta.owner_id,
    sin_regla: false,
    detalle: { override_de: venta.owner_id },
  };
}

/** Frase corta que explica de dónde salió el número, para la pantalla. */
/**
 * Aplica un % puesto a mano sobre una línea ya calculada.
 *
 * Vive aquí y no en el endpoint porque la usan DOS caminos —guardar el ajuste y
 * el recálculo de cada madrugada— y si cada uno hiciera su propia cuenta, una
 * de las dos se quedaría atrás. El exceso de descuento se sigue restando: es un
 * castigo por cómo se vendió, no por la tarifa, y perdonarlo al mover el % sería
 * una puerta trasera para saltárselo.
 */
type ConTarifa = { base: number | string; pct: number | string; descuento_exceso?: number | string | null };

/**
 * Cambia la CUENTA a la que entró el pago y rehace lo que cuelga de ella.
 *
 * La cuenta decide el descuento (16% de IVA en la corporativa, 6% de dispersión
 * en la pagadora), el descuento decide la base, y la base decide la comisión.
 * Por eso no basta con guardar la cuenta: hay que rehacer la cadena completa, o
 * el renglón diría una cuenta y cobraría por otra.
 *
 * El `pct` que recibe es el que ya tiene la línea —incluido uno puesto a mano—,
 * así que corregir la cuenta NO pisa un ajuste de porcentaje. Son dos
 * correcciones distintas y se pueden usar juntas.
 */
export function aplicarCuenta<T extends { monto_bruto: number | string; pct: number | string; descuento_exceso?: number | string | null }>(
  l: T, cuenta: Cuenta | null, modelo: Modelo,
): T & { cuenta: Cuenta; cuenta_manual: Cuenta | null; descuento_pct: number; base: number; monto: number } {
  const efectiva: Cuenta = cuenta || (modelo.cuenta_default as Cuenta) || 'corporativa';
  const descuento_pct = descuentoDe(modelo, efectiva);
  const bruto = Number(l.monto_bruto || 0);
  const base = r2(bruto * (1 - descuento_pct / 100));
  const bruta = r2(base * Number(l.pct || 0) / 100);
  return {
    ...l,
    cuenta: efectiva,
    cuenta_manual: cuenta,
    descuento_pct,
    base,
    monto: r2(Math.max(0, bruta - Number(l.descuento_exceso || 0))),
  };
}

export function aplicarPctManual<T extends ConTarifa>(
  l: T, pct: number | null, nota?: string | null, cuando?: string | null,
): T & { pct: number; monto: number; pct_manual: number | null; pct_manual_nota: string | null; pct_manual_at: string | null } {
  if (pct == null) {
    const bruta = r2(Number(l.base || 0) * Number(l.pct || 0) / 100);
    return {
      ...l, pct: Number(l.pct || 0),
      pct_manual: null, pct_manual_nota: null, pct_manual_at: null,
      monto: r2(Math.max(0, bruta - Number(l.descuento_exceso || 0))),
    };
  }
  const bruta = r2(Number(l.base || 0) * pct / 100);
  return {
    ...l,
    pct_manual: pct,
    pct_manual_nota: (nota || '').trim() || null,
    pct_manual_at: cuando || new Date().toISOString(),
    pct,
    monto: r2(Math.max(0, bruta - Number(l.descuento_exceso || 0))),
  };
}

export function explicar(l: LineaCalculada | any): string {
  const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
  const partes: string[] = [];

  if (l.estado === 'cancelada') return 'Cancelada a mano · no suma y el recálculo no la toca';
  if (l.tipo === 'override_partner') {
    return `${money(l.base)} de base × ${Number(l.pct)}% de override sobre la venta del partner = ${money(l.monto)}`;
  }

  partes.push(money(l.monto_bruto) + ' cobrado');
  if (Number(l.descuento_pct) > 0) {
    partes.push(`−${Number(l.descuento_pct)}% ${l.cuenta === 'corporativa' ? 'IVA' : 'dispersión'} = ${money(l.base)}`);
  }
  if (l.sin_regla) { partes.push('sin tarifa configurada'); return partes.join(' · '); }

  const motivo = l.detalle?.motivo_tasa_reducida
    || (l.fuera_de_tiempo ? 'cobro fuera de tiempo' : 'no cumplió renovación');
  const sello = l.pct_manual != null
      ? ` ajustado a mano${l.pct_manual_nota ? `: ${l.pct_manual_nota}` : ''}`
    : l.tasa_reducida ? ` (tasa reducida: ${motivo})`
    : l.tasa_de_renovacion ? ' de anualidad' : '';
  partes.push(`× ${Number(l.pct)}%${sello} = ${money(l.detalle?.comision_antes_de_exceso ?? l.monto)}`);
  if (l.dias_atraso != null && Number(l.dias_atraso) > 0 && !l.tasa_reducida) {
    partes.push(`cobrado ${Number(l.dias_atraso)} día(s) tarde, dentro del margen`);
  }
  if (Number(l.descuento_exceso) > 0) {
    partes.push(`−${money(l.descuento_exceso)} de descuento sobre el tope = ${money(l.monto)}`);
  }
  return partes.join(' · ');
}

/** Primer y último día del mes de una fecha ISO (YYYY-MM-DD). */
export function mesDe(iso: string): { desde: string; hasta: string } {
  const [y, m] = iso.split('-').map(Number);
  const fin = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return { desde: `${y}-${p(m)}-01`, hasta: `${y}-${p(m)}-${p(fin)}` };
}

/**
 * Escapa un término para meterlo dentro de un `.or()` de PostgREST.
 *
 * La coma separa filtros: buscar «Kshlerin, Kemmer and Adams» partía la
 * consulta en dos filtros inválidos y devolvía un 400. Entrecomillar el valor
 * es lo que PostgREST espera para valores con comas, paréntesis o puntos.
 */
export function orSeguro(valor: string): string {
  return '"' + String(valor).replace(/["\\]/g, m => '\\' + m) + '"';
}
