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

  const [compQ, bookQ, quotesQ, payQ, payTodosQ, subsQ, ideasQ, waQ, llQ, planQ, bajasQ, dealsQ] = await Promise.all([
    supabase.from('companies')
      .select('id, nombre, nombre_comercial, estado_cuenta, arr, dias_sin_venta, ultima_venta_at, months_active')
      .is('archived_at', null),
    supabase.from('bookings').select('id, fecha, company_id, estado').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('quotes').select('id, numero, empresa, total, estado, created_at, pagado_fecha, company_id, plan'),
    supabase.from('payments').select('id, monto, fecha, company_id, quote_id, subscription_id')
      .gte('fecha', desde).lte('fecha', hasta)
      .not('estado', 'in', '(reembolsado,duplicado)').not('reembolsado', 'is', true),
    // El historial completo de pagos: sirve para contar recompras, medir cada
    // cuánto vuelve una cuenta y —lo nuevo— saber cuánto se ha cubierto de
    // cada cotización, que es como se detecta una parcialidad.
    supabase.from('payments').select('id, company_id, fecha, monto, quote_id')
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
    // El plan de pagos pactado, cuando existe: es dinero futuro con fecha.
    supabase.from('quote_parcialidades').select('quote_id, numero, fecha, monto, pagada_at').order('numero'),
    // Lo que YA NO va a entrar. Vive en la suscripción y no en la empresa:
    // al cancelar una cuenta su `arr` se pone en cero, así que desde
    // `companies` el ARR perdido se lee como $0 y desaparece del negocio.
    supabase.from('subscriptions').select('company_id, arr, cancelada_at, razon_cancelacion, nombre_plan')
      .in('estado', ['cancelada', 'cancelado']),
    // Oportunidades abiertas, para separar las que ya tienen precio de las que no.
    supabase.from('deals').select('id, valor_total, stage, company_id, created_at, nombre, quote_id')
      .is('archived_at', null),
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

  /* Cómo se reparte la cartera por tipo de licencia: una vitalicia, una anual
     y una mensual valen distinto y se cuidan distinto. */
  const porCiclo: Record<string, { n: number; arr: number }> = {};
  (subsQ.data || []).filter((s2: any) => s2.estado === 'activa').forEach((s2: any) => {
    const k = s2.ciclo || 'sin ciclo';
    porCiclo[k] = porCiclo[k] || { n: 0, arr: 0 };
    porCiclo[k].n++; porCiclo[k].arr += num(s2.arr);
  });

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


  /* ══ EL DINERO, FLUJO POR FLUJO ═══════════════════════════════════════
     Cinco preguntas que antes no tenían dónde contestarse:
     qué entró a medias, qué falta de eso, qué ya no va a entrar, qué dinero
     cobrado no es de nadie y qué oportunidad sigue sin precio. */

  const todosPagos = (payTodosQ.data || []) as any[];
  const plan = (planQ.data || []) as any[];

  // Cuánto se ha cubierto de CADA cotización, sumando sus pagos.
  const cubierto: Record<string, { monto: number; ultimo: string; n: number }> = {};
  todosPagos.forEach((p: any) => {
    if (!p.quote_id) return;
    const v = cubierto[p.quote_id] || { monto: 0, ultimo: '', n: 0 };
    v.monto += num(p.monto); v.n++;
    const f = dia(p.fecha); if (f > v.ultimo) v.ultimo = f;
    cubierto[p.quote_id] = v;
  });

  const planDe: Record<string, any[]> = {};
  plan.forEach((l: any) => { (planDe[l.quote_id] = planDe[l.quote_id] || []).push(l); });

  /* PARCIALIDADES: la cotización que ya recibió dinero pero no está saldada.
     El estado `parcial` existe en el catálogo y NADIE lo usa —cero filas—, así
     que la parcialidad no se lee de un campo: se deduce de los pagos. */
  const TOLERANCIA = 1;   // pesos: un redondeo no convierte una cotización en parcial
  const parcialidades = quotes
    .filter((q: any) => cubierto[q.id] && cubierto[q.id].monto > 0 && cubierto[q.id].monto < num(q.total) - TOLERANCIA)
    .map((q: any) => {
      const c = cubierto[q.id];
      const lineas = (planDe[q.id] || []).map((l: any) => ({
        numero: l.numero, fecha: dia(l.fecha), monto: Math.round(num(l.monto)), pagada: !!l.pagada_at,
      }));
      const pendientes = lineas.filter(l => !l.pagada).sort((a, b) => a.fecha.localeCompare(b.fecha));
      return {
        quote_id: q.id, numero: q.numero, empresa: nombreDe[q.company_id] || q.empresa || 'Cuenta',
        company_id: q.company_id || null, estado: q.estado,
        total: Math.round(num(q.total)), pagado: Math.round(c.monto), saldo: Math.round(num(q.total) - c.monto),
        pagos: c.n, ultimo_pago: c.ultimo,
        dias_sin_pagar: c.ultimo ? Math.round((Date.parse(hoy) - Date.parse(c.ultimo)) / 86400000) : null,
        plan: lineas,
        // El próximo pago pactado. Sin plan capturado no se inventa una fecha:
        // se devuelve nulo y la pantalla pide capturarlo.
        proximo: pendientes[0] || null,
        vencidas: pendientes.filter(l => l.fecha < hoy).length,
      };
    })
    .sort((a, b) => b.saldo - a.saldo);

  const anticipos = parcialidades.reduce((a, p) => a + p.pagado, 0);

  /* POR COBRAR de cotizaciones, en bruto y en NETO. El bruto es lo que decía
     el tablero hasta hoy y está inflado: cuenta completo lo que ya recibió
     anticipo, así que ese dinero aparecía a la vez en «cobrado» y en «por
     cobrar». El neto descuenta lo que ya entró. */
  const brutoPorCobrar = Math.round(pendientes.reduce((a: number, q: any) => a + num(q.total), 0));
  const netoPorCobrar = Math.round(pendientes.reduce((a: number, q: any) =>
    a + Math.max(0, num(q.total) - (cubierto[q.id]?.monto || 0)), 0));

  /* LO QUE YA NO VA A ENTRAR. Se mide de las suscripciones canceladas porque
     al cancelar una cuenta su `arr` se pone en cero: desde `companies`, 36
     cancelaciones suman $0 y el dinero perdido se vuelve invisible. */
  const bajas = (bajasQ.data || []) as any[];
  const haceUnAnio = iso(new Date(Date.now() - 365 * 86400000));
  const bajas12 = bajas.filter((b: any) => b.cancelada_at && dia(b.cancelada_at) >= haceUnAnio);
  const sumaArr = (a: any[]) => Math.round(a.reduce((x: number, b: any) => x + num(b.arr), 0));

  /* PAGOS SIN DUEÑO: dinero que entró y no está atado a ninguna cuenta. Suma
     en el total cobrado pero no aparece en la cartera de nadie, así que nadie
     lo reclama ni lo agradece. */
  const sinDueno = todosPagos.filter((p: any) => !p.company_id);

  /* OPORTUNIDADES: las que ya tienen precio en la mano y las que no. */
  const deals = (dealsQ.data || []) as any[];
  /* «Sin cotizar» se mira por los DOS lados: la cotización que apunta al trato
     y el trato que apunta a la cotización. Con uno solo, los tratos cotizados
     desde la ficha del cliente salían como si no tuvieran precio. */
  const quoteDeDeal = new Set(quotes.map((q: any) => q.deal_id).filter(Boolean));
  const abiertas = deals.filter((d: any) => !String(d.stage || '').startsWith('cerrada'));
  const sinCotizar = abiertas.filter((d: any) => !quoteDeDeal.has(d.id) && !d.quote_id);

  /* LO QUE ENTRA EN LOS PRÓXIMOS 90 DÍAS por parcialidades pactadas: dinero
     futuro con fecha, que hasta hoy no lo sumaba nadie. */
  const en90 = iso(new Date(Date.now() + 90 * 86400000));
  const proximasLineas = parcialidades.flatMap(p => p.plan
    .filter((l: any) => !l.pagada && l.fecha >= hoy && l.fecha <= en90)
    .map((l: any) => ({ ...l, empresa: p.empresa, numero_cotiza: p.numero, quote_id: p.quote_id })));

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
    dinero: {
      parcialidades,
      anticipos,
      por_cobrar: { bruto: brutoPorCobrar, neto: netoPorCobrar, n: pendientes.length, con_anticipo: parcialidades.length },
      proximas_parcialidades: {
        n: proximasLineas.length,
        monto: Math.round(proximasLineas.reduce((a, l: any) => a + num(l.monto), 0)),
        items: proximasLineas.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)).slice(0, 12),
      },
      no_entrara: {
        historico: { n: bajas.length, arr: sumaArr(bajas) },
        anio: { n: bajas12.length, arr: sumaArr(bajas12) },
        sin_fecha: { n: bajas.filter((b: any) => !b.cancelada_at).length, arr: sumaArr(bajas.filter((b: any) => !b.cancelada_at)) },
        items: bajas.filter((b: any) => b.cancelada_at).sort((a: any, b: any) => dia(b.cancelada_at).localeCompare(dia(a.cancelada_at)))
          .slice(0, 8).map((b: any) => ({
            nombre: nombreDe[b.company_id] || 'Cuenta', arr: Math.round(num(b.arr)),
            fecha: dia(b.cancelada_at), razon: b.razon_cancelacion || null, plan: b.nombre_plan || null,
          })),
      },
      sin_dueno: {
        n: sinDueno.length, monto: Math.round(sinDueno.reduce((a: number, p: any) => a + num(p.monto), 0)),
        items: sinDueno.sort((a: any, b: any) => dia(b.fecha).localeCompare(dia(a.fecha))).slice(0, 8)
          .map((p: any) => ({ id: p.id, fecha: dia(p.fecha), monto: Math.round(num(p.monto)) })),
      },
      oportunidades: {
        abiertas: { n: abiertas.length, monto: Math.round(abiertas.reduce((a: number, d: any) => a + num(d.valor_total), 0)) },
        sin_cotizar: {
          n: sinCotizar.length, monto: Math.round(sinCotizar.reduce((a: number, d: any) => a + num(d.valor_total), 0)),
          items: sinCotizar.sort((a: any, b: any) => num(b.valor_total) - num(a.valor_total)).slice(0, 6)
            .map((d: any) => ({ id: d.id, titulo: d.nombre || 'Oportunidad', monto: Math.round(num(d.valor_total)),
              nombre: nombreDe[d.company_id] || null, company_id: d.company_id || null })),
        },
      },
    },
    clientes: {
      activos: activas.length,
      recurrentes: recurrentes.length,
      recurrentes_pct: activas.length ? Math.round((recurrentes.length / activas.length) * 100) : null,
      recompras: { n: recompras.length, monto: Math.round(recompras.reduce((a, [, m]) => a + m, 0)) },
      frecuencia_meses: medianaDias != null ? Math.round((medianaDias / 30.4) * 10) / 10 : null,
      renovaciones, sin_movimiento: sinMovimiento, expansion,
      /* El total NO es el largo de la lista: la lista se corta en 8 para que
         la pantalla no se vuelva un directorio, pero el KPI tiene que contar
         todas las cuentas y todas las ideas. */
      expansion_total: {
        cuentas: Object.keys(ideasPorCuenta).filter(id => nombreDe[id]).length,
        ideas: Object.entries(ideasPorCuenta).filter(([id]) => nombreDe[id]).reduce((a, [, n]) => a + (n as number), 0),
      },
      renovaciones_monto: Math.round(renovaciones.reduce((a: number, r: any) => a + num(r.monto), 0)),
      por_ciclo: Object.entries(porCiclo).map(([ciclo, v]) => ({ ciclo, n: v.n, arr: Math.round(v.arr) }))
        .sort((a, b) => b.n - a.n),
    },
  });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 60s en la instancia.
export const GET = conMicroCache('reports/tablero-secciones', 60000, _GET as any);
