// Tablero de cobranza: qué tan rápido se cobra y qué tan sana está la cartera.
//
// Casi todo lo que se puede medir aquí depende de tres datos que ANTES no se
// guardaban y ahora sí: la fecha que cada pago venía a cubrir (payments.vencia_el),
// la bitácora de gestión (cobranza_gestiones) y el desenlace de la promesa.
// Por eso el tablero empieza con poco y se llena solo con el uso; lo que no
// tiene base se devuelve en null y la pantalla lo dice, en vez de inventar un
// promedio con dos datos.
//
// GET ?meses=6
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { planDeCotizacion } from '../../../../lib/quotes/plan';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const num = (x: any) => Number(x || 0);
const r0 = (n: number) => Math.round(n);
const hoyMx = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const prom = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export const GET: APIRoute = async ({ url }) => {
  const meses = Math.min(12, Math.max(3, Number(url.searchParams.get('meses')) || 5));
  const hoy = hoyMx();
  const mes1 = hoy.slice(0, 8) + '01';

  const [{ data: subs }, { data: pagos }, { data: quotes }, { data: gestiones }, { data: exhibiciones }] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, ciclo, estado, precio, monto_proximo, arr, proxima_factura, saldo_favor, cobranza_estado, cobranza_promesa, cobranza_promesa_estado')
      .in('estado', ['activa', 'pendiente_pago']),
    supabase.from('payments').select('id, fecha, monto, subscription_id, quote_id, vencia_el, dias_atraso, metodo')
      .neq('estado', 'reembolsado').order('fecha', { ascending: false }).limit(3000),
    supabase.from('quotes').select('id, numero, empresa, total, estado, notas, company_id, cobranza_promesa, cobranza_promesa_estado')
      .in('estado', ['accepted', 'sent', 'expired', 'paid']).limit(1000),
    supabase.from('cobranza_gestiones').select('id, tipo, created_at, promesa_fecha, promesa_resultado, company_id, subscription_id, quote_id')
      .order('created_at', { ascending: false }).limit(2000),
    supabase.from('cobros_programados').select('quote_id, subscription_id, fecha, monto, estado').neq('estado', 'cancelada'),
  ]);

  const S = subs || [], P = pagos || [], Q = quotes || [], G = gestiones || [], E = exhibiciones || [];

  // ── 1 · Días en cobrar ──
  // Solo con los pagos que ya traen la fecha que venían a cubrir. Un promedio
  // sobre dos pagos no es un promedio: se exige un mínimo de 3 para publicarlo.
  const conFecha = P.filter(p => p.dias_atraso != null);
  const porTipo = (f: (p: any) => boolean) => {
    const xs = conFecha.filter(f).map(p => Number(p.dias_atraso));
    return { dias: xs.length >= 3 ? prom(xs) : null, n: xs.length };
  };
  const idsAnual = new Set(S.filter(s => s.ciclo === 'anual').map(s => s.id));
  const idsMensual = new Set(S.filter(s => s.ciclo === 'mensual').map(s => s.id));
  const velocidad = {
    anual: porTipo(p => idsAnual.has(p.subscription_id)),
    mensual: porTipo(p => idsMensual.has(p.subscription_id)),
    cotizacion: porTipo(p => !!p.quote_id),
    // Puntualidad: pagar el día o antes. Es más honesto que el promedio, que
    // una sola cuenta muy atrasada distorsiona.
    a_tiempo: conFecha.length >= 3
      ? Math.round((conFecha.filter(p => Number(p.dias_atraso) <= 0).length / conFecha.length) * 100)
      : null,
    total_medidos: conFecha.length,
    sin_medir: P.length - conFecha.length,
  };

  // ── 2 · Cartera ──
  const vencidasSubs = S.filter(s => s.proxima_factura && String(s.proxima_factura).slice(0, 10) < hoy && s.ciclo !== 'vitalicia');
  const deudaSub = (s: any) => {
    const precio = num(s.monto_proximo ?? s.precio);
    if (s.ciclo !== 'mensual') return Math.max(0, precio - num(s.saldo_favor));
    let m = 0; const f = new Date(String(s.proxima_factura).slice(0, 10) + 'T12:00:00');
    while (f.toISOString().slice(0, 10) <= hoy && m < 120) { m++; f.setMonth(f.getMonth() + 1); }
    return Math.max(0, precio * m - num(s.saldo_favor));
  };
  const abonadoCot = new Map<string, number>();
  P.forEach(p => { if (p.quote_id) abonadoCot.set(p.quote_id, (abonadoCot.get(p.quote_id) || 0) + num(p.monto)); });
  let vencidoCots = 0;
  const futuroCots: { fecha: string; monto: number }[] = [];
  for (const q of Q) {
    if (q.estado === 'paid') continue;
    const ab = abonadoCot.get(q.id) || 0;
    if (num(q.total) - ab <= 0.5) continue;
    for (const x of planDeCotizacion(q, ab, hoy)) {
      if (x.estado !== 'pendiente') continue;
      if (x.vencida) vencidoCots += x.monto; else futuroCots.push({ fecha: x.fecha, monto: x.monto });
    }
  }
  const vencidoSubs = vencidasSubs.reduce((a, s) => a + deudaSub(s), 0);
  const arrActivo = S.filter(s => s.estado === 'activa').reduce((a, s) => a + num(s.arr), 0);

  // ── 3 · Lo que entra los próximos meses ──
  const porMes: Record<string, { subs: number; parcial: number; n: number }> = {};
  const suma = (fecha: string, monto: number, tipo: 'subs' | 'parcial') => {
    const k = String(fecha).slice(0, 7);
    porMes[k] = porMes[k] || { subs: 0, parcial: 0, n: 0 };
    porMes[k][tipo] += monto; porMes[k].n++;
  };
  S.forEach(s => {
    const f = s.proxima_factura ? String(s.proxima_factura).slice(0, 10) : null;
    if (!f || f < hoy || s.ciclo === 'vitalicia') return;
    suma(f, num(s.monto_proximo ?? s.precio), 'subs');
  });
  futuroCots.forEach(x => suma(x.fecha, x.monto, 'parcial'));
  E.filter(x => x.estado === 'pendiente' && x.subscription_id && String(x.fecha) >= hoy)
    .forEach(x => suma(String(x.fecha), num(x.monto), 'parcial'));
  const proyeccion = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(0, meses)
    .map(([mes, v]) => ({ mes, subs: r0(v.subs), parcial: r0(v.parcial), total: r0(v.subs + v.parcial), n: v.n }));

  // ── 4 · Promesas ──
  const promesasVivas = [...S, ...Q].filter((x: any) => x.cobranza_promesa);
  const cerradasMes = G.filter(g => g.tipo === 'promesa' && String(g.created_at) >= mes1);
  const cumplidas = [...S, ...Q].filter((x: any) => x.cobranza_promesa_estado === 'cumplida').length;
  const rotas = [...S, ...Q].filter((x: any) => x.cobranza_promesa_estado === 'rota').length;

  // ── 5 · Gestión ──
  // Cuántos toques lleva cada cuenta y cuál fue el último. Sin bitácora esto
  // sale en cero, que es exactamente el punto: se llena con el uso.
  const toquesPorCuenta: Record<string, number> = {};
  G.forEach(g => { const k = g.company_id || g.subscription_id || g.quote_id || '?'; toquesPorCuenta[k] = (toquesPorCuenta[k] || 0) + 1; });
  const porAccion: Record<string, number> = {};
  G.forEach(g => { porAccion[g.tipo] = (porAccion[g.tipo] || 0) + 1; });

  return json({
    hoy,
    velocidad,
    cartera: {
      vencido: r0(vencidoSubs + vencidoCots),
      vencido_subs: r0(vencidoSubs), vencido_cotizaciones: r0(vencidoCots),
      cuentas_vencidas: vencidasSubs.length,
      arr_activo: r0(arrActivo),
      pct_vencido: arrActivo > 0 ? Math.round(((vencidoSubs + vencidoCots) / arrActivo) * 1000) / 10 : null,
      cobrado_mes: r0(P.filter(p => String(p.fecha).slice(0, 10) >= mes1).reduce((a, p) => a + num(p.monto), 0)),
    },
    proyeccion,
    promesas: {
      vivas: promesasVivas.length,
      monto_vivo: r0(promesasVivas.reduce((a: number, x: any) => a + num(x.monto_proximo ?? x.precio ?? x.total), 0)),
      cumplidas, rotas,
      cumplimiento: (cumplidas + rotas) > 0 ? Math.round((cumplidas / (cumplidas + rotas)) * 100) : null,
      registradas_mes: cerradasMes.length,
    },
    gestion: {
      toques: G.length,
      cuentas_tocadas: Object.keys(toquesPorCuenta).length,
      toques_por_cuenta: Object.keys(toquesPorCuenta).length ? Math.round((G.length / Object.keys(toquesPorCuenta).length) * 10) / 10 : null,
      por_accion: Object.entries(porAccion).map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
    },
  });
};
