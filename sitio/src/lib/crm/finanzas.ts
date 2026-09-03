// ══ Finanzas del negocio (decisión 2026-09-03) ═══════════════════════════════════════════════════════════════
// Un mes = lo que entró (payments confirmados), lo que falta por entrar (renovaciones con proxima_factura en el
// mes), lo que hay que pagar (fin_gastos aplicables al mes + comisiones calculadas por el sistema) y la utilidad.
// El cierre congela esos números en fin_cierres; el reporte anual mezcla cierres con meses vivos.
import { supabase } from '../supabase';

export type Mes = string; // 'YYYY-MM'
export const mesDe = (d = new Date()) => new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 7);
const ini = (m: Mes) => `${m}-01`;
const finExcl = (m: Mes) => { const [y, mm] = m.split('-').map(Number); return `${mm === 12 ? y + 1 : y}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-01`; };

/** ¿Un gasto aplica a este mes? mensual: desde inicio hasta fin; anual: mismo mes que inicio; único: solo su mes. */
export function aplicaMes(g: any, m: Mes) {
  if (g.activo === false) return false;
  const i = String(g.inicio || '').slice(0, 7); if (!i || i > m) return false;
  if (g.fin && String(g.fin).slice(0, 7) < m) return false;
  if (g.periodicidad === 'anual') return i.slice(5) === m.slice(5);
  if (g.periodicidad === 'unico') return i === m;
  return true;
}

export async function resumenMes(m: Mes) {
  const [{ data: pagos }, { data: subs }, { data: gastos }, { data: pagosG }, { data: coms }, { data: deals }, { data: cierre }] = await Promise.all([
    supabase.from('payments').select('id, fecha, monto, metodo, pasarela, contact_id, company_id, subscription_id, companies(nombre_comercial, nombre), contacts(nombre)').eq('estado', 'confirmado').gte('fecha', ini(m)).lt('fecha', finExcl(m)).order('fecha', { ascending: false }),
    supabase.from('subscriptions').select('id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, company_id, companies(nombre_comercial, nombre), cobranza_estado').in('estado', ['activa', 'pendiente_pago', 'programada']).gte('proxima_factura', ini(m)).lt('proxima_factura', finExcl(m)).order('proxima_factura'),
    supabase.from('fin_gastos').select('*').order('categoria').order('nombre'),
    supabase.from('fin_gastos_pagos').select('*').eq('mes', m),
    supabase.from('comision_lineas').select('id, owner_id, monto, fecha, estado, concepto, team_members:owner_id(nombre)').gte('fecha', ini(m)).lt('fecha', finExcl(m)),
    supabase.from('deals').select('id, nombre, stage, valor_total, valor_mensual, mrr, probabilidad, fecha_cierre_esperada, owner_id, companies(nombre_comercial, nombre), contacts(nombre), team_members:owner_id(nombre)').is('archived_at', null).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")').order('valor_total', { ascending: false }),
    supabase.from('fin_cierres').select('*').eq('mes', m).maybeSingle(),
  ]);
  const pagadoPor = new Map((pagosG || []).map(p => [p.gasto_id, p]));
  const aplicables = (gastos || []).filter(g => aplicaMes(g, m)).map(g => ({ ...g, pago: pagadoPor.get(g.id) || null }));
  const porCat: Record<string, { previsto: number; pagado: number; n: number }> = {};
  for (const g of aplicables) { const c = porCat[g.categoria] || (porCat[g.categoria] = { previsto: 0, pagado: 0, n: 0 }); c.previsto += Number(g.monto); c.n++; if (g.pago) c.pagado += Number(g.pago.monto ?? g.monto); }
  const gastosPrevisto = aplicables.reduce((s, g) => s + Number(g.monto), 0);
  const gastosPagado = aplicables.reduce((s, g) => s + (g.pago ? Number(g.pago.monto ?? g.monto) : 0), 0);
  const comisiones = (coms || []).reduce((s, c) => s + Number(c.monto || 0), 0);
  const porVendedor: Record<string, number> = {}; for (const c of coms || []) { const k = (c as any).team_members?.nombre || 'Sin asignar'; porVendedor[k] = (porVendedor[k] || 0) + Number(c.monto || 0); }
  const cobrado = (pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
  const cobradoSubs = new Set((pagos || []).map(p => p.subscription_id).filter(Boolean));
  const porCobrar = (subs || []).filter(s => !cobradoSubs.has(s.id)).map(s => ({ ...s, monto: Number(s.monto_proximo ?? s.precio ?? 0) }));
  const porCobrarMonto = porCobrar.reduce((s, x) => s + x.monto, 0);
  const abiertos = (deals || []).map(d => ({ ...d, valor: Number(d.valor_total || 0) || Number(d.valor_mensual || 0) * 12, prob: Number(d.probabilidad ?? 30) }));
  const pipelineTotal = abiertos.reduce((s, d) => s + d.valor, 0);
  const pipelinePond = abiertos.reduce((s, d) => s + d.valor * d.prob / 100, 0);
  const totalGastos = gastosPrevisto + (porCat.comision ? 0 : comisiones);   // si capturaste comisiones a mano, no se suman dos veces
  return {
    mes: m, cierre: cierre || null,
    ingresos: { cobrado, pagos: pagos || [], por_cobrar: porCobrarMonto, por_cobrar_lista: porCobrar, esperado: cobrado + porCobrarMonto },
    gastos: { lista: aplicables, previsto: gastosPrevisto, pagado: gastosPagado, por_categoria: porCat, catalogo: gastos || [] },
    comisiones: { total: comisiones, por_vendedor: porVendedor, lineas: (coms || []).length },
    pipeline: { abiertos, total: pipelineTotal, ponderado: pipelinePond },
    utilidad: { estimada: cobrado - totalGastos, si_cobra_todo: cobrado + porCobrarMonto - totalGastos, total_gastos: totalGastos },
  };
}

/** Reporte por meses de un año: cierres guardados + meses vivos calculados al vuelo (solo dinero agregado). */
export async function reporteAnual(anio: number) {
  const [{ data: cierres }, { data: pagos }, { data: gastos }, { data: coms }, { data: pagosG }] = await Promise.all([
    supabase.from('fin_cierres').select('*').gte('mes', `${anio}-01`).lte('mes', `${anio}-12`),
    supabase.from('payments').select('fecha, monto').eq('estado', 'confirmado').gte('fecha', `${anio}-01-01`).lt('fecha', `${anio + 1}-01-01`),
    supabase.from('fin_gastos').select('*'),
    supabase.from('comision_lineas').select('fecha, monto').gte('fecha', `${anio}-01-01`).lt('fecha', `${anio + 1}-01-01`),
    supabase.from('fin_gastos_pagos').select('gasto_id, mes, monto').gte('mes', `${anio}-01`).lte('mes', `${anio}-12`),
  ]);
  const porMesCierre = new Map((cierres || []).map(c => [c.mes, c]));
  const hoy = mesDe();
  const meses: any[] = [];
  for (let i = 1; i <= 12; i++) {
    const m = `${anio}-${String(i).padStart(2, '0')}`;
    const c = porMesCierre.get(m);
    if (c) { meses.push({ mes: m, ingresos: Number(c.ingresos), gastos: Number(c.gastos), comisiones: Number(c.comisiones), utilidad: Number(c.utilidad), cerrado: true }); continue; }
    if (m > hoy) { meses.push({ mes: m, ingresos: 0, gastos: (gastos || []).filter(g => aplicaMes(g, m)).reduce((s, g) => s + Number(g.monto), 0), comisiones: 0, utilidad: null, cerrado: false, futuro: true }); continue; }
    const ing = (pagos || []).filter(p => String(p.fecha).slice(0, 7) === m).reduce((s, p) => s + Number(p.monto), 0);
    const apl = (gastos || []).filter(g => aplicaMes(g, m));
    const gas = apl.reduce((s, g) => s + Number(g.monto), 0);
    const com = (coms || []).filter(x => String(x.fecha).slice(0, 7) === m).reduce((s, x) => s + Number(x.monto || 0), 0);
    const tieneComManual = apl.some(g => g.categoria === 'comision');
    const total = gas + (tieneComManual ? 0 : com);
    meses.push({ mes: m, ingresos: ing, gastos: gas, comisiones: com, utilidad: ing - total, cerrado: false, pagado: (pagosG || []).filter(p => p.mes === m).length });
  }
  const tot = meses.reduce((a, x) => ({ ingresos: a.ingresos + x.ingresos, gastos: a.gastos + x.gastos, comisiones: a.comisiones + x.comisiones, utilidad: a.utilidad + (x.utilidad || 0) }), { ingresos: 0, gastos: 0, comisiones: 0, utilidad: 0 });
  return { anio, meses, total: tot };
}

export async function cerrarMes(m: Mes, userId?: string, notas?: string) {
  const r = await resumenMes(m);
  const fila = { mes: m, ingresos: r.ingresos.cobrado, por_cobrar_pendiente: r.ingresos.por_cobrar, gastos: r.gastos.previsto, comisiones: r.comisiones.total, nomina: r.gastos.por_categoria.nomina?.previsto || 0, utilidad: r.utilidad.estimada, notas: notas || null, cerrado_por: userId || null, cerrado_at: new Date().toISOString(),
    detalle: { gastos: r.gastos.lista.map(g => ({ nombre: g.nombre, categoria: g.categoria, monto: g.monto, pagado: !!g.pago })), por_categoria: r.gastos.por_categoria, comisiones_por_vendedor: r.comisiones.por_vendedor, pagos: r.ingresos.pagos.length, por_cobrar: r.ingresos.por_cobrar_lista.map((s: any) => ({ empresa: s.companies?.nombre_comercial || s.companies?.nombre, monto: s.monto, fecha: s.proxima_factura })), pipeline: { total: r.pipeline.total, ponderado: r.pipeline.ponderado, n: r.pipeline.abiertos.length } } };
  const { error } = await supabase.from('fin_cierres').upsert(fila, { onConflict: 'mes' });
  return error ? { error: error.message } : { ok: true, cierre: fila };
}
