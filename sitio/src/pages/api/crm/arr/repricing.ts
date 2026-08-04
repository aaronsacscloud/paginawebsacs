// GET /api/crm/arr/repricing — ¿a quién le estamos cobrando barato para lo que
// le entregamos?
//
// La pregunta que contesta: por cada $10,000 que el cliente TRANSACCIONA en
// SACS, ¿cuánto nos paga a nosotros? Ese número, comparado entre clientes,
// destapa diferencias de 3× por el mismo producto — y ahí está el dinero más
// grande y más fácil, porque no requiere venderle nada nuevo: se corrige en la
// renovación.
//
// Es distinto del upsell por módulos: aquí no importa QUÉ usa, sino cuánto vale
// lo que ya le damos.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async ({ url }) => {
  const min = Number(url.searchParams.get('min_transaccion') || 50000); // ruido fuera
  const { data, error } = await supabase.from('companies')
    .select('id, nombre, sacs_account, plan, arr, mrr, actividad, subscriptions(estado, nombre_plan, arr)')
    .is('archived_at', null).range(0, 9999);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const filas = (data || []).map((c: any) => {
    const act = c.actividad || {};
    const activas = (c.subscriptions || []).filter((s: any) => s.estado === 'activa');
    // ARR real = suma de sus subs activas (companies.arr se desfasa si algo se
    // tocó fuera de la API; aquí se recalcula para no rankear con datos viejos).
    const arr = activas.reduce((a: number, s: any) => a + Number(s.arr || 0), 0);
    const monto30 = Number(act.total_30d || 0);
    const anual = monto30 * 12;
    return {
      company_id: c.id, nombre: c.nombre, sacs_account: c.sacs_account,
      plan: c.plan || null,
      planes: activas.map((s: any) => s.nombre_plan).filter(Boolean),
      arr: r2(arr),
      ventas_30d: Number(act.ventas_30d || 0),
      transacciona_30d: r2(monto30),
      sucursales: Number(act.sucursales || 0),
      usuarios: Number(act.usuarios || 0),
      // Lo que nos paga por cada $10,000 que mueve en un año.
      pesos_por_10k: anual > 0 ? r2((arr / anual) * 10000) : null,
    };
  })
    // Solo clientes que pagan Y transaccionan: sin las dos puntas el ratio no
    // significa nada (un cliente sin ventas daría "infinitamente caro").
    .filter(f => f.arr > 0 && f.transacciona_30d >= min && f.pesos_por_10k != null)
    .sort((a: any, b: any) => (a.pesos_por_10k as number) - (b.pesos_por_10k as number));

  // Mediana como vara de comparación: el promedio lo destruye un solo outlier.
  const ratios = filas.map(f => f.pesos_por_10k as number).sort((a, b) => a - b);
  const mediana = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;

  const conBrecha = filas.map(f => ({
    ...f,
    // Cuánto ARR adicional saldría de llevarlo a la mediana. Es una referencia
    // para negociar, no un precio: el plan y el contrato mandan.
    arr_a_la_mediana: mediana ? r2(Math.max(0, (f.transacciona_30d * 12 * mediana) / 10000 - f.arr)) : 0,
  }));

  return new Response(JSON.stringify({
    mediana_pesos_por_10k: mediana,
    clientes: conBrecha.length,
    oportunidad_total: r2(conBrecha.reduce((a, f) => a + f.arr_a_la_mediana, 0)),
    data: conBrecha,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
