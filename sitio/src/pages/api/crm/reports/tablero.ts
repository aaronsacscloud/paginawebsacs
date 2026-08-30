import { conMicroCache } from '../../../../lib/crm/micro-cache';
// GET /api/crm/reports/tablero?desde=&hasta= — todo lo que pinta el tablero.
//
// Un solo viaje: el tablero abre en cada sesión y con seis llamadas sueltas se
// veía llenarse por partes.
//
// El tablero razona por MES. Por omisión el rango es del día 1 al de hoy, y el
// resto son fechas a mano. Cuatro reglas gobiernan el archivo:
//
//  · Lo que NO se puede calcular se marca como tal y no se rellena. El CAC
//    necesita el gasto de marketing —que el CRM no conoce— y el LTV necesita
//    varios meses de bajas. Un número inventado en una pantalla que puede ver
//    un inversionista es peor que un hueco.
//  · Las cifras de recurrencia salen del LEDGER de MRR (mrr_movements), no de
//    comparar fotos: el ledger dice si un alza fue alta nueva, expansión o
//    reactivación, y esa diferencia es justo la que importa.
//  · Hay bloques que NO obedecen al rango y lo dicen: la meta del mes es
//    siempre del mes corriente, el ARR por cobrar mira 90 días hacia adelante
//    y la facturación de la cartera es una foto de 30 días que escribe el cron.
//  · Los pagos marcados como duplicado o reembolsado no suman en ningún lado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const num = (x: any) => Number(x || 0);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : null;
const dia = (f: any) => String(f || '').slice(0, 10);
const entre = (f: any, a: string, b: string) => { const d = dia(f); return !!d && d >= a && d <= b; };
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// Cotizaciones que no cuentan para nada: borradores, plantillas y borradas.
const VIVA = (q: any) => !['draft', 'deleted', 'plantilla'].includes(q.estado);

const _GET: APIRoute = async ({ url }) => {
  const ahora = new Date();
  const hoy = iso(ahora);
  const anio = ahora.getFullYear(), mes = ahora.getMonth() + 1;
  const mesIni = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const diasMes = new Date(anio, mes, 0).getDate();

  const hasta = (url.searchParams.get('hasta') || hoy).slice(0, 10);
  const desde = (url.searchParams.get('desde') || mesIni).slice(0, 10);
  const dias = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1);
  // "El mes" es el caso normal: habilita la meta, el ritmo y la proyección.
  const esMesActual = desde === mesIni && hasta === hoy;

  // Los pagos se piden UNA vez con la ventana más ancha que necesita el
  // tablero —el rango pedido, el mes corriente y los 6 meses del historial— y
  // se recortan en memoria. Tres consultas casi iguales no valen el viaje.
  const seisAtras = iso(new Date(anio, mes - 6, 1));
  const ventanaIni = [desde, mesIni, seisAtras].sort()[0];
  const ventanaFin = [hasta, hoy].sort().reverse()[0];

  const [subsQ, compQ, quotesQ, dealsQ, movQ, goalsQ, payQ, reuQ, mejQ, reuTodasQ] = await Promise.all([
    supabase.from('subscriptions').select('id, company_id, nombre_plan, plan_id, ciclo, precio, monto_proximo, arr, proxima_factura, estado, mp_link_pago, fecha_inicio'),
    supabase.from('companies').select('id, nombre, nombre_comercial, estado_cuenta, created_at').is('archived_at', null),
    supabase.from('quotes').select('id, numero, empresa, total, estado, vigencia, created_at, pagado_fecha, aceptado_fecha, company_id, deal_id'),
    supabase.from('deals').select('id, valor_total, stage, created_at, company_id'),
    supabase.from('mrr_movements').select('fecha, tipo, mrr_delta, company_id').gte('fecha', ventanaIni).lte('fecha', ventanaFin),
    supabase.from('crm_goals').select('tipo, anio, mes, monto'),
    supabase.from('payments').select('id, monto, fecha, metodo, subscription_id, quote_id, company_id')
      .gte('fecha', ventanaIni).lte('fecha', ventanaFin)
      .not('estado', 'in', '(reembolsado,duplicado)').not('reembolsado', 'is', true),
    supabase.from('bookings').select('id, fecha, estado, event_types(nombre, categoria)').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('mejoras').select('id, estado, created_at, company_id, fecha_compromiso').is('archived_at', null),
    supabase.from('bookings').select('company_id').gte('fecha', desde),
  ]);

  const subs = (subsQ.data || []);
  const activas = subs.filter((s: any) => s.estado === 'activa' && s.ciclo !== 'vitalicia');
  const empresas = compQ.data || [];
  const quotes = (quotesQ.data || []).filter(VIVA);
  const deals = dealsQ.data || [];
  const empresaDe = Object.fromEntries(empresas.map((c: any) => [c.id, c.nombre_comercial || c.nombre]));

  const todosPagos = (payQ.data || []) as any[];
  const pagos = todosPagos.filter((p: any) => entre(p.fecha, desde, hasta));
  const pagosMes = todosPagos.filter((p: any) => entre(p.fecha, mesIni, hoy));
  const movs = (movQ.data || []).filter((m: any) => entre(m.fecha, desde, hasta));

  /* ══════════ 1 · EL DINERO DEL RANGO ══════════ */
  const cobrado = Math.round(pagos.reduce((a: number, p: any) => a + num(p.monto), 0));

  // Serie acumulada, un punto por día. Arriba de 92 días se agrupa por semana:
  // un año son 365 vértices que el ojo no distingue y el SVG sí pesa.
  const paso = dias > 92 ? 7 : 1;
  const t0 = Date.parse(desde + 'T12:00:00');
  const porDia: Record<number, number> = {};
  for (const p of pagos) {
    const i = Math.round((Date.parse(dia(p.fecha) + 'T12:00:00') - t0) / 86400000);
    porDia[i] = (porDia[i] || 0) + num(p.monto);
  }
  const serie: { i: number; acum: number }[] = [];
  let corrido = 0;
  for (let i = 0; i < dias; i++) {
    corrido += porDia[i] || 0;
    if (i % paso === 0 || i === dias - 1) serie.push({ i, acum: Math.round(corrido) });
  }

  // Historial: los 6 meses que acaban en el corriente. Sirve para saber si el
  // mes va bien o mal, que un total suelto no dice.
  const historial = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(anio, mes - 6 + k, 1);
    const a = d.getFullYear(), m = d.getMonth() + 1;
    const ini = `${a}-${String(m).padStart(2, '0')}-01`;
    const fin = `${a}-${String(m).padStart(2, '0')}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
    return {
      etiqueta: MES_CORTO[m - 1], mes: ini.slice(0, 7), actual: ini === mesIni,
      monto: Math.round(todosPagos.filter((p: any) => entre(p.fecha, ini, fin)).reduce((x: number, p: any) => x + num(p.monto), 0)),
    };
  });

  /* ══════════ 2 · SOBRE LA MESA ══════════
     Lo vivo AHORA, no lo del rango: una cotización de julio sin responder
     sigue siendo dinero por cerrar hoy. */
  const aceptadasVivas = quotes.filter((q: any) => q.estado === 'accepted');
  const enviadasVivas = quotes.filter((q: any) => ['sent', 'parcial'].includes(q.estado));
  const suma = (a: any[]) => Math.round(a.reduce((x: number, q: any) => x + num(q.total), 0));
  const abiertas = deals.filter((d: any) => !String(d.stage || '').startsWith('cerrada'));
  const dealsConCotiza = new Set(quotes.filter((q: any) => q.deal_id && ['sent', 'accepted', 'parcial'].includes(q.estado)).map((q: any) => q.deal_id));

  /* ══════════ 3 · GENERADO ══════════ */
  const aceptadasPeriodo = quotes.filter((q: any) => entre(q.aceptado_fecha, desde, hasta));
  const cotizadasPeriodo = quotes.filter((q: any) => entre(q.created_at, desde, hasta));
  // La semana más fuerte. Cuando un mes se decide en cinco días, el promedio
  // miente y conviene decirlo con fechas.
  const semanas: Record<number, { monto: number; n: number }> = {};
  for (const q of aceptadasPeriodo) {
    const k = Math.floor((Date.parse(dia(q.aceptado_fecha) + 'T12:00:00') - t0) / 86400000 / 7);
    semanas[k] = semanas[k] || { monto: 0, n: 0 };
    semanas[k].monto += num(q.total); semanas[k].n++;
  }
  const mejorK = Object.entries(semanas).sort((a, b) => b[1].monto - a[1].monto)[0];
  const fechaEn = (off: number) => iso(new Date(t0 + off * 86400000));
  const mejorSemana = mejorK ? {
    monto: Math.round(mejorK[1].monto), n: mejorK[1].n,
    desde: fechaEn(Number(mejorK[0]) * 7),
    hasta: fechaEn(Math.min(dias - 1, Number(mejorK[0]) * 7 + 6)),
  } : null;

  /* ══════════ 4 · EL MOTOR RECURRENTE ══════════
     Vender no es crecer: la cascada separa lo que entró de lo que se fue. */
  const sumaT = (t: string) => movs.filter((m: any) => m.tipo === t).reduce((a: number, m: any) => a + num(m.mrr_delta), 0);
  const nuevo = sumaT('new'), expansion = sumaT('expansion'), churn = sumaT('churn'), contraccion = sumaT('contraction'), react = sumaT('reactivation');
  const a12 = (v: number) => Math.round(v * 12);
  /* El ARR sale de la COLUMNA `arr`, no de `monto_proximo`.
   *
   * Antes se calculaba con `monto_proximo ?? precio`, y ese campo guarda a
   * propósito los ADD-ONS y descuentos del próximo cobro — cosas que se cobran
   * una vez o que no son plan base. Sumarlos infla el recurrente con dinero que
   * no se repite.
   *
   * Medido el 2026-08-30 en producción: 5 suscripciones tenían add-ons en
   * `monto_proximo` (Jose hernandez +$9,176, amalove +$4,767, cafevaboutique
   * +$1,872, boomfitness +$1,860, elbombazo +$1,365) y hacían que el tablero
   * dijera $1,924,569 mientras la pantalla de Suscripciones —que sí lee la
   * columna— decía $1,905,529. **$19,040 de diferencia entre dos pantallas del
   * mismo producto**, sin que ninguna estuviera marcada como aproximada. El
   * dueño lo vio desde el teléfono.
   *
   * La columna `arr` es el valor canónico de una suscripción en este CRM. Con
   * ella, Inicio y Suscripciones dan el mismo número. */
  const mrrDe = (s: any) => num(s.arr) / 12;
  const mrr = activas.reduce((a: number, s: any) => a + mrrDe(s), 0);
  const arr = mrr * 12;

  /* ══════════ 5 · QUIÉN ENTRÓ Y QUIÉN SE FUE ══════════ */
  const empresasNuevas = empresas.filter((c: any) => entre(c.created_at, desde, hasta));
  const leads = empresasNuevas.filter((c: any) => c.estado_cuenta !== 'activo').length;
  const clientesNuevos = new Set(subs.filter((s: any) => entre(s.fecha_inicio, desde, hasta)).map((s: any) => s.company_id)).size;
  const bajasCuentas = new Set(movs.filter((m: any) => m.tipo === 'churn').map((m: any) => m.company_id)).size;
  const clientesActivos = new Set(activas.map((s: any) => s.company_id)).size;

  /* ══════════ 6 · REUNIONES ══════════ */
  const reus = (reuQ.data || []) as any[];
  const asistio = (b: any) => b.estado === 'asistio' || b.estado === 'completada';
  const porTipo: Record<string, number> = {};
  for (const b of reus) {
    const k = (b.event_types as any)?.nombre || 'Sin tipo';
    porTipo[k] = (porTipo[k] || 0) + 1;
  }
  // "Para vender" son demo y cotización; el resto sostiene a quien ya es
  // cliente. La mezcla entre las dos es la que predice el mes que viene.
  const paraVender = reus.filter((b: any) => ['demo', 'cotizacion'].includes((b.event_types as any)?.categoria)).length;

  /* ══════════ 7 · CONSULTORÍA ══════════ */
  const mejoras = (mejQ.data || []) as any[];
  const mejEstado = (e: string) => mejoras.filter((m: any) => m.estado === e).length;
  // Vencido = tiene fecha comprometida, ya pasó, y no está entregada. Sin
  // fecha no se puede decir que esté vencido, así que no se cuenta.
  const mejVencidas = mejoras.filter((m: any) => m.fecha_compromiso && dia(m.fecha_compromiso) < hoy && m.estado !== 'entregada');

  /* ══════════ 8 · ARR POR COBRAR (90 días, no depende del rango) ══════════ */
  const cobrables = activas.filter((s: any) => s.proxima_factura);
  const tramo = (a: string, b: string) => cobrables.filter((s: any) => { const f = dia(s.proxima_factura); return f >= a && f <= b; });
  const montoDe = (a: any[]) => Math.round(a.reduce((x: number, s: any) => x + num(s.monto_proximo ?? s.precio), 0));
  const detalle = (a: any[]) => a
    .sort((x: any, y: any) => dia(x.proxima_factura).localeCompare(dia(y.proxima_factura)))
    .map((s: any) => ({
      id: s.id, company_id: s.company_id, cliente: empresaDe[s.company_id] || 'Cuenta',
      plan: s.nombre_plan, ciclo: s.ciclo, fecha: dia(s.proxima_factura),
      monto: Math.round(num(s.monto_proximo ?? s.precio)), link: s.mp_link_pago || null,
    }));
  const vencidasCobro = cobrables.filter((s: any) => dia(s.proxima_factura) < hoy);
  const d30 = tramo(hoy, masDias(30)), d60 = tramo(masDias(31), masDias(60)), d90 = tramo(masDias(61), masDias(90));
  const finMes = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
  const antesDeFinMes = cobrables.filter((s: any) => { const f = dia(s.proxima_factura); return f >= hoy && f <= finMes; });
  // Activas SIN fecha de renovación: no caen en ningún tramo, así que el
  // total de la tarjeta se queda corto y nadie las va a cobrar. Es un hueco
  // de captura, no un cero, y por eso se enseña en vez de esconderse.
  const sinFecha = activas.filter((s: any) => !s.proxima_factura);

  /* ══════════ 10 · SALUD ══════════ */
  const baseMrr = mrr - (nuevo + react);
  const nrr = baseMrr > 0 ? Math.round(((baseMrr + expansion + contraccion + churn) / baseMrr) * 100) : null;
  const churnPct = baseMrr > 0 ? Number(((Math.abs(churn) / baseMrr) * 100).toFixed(1)) : null;
  const resueltas = quotes.filter((q: any) => ['paid', 'rejected', 'expired'].includes(q.estado));
  const cierrePct = pct(resueltas.filter((q: any) => q.estado === 'paid').length, resueltas.length);
  const pagadas = quotes.filter((q: any) => q.estado === 'paid' && q.pagado_fecha && q.created_at);
  const cicloDias = pagadas.length
    ? Math.round(pagadas.reduce((a: number, q: any) => a + (Date.parse(q.pagado_fecha) - Date.parse(q.created_at)) / 86400000, 0) / pagadas.length)
    : null;
  const primeraDe: Record<string, string> = {};
  subs.filter((s: any) => s.estado === 'activa' && s.fecha_inicio).forEach((s: any) => {
    const f = dia(s.fecha_inicio);
    if (!primeraDe[s.company_id] || f < primeraDe[s.company_id]) primeraDe[s.company_id] = f;
  });
  const antig = Object.values(primeraDe);
  const antigMeses = antig.length
    ? Math.round(antig.reduce((a, f) => a + (Date.now() - Date.parse(f + 'T12:00:00')) / 2629800000, 0) / antig.length)
    : null;
  const porCuenta: Record<string, number> = {};
  activas.forEach((s: any) => { porCuenta[s.company_id] = (porCuenta[s.company_id] || 0) + mrrDe(s) * 12; });
  const top5 = Object.entries(porCuenta).sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* ══════════ A · EL DETALLE QUE ABRE CADA TARJETA ══════════
     Una cifra sin poder abrirla obliga a irse a otro módulo a comprobarla, y
     entonces el tablero deja de usarse. */
  const planDe: Record<string, string> = Object.fromEntries(subs.map((x: any) => [x.id, x.nombre_plan]));
  const numeroDe: Record<string, string> = Object.fromEntries((quotesQ.data || []).map((q: any) => [q.id, q.numero]));
  const pagosDetalle = [...pagos]
    .sort((a: any, b: any) => dia(b.fecha).localeCompare(dia(a.fecha)) || num(b.monto) - num(a.monto))
    .map((p: any) => ({
      id: p.id, fecha: dia(p.fecha), company_id: p.company_id || null,
      cliente: p.company_id ? (empresaDe[p.company_id] || 'Cuenta') : null,
      concepto: (p.subscription_id && planDe[p.subscription_id]) || (p.quote_id && numeroDe[p.quote_id]) || 'Cobro suelto',
      metodo: p.metodo || 'sin método', monto: Math.round(num(p.monto)),
    }));
  const porMetodo: Record<string, { n: number; monto: number }> = {};
  for (const p of pagosDetalle) {
    porMetodo[p.metodo] = porMetodo[p.metodo] || { n: 0, monto: 0 };
    porMetodo[p.metodo].n++; porMetodo[p.metodo].monto += p.monto;
  }

  const cotizaDetalle = (a: any[]) => a
    .sort((x: any, y: any) => num(y.total) - num(x.total))
    .map((q: any) => ({
      id: q.id, numero: q.numero, empresa: q.empresa || (q.company_id ? empresaDe[q.company_id] : '') || 'Sin empresa',
      company_id: q.company_id || null, total: Math.round(num(q.total)), estado: q.estado,
      creada: dia(q.created_at), vigencia: q.vigencia ? dia(q.vigencia) : null,
      aceptada: q.aceptado_fecha ? dia(q.aceptado_fecha) : null,
      // Días esperando: lo que lleva en manos del cliente sin resolverse. Es
      // lo que decide a cuál llamarle primero.
      espera: q.created_at ? Math.round((Date.parse(hoy + 'T12:00:00') - Date.parse(dia(q.created_at) + 'T12:00:00')) / 86400000) : null,
    }));

  const movDetalle = (t: string) => movs.filter((m: any) => m.tipo === t)
    .map((m: any) => ({
      company_id: m.company_id, cliente: empresaDe[m.company_id] || 'Cuenta',
      fecha: dia(m.fecha), arr: a12(num(m.mrr_delta)),
    }))
    .sort((x: any, y: any) => Math.abs(y.arr) - Math.abs(x.arr));

  const clientesNuevosDetalle = subs.filter((x: any) => entre(x.fecha_inicio, desde, hasta))
    .map((x: any) => ({
      company_id: x.company_id, cliente: empresaDe[x.company_id] || 'Cuenta',
      plan: x.nombre_plan, ciclo: x.ciclo, fecha: dia(x.fecha_inicio),
      arr: x.ciclo === 'mensual' ? Math.round(num(x.monto_proximo ?? x.precio) * 12) : Math.round(num(x.monto_proximo ?? x.precio)),
    }))
    .sort((a: any, b: any) => b.arr - a.arr);

  const leadsDetalle = empresasNuevas.filter((c: any) => c.estado_cuenta !== 'activo')
    .map((c: any) => ({
      company_id: c.id, cliente: c.nombre_comercial || c.nombre, fecha: dia(c.created_at),
      estado: c.estado_cuenta || 'prospecto',
    }))
    .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));

  /* ══════════ B · CUÁNTO CRECIÓ EL RECURRENTE, EN PORCENTAJE ══════════
     El monto solo no dice si el movimiento fue grande: $47K sobre un ARR de
     dos millones es 2.4%, y ese es el número que se compara entre meses. */
  const netoArr = a12(nuevo + expansion + react + contraccion + churn);
  const arrBase = Math.round(arr) - netoArr;          // el ARR al empezar el rango
  const porc = (v: number) => arrBase > 0 ? Number(((v / arrBase) * 100).toFixed(2)) : null;

  /* ══════════ C · LA COHORTE DEL RANGO ══════════
     No es el embudo general: son LAS MISMAS empresas que entraron, seguidas
     hasta dónde llegaron. Los pasos no son monótonos a propósito —se cierran
     ventas sin junta ni cotización— y eso es justo lo que hay que ver. */
  const cohorteIds = new Set(empresasNuevas.map((c: any) => c.id));
  const conJunta = new Set((reuTodasQ.data || []).map((b: any) => b.company_id).filter((id: any) => cohorteIds.has(id)));
  const conCotiza = new Set(quotes.filter((q: any) => cohorteIds.has(q.company_id)).map((q: any) => q.company_id));
  const conAcepta = new Set(quotes.filter((q: any) => cohorteIds.has(q.company_id) && ['accepted', 'paid'].includes(q.estado)).map((q: any) => q.company_id));
  const conLicencia = new Set(subs.filter((x: any) => cohorteIds.has(x.company_id)).map((x: any) => x.company_id));
  // Los que compraron sin dejar rastro en el CRM: si son muchos, el proceso no
  // se está capturando, y el embudo de arriba no significa nada.
  const sinRastro = [...conLicencia].filter(id => !conJunta.has(id) && !conAcepta.has(id)).length;

  /* ══════════ 11 · META DEL MES (siempre del mes, pase lo que pase) ══════════ */
  const goals = goalsQ.data || [];
  const metaDe = (tipo: string, def: number) => {
    const g = goals.find((x: any) => x.tipo === tipo && x.anio === anio && x.mes === mes);
    return g ? num(g.monto) : def;
  };
  const metaIngresos = metaDe('ingresos_mensual', 300000);
  const ingresosMes = Math.round(pagosMes.reduce((a: number, p: any) => a + num(p.monto), 0));
  const diaDelMes = ahora.getDate();
  // Proyección a fin de mes al ritmo que se lleva. Es una regla de tres, no un
  // modelo: por eso la pantalla dice "a este ritmo" y no "vas a cerrar en".
  const proyeccion = Math.round(ingresosMes / diaDelMes * diasMes);

  return json({
    periodo: { desde, hasta, dias, es_mes_actual: esMesActual, eje_total: esMesActual ? diasMes : dias },
    hoy_fecha: hoy,

    cobrado: {
      monto: cobrado, n: pagos.length, serie, paso,
      // Meta y ritmo solo tienen sentido con el mes corriente; en un rango a
      // mano van nulos y el front no dibuja ni la pauta ni la proyección.
      meta: esMesActual ? metaIngresos : null,
      proyeccion: esMesActual ? proyeccion : null,
      dia_actual: diaDelMes, dias_mes: diasMes,
      antes_de_fin_de_mes: { monto: montoDe(antesDeFinMes), n: antesDeFinMes.length },
      items: pagosDetalle,
      metodos: Object.entries(porMetodo).map(([metodo, v]) => ({ metodo, ...v })).sort((x, y) => y.monto - x.monto),
      sin_cliente: { n: pagosDetalle.filter(p => !p.company_id).length, monto: pagosDetalle.filter(p => !p.company_id).reduce((a, p) => a + p.monto, 0) },
    },
    historial,

    sobre_la_mesa: {
      total: suma([...aceptadasVivas, ...enviadasVivas]),
      aceptadas: { monto: suma(aceptadasVivas), n: aceptadasVivas.length },
      enviadas: { monto: suma(enviadasVivas), n: enviadasVivas.length },
      items: cotizaDetalle([...aceptadasVivas, ...enviadasVivas]),
      // Se enseñan aparte, nunca sumadas: parte del pipeline YA está cotizado
      // y sumarlo contaría el mismo dinero dos veces.
      oportunidades: {
        monto: Math.round(abiertas.reduce((a: number, d: any) => a + num(d.valor_total), 0)),
        n: abiertas.length, con_cotizacion: abiertas.filter((d: any) => dealsConCotiza.has(d.id)).length,
      },
    },

    generado: { monto: suma(aceptadasPeriodo), n: aceptadasPeriodo.length, mejor_semana: mejorSemana, items: cotizaDetalle(aceptadasPeriodo) },

    recurrente: {
      arr_hoy: Math.round(arr), arr_base: arrBase,
      altas: a12(nuevo), ampliaciones: a12(expansion), reactivaciones: a12(react),
      reducciones: a12(contraccion), bajas: a12(churn), neto: netoArr,
      // El mismo movimiento como proporción del ARR con el que se empezó: es
      // lo único comparable entre un mes y otro.
      pct: {
        altas: porc(a12(nuevo)), ampliaciones: porc(a12(expansion)), reactivaciones: porc(a12(react)),
        reducciones: porc(a12(contraccion)), bajas: porc(a12(churn)), neto: porc(netoArr),
        entro: porc(a12(nuevo + expansion + react)), salio: porc(a12(contraccion + churn)),
      },
      movimientos: {
        altas: movDetalle('new'), ampliaciones: movDetalle('expansion'),
        reactivaciones: movDetalle('reactivation'), reducciones: movDetalle('contraction'), bajas: movDetalle('churn'),
      },
      // El ledger arrancó el 19-may-2026: pedir un rango anterior da números
      // cortos, y hay que decirlo en vez de dejar creer que fue mal mes.
      ledger_desde: '2026-05-19',
    },

    contadores: {
      clientes_nuevos: clientesNuevos, leads, empresas_nuevas: empresasNuevas.length,
      bajas: bajasCuentas, bajas_arr: Math.abs(a12(churn)),
      ampliaciones: new Set(movs.filter((m: any) => m.tipo === 'expansion').map((m: any) => m.company_id)).size,
      conversion: pct(clientesNuevos, empresasNuevas.length),
      items: { clientes_nuevos: clientesNuevosDetalle, leads: leadsDetalle },
    },

    cohorte: {
      pasos: [
        { nombre: 'Entraron', n: empresasNuevas.length, nota: 'empresas nuevas en el periodo' },
        { nombre: 'Tuvieron reunión', n: conJunta.size, nota: 'se les agendó una junta' },
        { nombre: 'Recibieron cotización', n: conCotiza.size, nota: 'con precio en la mano' },
        { nombre: 'Aceptaron', n: conAcepta.size, nota: 'dijeron que sí' },
        { nombre: 'Ya son clientes', n: conLicencia.size, nota: 'con licencia activa' },
      ],
      base: empresasNuevas.length, sin_rastro: sinRastro,
    },

    reuniones: {
      total: reus.length, fueron: reus.filter(asistio).length, para_vender: paraVender,
      sin_marcar: reus.filter((b: any) => dia(b.fecha) < hoy && ['agendada', 'confirmada'].includes(b.estado)).length,
      tipos: Object.entries(porTipo).map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n),
    },

    consultoria: {
      nuevas: mejoras.filter((m: any) => entre(m.created_at, desde, hasta)).length,
      entregadas: mejEstado('entregada'), en_proceso: mejEstado('en_proceso'), idea: mejEstado('idea'),
      vencidas: mejVencidas.length, cuentas_vencidas: new Set(mejVencidas.map((m: any) => m.company_id)).size,
    },

    cobrar: {
      vencido: { monto: montoDe(vencidasCobro), n: vencidasCobro.length, items: detalle(vencidasCobro) },
      d30: { monto: montoDe(d30), n: d30.length },
      d60: { monto: montoDe(d60), n: d60.length },
      d90: { monto: montoDe(d90), n: d90.length },
      // El total de los tres tramos, para que la barra y los renglones cuadren
      // con una cifra en vez de dejar al ojo sumando.
      total: { monto: montoDe([...d30, ...d60, ...d90]), n: d30.length + d60.length + d90.length },
      // La lista ES el subconjunto del que habla la nota; antes enseñaba 4 de
      // 15 y no cuadraba con ningún número de la tarjeta.
      este_mes: { monto: montoDe(antesDeFinMes), n: antesDeFinMes.length, items: detalle(antesDeFinMes) },
      sin_fecha: { monto: montoDe(sinFecha), n: sinFecha.length },
      fin_de_mes: finMes,
    },


    salud: {
      arr: Math.round(arr), clientes: clientesActivos,
      nrr, churn_pct: churnPct, churn_arr: Math.abs(a12(churn)),
      arpa: clientesActivos > 0 ? Math.round(arr / clientesActivos) : 0,
      antiguedad_meses: antigMeses, antiguedad_n: antig.length,
      cierre_pct: cierrePct, cierre_n: resueltas.length,
      ciclo_dias: cicloDias, ciclo_n: pagadas.length,
      concentracion: arr > 0 ? Math.round((top5.reduce((a, [, v]) => a + v, 0) / arr) * 100) : null,
      top5: top5.map(([id, v]) => ({ cliente: empresaDe[id] || 'Cuenta', arr: Math.round(v) })),
    },

    meta_mes: { meta: metaIngresos, real: ingresosMes, proyeccion, dias_restantes: Math.max(0, diasMes - diaDelMes) },
  });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 60s en la instancia.
export const GET = conMicroCache('reports/tablero', 60000, _GET as any);
