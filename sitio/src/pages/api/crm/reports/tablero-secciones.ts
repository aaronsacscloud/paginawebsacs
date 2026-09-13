// GET /api/crm/reports/tablero-secciones?desde=&hasta=
//
// Lo que el tablero nuevo necesita y NO existía en ningún lado. Todo lo demás
// —el dinero cobrado, la meta, el ARR, la cobranza, el embudo de leads— se
// sigue leyendo de `reports/tablero` y de `leads/resumen`: si cada pantalla
// recalcula por su cuenta, tarde o temprano dos pantallas dicen números
// distintos del mismo mes y ya no se puede confiar en ninguna.
//
// Aquí viven tres cosas nuevas:
//
//  · CONSULTORÍA por junta: cuántas cuentas distintas atendiste, qué
//    cotizaste en el periodo y la cartera cuenta por cuenta (cobrado,
//    pendiente y qué sigue).
//  · POR DÓNDE PASÓ: reuniones, conversaciones de WhatsApp y llamadas del
//    periodo. Es el único bloque que mezcla los tres canales.
//  · RECURRENCIA: quién vuelve a comprar, cada cuánto, qué se renueva y quién
//    lleva meses sin moverse.
//
// Dos definiciones que cambian el resultado, y por eso se escriben:
//
//  · RECURRENTE es la cuenta con DOS O MÁS pagos en su historia, no la que
//    lleva mucho tiempo. Una vitalicia de hace tres años que pagó una vez no
//    es recurrencia: es antigüedad.
//  · La FRECUENCIA es la mediana de días entre pagos consecutivos, no el
//    promedio: un solo cliente que pagó dos veces en la misma semana mueve el
//    promedio y deja de describir a nadie.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conMicroCache } from '../../../../lib/crm/micro-cache';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dia = (f: any) => String(f || '').slice(0, 10);
const num = (x: any) => Number(x || 0);
const masDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
/* Cotización que sigue en pie: ni borrador, ni borrada, ni plantilla. La misma
   regla que usa `reports/tablero`, copiada a propósito para que las dos
   pantallas cuenten lo mismo. */
const VIVA = (q: any) => !['draft', 'deleted', 'plantilla'].includes(q.estado);

const _GET: APIRoute = async ({ url }) => {
  const hoy = iso(new Date());
  const mesIni = hoy.slice(0, 8) + '01';
  const hasta = (url.searchParams.get('hasta') || hoy).slice(0, 10);
  const desde = (url.searchParams.get('desde') || mesIni).slice(0, 10);

  const [compQ, bookQ, quotesQ, payQ, payTodosQ, subsQ, ideasQ, waQ, llQ] = await Promise.all([
    supabase.from('companies')
      .select('id, nombre, nombre_comercial, estado_cuenta, arr, dias_sin_venta, ultima_venta_at, months_active')
      .is('archived_at', null),
    supabase.from('bookings').select('id, fecha, company_id, estado').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('quotes').select('id, numero, empresa, total, estado, created_at, pagado_fecha, company_id, plan'),
    supabase.from('payments').select('id, monto, fecha, company_id, quote_id, subscription_id')
      .gte('fecha', desde).lte('fecha', hasta)
      .not('estado', 'in', '(reembolsado,duplicado)').not('reembolsado', 'is', true),
    // El historial completo de pagos, solo con lo justo para contar recompras y
    // medir cada cuánto vuelve una cuenta.
    supabase.from('payments').select('company_id, fecha')
      .not('estado', 'in', '(reembolsado,duplicado)').not('reembolsado', 'is', true),
    supabase.from('subscriptions').select('id, company_id, nombre_plan, estado, arr, monto_proximo, proxima_factura, ciclo'),
    // Las ideas que salieron de las juntas y nadie ha cotizado: es la expansión
    // que ya te pidieron, no una que alguien supuso.
    supabase.from('mejoras').select('id, titulo, estado, company_id, quote_id, created_at')
      .is('archived_at', null).is('quote_id', null),
    supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true })
      .gte('ultimo_mensaje_at', desde).lte('ultimo_mensaje_at', hasta + 'T23:59:59'),
    supabase.from('wa_llamadas').select('id', { count: 'exact', head: true })
      .gte('created_at', desde).lte('created_at', hasta + 'T23:59:59'),
  ]);

  const empresas = compQ.data || [];
  const nombreDe: Record<string, string> = {};
  empresas.forEach((c: any) => { nombreDe[c.id] = c.nombre_comercial || c.nombre; });

  const juntas = (bookQ.data || []).filter((b: any) => !['cancelada', 'no_asistio'].includes(b.estado));
  const cuentasConJunta = new Set(juntas.map((b: any) => b.company_id).filter(Boolean));

  const quotes = (quotesQ.data || []).filter(VIVA);
  const generadas = quotes.filter((q: any) => dia(q.created_at) >= desde && dia(q.created_at) <= hasta);
  const pendientes = quotes.filter((q: any) => ['sent', 'accepted', 'parcial'].includes(q.estado));

  const pagos = payQ.data || [];
  const cobrado = Math.round(pagos.reduce((a: number, p: any) => a + num(p.monto), 0));

  /* ══ La cartera de consultoría: una línea por cuenta ══
     Se arma sobre las cuentas que tuvieron JUNTA en el periodo —es la sección
     de consultoría, no la de cobranza— y se completa con lo que pagaron y lo
     que deben. Una cuenta con junta y sin cobro sigue apareciendo: ese hueco
     es justo lo que hay que ver. */
  const cobradoPorCuenta: Record<string, number> = {};
  pagos.forEach((p: any) => { if (p.company_id) cobradoPorCuenta[p.company_id] = (cobradoPorCuenta[p.company_id] || 0) + num(p.monto); });
  const pendientePorCuenta: Record<string, { monto: number; vencida: boolean }> = {};
  pendientes.forEach((q: any) => {
    if (!q.company_id) return;
    const v = pendientePorCuenta[q.company_id] || { monto: 0, vencida: false };
    v.monto += num(q.total);
    if (q.vigencia && dia(q.vigencia) < hoy) v.vencida = true;
    pendientePorCuenta[q.company_id] = v;
  });
  const ideas = (ideasQ.data || []).filter((m: any) => ['idea', 'propuesta'].includes(String(m.estado)));
  const ideasPorCuenta: Record<string, number> = {};
  ideas.forEach((m: any) => { if (m.company_id) ideasPorCuenta[m.company_id] = (ideasPorCuenta[m.company_id] || 0) + 1; });

  const cartera = [...cuentasConJunta].map((id: any) => {
    const pen = pendientePorCuenta[id] || { monto: 0, vencida: false };
    const cob = Math.round(cobradoPorCuenta[id] || 0);
    const idea = ideasPorCuenta[id] || 0;
    /* El estado sale de los hechos, no de un campo que alguien mueve a mano:
       primero lo vencido, luego lo que se debe, luego la idea sin cotizar. */
    const estado = pen.vencida ? 'vencida' : pen.monto > 0 ? 'por_cobrar' : idea > 0 ? 'idea' : 'al_dia';
    const accion = pen.vencida ? 'Llamar hoy: cotización vencida'
      : pen.monto > 0 ? 'Recordar el pago'
      : idea > 0 ? `Cotizar ${idea === 1 ? 'la idea' : `las ${idea} ideas`} de la junta`
      : 'Agendar la siguiente junta';
    return { company_id: id, nombre: nombreDe[id] || 'Cuenta', cobrado: cob, pendiente: Math.round(pen.monto), ideas: idea, estado, accion };
  }).sort((a, b) => (b.cobrado - a.cobrado) || (b.pendiente - a.pendiente));

  /* ══ Servicios: de dónde viene el dinero cobrado ══
     El plan de la cotización que cubrió el pago. Los pagos sueltos —los que no
     cuelgan de ninguna cotización— van en su propio renglón en vez de
     repartirse a ojo entre los demás. */
  const planDeQuote: Record<string, string> = {};
  // Sin plan capturado el cobro no se puede partir por servicio; se agrupa
  // bajo un nombre que dice lo que es en vez de inventarle un servicio.
  quotes.forEach((q: any) => { planDeQuote[q.id] = q.plan || 'Venta cotizada'; });
  const porServicio: Record<string, number> = {};
  pagos.forEach((p: any) => {
    const k = p.quote_id ? (planDeQuote[p.quote_id] || 'Venta cotizada') : p.subscription_id ? 'Renovación de licencia' : 'Cobro suelto';
    porServicio[k] = (porServicio[k] || 0) + num(p.monto);
  });
  const servicios = Object.entries(porServicio)
    .map(([nombre, monto]) => ({ nombre, monto: Math.round(monto) }))
    .sort((a, b) => b.monto - a.monto).slice(0, 6);

  /* ══ Recurrencia ══ */
  const pagosPorCuenta: Record<string, string[]> = {};
  (payTodosQ.data || []).forEach((p: any) => {
    if (!p.company_id) return;
    (pagosPorCuenta[p.company_id] = pagosPorCuenta[p.company_id] || []).push(dia(p.fecha));
  });
  const activas = empresas.filter((c: any) => c.estado_cuenta === 'activo');
  const recurrentes = activas.filter((c: any) => (pagosPorCuenta[c.id] || []).length >= 2);
  // Recompras DEL PERIODO: cuentas que ya habían pagado antes y volvieron a pagar ahora.
  const recompras = Object.entries(cobradoPorCuenta).filter(([id]) => {
    const f = (pagosPorCuenta[id] || []).slice().sort();
    return f.length >= 2 && f[0] < desde;
  });
  // Frecuencia: la mediana de los huecos entre pagos consecutivos.
  const huecos: number[] = [];
  Object.values(pagosPorCuenta).forEach(fs => {
    const o = fs.slice().sort();
    for (let i = 1; i < o.length; i++) {
      const d = (Date.parse(o[i]) - Date.parse(o[i - 1])) / 86400000;
      if (d > 0 && d < 800) huecos.push(d);
    }
  });
  huecos.sort((a, b) => a - b);
  const medianaDias = huecos.length ? huecos[Math.floor(huecos.length / 2)] : null;

  const renovaciones = (subsQ.data || [])
    .filter((s: any) => s.estado === 'activa' && s.proxima_factura && dia(s.proxima_factura) >= hoy && dia(s.proxima_factura) <= masDias(60))
    .map((s: any) => ({
      nombre: nombreDe[s.company_id] || 'Cuenta', fecha: dia(s.proxima_factura),
      monto: Math.round(num(s.monto_proximo) || num(s.arr) / (s.ciclo === 'mensual' ? 12 : 1)),
      plan: s.nombre_plan || null,
    }))
    .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));

  const sinMovimiento = activas
    .filter((c: any) => num(c.dias_sin_venta) >= 60)
    .map((c: any) => ({ nombre: nombreDe[c.id], dias: Math.round(num(c.dias_sin_venta)), arr: Math.round(num(c.arr)), company_id: c.id }))
    .sort((a: any, b: any) => b.dias - a.dias);

  /* Expansión: la idea que salió de una junta y nadie cotizó. No es una
     corazonada del sistema — es algo que el cliente ya pidió. */
  const expansion = Object.entries(ideasPorCuenta)
    .filter(([id]) => nombreDe[id])
    .map(([id, n]) => ({
      company_id: id, nombre: nombreDe[id], ideas: n,
      titulo: (ideas.find((m: any) => m.company_id === id) || {}).titulo || null,
    }))
    .sort((a, b) => b.ideas - a.ideas).slice(0, 8);

  return json({
    periodo: { desde, hasta },
    consultoria: {
      juntas: juntas.length,
      clientes: cuentasConJunta.size,
      clientes_activos: activas.length,
      cotizaciones: { n: generadas.length, monto: Math.round(generadas.reduce((a: number, q: any) => a + num(q.total), 0)) },
      cobrado: { monto: cobrado, n: pagos.length },
      // Ingreso por cliente del periodo: lo cobrado entre las cuentas que
      // pagaron, no entre todas las activas. Son dos números distintos y el de
      // la cartera completa vive en «Clientes».
      ticket: Object.keys(cobradoPorCuenta).length ? Math.round(cobrado / Object.keys(cobradoPorCuenta).length) : 0,
      canales: { reuniones: juntas.length, whatsapp: waQ.count || 0, llamadas: llQ.count || 0 },
      cartera, servicios,
    },
    clientes: {
      activos: activas.length,
      recurrentes: recurrentes.length,
      recurrentes_pct: activas.length ? Math.round((recurrentes.length / activas.length) * 100) : null,
      recompras: { n: recompras.length, monto: Math.round(recompras.reduce((a, [, m]) => a + m, 0)) },
      frecuencia_meses: medianaDias != null ? Math.round((medianaDias / 30.4) * 10) / 10 : null,
      renovaciones, sin_movimiento: sinMovimiento, expansion,
    },
  });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 60s en la instancia.
export const GET = conMicroCache('reports/tablero-secciones', 60000, _GET as any);
