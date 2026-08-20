// Dashboard de cobranza, por periodo.
//
// Dos naturalezas distintas conviven aquí y conviene no confundirlas:
//
//  · Lo del PERIODO —cobrado, lo que venció, tasa de cobro, cómo entró el
//    dinero— cambia con el filtro de fechas y se compara contra el periodo
//    anterior del mismo tamaño.
//  · La CARTERA —vencido, aging, proyección, promesas vivas— es una foto de
//    HOY. Filtrarla por mes no significaría nada: lo que se debe, se debe hoy.
//
// Lo que depende de datos que apenas se empezaron a guardar (la fecha que cada
// pago venía a cubrir, la bitácora) se devuelve con su conteo de base y en null
// cuando no alcanza: un promedio de dos pagos no es un promedio.
//
// GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   (por defecto, el mes en curso)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { planDeCotizacion } from '../../../../lib/quotes/plan';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x: any) => Number(x || 0);
const r0 = (n: number) => Math.round(n);
const prom = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyMx = () => dia(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })));
const suma = (xs: any[], k = 'monto') => r0(xs.reduce((a, x) => a + num(x[k]), 0));

export const GET: APIRoute = async ({ url }) => {
  const hoy = hoyMx();
  const q0 = url.searchParams;
  // Periodo: por defecto el mes en curso. El anterior se calcula del mismo
  // largo, para que la comparación signifique algo aunque el rango sea raro.
  const hoyD = new Date(hoy + 'T12:00:00');
  const desde = (q0.get('desde') || dia(new Date(hoyD.getFullYear(), hoyD.getMonth(), 1))).slice(0, 10);
  const hasta = (q0.get('hasta') || dia(new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 0))).slice(0, 10);
  const largo = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1);
  const prevHasta = dia(new Date(Date.parse(desde) - 86400000));
  const prevDesde = dia(new Date(Date.parse(desde) - largo * 86400000));

  const [{ data: subs }, { data: pagos }, { data: quotes }, { data: gestiones }, { data: exhibiciones }, { data: comps }] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, ciclo, estado, precio, monto_proximo, arr, proxima_factura, saldo_favor, cobranza_estado, cobranza_promesa, cobranza_promesa_estado')
      .in('estado', ['activa', 'pendiente_pago']),
    supabase.from('payments').select('id, fecha, monto, metodo, subscription_id, quote_id, company_id, vencia_el, dias_atraso')
      .neq('estado', 'reembolsado').gte('fecha', prevDesde).lte('fecha', hasta).limit(3000),
    supabase.from('quotes').select('id, numero, empresa, total, estado, notas, company_id, cobranza_promesa, cobranza_promesa_estado')
      .in('estado', ['accepted', 'sent', 'expired', 'paid']).limit(1000),
    supabase.from('cobranza_gestiones').select('id, tipo, created_at, company_id, subscription_id, quote_id').limit(3000),
    supabase.from('cobros_programados').select('quote_id, subscription_id, fecha, monto, estado').neq('estado', 'cancelada'),
    supabase.from('companies').select('id, nombre, nombre_comercial, dias_sin_venta').is('archived_at', null),
  ]);

  const S = subs || [], P = pagos || [], Q = quotes || [], G = gestiones || [], E = exhibiciones || [];
  const emp = Object.fromEntries((comps || []).map((c: any) => [c.id, c]));
  const enRango = (f: any, a: string, b: string) => !!f && String(f).slice(0, 10) >= a && String(f).slice(0, 10) <= b;

  // ── Abonos por cotización (todos, para saldos) ──
  const { data: pagosCot } = await supabase.from('payments').select('quote_id, monto')
    .not('quote_id', 'is', null).neq('estado', 'reembolsado').limit(5000);
  const abonado = new Map<string, number>();
  (pagosCot || []).forEach((p: any) => abonado.set(p.quote_id, (abonado.get(p.quote_id) || 0) + num(p.monto)));

  // ═══ 1 · El dinero del periodo ═══
  const delPeriodo = P.filter(p => enRango(p.fecha, desde, hasta));
  const delPrevio = P.filter(p => enRango(p.fecha, prevDesde, prevHasta));
  const cobrado = suma(delPeriodo), cobradoPrev = suma(delPrevio);

  // Lo que VENCIÓ en el periodo: renovaciones con fecha en el rango y
  // exhibiciones pactadas en el rango. Es el denominador honesto de la tasa de
  // cobro —cuánto de lo que tocaba cobrar, se cobró.
  const vencioSubs = S.filter(s => s.ciclo !== 'vitalicia' && enRango(s.proxima_factura, desde, hasta))
    .map(s => ({ monto: num(s.monto_proximo ?? s.precio), sub: s }));
  const vencioExh: any[] = [];
  for (const q of Q) {
    if (q.estado === 'paid') continue;
    for (const x of planDeCotizacion(q, abonado.get(q.id) || 0, hoy)) {
      if (enRango(x.fecha, desde, hasta)) vencioExh.push({ monto: x.monto_original, quote: q, exh: x });
    }
  }
  E.filter(x => x.subscription_id && enRango(x.fecha, desde, hasta)).forEach(x => vencioExh.push({ monto: num(x.monto), plan: x }));
  const vencio = suma(vencioSubs) + suma(vencioExh);

  // ═══ 2 · Velocidad ═══
  const conFecha = delPeriodo.filter(p => p.dias_atraso != null);
  const idsAnual = new Set(S.filter(s => s.ciclo === 'anual').map(s => s.id));
  const idsMensual = new Set(S.filter(s => s.ciclo === 'mensual').map(s => s.id));
  const velocidadDe = (f: (p: any) => boolean) => {
    const xs = conFecha.filter(f).map(p => Number(p.dias_atraso));
    return { dias: xs.length >= 3 ? prom(xs) : null, n: xs.length };
  };

  // ═══ 3 · Cartera de HOY ═══
  const deudaSub = (s: any) => {
    const precio = num(s.monto_proximo ?? s.precio);
    if (s.ciclo !== 'mensual') return Math.max(0, precio - num(s.saldo_favor));
    let m = 0; const f = new Date(String(s.proxima_factura).slice(0, 10) + 'T12:00:00');
    while (dia(f) <= hoy && m < 120) { m++; f.setMonth(f.getMonth() + 1); }
    return Math.max(0, precio * m - num(s.saldo_favor));
  };
  const diasDe = (f: string) => Math.round((Date.parse(hoy) - Date.parse(String(f).slice(0, 10))) / 86400000);
  const deudores: any[] = [];
  S.filter(s => s.ciclo !== 'vitalicia' && s.proxima_factura && String(s.proxima_factura).slice(0, 10) < hoy)
    .forEach(s => {
      const d = deudaSub(s);
      if (d > 0) deudores.push({
        tipo: 'suscripcion', id: s.id, company_id: s.company_id,
        cliente: emp[s.company_id]?.nombre_comercial || emp[s.company_id]?.nombre || 'Cuenta',
        concepto: s.nombre_plan, ciclo: s.ciclo, monto: r0(d), dias: diasDe(s.proxima_factura),
        gestion: s.cobranza_estado || 'sin_contactar',
        sin_venta: emp[s.company_id]?.dias_sin_venta ?? null,
      });
    });
  for (const q of Q) {
    if (q.estado === 'paid') continue;
    const ab = abonado.get(q.id) || 0;
    if (num(q.total) - ab <= 0.5) continue;
    for (const x of planDeCotizacion(q, ab, hoy)) {
      if (x.estado === 'pendiente' && x.vencida) deudores.push({
        tipo: 'parcialidad', id: q.id, company_id: q.company_id,
        cliente: emp[q.company_id]?.nombre_comercial || emp[q.company_id]?.nombre || q.empresa,
        concepto: `${q.numero} · ${x.concepto}`, ciclo: 'cotizacion', monto: r0(x.monto), dias: diasDe(x.fecha),
        gestion: 'sin_contactar', sin_venta: emp[q.company_id]?.dias_sin_venta ?? null,
      });
    }
  }
  const vencidoTotal = suma(deudores);
  const arrActivo = r0(S.filter(s => s.estado === 'activa').reduce((a, s) => a + num(s.arr), 0));
  const tramo = (a: number, b: number) => {
    const xs = deudores.filter(d => d.dias >= a && d.dias <= b);
    return { monto: suma(xs), n: xs.length };
  };

  // ═══ 4 · Proyección ═══
  const porMes: Record<string, { subs: number; parcial: number; n: number }> = {};
  const acum = (f: string, m: number, t: 'subs' | 'parcial') => {
    const k = String(f).slice(0, 7);
    porMes[k] = porMes[k] || { subs: 0, parcial: 0, n: 0 };
    porMes[k][t] += m; porMes[k].n++;
  };
  S.forEach(s => {
    const f = s.proxima_factura ? String(s.proxima_factura).slice(0, 10) : null;
    if (!f || f < hoy || s.ciclo === 'vitalicia') return;
    acum(f, num(s.monto_proximo ?? s.precio), 'subs');
  });
  for (const q of Q) {
    if (q.estado === 'paid') continue;
    for (const x of planDeCotizacion(q, abonado.get(q.id) || 0, hoy)) {
      if (x.estado === 'pendiente' && !x.vencida) acum(x.fecha, x.monto, 'parcial');
    }
  }
  E.filter(x => x.estado === 'pendiente' && x.subscription_id && String(x.fecha) >= hoy)
    .forEach(x => acum(String(x.fecha), num(x.monto), 'parcial'));

  // ═══ 5 · Proceso y promesas ═══
  const embudo = ['sin_contactar', 'contactado', 'promesa', 'negociando', 'plan_pagos', 'incobrable']
    .map(e => {
      const xs = deudores.filter(d => d.gestion === e);
      return { estado: e, n: xs.length, monto: suma(xs) };
    }).filter(x => x.n > 0);
  const vivas = [...S, ...Q].filter((x: any) => x.cobranza_promesa);
  const cumplidas = [...S, ...Q].filter((x: any) => x.cobranza_promesa_estado === 'cumplida').length;
  const rotas = [...S, ...Q].filter((x: any) => x.cobranza_promesa_estado === 'rota').length;

  // ═══ 6 · Cómo entra el dinero ═══
  const porMetodo: Record<string, { n: number; monto: number }> = {};
  delPeriodo.forEach(p => {
    const k = p.metodo || 'sin método';
    porMetodo[k] = porMetodo[k] || { n: 0, monto: 0 };
    porMetodo[k].n++; porMetodo[k].monto += num(p.monto);
  });

  // Serie por día del periodo, para ver el ritmo de cobro dentro del rango.
  const porDia: Record<string, number> = {};
  delPeriodo.forEach(p => { const k = String(p.fecha).slice(0, 10); porDia[k] = (porDia[k] || 0) + num(p.monto); });

  const gestPeriodo = G.filter(g => enRango(g.created_at, desde, hasta));
  const porAccion: Record<string, number> = {};
  gestPeriodo.forEach(g => { porAccion[g.tipo] = (porAccion[g.tipo] || 0) + 1; });

  return json({
    hoy, periodo: { desde, hasta, dias: largo }, previo: { desde: prevDesde, hasta: prevHasta },
    dinero: {
      cobrado, cobrado_prev: cobradoPrev,
      variacion: cobradoPrev > 0 ? Math.round(((cobrado - cobradoPrev) / cobradoPrev) * 100) : null,
      pagos: delPeriodo.length,
      ticket: delPeriodo.length ? r0(cobrado / delPeriodo.length) : 0,
      vencio, vencio_n: vencioSubs.length + vencioExh.length,
      // Tasa de cobro: de lo que tocaba cobrar en el periodo, cuánto entró. Por
      // encima de 100% significa que se cobró también atraso viejo.
      tasa: vencio > 0 ? Math.round((cobrado / vencio) * 100) : null,
      por_metodo: Object.entries(porMetodo).map(([metodo, v]) => ({ metodo, n: v.n, monto: r0(v.monto) })).sort((a, b) => b.monto - a.monto),
      por_dia: Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])).map(([f, m]) => ({ fecha: f, monto: r0(m) })),
      suscripciones: suma(delPeriodo.filter(p => p.subscription_id)),
      cotizaciones: suma(delPeriodo.filter(p => p.quote_id)),
    },
    velocidad: {
      anual: velocidadDe(p => idsAnual.has(p.subscription_id)),
      mensual: velocidadDe(p => idsMensual.has(p.subscription_id)),
      cotizacion: velocidadDe(p => !!p.quote_id),
      a_tiempo: conFecha.length >= 3 ? Math.round((conFecha.filter(p => Number(p.dias_atraso) <= 0).length / conFecha.length) * 100) : null,
      medidos: conFecha.length, sin_medir: delPeriodo.length - conFecha.length,
    },
    cartera: {
      vencido: vencidoTotal, cuentas: deudores.length,
      arr_activo: arrActivo,
      pct_arr: arrActivo > 0 ? Math.round((vencidoTotal / arrActivo) * 1000) / 10 : null,
      atraso_prom: deudores.length ? prom(deudores.map(d => d.dias)) : null,
      tramos: [
        { k: '1 a 7 días', ...tramo(1, 7) },
        { k: '8 a 30 días', ...tramo(8, 30) },
        { k: '31 a 90 días', ...tramo(31, 90) },
        { k: 'Más de 90 días', ...tramo(91, 99999) },
      ],
      top: deudores.slice().sort((a, b) => b.monto - a.monto).slice(0, 8),
      // Deben y además no están vendiendo: ahí la cobranza es otra conversación.
      en_riesgo: deudores.filter(d => (d.sin_venta ?? 0) > 10),
    },
    proyeccion: Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 6)
      .map(([mes, v]) => ({ mes, subs: r0(v.subs), parcial: r0(v.parcial), total: r0(v.subs + v.parcial), n: v.n })),
    proceso: {
      embudo,
      promesas: {
        vivas: vivas.length,
        monto: r0(vivas.reduce((a: number, x: any) => a + num(x.monto_proximo ?? x.precio ?? x.total), 0)),
        cumplidas, rotas,
        cumplimiento: (cumplidas + rotas) > 0 ? Math.round((cumplidas / (cumplidas + rotas)) * 100) : null,
      },
      gestiones: gestPeriodo.length,
      por_accion: Object.entries(porAccion).map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
      sin_contactar: deudores.filter(d => d.gestion === 'sin_contactar').length,
      sin_contactar_monto: suma(deudores.filter(d => d.gestion === 'sin_contactar')),
    },
  });
};
