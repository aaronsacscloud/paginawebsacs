import { conMicroCache } from '../../../../lib/crm/micro-cache';
// GET /api/revenue/quotes/kpis → los números del MES de Cotizaciones.
//
// Se calculan en el servidor porque casi todos necesitan los ABONOS (payments
// ligados a la cotización) y el front solo tiene las cotizaciones. Si se
// hicieran ahí, "cerrado" ignoraría los anticipos y "por cobrar" contaría el
// total en vez del saldo — justo los dos casos que importan.
//
// Los criterios, que son el punto:
//
//  · COTIZADO = cotización creada este mes. Termómetro de actividad.
//  · CERRADO = el cliente dijo que sí ESTE MES. La fecha del cierre es la del
//    PAGO REGISTRADO (el primer abono), no la de captura: marcar hoy como
//    pagada una cotización cuyo pago fue en julio no la vuelve venta de agosto.
//    Sin ningún pago, manda la fecha de aceptación. Las parcialidades entran
//    completas: Ruben's aceptó y dejó anticipo, la venta está cerrada aunque el
//    resto se cobre después.
//  · COBRADO = dinero que ENTRÓ este mes, anticipos incluidos. Es lo único que
//    se compara contra el banco.
//  · POR COBRAR = lo exigible DENTRO del mes en curso, y SOLO donde hay una
//    fecha acordada: las exhibiciones del plan de pagos. Un saldo ganado sin
//    fechas no está vencido —la vigencia es la caducidad del PRECIO, no la de un
//    pago— y contarlo como atrasado acusa al cliente de algo que nadie le pidió.
//    Lo que toca en noviembre tampoco se cobra hoy: entra en su mes.
//  · EN PAGO PARCIAL = cuánto se abonó, cuánto falta y CUÁNDO toca cada
//    exhibición.
//
// Las archivadas y las plantillas no existen para ningún número.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { planDeCotizacion } from '../../../../lib/quotes/plan';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (x: any) => Number(x || 0);

/** Primer día del mes en hora de México. Usar UTC corrido movería al mes
 *  anterior todo lo creado el día 1 antes de las 6 de la mañana. */
function rangoMes(offset = 0) {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const ini = new Date(ahora.getFullYear(), ahora.getMonth() + offset, 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + offset + 1, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desde: iso(ini), hasta: iso(fin) };
}
const hoyMx = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const _GET: APIRoute = async () => {
  const mes = rangoMes(0);
  const previo = rangoMes(-1);
  const hoy = hoyMx();

  const [{ data: quotes }, { data: pagos }, { data: exhibiciones }] = await Promise.all([
    supabase.from('quotes')
      .select('id, numero, empresa, total, estado, created_at, aceptado_fecha, pagado_fecha, vigencia, company_id, notas')
      .not('estado', 'in', '(deleted,plantilla)').limit(2000),
    supabase.from('payments').select('id, quote_id, monto, fecha, metodo')
      .not('quote_id', 'is', null).neq('estado', 'reembolsado').limit(5000),
    // Las parcialidades acordadas: es lo que convierte "falta cobrar" en
    // "falta cobrar el 15 de octubre".
    supabase.from('cobros_programados').select('id, quote_id, numero, total, fecha, monto, estado')
      .not('quote_id', 'is', null).neq('estado', 'cancelada').order('fecha'),
  ]);

  const abonos = new Map<string, { total: number; primero: string | null; lista: any[] }>();
  for (const p of pagos || []) {
    const f = String(p.fecha || '').slice(0, 10);
    const a = abonos.get(p.quote_id) || { total: 0, primero: null, lista: [] };
    a.total += num(p.monto);
    a.lista.push(p);
    if (!a.primero || f < a.primero) a.primero = f;
    abonos.set(p.quote_id, a);
  }
  const planes = new Map<string, any[]>();
  for (const c of exhibiciones || []) {
    const l = planes.get(c.quote_id) || [];
    l.push(c); planes.set(c.quote_id, l);
  }
  // Y las parcialidades pactadas AL COTIZAR, que viven en el meta de la
  // cotización. Son las que el vendedor captura en el editor; ignorarlas dejaba
  // la proyección del mes en ceros aunque las fechas estuvieran acordadas.
  for (const q of quotes || []) {
    if (planes.has(q.id)) continue;
    const p = planDeCotizacion(q, abonos.get(q.id)?.total || 0, hoy);
    if (p.length) planes.set(q.id, p.map(x => ({
      quote_id: q.id, numero: x.numero, total: x.total, fecha: x.fecha,
      monto: x.monto > 0 ? x.monto : x.monto_original, estado: x.estado,
    })));
  }

  const enMes = (f?: string | null, r = mes) => !!f && String(f).slice(0, 10) >= r.desde && String(f).slice(0, 10) < r.hasta;
  const qs = quotes || [];

  // ── 1 · Cotizado este mes ──
  const delMes = qs.filter(q => enMes(q.created_at));
  const delPrevio = qs.filter(q => enMes(q.created_at, previo));
  const cotizado = delMes.reduce((a, q) => a + num(q.total), 0);
  const cotizadoPrev = delPrevio.reduce((a, q) => a + num(q.total), 0);

  // ── 2 · Cerrado este mes ──
  // La fecha del cierre es la del primer pago registrado; sin pagos, la de
  // aceptación. Nunca la de captura.
  const cerradas = qs.map(q => {
    const ab = abonos.get(q.id);
    const cierre = ab?.primero || (q.aceptado_fecha ? String(q.aceptado_fecha).slice(0, 10) : null);
    const cerrada = !!ab || ['accepted', 'paid'].includes(String(q.estado));
    return { q, cierre, cerrada, abonado: ab?.total || 0 };
  }).filter(x => x.cerrada && enMes(x.cierre));
  const cerrado = cerradas.reduce((a, x) => a + num(x.q.total), 0);
  const cerradasPrev = qs.map(q => {
    const ab = abonos.get(q.id);
    const cierre = ab?.primero || (q.aceptado_fecha ? String(q.aceptado_fecha).slice(0, 10) : null);
    const cerrada = !!ab || ['accepted', 'paid'].includes(String(q.estado));
    return { q, cierre, cerrada };
  }).filter(x => x.cerrada && enMes(x.cierre, previo));
  const cerradoPrev = cerradasPrev.reduce((a, x) => a + num(x.q.total), 0);

  // ── 3 · Cobrado este mes ──
  const pagosMes = (pagos || []).filter((p: any) => enMes(p.fecha));
  const cobrado = pagosMes.reduce((a: number, p: any) => a + num(p.monto), 0);
  const anticipos = pagosMes.filter((p: any) => {
    const q = qs.find(x => x.id === p.quote_id);
    const ab = abonos.get(p.quote_id);
    return q && ab && ab.total < num(q.total) - 0.5;   // no liquida: es anticipo
  });

  // ── 4 · Por cobrar dentro del mes ──
  // Manda la fecha de cada exhibición acordada. Sin plan no hay fecha, y sin
  // fecha nada está vencido.
  const finMes = mes.hasta;   // exclusivo
  const porCobrar: any[] = [];
  const sinFechas: any[] = [];
  for (const q of qs) {
    const ab = abonos.get(q.id)?.total || 0;
    const saldo = r2(num(q.total) - ab);
    if (saldo <= 0.5) continue;
    const cerrada = ab > 0 || String(q.estado) === 'accepted';
    if (!cerrada) continue;                     // sin un sí, no es cobranza
    const plan = (planes.get(q.id) || []).filter((x: any) => x.estado === 'pendiente');
    if (!plan.length) {
      // Ganada pero sin plan: hay saldo y no hay fecha. No se cuenta —ni como
      // exigible ni como vencido—, se nombra aparte para poder acordarla.
      sinFechas.push({ quote: q, saldo });
      continue;
    }
    for (const x of plan) {
      const f = String(x.fecha).slice(0, 10);
      if (f < finMes) porCobrar.push({ quote: q, monto: num(x.monto), fecha: f, exhibicion: `${x.numero} de ${x.total}`, vencido: f < hoy });
    }
  }
  const porCobrarMonto = porCobrar.reduce((a, x) => a + x.monto, 0);
  const porCobrarVencido = porCobrar.filter(x => x.vencido).reduce((a, x) => a + x.monto, 0);

  // ── 5 · En pago parcial ──
  const parciales = qs.map(q => {
    const ab = abonos.get(q.id)?.total || 0;
    const saldo = r2(num(q.total) - ab);
    const plan = (planes.get(q.id) || []);
    return { q, ab, saldo, plan };
  }).filter(x => x.ab > 0 && x.saldo > 0.5);
  const parcialFalta = parciales.reduce((a, x) => a + x.saldo, 0);
  const parcialAbonado = parciales.reduce((a, x) => a + x.ab, 0);

  // ── 6 · Cierre ──
  // De lo cotizado ESTE MES, cuánto ya se cerró y cuánto ya se pagó completo.
  // Es la única tarjeta que habla de conversión, y se mide sobre las mismas
  // cotizaciones: comparar contra el mes anterior mezclaría dos poblaciones.
  const idsMes = new Set(delMes.map(q => q.id));
  const cerradasDelMes = delMes.filter(q => {
    const ab = abonos.get(q.id);
    return !!ab || ['accepted', 'paid'].includes(String(q.estado));
  });
  const pagadasDelMes = delMes.filter(q => (abonos.get(q.id)?.total || 0) >= num(q.total) - 0.5);
  const montoCerradoDelMes = cerradasDelMes.reduce((a, q) => a + num(q.total), 0);

  const variacion = (h: number, a: number) => (a > 0 ? Math.round(((h - a) / a) * 100) : null);
  const ficha = (q: any) => ({ id: q.id, numero: q.numero, empresa: q.empresa, total: Math.round(num(q.total)), estado: q.estado });

  return json({
    mes, hoy,
    cotizado: {
      monto: r2(cotizado), variacion: variacion(cotizado, cotizadoPrev), mes_anterior: r2(cotizadoPrev),
      cotizaciones: delMes.length,
      detalle: delMes.map(q => ({ ...ficha(q), fecha: String(q.created_at).slice(0, 10) })),
    },
    cerrado: {
      monto: r2(cerrado), variacion: variacion(cerrado, cerradoPrev), mes_anterior: r2(cerradoPrev),
      cotizaciones: cerradas.length,
      con_anticipo: cerradas.filter(x => x.abonado > 0 && x.abonado < num(x.q.total) - 0.5).length,
      // Cerrado no es una sola cosa: una liquidada ya no da trabajo y una en
      // parcialidades sigue teniendo cobranza detrás. Se separan para poder
      // mirar solo la que falta.
      liquidado: r2(cerradas.filter(x => x.abonado >= num(x.q.total) - 0.5).reduce((a, x) => a + num(x.q.total), 0)),
      en_parcialidades: r2(cerradas.filter(x => x.abonado < num(x.q.total) - 0.5).reduce((a, x) => a + num(x.q.total), 0)),
      detalle: cerradas.map(x => ({
        ...ficha(x.q), fecha: x.cierre,
        abonado: Math.round(x.abonado), saldo: Math.round(num(x.q.total) - x.abonado),
        grupo: x.abonado >= num(x.q.total) - 0.5 ? 'Liquidadas' : 'En parcialidades',
        exhibiciones: (planes.get(x.q.id) || []).map((c: any) => ({ numero: c.numero, total: c.total, fecha: String(c.fecha).slice(0, 10), monto: Math.round(num(c.monto)), estado: c.estado })),
      })).sort((a, b) => a.grupo.localeCompare(b.grupo) || String(b.fecha).localeCompare(String(a.fecha))),
    },
    cobrado: {
      monto: r2(cobrado), cotizaciones: new Set(pagosMes.map((p: any) => p.quote_id)).size,
      anticipos: r2(anticipos.reduce((a: number, p: any) => a + num(p.monto), 0)),
      detalle: pagosMes.map((p: any) => {
        const q = qs.find(x => x.id === p.quote_id);
        return {
          id: p.id, fecha: String(p.fecha).slice(0, 10), monto: Math.round(num(p.monto)), metodo: p.metodo || '—',
          numero: q?.numero || '—', empresa: q?.empresa || 'Sin cotización',
          anticipo: anticipos.some((a: any) => a.id === p.id),
        };
      }).sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
    },
    por_cobrar: {
      monto: r2(porCobrarMonto), vencido: r2(porCobrarVencido), n: porCobrar.length,
      // Ganado con saldo y sin fechas acordadas: no es deuda vencida, es un
      // plan que falta acordar.
      sin_fechas: sinFechas.length,
      sin_fechas_monto: r2(sinFechas.reduce((a, x) => a + x.saldo, 0)),
      detalle: porCobrar.map(x => ({ ...ficha(x.quote), monto: Math.round(x.monto), fecha: x.fecha, exhibicion: x.exhibicion, vencido: x.vencido }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
      detalle_sin_fechas: sinFechas.map(x => ({ ...ficha(x.quote), monto: Math.round(x.saldo) })),
    },
    cierre: {
      pct: delMes.length ? Math.round((cerradasDelMes.length / delMes.length) * 100) : null,
      pct_pagadas: delMes.length ? Math.round((pagadasDelMes.length / delMes.length) * 100) : null,
      cerradas: cerradasDelMes.length, pagadas: pagadasDelMes.length, generadas: delMes.length,
      monto_cerrado: r2(montoCerradoDelMes), monto_generado: r2(cotizado),
      detalle: delMes.map(q => {
        const ab = abonos.get(q.id)?.total || 0;
        const liq = ab >= num(q.total) - 0.5;
        const cerr = ab > 0 || ['accepted', 'paid'].includes(String(q.estado));
        return { ...ficha(q), fecha: String(q.created_at).slice(0, 10), abonado: Math.round(ab), grupo: liq ? 'Pagadas' : cerr ? 'Cerradas sin liquidar' : 'Abiertas' };
      }).sort((a, b) => a.grupo.localeCompare(b.grupo)),
    },
    parcial: {
      falta: r2(parcialFalta), abonado: r2(parcialAbonado), n: parciales.length,
      con_plan: parciales.filter(x => x.plan.length).length,
      detalle: parciales.map(x => ({
        ...ficha(x.q), abonado: Math.round(x.ab), saldo: Math.round(x.saldo),
        // Las fechas específicas de cada exhibición, que es lo que convierte
        // "falta cobrar" en una agenda.
        exhibiciones: x.plan.map((c: any) => ({ numero: c.numero, total: c.total, fecha: String(c.fecha).slice(0, 10), monto: Math.round(num(c.monto)), estado: c.estado })),
      })).sort((a, b) => b.saldo - a.saldo),
    },
  });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 60s en la instancia.
export const GET = conMicroCache('revenue/kpis', 60000, _GET as any);
