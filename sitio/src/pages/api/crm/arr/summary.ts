// GET /api/crm/arr/summary — el corazón del hub ARR:
// KPIs (ARR/MRR por ciclo), meta y progreso, calendario de cobros 12 meses,
// proyección mensual (contratado / +pendientes / −riesgo), bandas de riesgo
// por inactividad (3-15, +15 días) con ARR en riesgo, y vencidos.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  const hoy = new Date();
  const hoyStr = hoy.toISOString().slice(0, 10);

  const [subsRes, goalsRes, compRes] = await Promise.all([
    supabase.from('subscriptions').select('*, companies(id, nombre, sacs_account, ultima_venta_at, dias_sin_venta, estado_cuenta)').limit(2000),
    supabase.from('crm_goals').select('*'),
    supabase.from('companies').select('id, nombre, sacs_account, mrr, arr, ultima_venta_at, dias_sin_venta, actividad_sync_at, estado_cuenta').not('sacs_account', 'is', null),
  ]);
  if (subsRes.error) return new Response(JSON.stringify({ error: subsRes.error.message }), { status: 500 });

  const subs = subsRes.data || [];
  const activas = subs.filter(s => s.estado === 'activa');
  const pendientes = subs.filter(s => s.estado === 'pendiente_pago');
  const programadas = subs.filter(s => s.estado === 'programada');

  // ── KPIs por ciclo (mensual y anual se cobran MUY distinto: siempre separados) ──
  const kpis = {
    arr_activo: r2(activas.reduce((a, s) => a + Number(s.arr || 0), 0)),
    mrr_activo: r2(activas.reduce((a, s) => a + Number(s.mrr || 0), 0)),
    subs_activas: activas.length,
    anuales: { n: activas.filter(s => s.ciclo === 'anual').length, arr: r2(activas.filter(s => s.ciclo === 'anual').reduce((a, s) => a + Number(s.arr || 0), 0)) },
    mensuales: { n: activas.filter(s => s.ciclo === 'mensual').length, arr: r2(activas.filter(s => s.ciclo === 'mensual').reduce((a, s) => a + Number(s.arr || 0), 0)) },
    pendiente_pago: { n: pendientes.length, arr: r2(pendientes.reduce((a, s) => a + Number(s.arr || 0), 0)) },
    programadas: { n: programadas.length, arr: r2(programadas.reduce((a, s) => a + Number(s.arr || 0), 0)) },
    clientes_activos: new Set(activas.map(s => s.company_id).filter(Boolean)).size,
  };

  // ── Meta ARR del año y progreso ──
  const anio = hoy.getFullYear();
  const goals = goalsRes.data || [];
  const metaArr = goals.find(g => g.tipo === 'arr' && g.anio === anio && g.mes == null) || null;
  const meta = {
    anio,
    monto: metaArr ? Number(metaArr.monto) : null,
    progreso_pct: metaArr && Number(metaArr.monto) > 0 ? r2(100 * kpis.arr_activo / Number(metaArr.monto)) : null,
    mensuales: goals.filter(g => g.tipo === 'new_arr_mensual' && g.anio === anio).map(g => ({ mes: g.mes, monto: Number(g.monto) })),
  };

  // ── Riesgo por inactividad (solo clientes con suscripción activa y cuenta ligada) ──
  const riesgo = { banda_3_15: [] as any[], banda_15_mas: [] as any[], arr_en_riesgo: 0, sin_liga: 0 };
  const activasPorCompany = new Map<string, number>();
  activas.forEach(s => { if (s.company_id) activasPorCompany.set(s.company_id, (activasPorCompany.get(s.company_id) || 0) + Number(s.arr || 0)); });
  (compRes.data || []).forEach(c => {
    const arrCliente = activasPorCompany.get(c.id) || 0;
    if (arrCliente <= 0) return;
    const dias = c.dias_sin_venta;
    if (dias == null) { riesgo.sin_liga++; return; }
    const item = { company_id: c.id, nombre: c.nombre, sacs_account: c.sacs_account, dias_sin_venta: dias, ultima_venta: c.ultima_venta_at, arr: r2(arrCliente) };
    if (dias > 15) { riesgo.banda_15_mas.push(item); riesgo.arr_en_riesgo += arrCliente; }
    else if (dias >= 3) { riesgo.banda_3_15.push(item); riesgo.arr_en_riesgo += arrCliente; }
  });
  riesgo.banda_3_15.sort((a, b) => b.arr - a.arr);
  riesgo.banda_15_mas.sort((a, b) => b.arr - a.arr);
  riesgo.arr_en_riesgo = r2(riesgo.arr_en_riesgo);

  // ── Calendario de cobros + proyección 12 meses ──
  const meses: { mes: string; contratado: number; pendiente: number; enRiesgo: number; cobros: any[] }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    meses.push({ mes: d.toISOString().slice(0, 7), contratado: 0, pendiente: 0, enRiesgo: 0, cobros: [] });
  }
  const riesgoIds = new Set([...riesgo.banda_3_15, ...riesgo.banda_15_mas].map(x => x.company_id));
  const mesIdx = (fecha: string) => meses.findIndex(m => fecha.slice(0, 7) === m.mes);

  for (const s of subs) {
    const co = (s as any).companies;
    const base = { subscription_id: s.id, plan: s.nombre_plan, ciclo: s.ciclo, estado: s.estado, empresa: co?.nombre || '—', sacs_account: co?.sacs_account || null };
    if (s.estado === 'activa' || s.estado === 'pendiente_pago' || s.estado === 'programada') {
      if (s.ciclo === 'anual') {
        // renovación anual: cae en su mes de próxima factura
        if (s.proxima_factura) {
          const idx = mesIdx(s.proxima_factura);
          if (idx >= 0) {
            const monto = Number(s.monto_proximo ?? s.precio) || 0;
            meses[idx].cobros.push({ ...base, fecha: s.proxima_factura, monto: r2(monto) });
            if (s.estado === 'activa') { meses[idx].contratado += monto; if (riesgoIds.has(s.company_id)) meses[idx].enRiesgo += monto; }
            else meses[idx].pendiente += monto;
          }
        }
      } else {
        // mensual: cobra TODOS los meses desde su próxima factura
        const inicio = s.proxima_factura && s.proxima_factura >= hoyStr ? mesIdx(s.proxima_factura) : 0;
        const desde = inicio >= 0 ? inicio : 0;
        for (let i = desde; i < 12; i++) {
          const monto = Number(s.monto_proximo ?? s.precio) || 0;
          if (i === desde) meses[i].cobros.push({ ...base, fecha: s.proxima_factura || meses[i].mes + '-01', monto: r2(monto) });
          if (s.estado === 'activa') { meses[i].contratado += monto; if (riesgoIds.has(s.company_id)) meses[i].enRiesgo += monto; }
          else meses[i].pendiente += monto;
        }
      }
    }
  }
  meses.forEach(m => { m.contratado = r2(m.contratado); m.pendiente = r2(m.pendiente); m.enRiesgo = r2(m.enRiesgo); m.cobros.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)); });

  // ── Vencidos: próxima factura en el pasado y no cancelada ──
  const vencidas = subs
    .filter(s => (s.estado === 'activa' || s.estado === 'pendiente_pago') && s.proxima_factura && s.proxima_factura < hoyStr)
    .map(s => ({
      subscription_id: s.id, plan: s.nombre_plan, ciclo: s.ciclo, estado: s.estado,
      empresa: (s as any).companies?.nombre || '—', vencida_desde: s.proxima_factura,
      dias_vencida: Math.floor((hoy.getTime() - new Date(s.proxima_factura).getTime()) / 86400000),
      monto: r2(Number(s.monto_proximo ?? s.precio) || 0),
    }))
    .sort((a, b) => b.dias_vencida - a.dias_vencida);

  const sync = (compRes.data || []).map(c => c.actividad_sync_at).filter(Boolean).sort().pop() || null;

  return new Response(JSON.stringify({ kpis, meta, riesgo, meses, vencidas, actividad_sync_at: sync }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
};
