// GET /api/revenue/quotes/kpis → los 5 números del MES de Cotizaciones.
//
// Se calculan en el servidor porque dos de ellos necesitan los ABONOS
// (payments ligados a la cotización) y el front solo tiene las cotizaciones. Si
// se hicieran ahí, "pendiente" ignoraría los pagos parciales y "pagado" contaría
// solo lo liquidado — justo los dos casos que importan cuando alguien deja
// anticipo.
//
// Tres decisiones de criterio:
//  · "del mes" = cotización CREADA este mes (1 al último día, hora de México).
//    El cierre contable se hace por lo generado en el periodo.
//  · "pagado este mes" es la excepción a propósito: cuenta el dinero que ENTRÓ
//    este mes aunque la cotización sea de marzo. Es flujo, no generación.
//  · las archivadas y las plantillas no existen para ningún número.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ACTIVAS = ['draft', 'sent', 'accepted'];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Primer día del mes en hora de México, en ISO. Usar UTC corrido movería al mes
 *  anterior todo lo creado el día 1 antes de las 6 de la mañana. */
function rangoMes(offset = 0) {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const ini = new Date(ahora.getFullYear(), ahora.getMonth() + offset, 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + offset + 1, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desde: iso(ini), hasta: iso(fin) };
}

export const GET: APIRoute = async () => {
  const mes = rangoMes(0);
  const previo = rangoMes(-1);

  const [{ data: quotes }, { data: pagos }] = await Promise.all([
    supabase.from('quotes')
      .select('id, total, estado, created_at')
      .not('estado', 'in', '(deleted,plantilla)')
      .gte('created_at', previo.desde).lt('created_at', mes.hasta),
    // Todos los abonos ligados a cotizaciones: los del mes para el flujo, y los
    // anteriores porque un anticipo de marzo reduce el saldo de hoy.
    supabase.from('payments').select('quote_id, monto, fecha').not('quote_id', 'is', null).limit(5000),
  ]);

  const delMes = (q: any) => q.created_at >= mes.desde && q.created_at < mes.hasta;
  const delPrevio = (q: any) => q.created_at >= previo.desde && q.created_at < previo.hasta;
  const qMes = (quotes || []).filter(delMes);
  const qPrev = (quotes || []).filter(delPrevio);

  const abonadoPorQuote = new Map<string, number>();
  for (const p of pagos || []) {
    abonadoPorQuote.set(p.quote_id, (abonadoPorQuote.get(p.quote_id) || 0) + Number(p.monto || 0));
  }

  // 1 · Cotizado este mes
  const cotizado = qMes.reduce((a, q) => a + Number(q.total || 0), 0);
  const cotizadoPrev = qPrev.reduce((a, q) => a + Number(q.total || 0), 0);

  // 2 · Pendiente de pago del mes — SALDO, no total: si dejó anticipo, lo que
  //     falta es lo que falta.
  const activasMes = qMes.filter(q => ACTIVAS.includes(q.estado));
  let pendiente = 0, conParcial = 0;
  for (const q of activasMes) {
    const ab = abonadoPorQuote.get(q.id) || 0;
    const saldo = Math.max(0, Number(q.total || 0) - ab);
    pendiente += saldo;
    if (ab > 0 && saldo > 0) conParcial++;
  }

  // 3 · Pagado este mes — dinero que ENTRÓ, completos y abonos.
  const pagosMes = (pagos || []).filter((p: any) => {
    const f = String(p.fecha || '').slice(0, 10);
    return f >= mes.desde && f < mes.hasta;
  });
  const pagado = pagosMes.reduce((a: number, p: any) => a + Number(p.monto || 0), 0);
  const cotizacionesConPago = new Set(pagosMes.map((p: any) => p.quote_id)).size;

  // 5 · Ticket promedio del mes
  const ticket = qMes.length ? cotizado / qMes.length : 0;
  const ticketPrev = qPrev.length ? cotizadoPrev / qPrev.length : 0;

  // Variación: sin base con qué comparar, no se inventa un "+100%".
  const variacion = (hoy: number, antes: number) => (antes > 0 ? Math.round(((hoy - antes) / antes) * 100) : null);

  return json({
    mes,
    cotizado: { monto: r2(cotizado), variacion: variacion(cotizado, cotizadoPrev), mes_anterior: r2(cotizadoPrev), cotizaciones: qMes.length },
    pendiente: { monto: r2(pendiente), activas: activasMes.length, con_parcial: conParcial },
    pagado: { monto: r2(pagado), cotizaciones: cotizacionesConPago },
    activas: { total: activasMes.length },
    ticket: { monto: r2(ticket), variacion: variacion(ticket, ticketPrev), mes_anterior: r2(ticketPrev) },
  });
};
