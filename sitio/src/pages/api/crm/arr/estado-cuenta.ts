// GET /api/crm/arr/estado-cuenta?company_id=X  (o ?subscription_id=Y)
// Estado de cuenta (ledger) por suscripción: por cada PERIODO esperado desde el
// inicio hasta hoy → cuánto se esperaba, cuánto se pagó (match por periodo_cubierto)
// y el saldo. Es lo que vuelve la conciliación OBVIA: al día / parcial / pendiente.
// El total_pagado del header viene de la suscripción (autoritativo); el desglose por
// periodo puede no cuadrar 1:1 con pagos migrados/agregados (periodo_cubierto suelto).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;

function periodos(fechaInicio: string, ciclo: string, hoy: Date): string[] {
  const out: string[] = [];
  if (!fechaInicio) return out;
  const d = new Date(fechaInicio + 'T12:00:00Z');
  if (ciclo === 'anual') {
    let y = d.getUTCFullYear();
    const yHoy = hoy.getUTCFullYear();
    while (y <= yHoy && out.length < 30) { out.push(String(y)); y++; }
  } else {
    let y = d.getUTCFullYear(), m = d.getUTCMonth();
    const yHoy = hoy.getUTCFullYear(), mHoy = hoy.getUTCMonth();
    while ((y < yHoy || (y === yHoy && m <= mHoy)) && out.length < 120) {
      out.push(y + '-' + String(m + 1).padStart(2, '0'));
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  return out;
}

function json(o: any, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ url }) => {
  const companyId = url.searchParams.get('company_id');
  const subId = url.searchParams.get('subscription_id');
  if (!companyId && !subId) return json({ error: 'company_id o subscription_id requerido' }, 400);

  try {
    let subsQ = supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, precio, monto_proximo, fecha_inicio, proxima_factura, estado, total_pagado, pagos_realizados');
    subsQ = subId ? subsQ.eq('id', subId) : subsQ.eq('company_id', companyId);
    const { data: subs, error } = await subsQ;
    if (error) throw error;

    const subIds = (subs || []).map((s: any) => s.id);
    let pays: any[] = [];
    if (subIds.length) {
      const { data } = await supabase.from('payments').select('subscription_id, periodo_cubierto, monto').in('subscription_id', subIds);
      pays = data || [];
    }
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    const cuentas = (subs || []).map((s: any) => {
      const pagadoPorPeriodo: Record<string, number> = {};
      pays.filter(p => p.subscription_id === s.id).forEach(p => {
        const k = p.periodo_cubierto || '?';
        pagadoPorPeriodo[k] = (pagadoPorPeriodo[k] || 0) + (Number(p.monto) || 0);
      });
      const precio = Number(s.precio) || 0;
      const per = periodos(s.fecha_inicio, s.ciclo, hoy);
      let totalEsp = 0;
      const detalle = per.map(k => {
        const esperado = precio;
        const pagado = r2(pagadoPorPeriodo[k] || 0);
        totalEsp += esperado;
        const estado = pagado >= esperado - 0.01 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';
        return { periodo: k, esperado: r2(esperado), pagado, saldo: r2(esperado - pagado), estado };
      });
      const totalPag = Number(s.total_pagado) || 0; // autoritativo (incluye migrados)
      const saldo = r2(totalEsp - totalPag);
      const vencida = !!(s.proxima_factura && s.proxima_factura < hoyStr && s.estado !== 'cancelada' && s.estado !== 'liberada');
      return {
        subscription_id: s.id, nombre_plan: s.nombre_plan, ciclo: s.ciclo, estado: s.estado,
        proxima_factura: s.proxima_factura, monto_proximo: s.monto_proximo,
        pagos_realizados: s.pagos_realizados,
        total_esperado: r2(totalEsp), total_pagado: r2(totalPag), saldo,
        al_dia: saldo <= 0.01 && !vencida, vencida, detalle,
      };
    });

    const resumen = {
      total_esperado: r2(cuentas.reduce((a, c) => a + c.total_esperado, 0)),
      total_pagado: r2(cuentas.reduce((a, c) => a + c.total_pagado, 0)),
      saldo: r2(cuentas.reduce((a, c) => a + c.saldo, 0)),
    };
    return json({ cuentas, resumen }, 200);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
