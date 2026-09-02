// Recálculo de comisiones sobre un rango de fechas.
//
// Lo usan el cron diario y el botón "Recalcular" de la pantalla: es el MISMO
// código, para que lo que ves al apretar el botón sea exactamente lo que va a
// pasar en la madrugada.
//
// Es idempotente: corre las veces que quieras sobre el mismo rango y el
// resultado no cambia. Eso es lo que permite recalcular todos los días sin
// llevar registro de qué ya se procesó.
//
// Lo que NUNCA toca:
//  · líneas PAGADAS — la historia no se reescribe;
//  · líneas CANCELADAS a mano — si no, cada madrugada resucitarían;
//  · pagos anulados o duplicados — no son dinero;
//  · pagos sin dueño asignado — no hay a quién pagarle. Se cuentan aparte y la
//    pantalla los muestra como "sin atribuir", que es el trabajo pendiente.
import { supabase } from '../supabase';
import {
  calcularLinea, calcularOverride, aplicarPctManual, aplicarCuenta, ESTADOS_ANULADOS, ESTADOS_CONGELADOS,
  type Modelo, type Regla, type Origen, type LineaCalculada,
} from './comisiones.lib';

export type ResultadoRecalculo = {
  desde: string; hasta: string;
  pagos_leidos: number;
  lineas_escritas: number;
  lineas_canceladas: number;
  overrides: number;
  sin_atribuir: number;
  sin_regla: number;
  congeladas: number;
  tasa_reducida: number;
  fuera_de_tiempo: number;
  sin_vencimiento: number;
  /** Pagos con fecha futura: dinero que todavía no entra, no comisiona. */
  futuros: number;
  /** Líneas cuyo % está puesto a mano y el recálculo respetó. */
  pct_manual: number;
  /** Líneas con la cuenta corregida a mano. */
  cuenta_manual: number;
  ajustes_pendientes: { payment_id: string; monto: number; motivo: string }[];
  monto_escrito: number;
  truncado: boolean;
  errores: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const PAGINA = 1000;

/**
 * Lee TODAS las filas que casen, no la primera página.
 *
 * El `.limit(5000)` que había antes no era un tope de seguridad: era una bomba
 * de tiempo silenciosa. Pasado ese número, los pagos siguientes simplemente
 * dejaban de comisionar y nada lo decía. `tope` existe solo para no colgar la
 * función; si se alcanza, el resultado lo reporta como `truncado`.
 */
async function leerTodo(construir: () => any, tope = 50000): Promise<{ filas: any[]; truncado: boolean }> {
  const filas: any[] = [];
  for (let off = 0; off < tope; off += PAGINA) {
    const { data, error } = await construir().range(off, off + PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

export async function recalcularComisiones(desde: string, hasta: string): Promise<ResultadoRecalculo> {
  const res: ResultadoRecalculo = {
    desde, hasta, pagos_leidos: 0, lineas_escritas: 0,
    lineas_canceladas: 0, overrides: 0, sin_atribuir: 0, sin_regla: 0, congeladas: 0,
    tasa_reducida: 0, fuera_de_tiempo: 0, sin_vencimiento: 0, futuros: 0, pct_manual: 0, cuenta_manual: 0,
    ajustes_pendientes: [], monto_escrito: 0, truncado: false, errores: [],
  };

  // ── Catálogos (pocas filas, se leen enteros una vez) ──
  const [{ data: modelos }, { data: reglas }, { data: miembros }, { data: planes }] = await Promise.all([
    supabase.from('comision_modelos').select('*'),
    supabase.from('comision_reglas').select('*'),
    supabase.from('team_members').select('id, nombre, activo, comision_modelo_id, reclutado_por_id'),
    supabase.from('plans').select('id, nombre, categoria'),
  ]);

  const modeloPorId = new Map<string, Modelo>((modelos || []).map((m: any) => [m.id, m as Modelo]));
  const modeloDefault = (modelos || []).find((m: any) => m.es_default) as Modelo | undefined;
  const reglasPorModelo = new Map<string, Regla[]>();
  for (const r of (reglas || []) as Regla[]) {
    if (!reglasPorModelo.has(r.modelo_id)) reglasPorModelo.set(r.modelo_id, []);
    reglasPorModelo.get(r.modelo_id)!.push(r);
  }
  const miembroPorId = new Map<string, any>((miembros || []).map((m: any) => [m.id, m]));
  const planPorId = new Map<string, any>((planes || []).map((p: any) => [p.id, p]));
  const modeloDe = (id: string | null | undefined): Modelo | undefined => {
    const m = id ? miembroPorId.get(id) : null;
    return (m?.comision_modelo_id && modeloPorId.get(m.comision_modelo_id)) || modeloDefault;
  };

  if (!(modelos || []).length) {
    res.errores.push('No hay ningún modelo de comisiones configurado.');
    return res;
  }

  // ── Pagos del rango, con lo necesario para atribuirlos ──
  let pagos: any[] = [];
  try {
    const r = await leerTodo(() => supabase
      .from('payments')
      .select(
        'id, fecha, monto, estado, reembolsado, comision_cuenta, company_id, subscription_id, vencia_el, dias_atraso, ' +
        'companies(id, nombre, comision_owner_id, comision_origen), ' +
        'subscriptions(id, nombre_plan, plan_id, precio, precio_lista, fecha_inicio, comision_owner_id, comision_origen)'
      )
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha'));
    pagos = r.filas; res.truncado = r.truncado;
  } catch (e: any) { res.errores.push(e.message); return res; }
  res.pagos_leidos = pagos.length;

  // ── Evaluaciones de renovación de las empresas involucradas ──
  const anios = [...new Set(pagos.map(p => Number(String(p.fecha).slice(0, 4))))];
  const evaluaciones = new Map<string, boolean>(); // `${company_id}:${anio}` → cumple
  if (anios.length) {
    const { data: evs } = await supabase.from('comision_evaluaciones')
      .select('company_id, anio, cumple').in('anio', anios);
    for (const e of evs || []) {
      if (e.cumple != null) evaluaciones.set(`${e.company_id}:${e.anio}`, e.cumple);
    }
  }

  // ── Líneas que ya existen para esos pagos ──
  const ids = pagos.map(p => p.id);
  const existentes = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('comision_lineas')
      .select('id, payment_id, owner_id, tipo, estado, monto, corte_id, pct_manual, pct_manual_nota, pct_manual_at, cuenta_manual').in('payment_id', ids.slice(i, i + 300));
    for (const l of data || []) existentes.set(`${l.payment_id}:${l.owner_id}:${l.tipo}`, l);
  }

  const aEscribir: LineaCalculada[] = [];
  const aCancelar: string[] = [];

  // El día de hoy en UTC. `payments.fecha` es un `date` sin hora, así que la
  // comparación es de calendario y no arrastra husos.
  const hoy = new Date().toISOString().slice(0, 10);

  for (const p of pagos) {
    const anulado = ESTADOS_ANULADOS.includes(String(p.estado || '').toLowerCase());
    const devuelto = p.reembolsado === true;

    // Un pago con fecha futura es un cobro PROGRAMADO, no cobrado: comisionarlo
    // sería pagar por dinero que todavía no entró. El cron diario nunca lo veía
    // porque su ventana termina hoy, pero un recálculo manual con rango abierto
    // sí, y ya había una línea de 2027 en la base por esta vía.
    // Si ya existía una línea por un pago que luego se movió al futuro, se
    // cancela: dejarla viva la seguiría sumando al corte.
    if (p.fecha > hoy) {
      res.futuros++;
      for (const [k, l] of existentes) {
        if (!k.startsWith(p.id + ':')) continue;
        if (l.estado !== 'pagada' && l.estado !== 'cancelada') aCancelar.push(l.id);
      }
      continue;
    }

    // Un pago que se fue para atrás: la comisión se va con él. Si ya se pagó,
    // NO se borra —el dinero ya salió— y se reporta como ajuste del siguiente
    // corte, que es como lo resuelve el marco de colaboración.
    if (anulado || devuelto) {
      for (const [k, l] of existentes) {
        if (!k.startsWith(p.id + ':')) continue;
        if (l.estado === 'pagada') {
          res.ajustes_pendientes.push({
            payment_id: p.id, monto: Number(l.monto || 0),
            motivo: anulado ? 'pago anulado' : 'pago reembolsado',
          });
        } else if (l.estado !== 'cancelada') {
          aCancelar.push(l.id);
        }
      }
      continue;
    }

    const sub = p.subscriptions || null;
    const comp = p.companies || null;

    // La suscripción manda sobre la empresa: una cuenta puede tener una venta
    // que le tocó a otra persona sin cambiar de dueño.
    const owner_id: string | null = sub?.comision_owner_id || comp?.comision_owner_id || null;
    const origen: Origen | null = (sub?.comision_origen || comp?.comision_origen || null) as Origen | null;

    if (!owner_id) { res.sin_atribuir++; continue; }

    const modelo = modeloDe(owner_id);
    if (!modelo) { res.errores.push(`Sin modelo para ${miembroPorId.get(owner_id)?.nombre || owner_id}`); continue; }

    const plan = sub?.plan_id ? planPorId.get(sub.plan_id) : null;

    // Renovación = el pago cae en un año posterior al del arranque de la
    // suscripción. Es la definición más simple que se puede verificar mirando
    // el expediente, y por eso es la que aguanta un reclamo.
    const anioPago = Number(String(p.fecha).slice(0, 4));
    const anioInicio = sub?.fecha_inicio ? Number(String(sub.fecha_inicio).slice(0, 4)) : null;
    const es_renovacion = anioInicio != null && anioPago > anioInicio;
    const cumple = p.company_id ? evaluaciones.get(`${p.company_id}:${anioPago}`) : undefined;

    // Descuento con el que se cerró: precio de lista contra precio real.
    const lista = Number(sub?.precio_lista || 0);
    const precio = Number(sub?.precio || 0);
    const descuento_venta_pct = lista > 0 && precio > 0 && precio < lista
      ? r2((1 - precio / lista) * 100) : 0;

    // Días de atraso del cobro. Se prefiere el capturado al registrar el pago;
    // si falta pero sí hay vencimiento, se deriva. Sin vencimiento no hay dato
    // y la puntualidad queda sin evaluar (no castiga).
    let dias_atraso: number | null = p.dias_atraso == null ? null : Number(p.dias_atraso);
    if (dias_atraso == null && p.vencia_el) {
      dias_atraso = Math.round((Date.parse(p.fecha + 'T00:00:00Z') - Date.parse(p.vencia_el + 'T00:00:00Z')) / 86400000);
    }
    if (es_renovacion && dias_atraso == null) res.sin_vencimiento++;

    const linea = calcularLinea({
      pago: p,
      concepto: plan?.nombre || sub?.nombre_plan || null,
      plan_id: plan?.id ?? null,
      categoria: plan?.categoria ?? null,
      origen,
      owner_id,
      modelo,
      reglas: reglasPorModelo.get(modelo.id) || [],
      descuento_venta_pct,
      es_renovacion,
      cumple_condiciones: cumple,
      dias_atraso,
    });

    if (linea.sin_regla) res.sin_regla++;
    if (linea.tasa_reducida) res.tasa_reducida++;
    if (linea.fuera_de_tiempo) res.fuera_de_tiempo++;

    const congelada = (k: string) => {
      const ya = existentes.get(k);
      if (!ya) return false;
      if (ESTADOS_CONGELADOS.includes(ya.estado)) { res.congeladas++; return true; }
      return false;
    };

    /**
     * Un upsert de PostgREST REEMPLAZA la fila: toda columna ausente del
     * payload vuelve a su valor por defecto. Sin esto, el recálculo de cada
     * madrugada borraba `corte_id` y devolvía `estado` a 'calculada' — un corte
     * enviado el lunes amanecía el martes sin ninguna línea.
     *
     * Se arrastra todo lo que NO es del cálculo sino del proceso: en qué corte
     * viaja, en qué estado está, y el % que alguien ajustó a mano.
     *
     * El ajuste manual es el más frágil de los tres, porque el recálculo SÍ
     * sabe calcular ese campo —y calcularía otra cosa—. Si no se arrastra, una
     * excepción acordada por la tarde desaparece de noche y el lunes se paga el
     * número viejo, sin que nadie vea el cambio.
     */
    const conservando = (l: LineaCalculada, k: string) => {
      const ya = existentes.get(k);
      if (!ya) return l;
      let f: any = { ...l, corte_id: ya.corte_id ?? null, estado: ya.estado };
      // EL ORDEN IMPORTA: la cuenta rehace la base, y el % se aplica sobre la
      // base. Al revés, un renglón con las dos correcciones cobraría el
      // porcentaje correcto sobre la base equivocada.
      if (ya.cuenta_manual) f = aplicarCuenta(f, ya.cuenta_manual, modelo);
      if (ya.pct_manual != null) f = aplicarPctManual(f, Number(ya.pct_manual), ya.pct_manual_nota, ya.pct_manual_at);
      return f as LineaCalculada;
    };

    const kVenta = `${p.id}:${owner_id}:venta`;
    if (!congelada(kVenta)) {
      // El monto que se REPORTA es el de la fila que se va a escribir: si un
      // ajuste manual la cambió, el resumen tiene que decir esa cifra y no la
      // que salió de la tarifa.
      const fila = conservando(linea, kVenta) as LineaCalculada;
      aEscribir.push(fila);
      if (fila.pct_manual != null) res.pct_manual++;
      if ((fila as any).cuenta_manual) res.cuenta_manual++;
      res.monto_escrito = r2(res.monto_escrito + fila.monto);
    }

    // ── Override de quien reclutó al partner (cláusula 8.3) ──
    const reclutador = miembroPorId.get(owner_id)?.reclutado_por_id || null;
    if (reclutador && reclutador !== owner_id) {
      const modeloR = modeloDe(reclutador);
      const ov = modeloR ? calcularOverride(linea, reclutador, modeloR) : null;
      const kOv = `${p.id}:${reclutador}:override_partner`;
      if (ov && !congelada(kOv)) {
        const fila = conservando(ov, kOv) as LineaCalculada;
        aEscribir.push(fila);
        res.overrides++;
        res.monto_escrito = r2(res.monto_escrito + fila.monto);
      }
    }
  }

  // ── Escrituras ──
  // upsert y no insert: el cron y el botón "Recalcular" pueden coincidir, y con
  // un insert plano el choque contra el índice único tumbaba el LOTE COMPLETO
  // de 500 filas, no solo la repetida.
  for (let i = 0; i < aEscribir.length; i += 300) {
    const lote = aEscribir.slice(i, i + 300).map(l => ({ ...l, calculado_at: new Date().toISOString() }));
    const { error: e, count } = await supabase.from('comision_lineas')
      .upsert(lote, { onConflict: 'payment_id,owner_id,tipo', count: 'exact' });
    if (e) res.errores.push(e.message);
    else res.lineas_escritas += count ?? lote.length;
  }
  if (aCancelar.length) {
    const { error: e } = await supabase.from('comision_lineas')
      .update({ estado: 'cancelada', monto: 0, calculado_at: new Date().toISOString() })
      .in('id', aCancelar);
    if (e) res.errores.push(e.message); else res.lineas_canceladas = aCancelar.length;
  }

  return res;
}

/**
 * Evalúa la condición B de renovación: la meta de EXPANSIÓN de la cuenta.
 *
 * La regla es del inciso 3.9 del marco: venderle al año al menos el **30% de su
 * plan anual vigente** en licencias vitalicias, plugins o servicios. Dos cosas
 * que la distinguen de la versión anterior (50% de lo contratado el año pasado):
 *
 *  · la base es el plan VIGENTE, no el histórico. Una cuenta vieja no se vuelve
 *    imposible de cumplir solo por llevar años comprando;
 *  · la renovación de la propia licencia NO cuenta. Lo que se mide es lo que
 *    SUMA a la cuenta, no que el cliente siga pagando lo mismo.
 *
 * La condición A (seguimiento) es de criterio y la marca una persona: aquí solo
 * se calcula lo que es aritmética.
 */
export async function evaluarRenovaciones(anio: number) {
  const desde = `${anio}-01-01`, hasta = `${anio}-12-31`;

  // ── Base: el plan anual vigente de cada cuenta ──
  const { filas: subs } = await leerTodo(() => supabase.from('subscriptions')
    .select('company_id, precio, ciclo, estado, plan_id, plans(categoria)')
    .eq('estado', 'activa').not('company_id', 'is', null).order('company_id'));

  const base = new Map<string, number>();
  for (const s of subs) {
    if ((s as any).plans?.categoria !== 'plan') continue;
    if (s.ciclo !== 'anual') continue;
    base.set(s.company_id, r2((base.get(s.company_id) || 0) + Number(s.precio || 0)));
  }

  // ── Vendido: SOLO lo que expande la cuenta ──
  // Todo lo que no es la licencia recurrente (plugins, servicios,
  // personalizaciones) más las licencias vitalicias, que son pago único.
  const { filas: pagos } = await leerTodo(() => supabase.from('payments')
    .select('company_id, monto, reembolsado, estado, subscriptions(ciclo, plans(categoria))')
    .gte('fecha', desde).lte('fecha', hasta)
    .not('company_id', 'is', null)
    .or('estado.is.null,estado.not.in.(anulado,cancelado,duplicado)')
    .order('company_id'));

  const vendido = new Map<string, number>();
  for (const p of pagos) {
    if (p.reembolsado === true) continue;
    const cat = (p as any).subscriptions?.plans?.categoria;
    const ciclo = (p as any).subscriptions?.ciclo;
    // Sin SKU no se puede saber si expandió: no cuenta ni a favor ni en contra.
    if (!cat) continue;
    const expande = cat !== 'plan' || ciclo === 'vitalicia';
    if (!expande) continue;
    vendido.set(p.company_id, r2((vendido.get(p.company_id) || 0) + Number(p.monto || 0)));
  }

  const filas: any[] = [];
  for (const [company_id, base_anterior] of base) {
    const v = vendido.get(company_id) || 0;
    const meta = r2(base_anterior * 0.30);
    filas.push({
      company_id, anio,
      base_anterior,            // el plan anual vigente: la base del 30%
      vendido: v,
      meta,
      cumple_b: v >= meta,
      calculado_at: new Date().toISOString(),
    });
  }
  if (!filas.length) return { anio, evaluadas: 0 };

  // No pisa `condicion_a` ni `cumple`: esos los pone una persona.
  for (let i = 0; i < filas.length; i += 300) {
    await supabase.from('comision_evaluaciones')
      .upsert(filas.slice(i, i + 300), { onConflict: 'company_id,anio', ignoreDuplicates: false });
  }
  return { anio, evaluadas: filas.length };
}
