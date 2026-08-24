// GET /api/crm/reports/tablero?desde=&hasta= — todo lo que pinta el tablero.
//
// Un solo viaje: el tablero abre en cada sesión y con seis llamadas sueltas se
// veía llenarse por partes.
//
// Dos reglas que gobiernan el archivo:
//
//  · Lo que NO se puede calcular se marca como tal y no se rellena. El CAC
//    necesita el gasto de marketing —que el CRM no conoce— y el LTV necesita
//    varios meses de bajas. Un número inventado en una pantalla que puede ver
//    un inversionista es peor que un hueco.
//  · Las cifras del periodo salen del LEDGER de MRR (mrr_movements), no de
//    comparar fotos: el ledger dice si un alza fue alta nueva, expansión o
//    reactivación, y esa diferencia es justo la que importa.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const num = (x: any) => Number(x || 0);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : null;

export const GET: APIRoute = async ({ url }) => {
  const hoy = iso(new Date());
  const hasta = (url.searchParams.get('hasta') || hoy).slice(0, 10);
  const desde = (url.searchParams.get('desde') || masDias(-30)).slice(0, 10);
  const dias = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000));

  const [subsQ, compQ, quotesQ, dealsQ, movQ, goalsQ, bookQ, payQ, reuQ, mejQ, actQ] = await Promise.all([
    supabase.from('subscriptions').select('id, company_id, nombre_plan, plan_id, ciclo, precio, monto_proximo, proxima_factura, estado, mp_link_pago, fecha_inicio'),
    supabase.from('companies').select('id, nombre, nombre_comercial, plan, sacs_account, dias_sin_venta, ultima_venta_at, estado_cuenta').is('archived_at', null),
    supabase.from('quotes').select('id, numero, empresa, total, estado, vigencia, created_at, pagado_fecha, aceptado_fecha, company_id, notas'),
    supabase.from('deals').select('id, valor_total, stage, created_at, company_id'),
    supabase.from('mrr_movements').select('fecha, tipo, mrr_delta, company_id').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('crm_goals').select('tipo, anio, mes, monto'),
    supabase.from('bookings').select('id, fecha, hora_inicio, asunto, estado, company_id, invitee_nombre, event_types(nombre, categoria)')
      .gte('fecha', hoy).lte('fecha', masDias(7)).order('fecha').order('hora_inicio'),
    supabase.from('payments').select('monto, fecha, subscription_id, quote_id, company_id').gte('fecha', desde).lte('fecha', hasta).not('estado', 'in', '(reembolsado,duplicado)').not('reembolsado', 'is', true),
    // Las reuniones DEL PERIODO (las de arriba son las próximas, otra pregunta).
    supabase.from('bookings').select('id, fecha, estado, event_types(nombre)').gte('fecha', desde).lte('fecha', hasta),
    // Consultoría: los compromisos que se pactan con el cliente.
    supabase.from('mejoras').select('id, estado, created_at, company_id, fecha_compromiso').is('archived_at', null),
    // Facturación de la CARTERA: lo que venden los clientes dentro de SACS.
    supabase.from('companies').select('id, actividad, estado_cuenta, created_at').is('archived_at', null),
  ]);

  const subs = (subsQ.data || []);
  const activas = subs.filter((s: any) => s.estado === 'activa' && s.ciclo !== 'vitalicia');
  const empresas = compQ.data || [];
  const quotes = quotesQ.data || [];
  const deals = dealsQ.data || [];
  const movs = movQ.data || [];
  const pagos = payQ.data || [];
  const empresaDe = Object.fromEntries(empresas.map((c: any) => [c.id, c.nombre_comercial || c.nombre]));

  // ── ARR y su movimiento en el periodo ──
  const mrrDe = (s: any) => s.ciclo === 'mensual' ? num(s.monto_proximo ?? s.precio) : num(s.monto_proximo ?? s.precio) / 12;
  const mrr = activas.reduce((a: number, s: any) => a + mrrDe(s), 0);
  const arr = mrr * 12;
  const suma = (t: string) => movs.filter((m: any) => m.tipo === t).reduce((a: number, m: any) => a + num(m.mrr_delta), 0);
  const nuevo = suma('new'), expansion = suma('expansion'), churn = suma('churn'), contraccion = suma('contraction'), react = suma('reactivation');
  const arrDelta = (nuevo + expansion + churn + contraccion + react) * 12;

  const clientesActivos = new Set(activas.map((s: any) => s.company_id)).size;
  const altasPeriodo = new Set(movs.filter((m: any) => m.tipo === 'new').map((m: any) => m.company_id)).size;
  const bajasPeriodo = new Set(movs.filter((m: any) => m.tipo === 'churn').map((m: any) => m.company_id)).size;

  // ── Oportunidades y cotizaciones ──
  const abiertas = deals.filter((d: any) => !String(d.stage || '').startsWith('cerrada'));
  const dealsPeriodo = deals.filter((d: any) => String(d.created_at || '').slice(0, 10) >= desde);
  const vivas = quotes.filter((q: any) => ['sent', 'accepted', 'parcial'].includes(q.estado));
  const enviadasPeriodo = quotes.filter((q: any) => String(q.created_at || '').slice(0, 10) >= desde && q.estado !== 'draft');

  // ── ARR por cobrar: lo contratado que toca renovar ──
  // No es proyección: son fechas con nombre y monto.
  const cobrables = activas.filter((s: any) => s.proxima_factura);
  const tramo = (a: string, b: string) => cobrables.filter((s: any) => {
    const f = String(s.proxima_factura).slice(0, 10);
    return f >= a && f <= b;
  });
  const detalle = (arr2: any[]) => arr2
    .sort((x: any, y: any) => String(x.proxima_factura).localeCompare(String(y.proxima_factura)))
    .map((s: any) => ({
      id: s.id, company_id: s.company_id, cliente: empresaDe[s.company_id] || 'Cuenta',
      plan: s.nombre_plan, ciclo: s.ciclo, fecha: String(s.proxima_factura).slice(0, 10),
      monto: Math.round(num(s.monto_proximo ?? s.precio)), link: s.mp_link_pago || null,
    }));
  const vencidas = cobrables.filter((s: any) => String(s.proxima_factura).slice(0, 10) < hoy);
  const d30 = tramo(hoy, masDias(30)), d60 = tramo(masDias(31), masDias(60)), d90 = tramo(masDias(61), masDias(90));
  const montoDe = (a: any[]) => Math.round(a.reduce((x: number, s: any) => x + num(s.monto_proximo ?? s.precio), 0));

  // ── Salud del negocio ──
  // Retención neta sobre la ventana pedida, no sobre 12 meses: el ledger
  // empieza en mayo de 2026 y decir "NRR anual" con tres meses sería inventar.
  const baseMrr = mrr - (nuevo + react);                 // lo que ya existía al inicio
  const nrr = baseMrr > 0 ? Math.round(((baseMrr + expansion + contraccion + churn) / baseMrr) * 100) : null;
  const churnArr = Math.abs(churn) * 12;
  const churnPct = baseMrr > 0 ? Number(((Math.abs(churn) / baseMrr) * 100).toFixed(1)) : null;
  const arpa = clientesActivos > 0 ? Math.round(arr / clientesActivos) : 0;

  // Antigüedad de la cartera: la primera suscripción de cada cuenta activa.
  // Es el dato que dice si el negocio retiene o solo repone.
  const primeraDe: Record<string, string> = {};
  subs.filter((s: any) => s.estado === 'activa' && (s as any).fecha_inicio).forEach((s: any) => {
    const f = String((s as any).fecha_inicio).slice(0, 10);
    if (!primeraDe[s.company_id] || f < primeraDe[s.company_id]) primeraDe[s.company_id] = f;
  });
  const antig = Object.values(primeraDe);
  const antigMeses = antig.length
    ? Math.round(antig.reduce((a, f) => a + (Date.now() - Date.parse(f + 'T12:00:00')) / 2629800000, 0) / antig.length)
    : null;

  const resueltas = quotes.filter((q: any) => ['paid', 'rejected', 'expired'].includes(q.estado));
  const cierrePct = pct(resueltas.filter((q: any) => q.estado === 'paid').length, resueltas.length);
  const pagadas = quotes.filter((q: any) => q.estado === 'paid' && q.pagado_fecha && q.created_at);
  const ciclo = pagadas.length
    ? Math.round(pagadas.reduce((a: number, q: any) => a + (Date.parse(q.pagado_fecha) - Date.parse(q.created_at)) / 86400000, 0) / pagadas.length)
    : null;

  // Concentración: cuánto del ARR está en las 5 cuentas más grandes. Arriba de
  // 30% un inversionista lo marca como riesgo, y conviene saberlo antes que él.
  const porCuenta: Record<string, number> = {};
  activas.forEach((s: any) => { porCuenta[s.company_id] = (porCuenta[s.company_id] || 0) + mrrDe(s) * 12; });
  const top5 = Object.entries(porCuenta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const concentracion = arr > 0 ? Math.round((top5.reduce((a, [, v]) => a + v, 0) / arr) * 100) : null;

  // ── Metas del mes ──
  const anio = new Date().getFullYear(), mes = new Date().getMonth() + 1;
  const goals = goalsQ.data || [];
  const meta = (tipo: string, def: number) => {
    const g = goals.find((x: any) => x.tipo === tipo && x.anio === anio && x.mes === mes);
    return g ? num(g.monto) : def;
  };
  const metaIngresos = meta('ingresos_mensual', 300000);
  const metaArr = meta('new_arr_mensual', 250000);
  // La de pagos únicos no se captura: es lo que resta. Pedir tres metas cuando
  // dos determinan la tercera es una invitación a que no cuadren.
  const metaUnicos = Math.max(0, metaIngresos - metaArr);

  const mesIni = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const pagosMes = pagos.filter((p: any) => String(p.fecha).slice(0, 10) >= mesIni);
  const ingresosMes = Math.round(pagosMes.reduce((a: number, p: any) => a + num(p.monto), 0));
  const arrNuevoMes = Math.round((nuevo + expansion) * 12);
  const unicosMes = Math.round(pagosMes.filter((p: any) => !p.subscription_id).reduce((a: number, p: any) => a + num(p.monto), 0));

  // ── Planes ──
  const planes: Record<string, { clientes: Set<string>; mrr: number }> = {};
  activas.forEach((s: any) => {
    const k = s.nombre_plan || 'Sin plan';
    planes[k] = planes[k] || { clientes: new Set(), mrr: 0 };
    planes[k].clientes.add(s.company_id); planes[k].mrr += mrrDe(s);
  });

  // ── Atención: lo que se apaga solo si nadie lo mira ──
  const porVencer = vivas
    .filter((q: any) => q.vigencia && String(q.vigencia).slice(0, 10) >= hoy && String(q.vigencia).slice(0, 10) <= masDias(7))
    .sort((a: any, b: any) => String(a.vigencia).localeCompare(String(b.vigencia)))
    .map((q: any) => ({
      id: q.id, numero: q.numero, empresa: q.empresa, total: Math.round(num(q.total)),
      vigencia: String(q.vigencia).slice(0, 10),
      dias: Math.round((Date.parse(String(q.vigencia).slice(0, 10)) - Date.parse(hoy)) / 86400000),
      vistas: (() => { try { const m = JSON.parse(String(q.notas || '').split('---META---')[1] || '{}'); return Array.isArray(m.views) ? m.views.length : 0; } catch { return 0; } })(),
    }));
  const riesgo = empresas
    .filter((c: any) => num(c.dias_sin_venta) >= 5 && porCuenta[c.id])
    .map((c: any) => ({ id: c.id, nombre: c.nombre_comercial || c.nombre, dias: num(c.dias_sin_venta), arr: Math.round(porCuenta[c.id] || 0) }))
    .sort((a: any, b: any) => b.arr - a.arr).slice(0, 6);

  /* ══ EL DINERO DEL PERIODO ══
     El tablero abría con el ARR TOTAL, que casi nunca cambia y además vive en
     Suscripciones. Lo que se necesita aquí es lo que SE MOVIÓ en el periodo
     elegido. */
  const cobradoPeriodo = Math.round(pagos.reduce((a: number, p: any) => a + num(p.monto), 0));
  const arrNuevoPeriodo = Math.round(nuevo * 12);
  const arrExpansionPeriodo = Math.round(expansion * 12);
  // Único = pago que no cuelga de una suscripción recurrente. Es la misma
  // regla que usa el panel financiero.
  const subsPorId: Record<string, any> = Object.fromEntries(subs.map((x: any) => [x.id, x]));
  const esUnico = (p: any) => !p.subscription_id || subsPorId[p.subscription_id]?.ciclo === 'vitalicia';
  const unicosPeriodo = Math.round(pagos.filter(esUnico).reduce((a: number, p: any) => a + num(p.monto), 0));
  const aceptadasPeriodo = quotes.filter((q: any) =>
    (q as any).aceptado_fecha && String((q as any).aceptado_fecha).slice(0, 10) >= desde && String((q as any).aceptado_fecha).slice(0, 10) <= hasta);

  /* ══ EL EMBUDO ══
     Un lead es una empresa creada en el periodo que todavía no es cliente. */
  const todasEmpresas = actQ.data || [];
  const leadsPeriodo = todasEmpresas.filter((c: any) =>
    String(c.created_at || '').slice(0, 10) >= desde && String(c.created_at || '').slice(0, 10) <= hasta && c.estado_cuenta !== 'activo').length;
  const clientesNuevos = new Set(
    subs.filter((x: any) => x.fecha_inicio && String(x.fecha_inicio).slice(0, 10) >= desde && String(x.fecha_inicio).slice(0, 10) <= hasta)
      .map((x: any) => x.company_id)).size;

  /* ══ DE QUIÉN VINO EL DINERO ══
     Ya era cliente = tenía alguna licencia empezada ANTES del periodo. */
  const eraClienteAntes = new Set(
    subs.filter((x: any) => x.fecha_inicio && String(x.fecha_inicio).slice(0, 10) < desde).map((x: any) => x.company_id));
  let deBase = 0, deNuevas = 0, sinLigar = 0;
  const cuentasBase = new Set<string>(), cuentasNuevas = new Set<string>();
  for (const p of pagos as any[]) {
    const m = num(p.monto);
    if (!p.company_id) { sinLigar += m; continue; }
    if (eraClienteAntes.has(p.company_id)) { deBase += m; cuentasBase.add(p.company_id); }
    else { deNuevas += m; cuentasNuevas.add(p.company_id); }
  }

  /* ══ LO QUE FACTURAN LOS CLIENTES ══
     No es dinero de SACS: es lo que mueven ELLOS por el sistema. Es la salud
     de la cartera y el argumento de la renovación. */
  const conActividad = todasEmpresas.filter((c: any) => c.actividad && c.estado_cuenta === 'activo');
  const factCartera = Math.round(conActividad.reduce((a: number, c: any) => a + num(c.actividad?.total_30d), 0));
  const ventasCartera = conActividad.reduce((a: number, c: any) => a + num(c.actividad?.ventas_30d), 0);
  const operando = conActividad.filter((c: any) => num(c.actividad?.total_30d) > 0).length;

  /* ══ REUNIONES DEL PERIODO, POR TIPO ══ */
  const reus = (reuQ.data || []) as any[];
  const porTipo: Record<string, { n: number; fue: number }> = {};
  for (const b of reus) {
    const k = (b.event_types as any)?.nombre || 'Sin tipo';
    porTipo[k] = porTipo[k] || { n: 0, fue: 0 };
    porTipo[k].n++;
    if (b.estado === 'asistio' || b.estado === 'completada') porTipo[k].fue++;
  }
  const reuFueron = reus.filter((b: any) => b.estado === 'asistio' || b.estado === 'completada').length;
  const reuSinMarcar = reus.filter((b: any) => String(b.fecha) < hoy && ['agendada', 'confirmada'].includes(b.estado)).length;

  /* ══ CONSULTORÍA ══ */
  const mejoras = (mejQ.data || []) as any[];
  const mejNuevas = mejoras.filter((m: any) => String(m.created_at || '').slice(0, 10) >= desde && String(m.created_at || '').slice(0, 10) <= hasta).length;
  const mejEstado = (e: string) => mejoras.filter((m: any) => m.estado === e).length;
  // Vencido = tiene fecha comprometida, ya pasó, y no está entregada. Sin
  // fecha no se puede decir que esté vencido, así que no se cuenta.
  const mejVencidas = mejoras.filter((m: any) => m.fecha_compromiso && String(m.fecha_compromiso).slice(0, 10) < hoy && m.estado !== 'entregada');
  const mejCuentasVenc = new Set(mejVencidas.map((m: any) => m.company_id)).size;

  /* ══ LA VISTA DE HOY ══
     El tablero abre en Hoy, y un lunes temprano casi todo está en ceros. Por
     eso Hoy no enseña el dinero del día: enseña lo que hay que atender y cómo
     va el mes, para que la pantalla nunca aparezca vacía. */
  const enSemana = (f?: string | null) => !!f && String(f).slice(0, 10) >= hoy && String(f).slice(0, 10) <= masDias(7);
  const cobroHoy = cobrables.filter((s2: any) => String(s2.proxima_factura).slice(0, 10) === hoy);
  const cobroSemana = cobrables.filter((s2: any) => enSemana(s2.proxima_factura));
  const reuHoy = (bookQ.data || []).filter((b: any) => b.fecha === hoy);
  const reuSemana = (bookQ.data || []).filter((b: any) => enSemana(b.fecha));

  return json({
    periodo: { desde, hasta, dias },
    hoy_fecha: hoy,

    // Lo del día: reuniones, cobros y lo que urge.
    hoy: {
      reuniones: reuHoy.length,
      cobro_hoy: { monto: montoDe(cobroHoy), n: cobroHoy.length },
      vencidos: { n: mejVencidas.length, cuentas: mejCuentasVenc },
      semana: {
        cobro: { monto: montoDe(cobroSemana), n: cobroSemana.length },
        reuniones: reuSemana.length,
        cotizaciones: { monto: Math.round(vivas.reduce((a: number, q: any) => a + num(q.total), 0)), n: vivas.length },
      },
    },

    dinero: {
      cobrado: { monto: cobradoPeriodo, n: pagos.length },
      arr_nuevo: { monto: arrNuevoPeriodo, n: altasPeriodo, expansion: arrExpansionPeriodo },
      unicos: { monto: unicosPeriodo, n: pagos.filter(esUnico).length },
      aceptadas: { monto: Math.round(aceptadasPeriodo.reduce((a: number, q: any) => a + num(q.total), 0)), n: aceptadasPeriodo.length },
      // El ledger arrancó el 19-may-2026: pedir "12 meses" antes de eso da un
      // ARR nuevo corto, y hay que decirlo en vez de dejar creer que fue malo.
      ledger_desde: '2026-05-19',
    },

    embudo: {
      leads: leadsPeriodo,
      cotizado: { monto: Math.round(enviadasPeriodo.reduce((a: number, q: any) => a + num(q.total), 0)), n: enviadasPeriodo.length },
      aceptado: { monto: Math.round(aceptadasPeriodo.reduce((a: number, q: any) => a + num(q.total), 0)), n: aceptadasPeriodo.length },
      clientes_nuevos: clientesNuevos,
    },

    origen: {
      base: { monto: Math.round(deBase), cuentas: cuentasBase.size },
      nuevas: { monto: Math.round(deNuevas), cuentas: cuentasNuevas.size },
      sin_ligar: { monto: Math.round(sinLigar), n: pagos.filter((p: any) => !p.company_id).length },
    },

    cartera: { facturacion: factCartera, ventas: ventasCartera, operando, cuentas: conActividad.length },

    acompanamiento: {
      reuniones: { total: reus.length, fueron: reuFueron, sin_marcar: reuSinMarcar,
        tipos: Object.entries(porTipo).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.n - a.n) },
      consultoria: { nuevas: mejNuevas, entregadas: mejEstado('entregada'), en_proceso: mejEstado('en_proceso'),
        idea: mejEstado('idea'), vencidas: mejVencidas.length, cuentas_vencidas: mejCuentasVenc },
    },

    kpis: {
      arr: Math.round(arr), arr_delta: Math.round(arrDelta),
      clientes: clientesActivos, altas: altasPeriodo, bajas: bajasPeriodo,
      oportunidades: Math.round(abiertas.reduce((a: number, d: any) => a + num(d.valor_total), 0)),
      oportunidades_n: abiertas.length, oportunidades_nuevas: dealsPeriodo.length,
      cotizaciones: Math.round(vivas.reduce((a: number, q: any) => a + num(q.total), 0)),
      cotizaciones_n: vivas.length, cotizaciones_nuevas: enviadasPeriodo.length,
    },
    cobrar: {
      vencido: { monto: montoDe(vencidas), n: vencidas.length, items: detalle(vencidas) },
      d30: { monto: montoDe(d30), n: d30.length, items: detalle(d30) },
      d60: { monto: montoDe(d60), n: d60.length },
      d90: { monto: montoDe(d90), n: d90.length },
    },
    salud: {
      nrr, churn_pct: churnPct, churn_arr: Math.round(churnArr), arpa,
      antiguedad_meses: antigMeses, antiguedad_n: antig.length,
      cierre_pct: cierrePct, cierre_n: resueltas.length,
      ciclo_dias: ciclo, ciclo_n: pagadas.length,
      concentracion, top5: top5.map(([id, v]) => ({ cliente: empresaDe[id] || 'Cuenta', arr: Math.round(v) })),
      // Se dice qué ventana tiene el ledger: una retención "anual" con tres
      // meses de historia sería un número bonito y falso.
      ventana_ledger: { desde, hasta, dias },
    },
    metas: {
      ingresos: { meta: metaIngresos, real: ingresosMes },
      arr: { meta: metaArr, real: arrNuevoMes },
      unicos: { meta: metaUnicos, real: unicosMes },
      pipeline: Math.round(abiertas.reduce((a: number, d: any) => a + num(d.valor_total), 0)),
      dias_restantes: Math.max(0, new Date(anio, mes, 0).getDate() - new Date().getDate()),
    },
    planes: Object.entries(planes).map(([nombre, v]) => ({ nombre, clientes: v.clientes.size, mrr: Math.round(v.mrr) }))
      .sort((a, b) => b.mrr - a.mrr),
    mrr_total: Math.round(mrr),
    reuniones: (bookQ.data || []).map((b: any) => ({
      id: b.id, fecha: b.fecha, hora: String(b.hora_inicio || '').slice(0, 5), asunto: b.asunto,
      tipo: b.event_types?.nombre || null, categoria: b.event_types?.categoria || null,
      con: b.invitee_nombre, company_id: b.company_id, hoy: b.fecha === hoy,
    })),
    atencion: { cotizaciones: porVencer.slice(0, 5), riesgo },
  });
};
