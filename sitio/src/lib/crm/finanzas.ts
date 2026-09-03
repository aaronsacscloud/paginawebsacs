// ══ Finanzas del negocio (decisión 2026-09-03) ═══════════════════════════════════════════════════════════════
// Un mes = lo que entró (payments confirmados), lo que falta por entrar (renovaciones con proxima_factura en el
// mes), lo que hay que pagar (fin_gastos aplicables al mes + comisiones calculadas por el sistema) y la utilidad.
// El cierre congela esos números en fin_cierres; el reporte anual mezcla cierres con meses vivos.
import { supabase } from '../supabase';
import { parcialidadesDelMes } from '../quotes/plan';

export type Mes = string; // 'YYYY-MM'
export const mesDe = (d = new Date()) => new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 7);
const ini = (m: Mes) => `${m}-01`;
const mesesEntre = (a: Mes, b: Mes) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
const mesMenos = (m: Mes, n: number) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 - n, 1)); return d.toISOString().slice(0, 7); };
const finExcl = (m: Mes) => { const [y, mm] = m.split('-').map(Number); return `${mm === 12 ? y + 1 : y}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-01`; };

/** ¿Un gasto aplica a este mes? mensual: desde inicio hasta fin; anual: mismo mes que inicio; único: solo su mes. */
export function aplicaMes(g: any, m: Mes) {
  if (g.activo === false) return false;
  const i = String(g.inicio || '').slice(0, 7); if (!i || i > m) return false;
  if (g.fin && String(g.fin).slice(0, 7) < m) return false;
  if (g.pausado_hasta && String(g.pausado_hasta).slice(0, 7) >= m) return false;   // pausado: no aplica hasta ese mes inclusive
  const cada: Record<string, number> = { bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  if (g.periodicidad === 'unico') return i === m;
  if (cada[g.periodicidad]) return mesesEntre(i, m) % cada[g.periodicidad] === 0;
  return true;   // mensual, quincenal, semanal: cada mes (con 2 o 4 ocurrencias)
}
/** Cuántas veces se paga en el mes (quincenal 2, semanal 4, lo demás 1) → el monto del mes es monto × ocurrencias. */
export const ocurrenciasMes = (g: any) => g.periodicidad === 'quincenal' ? 2 : g.periodicidad === 'semanal' ? 4 : 1;

export async function resumenMes(m: Mes) {
  const [{ data: pagos }, { data: subs }, { data: gastos }, { data: pagosG }, { data: coms }, { data: deals }, { data: cierre }] = await Promise.all([
    supabase.from('payments').select('id, fecha, monto, neto, comision, metodo, pasarela, contact_id, company_id, subscription_id, companies(nombre_comercial, nombre), contacts(nombre)').eq('estado', 'confirmado').gte('fecha', ini(m)).lt('fecha', finExcl(m)).order('fecha', { ascending: false }),
    supabase.from('subscriptions').select('id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, company_id, companies(nombre_comercial, nombre), cobranza_estado').in('estado', ['activa', 'pendiente_pago', 'programada']).gte('proxima_factura', ini(m)).lt('proxima_factura', finExcl(m)).order('proxima_factura'),
    supabase.from('fin_gastos').select('*').order('categoria').order('nombre'),
    supabase.from('fin_gastos_pagos').select('*').eq('mes', m),
    supabase.from('comision_lineas').select('id, owner_id, monto, fecha, estado, concepto, team_members:owner_id(nombre)').gte('fecha', ini(m)).lt('fecha', finExcl(m)),
    supabase.from('deals').select('id, nombre, stage, stage_changed_at, created_at, quote_id, contact_id, company_id, valor_total, valor_mensual, mrr, probabilidad, fecha_cierre_esperada, proximo_paso, proximo_paso_at, owner_id, companies(nombre_comercial, nombre), contacts(nombre, created_at, fuente, whatsapp), team_members:owner_id(nombre)').is('archived_at', null).not('stage', 'in', '("cerrada_ganada","cerrada_perdida")').order('valor_total', { ascending: false }),
    supabase.from('fin_cierres').select('*').eq('mes', m).maybeSingle(),
  ]);
  // Cotizaciones ACEPTADAS sin pago: por cobrar de venta nueva (no pipeline): salen de deals y entran aquí.
  //
  // ⚠️ Pedía `updated_at`, columna que NO existe en quotes. PostgREST devolvía
  // 400 y el destructuring dejaba `acept` en null: la tarjeta llevaba meses
  // enseñando $0 no porque no hubiera nada, sino porque la consulta moría en
  // silencio. Se ordena por `aceptado_fecha`, que es además la fecha correcta:
  // lo que importa es cuándo la aceptaron, no cuándo se tocó el renglón.
  const { data: acept, error: errAcept } = await supabase.from('quotes')
    .select('id, numero, total, aceptado_fecha, created_at, notas, contact_id, company_id, companies(nombre_comercial, nombre), contacts(nombre)')
    .eq('estado', 'accepted').order('aceptado_fecha', { ascending: false, nullsFirst: false }).limit(100);
  if (errAcept) console.error('[finanzas] cotizaciones aceptadas:', errAcept.message);
  // Lo ya abonado a cada cotización: una aceptada con anticipo NO está por
  // cobrar por su total, y contarla completa infla el mes por el anticipo.
  const acIds = (acept || []).map(q => q.id);
  const { data: pagosCot } = acIds.length
    ? await supabase.from('payments').select('quote_id, monto').in('quote_id', acIds).neq('estado', 'reembolsado')
    : { data: [] as any[] };
  const abonadoCot = new Map<string, number>();
  for (const p of pagosCot || []) abonadoCot.set(p.quote_id, (abonadoCot.get(p.quote_id) || 0) + Number(p.monto || 0));

  const hoyISO = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  // PAGOS DIFERIDOS (decisión del dueño, 2026-09-03). Una venta pactada en
  // exhibiciones es dinero comprometido con FECHA: la parcialidad que vence
  // este mes es tan «por cobrar» como una renovación. Vivía solo en Cobranza
  // (`meta.plan_pagos` vía planDeCotizacion) y Finanzas no la veía: el mes de
  // Ruben's se quedaba $30,000 corto.
  const { filas: parcialidades, conPlan } = parcialidadesDelMes(acept || [], abonadoCot, m, hoyISO);
  // Con plan, la cotización entra parcialidad por parcialidad: dejarla también
  // completa aquí contaría el mismo dinero dos veces.
  const aceptadas = (acept || []).filter(q => !conPlan.has(q.id))
    .map(q => ({ ...q, updated_at: q.aceptado_fecha || q.created_at, abonado: abonadoCot.get(q.id) || 0, monto: Math.max(0, Number(q.total || 0) - (abonadoCot.get(q.id) || 0)) }))
    .filter(q => q.monto > 0.01);
  const aceptadasIds = new Set([...(acept || []).map(q => q.id)]);
  const aceptadasMonto = aceptadas.reduce((s, q) => s + q.monto, 0);
  // COMISIONES POR PAGAR (decisión 2026-09-03): cada lunes se pagan los cortes de comisión; un corte generado y aceptado por
  // la vendedora es un gasto a contemplar aunque todavía no se pague. Lo del mes = cortes con paga_el en el mes.
  const { data: cortes } = await supabase.from('comision_cortes').select('id, owner_id, desde, hasta, paga_el, estado, total, pagado_at, recibido_at, team_members:owner_id(nombre)').gte('paga_el', ini(m)).lt('paga_el', finExcl(m)).order('paga_el');
  const cortesMes = (cortes || []).map(c => ({ ...c, vendedor: (c as any).team_members?.nombre || 'Vendedor', aceptado: !!c.recibido_at, pagado: !!c.pagado_at, monto: Number(c.total || 0) }));
  const cortesTotal = cortesMes.reduce((s, c) => s + c.monto, 0);
  const cortesPorPagar = cortesMes.filter(c => !c.pagado).reduce((s, c) => s + c.monto, 0);
  // Publicidad REAL del mes: lo capturado en Embudo (marketing_gastos), prorrateado al mes.
  const { data: mk } = await supabase.from('marketing_gastos').select('canal, monto, periodo_inicio, periodo_fin').lte('periodo_inicio', finExcl(m)).gte('periodo_fin', ini(m));
  const d0 = Date.parse(ini(m)), d1 = Date.parse(finExcl(m));
  const marketingReal = (mk || []).reduce((s, g) => { const a = Math.max(d0, Date.parse(g.periodo_inicio)), b = Math.min(d1, Date.parse(g.periodo_fin) + 86400e3); const tot = Date.parse(g.periodo_fin) + 86400e3 - Date.parse(g.periodo_inicio); return s + (b > a && tot > 0 ? Number(g.monto) * (b - a) / tot : 0); }, 0);
  const pagadoPor = new Map((pagosG || []).map(p => [p.gasto_id, p]));
  // Variables (probable): el estimado sigue al promedio de los últimos 3 pagos reales (Konfio: 7–10 mil según el mes).
  const probIds = (gastos || []).filter(g => g.probable).map(g => g.id);
  const { data: pagosProb } = probIds.length ? await supabase.from('fin_gastos_pagos').select('gasto_id, mes, monto').in('gasto_id', probIds).lt('mes', m).order('mes', { ascending: false }) : { data: [] as any[] };
  const promProb = new Map<string, number>();
  for (const id of probIds) { const ult = (pagosProb || []).filter(p => p.gasto_id === id && p.monto != null).slice(0, 3); if (ult.length) promProb.set(id, Math.round(ult.reduce((s, p) => s + Number(p.monto), 0) / ult.length)); }
  // DECISIONES sobre lo no pagado (2026-09-04): recorrer (se junta como atrasado), prórroga (se paga en otra fecha sin contar
  // como atraso), condonado / no aplica (desaparece). Se guardan por (gasto, mes original).
  const { data: decs } = await supabase.from('fin_gastos_decisiones').select('*');
  const decDe = (gid: string, mm: string) => (decs || []).find(x => x.gasto_id === gid && x.mes === mm) || null;
  const base = (gastos || []).filter(g => aplicaMes(g, m)).map(g => { const dec = decDe(g.id, m); return { ...g, mes_pago: m, monto_base: g.monto, monto: (g.probable && promProb.has(g.id) ? promProb.get(g.id)! : Number(g.monto)) * ocurrenciasMes(g), ocurrencias: ocurrenciasMes(g), estimado_por_promedio: g.probable && promProb.has(g.id), pago: pagadoPor.get(g.id) || null, decision: dec }; })
    .filter(g => !(g.decision && ['condonado', 'no_aplica'].includes(g.decision.decision)));
  // Prórrogas que CAEN en este mes (vienen de un mes anterior): se pagan aquí como renglón normal, con su fecha nueva.
  const prorrogas = (decs || []).filter(x => x.decision === 'prorroga' && x.nueva_fecha && String(x.nueva_fecha).slice(0, 7) === m && x.mes !== m);
  const { data: pagosProrr } = prorrogas.length ? await supabase.from('fin_gastos_pagos').select('gasto_id, mes, pagado_at, monto, nota, comprobante_path, comprobante_nombre').in('gasto_id', prorrogas.map(x => x.gasto_id)) : { data: [] as any[] };
  const filasProrroga = prorrogas.map(x => { const g = (gastos || []).find(gg => gg.id === x.gasto_id); if (!g) return null; const pago = (pagosProrr || []).find(p => p.gasto_id === x.gasto_id && p.mes === x.mes) || null; return { ...g, id: g.id, mes_pago: x.mes, prorroga_de: x.mes, dia_cobro: Number(String(x.nueva_fecha).slice(8, 10)), monto: Number(x.monto ?? g.monto), monto_base: g.monto, ocurrencias: 1, pago, decision: x, nombre: `${g.nombre} · prórroga de ${x.mes}` }; }).filter(Boolean) as any[];
  const aplicables = [...base, ...filasProrroga];
  const porCat: Record<string, { previsto: number; pagado: number; n: number }> = {};
  for (const g of aplicables) { const c = porCat[g.categoria] || (porCat[g.categoria] = { previsto: 0, pagado: 0, n: 0 }); c.previsto += Number(g.monto); c.n++; if (g.pago) c.pagado += Number(g.pago.monto ?? g.monto); }
  const gastosPrevisto = aplicables.reduce((s, g) => s + Number(g.monto), 0);
  const gastosPagado = aplicables.reduce((s, g) => s + (g.pago ? Number(g.pago.monto ?? g.monto) : 0), 0);
  const comisiones = (coms || []).reduce((s, c) => s + Number(c.monto || 0), 0);
  const porVendedor: Record<string, number> = {}; for (const c of coms || []) { const k = (c as any).team_members?.nombre || 'Sin asignar'; porVendedor[k] = (porVendedor[k] || 0) + Number(c.monto || 0); }
  const cobrado = (pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
  // NETO real: cuando el pago trae la comisión de la pasarela (Stripe / Mercado Pago), la utilidad usa el neto.
  const cobradoNeto = (pagos || []).reduce((s, p) => s + Number(p.neto ?? (Number(p.monto || 0) - Number(p.comision || 0))), 0);
  const comisionesPasarela = cobrado - cobradoNeto;
  const cobradoSubs = new Set((pagos || []).map(p => p.subscription_id).filter(Boolean));
  const porCobrar = [
    ...(subs || []).filter(s => !cobradoSubs.has(s.id)).map(s => ({ ...s, tipo: 'renovacion', monto: Number(s.monto_proximo ?? s.precio ?? 0) })),
    ...parcialidades,
  ].sort((a, b) => String(a.proxima_factura).localeCompare(String(b.proxima_factura)));
  const porCobrarMonto = porCobrar.reduce((s, x) => s + x.monto, 0);
  // PIPELINE CON CONTEXTO (frente C): probabilidad por etapa (20/40/60/90, decisión del dueño) salvo ajuste manual,
  // vistas de la cotización, última actividad, cliente nuevo vs expansión, días en etapa, duplicados por contacto.
  const PROB_ETAPA: Record<string, number> = { calificacion: 20, demo_agendada: 40, demo_realizada: 50, cotizacion_enviada: 60, negociacion: 75, aceptada: 90 };
  const dealsAb = (deals || []).filter(d => !aceptadasIds.has((d as any).quote_id));
  const qIds = dealsAb.map(d => d.quote_id).filter(Boolean); const cIds = [...new Set(dealsAb.map(d => d.contact_id).filter(Boolean))]; const coIds = [...new Set(dealsAb.map(d => d.company_id).filter(Boolean))];
  const [{ data: qs }, { data: acts }, { data: subsAct }] = await Promise.all([
    qIds.length ? supabase.from('quotes').select('id, vistas, ultima_vista_at, primera_vista_at, estado, numero, total, vigencia').in('id', qIds) : Promise.resolve({ data: [] as any[] }),
    cIds.length ? supabase.from('activities').select('contact_id, tipo, titulo, created_at').in('contact_id', cIds).order('created_at', { ascending: false }).limit(400) : Promise.resolve({ data: [] as any[] }),
    coIds.length ? supabase.from('subscriptions').select('company_id').in('company_id', coIds).eq('estado', 'activa') : Promise.resolve({ data: [] as any[] }),
  ]);
  const qPor = new Map((qs || []).map(q => [q.id, q])); const actPor = new Map<string, any>(); for (const a of acts || []) if (!actPor.has(a.contact_id)) actPor.set(a.contact_id, a);
  const expansionSet = new Set((subsAct || []).map(s => s.company_id));
  const porContacto: Record<string, number> = {}; for (const d of dealsAb) if (d.contact_id) porContacto[d.contact_id] = (porContacto[d.contact_id] || 0) + 1;
  const abiertos = dealsAb.map(d => {
    const q: any = d.quote_id ? qPor.get(d.quote_id) : null; const k: any = (d as any).contacts || {}; const a = d.contact_id ? actPor.get(d.contact_id) : null;
    const manual = d.probabilidad != null && Number(d.probabilidad) !== 20;   // 20 era el default plano: se trata como «sin ajustar»
    const prob = manual ? Number(d.probabilidad) : (PROB_ETAPA[d.stage] ?? 30);
    const diasEtapa = Math.floor((Date.now() - Date.parse(d.stage_changed_at || d.created_at)) / 86400e3);
    return { ...d, valor: Number(d.valor_total || 0) || Number(d.valor_mensual || 0) * 12, prob, prob_manual: manual, vistas: Number(q?.vistas || 0), ultima_vista_at: q?.ultima_vista_at || null, cot_estado: q?.estado || null, cot_numero: q?.numero || null, contacto_nombre: k.nombre || null, lead_desde: k.created_at || null, canal: k.fuente || null, whatsapp: k.whatsapp || null, expansion: !!(d.company_id && expansionSet.has(d.company_id)), ultima_actividad: a ? { tipo: a.tipo, titulo: a.titulo, at: a.created_at } : null, dias_etapa: diasEtapa, estancada: diasEtapa > 14, duplicados: d.contact_id ? porContacto[d.contact_id] : 1, cierre_en_mes: !!d.fecha_cierre_esperada && String(d.fecha_cierre_esperada).slice(0, 7) === m, sin_fecha_cierre: !d.fecha_cierre_esperada, cierre_vencido: !!d.fecha_cierre_esperada && String(d.fecha_cierre_esperada) < new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10) };
  });
  const pipelineTotal = abiertos.reduce((s, d) => s + d.valor, 0);
  const pipelinePond = abiertos.reduce((s, d) => s + d.valor * d.prob / 100, 0);
  const esperadoPipelineMes = abiertos.filter(d => d.cierre_en_mes).reduce((s, d) => s + d.valor * d.prob / 100, 0);
  const forecast: Record<string, { vendedor: string; n: number; total: number; ponderado: number; comprometido: number; este_mes: number }> = {};
  for (const d of abiertos) { const v = (d as any).team_members?.nombre || 'Sin vendedor'; const fc = forecast[v] || (forecast[v] = { vendedor: v, n: 0, total: 0, ponderado: 0, comprometido: 0, este_mes: 0 }); fc.n++; fc.total += d.valor; fc.ponderado += d.valor * d.prob / 100; if (d.prob >= 60) fc.comprometido += d.valor; if (d.cierre_en_mes) fc.este_mes += d.valor * d.prob / 100; }
  // Conversión últimos 90 días por canal: ganadas / cerradas (ganadas + perdidas).
  const { data: cerradas } = await supabase.from('deals').select('stage, closed_at, contacts(fuente)').in('stage', ['cerrada_ganada', 'cerrada_perdida']).gte('closed_at', new Date(Date.now() - 90 * 86400e3).toISOString()).limit(500);
  const conv: Record<string, { ganadas: number; perdidas: number }> = {}; for (const c of cerradas || []) { const canal = (c as any).contacts?.fuente || '(sin canal)'; const x = conv[canal] || (conv[canal] = { ganadas: 0, perdidas: 0 }); if (c.stage === 'cerrada_ganada') x.ganadas++; else x.perdidas++; }
  // ADEUDOS (decisión 2026-09-03): total, saldo, cuota del mes y lo atrasado que se junta. Si hay fecha límite y no hay
  // cuota fija, la cuota es saldo ÷ meses que faltan (SAT: 48,000 a octubre = 24,000 y 24,000).
  const [{ data: adeudos }, { data: abonos }] = await Promise.all([
    supabase.from('fin_adeudos').select('*').eq('activo', true).order('created_at'),
    supabase.from('fin_adeudos_abonos').select('*').order('fecha', { ascending: false }),
  ]);
  const { data: decsAd } = await supabase.from('fin_adeudos_decisiones').select('*');
  const adeudosMes = (adeudos || []).map(a => {
    const ab = (abonos || []).filter(x => x.adeudo_id === a.id);
    const pagadoTotal = ab.reduce((s, x) => s + Number(x.monto), 0);   // incluye condonaciones (tipo='condonacion'): bajan el saldo
    const misDecs = (decsAd || []).filter(x => x.adeudo_id === a.id);
    // Prórrogas de cuota: lo pendiente de un mes se mueve a la fecha nueva; hasta entonces no cuenta como atraso.
    const prorrogadoPendiente = misDecs.filter(x => x.decision === 'prorroga' && x.nueva_fecha && String(x.nueva_fecha).slice(0, 7) > m).reduce((s, x) => s + Number(x.monto || 0), 0);
    const saldo = Math.max(0, Number(a.total) - pagadoTotal);
    const inicioM = String(a.inicio).slice(0, 7);
    const mesesRest = a.fecha_limite ? Math.max(1, mesesEntre(m, String(a.fecha_limite).slice(0, 7)) + 1) : null;
    const cuota = Number(a.cuota) > 0 ? Number(a.cuota) : mesesRest ? Math.ceil(saldo / mesesRest) : null;
    const mesesCorridos = Math.max(0, mesesEntre(inicioM, m)) + 1;   // meses desde que empezó, incluido este
    const esperadoAcum = cuota ? Math.min(Number(a.total), cuota * mesesCorridos) : 0;
    const atraso = cuota ? Math.max(0, esperadoAcum - pagadoTotal - prorrogadoPendiente) : 0;   // lo que debería llevar pagado menos lo pagado y menos lo prorrogado a futuro
    const abonosMes = ab.filter(x => x.mes === m); const abonadoMes = abonosMes.reduce((s, x) => s + Number(x.monto), 0);
    const tocaEsteMes = cuota ? Math.min(saldo, Math.max(0, atraso)) : 0;
    return { ...a, decisiones: misDecs, prorrogado_pendiente: prorrogadoPendiente, pagado_total: pagadoTotal, saldo, cuota_mes: cuota, meses_restantes: mesesRest, atraso: Math.max(0, atraso - (cuota || 0)), toca_este_mes: tocaEsteMes, abonado_mes: abonadoMes, abonos_mes: abonosMes, abonos: ab.slice(0, 24), sin_cuota: !cuota, liquidado: saldo <= 0 };
  });
  const adeudosToca = adeudosMes.reduce((s, a) => s + a.toca_este_mes, 0);
  const adeudosAbonado = adeudosMes.reduce((s, a) => s + a.abonado_mes, 0);
  // ATRASADOS: gastos de los 3 meses anteriores que aplicaban y no se marcaron pagados: se juntan aquí, no se olvidan.
  const mesesPrev = [1, 2, 3].map(n => mesMenos(m, n)).filter(x => x >= '2026-09');
  const { data: pagosPrev } = mesesPrev.length ? await supabase.from('fin_gastos_pagos').select('gasto_id, mes').in('mes', mesesPrev) : { data: [] as any[] };
  const pagadoPrev = new Set((pagosPrev || []).map(p => `${p.gasto_id}:${p.mes}`));
  const atrasados: any[] = [];
  for (const mp of mesesPrev) for (const g of gastos || []) if (aplicaMes(g, mp) && !g.probable && !pagadoPrev.has(`${g.id}:${mp}`)) {
    const dec = decDe(g.id, mp);
    if (dec && dec.decision !== 'recorrer') continue;   // prórroga (ya aparece en su mes nuevo), condonado o no aplica: no se juntan
    atrasados.push({ ...g, mes: mp, monto: Number(g.monto) * ocurrenciasMes(g), decision: dec });
  }
  const atrasadosTotal = atrasados.reduce((s, g) => s + Number(g.monto), 0);
  const probables = aplicables.filter(g => g.probable).reduce((s, g) => s + Number(g.monto), 0);
  // Comisiones del mes: si hay cortes programados en el mes, mandan ellos (es lo que de verdad se paga los lunes); si no, las líneas.
  const comisionesMes = cortesMes.length ? cortesTotal : comisiones;
  // Publicidad: si hay inversión real capturada en Embudo, sustituye al estimado «probable» de marketing.
  const marketingEstimado = aplicables.filter(g => g.probable && g.categoria === 'marketing').reduce((s, g) => s + Number(g.monto), 0);
  const ajusteMarketing = marketingReal > 0 ? marketingReal - marketingEstimado : 0;
  const totalGastos = gastosPrevisto + ajusteMarketing + (porCat.comision ? 0 : comisionesMes) + adeudosToca + atrasadosTotal;   // comisiones a mano → no se suman dos veces
  return {
    mes: m, cierre: cierre || null,
    ingresos: { cobrado, cobrado_neto: cobradoNeto, comisiones_pasarela: comisionesPasarela, pagos: pagos || [], por_cobrar: porCobrarMonto, por_cobrar_lista: porCobrar, esperado: cobrado + porCobrarMonto + aceptadasMonto + esperadoPipelineMes, esperado_pipeline: esperadoPipelineMes, ventas_aceptadas: aceptadasMonto, ventas_aceptadas_lista: aceptadas },
    gastos: { lista: aplicables, previsto: gastosPrevisto + ajusteMarketing, pagado: gastosPagado, por_categoria: porCat, catalogo: gastos || [] },
    comisiones: { total: comisionesMes, lineas_total: comisiones, por_vendedor: porVendedor, lineas: (coms || []).length, cortes: cortesMes, por_pagar: cortesPorPagar },
    variables: { probables, marketing_real: Math.round(marketingReal), marketing_estimado: marketingEstimado },
    adeudos: { lista: adeudosMes, toca: adeudosToca, abonado: adeudosAbonado, saldo_total: adeudosMes.reduce((s, a) => s + a.saldo, 0) },
    atrasados: { lista: atrasados, total: atrasadosTotal },
    pipeline: { abiertos, total: pipelineTotal, ponderado: pipelinePond, esperado_mes: esperadoPipelineMes, forecast: Object.values(forecast).sort((a, b) => b.ponderado - a.ponderado), conversion: Object.entries(conv).map(([canal, x]) => ({ canal, ...x, pct: x.ganadas + x.perdidas ? Math.round(x.ganadas / (x.ganadas + x.perdidas) * 100) : null })).sort((a, b) => (b.ganadas + b.perdidas) - (a.ganadas + a.perdidas)) },
    utilidad: { estimada: cobradoNeto - totalGastos, si_cobra_todo: cobradoNeto + porCobrarMonto - totalGastos, total_gastos: totalGastos },
    flujo: flujoSemanal(m, { pagos: pagos || [], porCobrar, aceptadas, aplicables, cortesMes, adeudosMes, atrasados }),
  };
}

/** Reporte por meses de un año: cierres guardados + meses vivos calculados al vuelo (solo dinero agregado). */
/** Cuánto toca pagar de adeudos en un mes (cuota + atraso acumulado, menos prórrogas a futuro), con la misma fórmula del resumen. */
function tocaAdeudos(adeudos: any[], abonos: any[], decs: any[], m: Mes) {
  let toca = 0;
  for (const a of adeudos || []) {
    if (a.activo === false) continue;
    const ab = (abonos || []).filter(x => x.adeudo_id === a.id && x.mes <= m);
    const pagado = ab.reduce((s, x) => s + Number(x.monto), 0); const saldo = Math.max(0, Number(a.total) - pagado);
    const inicioM = String(a.inicio).slice(0, 7); if (inicioM > m) continue;
    const mesesRest = a.fecha_limite ? Math.max(1, mesesEntre(m, String(a.fecha_limite).slice(0, 7)) + 1) : null;
    const cuota = Number(a.cuota) > 0 ? Number(a.cuota) : mesesRest ? Math.ceil(saldo / mesesRest) : null;
    if (!cuota) continue;
    const esperado = Math.min(Number(a.total), cuota * (Math.max(0, mesesEntre(inicioM, m)) + 1));
    const prorr = (decs || []).filter(x => x.adeudo_id === a.id && x.decision === 'prorroga' && x.nueva_fecha && String(x.nueva_fecha).slice(0, 7) > m).reduce((s, x) => s + Number(x.monto || 0), 0);
    toca += Math.min(saldo, Math.max(0, esperado - pagado - prorr));
  }
  return toca;
}

export async function reporteAnual(anio: number) {
  const [{ data: abonosAnio }, { data: adeudosAll }, { data: abonosAll }, { data: decsAdAll }] = await Promise.all([
    supabase.from('fin_adeudos_abonos').select('mes, monto').gte('mes', `${anio}-01`).lte('mes', `${anio}-12`),
    supabase.from('fin_adeudos').select('*'), supabase.from('fin_adeudos_abonos').select('adeudo_id, mes, monto'), supabase.from('fin_adeudos_decisiones').select('*'),
  ]);
  const { data: cortesAnio } = await supabase.from('comision_cortes').select('paga_el, total').gte('paga_el', `${anio}-01-01`).lt('paga_el', `${anio + 1}-01-01`);
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
    if (m > hoy) { meses.push({ mes: m, ingresos: 0, gastos: (gastos || []).filter(g => aplicaMes(g, m)).reduce((s, g) => s + Number(g.monto) * ocurrenciasMes(g), 0) + tocaAdeudos(adeudosAll || [], abonosAll || [], decsAdAll || [], m), comisiones: 0, utilidad: null, cerrado: false, futuro: true }); continue; }
    const ing = (pagos || []).filter(p => String(p.fecha).slice(0, 7) === m).reduce((s, p) => s + Number(p.monto), 0);
    const apl = (gastos || []).filter(g => aplicaMes(g, m));
    // Mes vivo: gastos aplicables + lo que TOCA de adeudos (misma cifra que el KPI «Gastos del mes»). Los abonos reales sustituyen al «toca» cuando ya se pagó.
    const abonadoM = (abonosAnio || []).filter(x => x.mes === m).reduce((s, x) => s + Number(x.monto), 0);
    const gas = apl.reduce((s, g) => s + Number(g.monto) * ocurrenciasMes(g), 0) + Math.max(abonadoM, m === hoy ? tocaAdeudos(adeudosAll || [], abonosAll || [], decsAdAll || [], m) : abonadoM);
    const comLineas = (coms || []).filter(x => String(x.fecha).slice(0, 7) === m).reduce((s, x) => s + Number(x.monto || 0), 0);
    const cortesM = (cortesAnio || []).filter(c => String(c.paga_el).slice(0, 7) === m);
    const com = cortesM.length ? cortesM.reduce((s, c) => s + Number(c.total || 0), 0) : comLineas;
    const tieneComManual = apl.some(g => g.categoria === 'comision');
    const total = gas + (tieneComManual ? 0 : com);
    meses.push({ mes: m, ingresos: ing, gastos: gas, comisiones: com, utilidad: ing - total, cerrado: false, pagado: (pagosG || []).filter(p => p.mes === m).length });
  }
  const tot = meses.reduce((a, x) => ({ ingresos: a.ingresos + x.ingresos, gastos: a.gastos + x.gastos, comisiones: a.comisiones + x.comisiones, utilidad: a.utilidad + (x.utilidad || 0) }), { ingresos: 0, gastos: 0, comisiones: 0, utilidad: 0 });
  return { anio, meses, total: tot };
}

export async function cerrarMes(m: Mes, userId?: string, notas?: string) {
  const r = await resumenMes(m);
  const fila = { mes: m, ingresos: r.ingresos.cobrado, por_cobrar_pendiente: r.ingresos.por_cobrar, gastos: r.gastos.previsto + r.adeudos.abonado + r.atrasados.total, comisiones: r.comisiones.total, nomina: r.gastos.por_categoria.nomina?.previsto || 0, utilidad: r.utilidad.estimada, notas: notas || null, cerrado_por: userId || null, cerrado_at: new Date().toISOString(),
    detalle: { gastos: r.gastos.lista.map(g => ({ nombre: g.nombre, categoria: g.categoria, monto: g.monto, pagado: !!g.pago })), por_categoria: r.gastos.por_categoria, comisiones_por_vendedor: r.comisiones.por_vendedor, pagos: r.ingresos.pagos.length, por_cobrar: r.ingresos.por_cobrar_lista.map((s: any) => ({ empresa: s.companies?.nombre_comercial || s.companies?.nombre, monto: s.monto, fecha: s.proxima_factura })), pipeline: { total: r.pipeline.total, ponderado: r.pipeline.ponderado, n: r.pipeline.abiertos.length }, adeudos: r.adeudos.lista.map((a: any) => ({ nombre: a.nombre, saldo: a.saldo, abonado_mes: a.abonado_mes })), atrasados: r.atrasados.total } };
  const { error } = await supabase.from('fin_cierres').upsert(fila, { onConflict: 'mes' });
  return error ? { error: error.message } : { ok: true, cierre: fila };
}


/* ── FLUJO DE CAJA SEMANAL (B2) ──
   Semanas del mes (lunes a domingo, recortadas al mes). Entradas: cobrado real (fecha del pago), renovaciones por
   cobrar (proxima_factura), venta nueva aceptada (se espera a 7 días de aceptada). Salidas: gastos por día de cobro (los
   pagados, en la fecha real), adeudos por día de pago (lo que toca), cortes de comisión por paga_el, atrasados en la
   semana 1. Saldo = acumulado de entradas − salidas. */
function flujoSemanal(m: Mes, d: { pagos: any[]; porCobrar: any[]; aceptadas: any[]; aplicables: any[]; cortesMes: any[]; adeudosMes: any[]; atrasados: any[] }) {
  const y = Number(m.slice(0, 4)), mm = Number(m.slice(5, 7)); const ult = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  const dia = (n: number) => `${m}-${String(Math.min(Math.max(1, n), ult)).padStart(2, '0')}`;
  const semanas: any[] = []; let ini = 1;
  while (ini <= ult) { const dt = new Date(Date.UTC(y, mm - 1, ini)); const dow = (dt.getUTCDay() + 6) % 7; const fin = Math.min(ult, ini + (6 - dow)); semanas.push({ desde: dia(ini), hasta: dia(fin), entradas: [] as any[], salidas: [] as any[] }); ini = fin + 1; }
  const sem = (fecha: string) => { const f = String(fecha).slice(0, 10); if (f < semanas[0].desde) return semanas[0]; if (f > semanas[semanas.length - 1].hasta) return semanas[semanas.length - 1]; return semanas.find(s => f >= s.desde && f <= s.hasta) || semanas[semanas.length - 1]; };
  for (const p of d.pagos) sem(p.fecha).entradas.push({ tipo: 'cobrado', que: p.companies?.nombre_comercial || p.companies?.nombre || p.contacts?.nombre || 'Pago', monto: Number(p.neto ?? p.monto), fecha: p.fecha, real: true });
  // Una parcialidad vencida de un mes anterior cae en la semana 1 (sem() topa
  // las fechas fuera de rango): se puede cobrar hoy, así que ahí se ve.
  for (const s of d.porCobrar) sem(s.proxima_factura).entradas.push({ tipo: s.tipo === 'parcialidad' ? 'parcialidad' : 'renovacion', que: s.companies?.nombre_comercial || s.companies?.nombre || s.contacts?.nombre || (s.tipo === 'parcialidad' ? 'Pago diferido' : 'Renovación'), monto: s.monto, fecha: s.proxima_factura, real: false });
  for (const q of d.aceptadas) { const f = new Date(Date.parse(q.aceptado_fecha || q.created_at) + 7 * 86400e3).toISOString().slice(0, 10); if (f.slice(0, 7) === m) sem(f).entradas.push({ tipo: 'venta', que: q.companies?.nombre_comercial || q.companies?.nombre || q.contacts?.nombre || 'Venta', monto: q.monto, fecha: f, real: false }); }
  for (const g of d.aplicables) { const f = g.pago ? String(g.pago.pagado_at).slice(0, 10) : dia(Number(g.dia_cobro) || ult); sem(f).salidas.push({ tipo: g.categoria, que: g.nombre, monto: Number(g.pago?.monto ?? g.monto), fecha: f, real: !!g.pago }); }
  for (const a of d.adeudosMes) if (a.toca_este_mes > 0) sem(dia(Number(a.dia_pago) || ult)).salidas.push({ tipo: 'adeudo', que: a.nombre, monto: a.toca_este_mes, fecha: dia(Number(a.dia_pago) || ult), real: a.abonado_mes >= a.toca_este_mes });
  for (const c of d.cortesMes) sem(c.paga_el).salidas.push({ tipo: 'comision', que: `Comisión ${c.vendedor}`, monto: c.monto, fecha: c.paga_el, real: c.pagado });
  for (const g of d.atrasados) semanas[0].salidas.push({ tipo: 'atrasado', que: `${g.nombre} (${g.mes})`, monto: Number(g.monto), fecha: semanas[0].desde, real: false });
  let acum = 0;
  return semanas.map((s, i) => { const e = s.entradas.reduce((a: number, x: any) => a + x.monto, 0); const o = s.salidas.reduce((a: number, x: any) => a + x.monto, 0); acum += e - o; return { n: i + 1, desde: s.desde, hasta: s.hasta, entradas: e, salidas: o, neto: e - o, acumulado: acum, detalle_entradas: s.entradas.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)), detalle_salidas: s.salidas.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)) }; });
}


/** Detalle de UNA oportunidad para el modal: cotización con vistas, actividades, contacto y si es expansión. */
export async function detalleOportunidad(dealId: string) {
  const { data: d } = await supabase.from('deals').select('*, companies(id, nombre_comercial, nombre, giro, sucursales), contacts(id, nombre, apellido, email, whatsapp, fuente, created_at, lifecycle_stage, giro), team_members:owner_id(nombre)').eq('id', dealId).maybeSingle();
  if (!d) return null;
  const [{ data: q }, { data: vistas }, { data: acts }, { data: subs }, { data: otras }] = await Promise.all([
    d.quote_id ? supabase.from('quotes').select('id, numero, estado, total, items, vistas, primera_vista_at, ultima_vista_at, vigencia, created_at, plan, sucursales, periodo').eq('id', d.quote_id).maybeSingle() : Promise.resolve({ data: null as any }),
    d.quote_id ? supabase.from('quote_vistas').select('created_at, segundos').eq('quote_id', d.quote_id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] as any[] }),
    d.contact_id ? supabase.from('activities').select('id, tipo, titulo, descripcion, created_at').eq('contact_id', d.contact_id).order('created_at', { ascending: false }).limit(12) : Promise.resolve({ data: [] as any[] }),
    d.company_id ? supabase.from('subscriptions').select('id, nombre_plan, mrr, estado').eq('company_id', d.company_id).eq('estado', 'activa') : Promise.resolve({ data: [] as any[] }),
    d.contact_id ? supabase.from('deals').select('id, nombre, stage, valor_total, created_at').eq('contact_id', d.contact_id).neq('id', dealId).is('archived_at', null) : Promise.resolve({ data: [] as any[] }),
  ]);
  const PROB: Record<string, number> = { calificacion: 20, demo_agendada: 40, demo_realizada: 50, cotizacion_enviada: 60, negociacion: 75, aceptada: 90 };
  const probEfectiva = d.probabilidad != null && Number(d.probabilidad) !== 20 ? Number(d.probabilidad) : (PROB[d.stage] ?? 30);
  return { deal: d, prob_efectiva: probEfectiva, prob_manual: d.probabilidad != null && Number(d.probabilidad) !== 20, cotizacion: q, vistas: vistas || [], actividades: acts || [], suscripciones_activas: subs || [], expansion: (subs || []).length > 0, otras_oportunidades: otras || [], url_cotizacion: d.quote_id ? `https://www.sacscloud.com/cotizacion/${d.quote_id}` : null };
}

/** Editar desde el modal: probabilidad, fecha de cierre, etapa (perder exige motivo), siguiente paso. Deja historial en activities. */
export async function editarOportunidad(dealId: string, cambios: any, userId?: string | null) {
  const { data: prev } = await supabase.from('deals').select('id, contact_id, company_id, stage, probabilidad, fecha_cierre_esperada, proximo_paso, motivo_perdida').eq('id', dealId).maybeSingle();
  if (!prev) return { error: 'No existe' };
  const upd: any = { stage_changed_at: undefined };
  if (cambios.probabilidad != null) upd.probabilidad = Math.max(0, Math.min(100, Number(cambios.probabilidad)));
  if ('fecha_cierre_esperada' in cambios) upd.fecha_cierre_esperada = cambios.fecha_cierre_esperada || null;
  if ('proximo_paso' in cambios) upd.proximo_paso = cambios.proximo_paso || null;
  if ('proximo_paso_at' in cambios) upd.proximo_paso_at = cambios.proximo_paso_at || null;
  if (cambios.stage && cambios.stage !== prev.stage) {
    if (/perdid/i.test(cambios.stage) && !String(cambios.motivo_perdida || '').trim()) return { error: 'Escribe por qué se perdió: es lo único que después permite corregir precio, producto o seguimiento.' };
    upd.stage = cambios.stage; upd.stage_changed_at = new Date().toISOString();
    if (/perdid/i.test(cambios.stage)) { upd.motivo_perdida = cambios.motivo_perdida; upd.closed_at = new Date().toISOString(); }
  }
  delete upd.stage_changed_at; if (cambios.stage && cambios.stage !== prev.stage) upd.stage_changed_at = new Date().toISOString();
  const { error } = await supabase.from('deals').update(upd).eq('id', dealId);
  if (error) return { error: error.message };
  const dif = Object.entries(upd).filter(([k]) => k !== 'stage_changed_at' && k !== 'closed_at').map(([k, v]) => `${k}: ${(prev as any)[k] ?? '—'} → ${v ?? '—'}`);
  if (dif.length) await supabase.from('activities').insert({ contact_id: prev.contact_id, company_id: prev.company_id, deal_id: dealId, tipo: 'deal_cambio', titulo: 'Oportunidad actualizada', descripcion: dif.join(' · '), created_by: userId || null, automatico: false }).then(() => {}, () => {});
  return { ok: true };
}
