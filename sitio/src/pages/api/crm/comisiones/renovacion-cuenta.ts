// /api/crm/comisiones/renovacion-cuenta — la renovación de UNA cuenta.
//
// Lo mismo que mostraba la lista de Renovaciones, pero para un solo cliente y
// desde su ficha. El cambio de lugar no es cosmético: la meta de expansión es
// una propiedad de LA CUENTA, no del pago. Se actúa sobre ella mirando al
// cliente —qué usa, qué le falta, qué se le puede vender— y no mirando una
// tabla de nómina con setenta y un renglones.
//
// GET  ?company_id=X&anio=2026
// PUT  { company_id, anio, condicion_a, nota }  — marcar el seguimiento
// POST { anio }                                 — recalcular la condición B
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { cotizacionEsUnico, categoriaDePartida } from '../../../../lib/crm/pagos-unicos';
import { evaluarRenovaciones } from '../../../../lib/crm/comisiones.recalculo';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const anioOk = (n: any) => Number.isInteger(Number(n)) && Number(n) >= 2000 && Number(n) <= 2100;

export const GET: APIRoute = async ({ url }) => {
  try {
    const company_id = String(url.searchParams.get('company_id') || '');
    if (!UUID.test(company_id)) return json({ error: 'Falta la empresa.' }, 400);
    const anio = anioOk(url.searchParams.get('anio')) ? Number(url.searchParams.get('anio')) : new Date().getFullYear();

    const [{ data: ev }, { data: subs }, { data: modelo }] = await Promise.all([
      supabase.from('comision_evaluaciones')
        .select('*').eq('company_id', company_id).eq('anio', anio).maybeSingle(),
      supabase.from('subscriptions')
        .select('id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, fecha_inicio, plan_id, plans(categoria, nombre)')
        .eq('company_id', company_id).eq('estado', 'activa'),
      supabase.from('comision_modelos').select('dias_gracia_cobro, tasa_incumplimiento_pct').eq('es_default', true).maybeSingle(),
    ]);

    // Lo que ya se le vendió de EXPANSIÓN este año: todo lo que no es el plan
    // base. Renovar la propia licencia no cuenta —eso es conservar, no crecer—,
    // y esa distinción es justamente lo que mide la condición.
    const { data: lineas } = await supabase.from('comision_lineas')
      .select('payment_id, fecha, concepto, categoria, monto_bruto, monto, es_renovacion, dias_atraso, fuera_de_tiempo, tasa_reducida')
      .eq('company_id', company_id)
      .gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
      .neq('estado', 'cancelada')
      .order('fecha');

    const expansion: any[] = (lineas || []).filter((l: any) => l.categoria && l.categoria !== 'plan');

    /* ── Lo cobrado por COTIZACIÓN también es expansión ──
       Una línea de comisión saca su categoría del plan de la licencia. Un
       plugin o una personalización cobrados por cotización no cuelgan de
       ninguna licencia: la línea nace sin categoría y el filtro de arriba la
       tira. Resultado medido: ARTIK cobró $119,764 en julio y esta pantalla
       decía "VENDIDO $0 · NO CUMPLE" con el 30% de meta intacto.
       Se leen aquí los pagos únicos del año y se suman los que la comisión no
       alcanzó a categorizar. El cruce es por `payment_id`: sin él, una cuenta
       con su línea ya bien categorizada contaría el mismo dinero dos veces. */
    const yaContados = new Set((lineas || []).map((l: any) => l.payment_id).filter(Boolean));
    const { data: pagosCot } = await supabase.from('payments')
      .select('id, fecha, monto, quote_id, subscription_id, estado, quotes(numero, items)')
      .eq('company_id', company_id).is('subscription_id', null).not('quote_id', 'is', null)
      .gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`);
    const ANULADOS = ['anulado', 'cancelado', 'duplicado', 'reembolsado'];
    for (const p of (pagosCot || [])) {
      if (yaContados.has(p.id)) continue;
      if (ANULADOS.includes(String(p.estado || '').toLowerCase())) continue;
      const items = (p as any).quotes?.items;
      // Una cotización que vende licencia NO es expansión: renovar no es crecer.
      if (!cotizacionEsUnico(items)) continue;
      const nombres = (Array.isArray(items) ? items : [])
        .filter((i: any) => Number(i?.monto) > 0).map((i: any) => i.nombre);
      expansion.push({
        fecha: p.fecha,
        concepto: nombres.join(' · ') || (p as any).quotes?.numero || 'Cobro por cotización',
        categoria: nombres.length ? categoriaDePartida(nombres[0]) : 'plugin',
        monto_bruto: Number(p.monto || 0), monto: Number(p.monto || 0),
        es_renovacion: false, dias_atraso: null, fuera_de_tiempo: false, tasa_reducida: false,
        origen_cotizacion: (p as any).quotes?.numero || null,
      });
    }
    expansion.sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));

    // La próxima anualidad: la fecha que decide la condición C. Sin ella no se
    // puede avisar a tiempo, que es para lo que sirve esta pantalla.
    const proxima = (subs || [])
      .filter((s: any) => s.proxima_factura)
      .sort((a: any, b: any) => (a.proxima_factura < b.proxima_factura ? -1 : 1))[0] || null;

    const hoy = new Date().toISOString().slice(0, 10);
    const dias = proxima?.proxima_factura
      ? Math.round((Date.parse(proxima.proxima_factura + 'T00:00:00Z') - Date.parse(hoy + 'T00:00:00Z')) / 86400000)
      : null;

    return json({
      anio,
      evaluacion: ev || null,
      gracia: modelo?.dias_gracia_cobro ?? 5,
      tasa_incumplimiento: modelo?.tasa_incumplimiento_pct ?? 15,
      suscripciones: subs || [],
      proxima_anualidad: proxima
        ? { fecha: proxima.proxima_factura, monto: Number(proxima.monto_proximo || proxima.precio || 0), dias, plan: proxima.nombre_plan }
        : null,
      expansion: {
        vendido: expansion.reduce((a: number, l: any) => a + Number(l.monto_bruto || 0), 0),
        lineas: expansion,
      },
      cobros: (lineas || []).filter((l: any) => l.es_renovacion),
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!UUID.test(String(b.company_id || ''))) return json({ error: 'Falta la empresa.' }, 400);
    const anio = anioOk(b.anio) ? Number(b.anio) : new Date().getFullYear();
    const a = b.condicion_a === null ? null : b.condicion_a === true || b.condicion_a === 'true';

    const { data: ya } = await supabase.from('comision_evaluaciones')
      .select('id, cumple_b').eq('company_id', b.company_id).eq('anio', anio).maybeSingle();
    if (!ya) return json({ error: 'Esta cuenta todavía no tiene evaluación de este año.' }, 404);

    // `cumple` es la conjunción de las dos, y se guarda resuelta para que el
    // cálculo de comisiones no tenga que recomponerla en cada línea.
    const patch: any = {
      condicion_a: a,
      cumple: a === null ? null : a && ya.cumple_b === true,
    };
    if ('nota' in b) patch.nota = (b.nota || '').trim() || null;
    const { data, error } = await supabase.from('comision_evaluaciones')
      .update(patch).eq('id', ya.id).select().single();
    if (error) throw error;
    return json({ ok: true, evaluacion: data });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

/**
 * POST — recalcula la condición B (la meta de expansión) del año.
 *
 * Es el mismo cálculo que corre solo cada madrugada. Existe a mano porque sin
 * él la ficha tenía un callejón sin salida: una cuenta sin evaluación mostraba
 * "todavía no tiene" y no había forma de generarla salvo esperar al cron.
 *
 * Evalúa TODAS las cuentas del año, no solo una: la meta de cada quien depende
 * de su propia anualidad anterior, así que separarlo por cuenta no ahorraría
 * trabajo y sí abriría la puerta a que dos cuentas queden calculadas con
 * criterios de días distintos.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json().catch(() => ({}));
    const anio = anioOk(b.anio) ? Number(b.anio) : new Date().getFullYear();
    const r = await evaluarRenovaciones(anio);
    return json({ ok: true, ...r });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
