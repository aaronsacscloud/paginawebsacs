// GET /api/crm/arr/intelligence — un solo endpoint que consolida las métricas
// de clase mundial del negocio ARR, calculadas desde el ledger (mrr_movements)
// + suscripciones + pagos + churn_events + telemetría de uso (companies):
//   waterfall MRR · NRR/GRR · logo churn · cohortes · forecast vs cobrado ·
//   ingreso reconocido/diferido · pipeline de renovaciones · riesgo de churn.
// Todo tolerante a que el ledger aún esté vacío (métricas basadas en él dicen
// "acumulando"); lo demás sale del estado actual.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);
const mesDe = (d: string) => (d || '').slice(0, 7);
const hoy = () => new Date().toISOString().slice(0, 10);
function addMeses(fecha: string, n: number): string {
  const d = new Date(fecha + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async () => {
  const H = hoy();
  const mesActual = mesDe(H);

  // ── datos base ──
  const [subsRes, movRes, churnRes, paysRes, savesRes] = await Promise.all([
    supabase.from('subscriptions').select('id, company_id, estado, ciclo, precio, mrr, arr, proxima_factura, fecha_inicio, nombre_plan, monto_proximo, companies(id, nombre, health_score, dias_sin_venta, ultima_venta_at)'),
    supabase.from('mrr_movements').select('fecha, tipo, mrr_delta, mrr_anterior, mrr_nuevo').order('fecha', { ascending: true }),
    supabase.from('churn_events').select('cancelled_at, mrr_lost, reason'),
    supabase.from('payments').select('fecha, monto').order('fecha', { ascending: false }).limit(2000),
    supabase.from('activities').select('created_at, metadata').contains('metadata', { retencion: 'aceptada' }).order('created_at', { ascending: false }).limit(500),
  ]);
  const subs = subsRes.data || [];
  const movs = movRes.error ? [] : (movRes.data || []);      // ledger vacío/no existe → []
  const churn = churnRes.data || [];
  const pays = paysRes.data || [];
  const saves = savesRes.error ? [] : (savesRes.data || []);
  const conLedger = movs.length > 0;

  const activas = subs.filter((s: any) => s.estado === 'activa');
  const mrrActivo = r2(activas.reduce((a: number, s: any) => a + Number(s.mrr || 0), 0));
  // Ancla para NRR/GRR: el ingreso que "aún no se ha ido" incluye las vencidas
  // (pendiente_pago) — no han cancelado, solo van tarde. Debe coincidir con la
  // definición de aporte del ledger (subscriptions.ts mrrAporte) para que la
  // identidad mrrBase = base_inicio + Σ movimientos se sostenga.
  const baseSubs = subs.filter((s: any) => s.estado === 'activa' || s.estado === 'pendiente_pago');
  const mrrBase = r2(baseSubs.reduce((a: number, s: any) => a + Number(s.mrr || 0), 0));

  // ── 1 · Waterfall MRR del mes en curso (desde el ledger) ──
  const movMes = movs.filter((m: any) => mesDe(m.fecha) === mesActual);
  const waterfall = { new: 0, expansion: 0, reactivation: 0, contraction: 0, churn: 0 };
  for (const m of movMes) {
    const d = Number(m.mrr_delta || 0);
    if (m.tipo === 'new') waterfall.new += d;
    else if (m.tipo === 'expansion') waterfall.expansion += d;
    else if (m.tipo === 'reactivation') waterfall.reactivation += d;
    else if (m.tipo === 'contraction') waterfall.contraction += d;   // negativo
    else if (m.tipo === 'churn') waterfall.churn += d;               // negativo
  }
  Object.keys(waterfall).forEach(k => (waterfall as any)[k] = r2((waterfall as any)[k]));

  // ── 2 · NRR / GRR del último mes completo (desde el ledger) ──
  // Base = MRR al inicio del mes previo (aprox: mrr_activo actual − netos de este mes).
  let nrr: number | null = null, grr: number | null = null;
  if (conLedger) {
    const mesPrev = mesDe(addMeses(mesActual + '-01', -1));
    const mp = movs.filter((m: any) => mesDe(m.fecha) === mesPrev);
    let exp = 0, react = 0, contr = 0, ch = 0;
    for (const m of mp) {
      const d = Number(m.mrr_delta || 0);
      if (m.tipo === 'expansion') exp += d; else if (m.tipo === 'reactivation') react += d;
      else if (m.tipo === 'contraction') contr += d; else if (m.tipo === 'churn') ch += d;
    }
    // base = MRR al INICIO del mes previo = MRR base actual − (todos los
    // movimientos ocurridos desde ese inicio, incluidos los del mes en curso,
    // que se cancelan al restar). Identidad: mrrBase = base + Σ desde.
    const desde = movs.filter((m: any) => m.fecha >= mesPrev + '-01').reduce((a: number, m: any) => a + Number(m.mrr_delta || 0), 0);
    const base = mrrBase - desde;
    // NRR/GRR miden la BASE EXISTENTE (sin las altas nuevas del periodo).
    if (base > 0) {
      grr = r2(Math.max(0, (base + contr + ch)) / base * 100);       // contr/ch son negativos
      nrr = r2((base + exp + react + contr + ch) / base * 100);
    }
  }

  // ── 3 · Logo churn (CLIENTES únicos que se fueron, no eventos) ──
  const churnCos30 = new Set(churn.filter((c: any) => c.cancelled_at && c.cancelled_at >= addMeses(H, -1)).map((c: any) => c.company_id).filter(Boolean));
  const churnCos90 = new Set(churn.filter((c: any) => c.cancelled_at && c.cancelled_at >= addMeses(H, -3)).map((c: any) => c.company_id).filter(Boolean));
  const clientesActivos = new Set(activas.map((s: any) => s.company_id).filter(Boolean)).size;
  // logos que se fueron y NO conservan otra sub activa
  const activasSet = new Set(activas.map((s: any) => s.company_id));
  const churn30 = Array.from(churnCos30).filter(id => !activasSet.has(id)).length;
  const churn90 = Array.from(churnCos90).filter(id => !activasSet.has(id)).length;
  const logoChurnPct = clientesActivos + churn30 > 0 ? r2(churn30 / (clientesActivos + churn30) * 100) : 0;
  // razones de churn agregadas
  const razones: Record<string, number> = {};
  churn.filter((c: any) => c.cancelled_at >= addMeses(H, -3)).forEach((c: any) => { const k = c.reason || 'sin razón'; razones[k] = (razones[k] || 0) + 1; });

  // save-rate: de los que iban a cancelar, cuántos se retuvieron (90d).
  const saves90 = saves.filter((s: any) => s.created_at >= addMeses(H, -3)).length;
  const churnEvents90 = churn.filter((c: any) => c.cancelled_at && c.cancelled_at >= addMeses(H, -3)).length;
  const saveRate = (saves90 + churnEvents90) > 0 ? r2(saves90 / (saves90 + churnEvents90) * 100) : null;

  // ── 4 · Cohortes de retención por mes de alta ──
  const cohortes: Record<string, { total: number; activas: number; mrr: number }> = {};
  subs.filter((s: any) => s.fecha_inicio).forEach((s: any) => {
    const k = mesDe(s.fecha_inicio);
    const c = (cohortes[k] = cohortes[k] || { total: 0, activas: 0, mrr: 0 });
    c.total++; if (s.estado === 'activa') { c.activas++; c.mrr += Number(s.mrr || 0); }
  });
  const cohortesArr = Object.entries(cohortes).sort().slice(-12).map(([mes, c]) => ({
    mes, total: c.total, activas: c.activas, retencion: c.total ? r0(c.activas / c.total * 100) : 0, mrr: r2(c.mrr),
  }));

  // ── 5 · Forecast de cobranza (12 meses) vs cobrado este mes ──
  const forecast: { mes: string; esperado: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const mes = mesDe(addMeses(mesActual + '-01', i));
    let esperado = 0;
    for (const s of activas) {
      if (!s.proxima_factura) continue;
      const monto = Number(s.monto_proximo ?? s.precio) || 0;
      // ¿cae un cobro de esta sub en ese mes? (anual: una vez; mensual: todos)
      if (s.ciclo === 'mensual') esperado += monto;
      else if (mesDe(s.proxima_factura) === mes) esperado += monto;
    }
    forecast.push({ mes, esperado: r2(esperado) });
  }
  const cobradoMes = r2(pays.filter((p: any) => mesDe(p.fecha) === mesActual).reduce((a: number, p: any) => a + Number(p.monto || 0), 0));

  // ── 6 · Ingreso reconocido (mes) vs diferido (por cobrar amortizable) ──
  // Reconocido del mes = MRR activo (un anual de $12k reconoce $1k/mes, no $12k).
  // Diferido = de las anuales activas, la parte del año aún no consumida.
  let diferido = 0;
  for (const s of activas.filter((s: any) => s.ciclo === 'anual')) {
    if (!s.proxima_factura) continue;
    const mesesRest = Math.max(0, Math.min(12, Math.round((new Date(s.proxima_factura).getTime() - Date.now()) / (30.4 * 86400000))));
    diferido += (Number(s.precio || 0) / 12) * mesesRest;
  }
  const revenue = { reconocido_mes: mrrActivo, diferido: r2(diferido) };

  // ── 7 · Pipeline de renovaciones (próximos 90 días) ──
  const en90 = addMeses(H, 3);
  const renovaciones = activas
    .filter((s: any) => s.proxima_factura && s.proxima_factura >= H && s.proxima_factura <= en90)
    .map((s: any) => ({
      subscription_id: s.id, company_id: s.company_id, empresa: s.companies?.nombre || '—',
      plan: s.nombre_plan, ciclo: s.ciclo, monto: Number(s.monto_proximo ?? s.precio) || 0,
      fecha: s.proxima_factura, salud: s.companies?.health_score ?? null, dias_sin_venta: s.companies?.dias_sin_venta ?? null,
    }))
    .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  const renovacionesMonto = r2(renovaciones.reduce((a: number, r: any) => a + r.monto, 0));

  // ── 8 · Riesgo de churn (score compuesto: uso + salud + renovación cercana) ──
  const enRiesgo = activas.map((s: any) => {
    const co = s.companies || {};
    const dias = co.dias_sin_venta;
    const salud = co.health_score;
    const renuevaEn = s.proxima_factura ? Math.round((new Date(s.proxima_factura).getTime() - Date.now()) / 86400000) : null;
    // score 0-100 (mayor = más riesgo)
    let score = 0;
    if (dias != null) score += dias > 15 ? 45 : dias > 7 ? 30 : dias >= 3 ? 15 : 0;
    if (salud != null) score += salud < 40 ? 30 : salud < 60 ? 18 : salud < 75 ? 8 : 0;
    if (renuevaEn != null && renuevaEn >= 0 && renuevaEn <= 30) score += 25; // renueva pronto y con señales malas = urgente
    return {
      subscription_id: s.id, company_id: s.company_id, empresa: co.nombre || '—', plan: s.nombre_plan,
      arr: Number(s.arr || 0), salud, dias_sin_venta: dias, renueva_en: renuevaEn, score: Math.min(100, score),
    };
  }).filter((x: any) => x.score >= 15).sort((a: any, b: any) => b.score - a.score);
  const arrEnRiesgo = r2(enRiesgo.reduce((a: number, x: any) => a + x.arr, 0));

  return new Response(JSON.stringify({
    generado: H,
    con_ledger: conLedger,
    mrr_activo: mrrActivo, arr_activo: r2(mrrActivo * 12), clientes_activos: clientesActivos,
    waterfall,
    retencion: { nrr, grr, logo_churn_pct: logoChurnPct, churn_30d: churn30, churn_90d: churn90, razones, save_rate: saveRate, saves_90d: saves90 },
    cohortes: cohortesArr,
    forecast, cobrado_mes: cobradoMes,
    revenue,
    renovaciones: { proximas: renovaciones.slice(0, 40), total: renovaciones.length, monto: renovacionesMonto },
    riesgo: { lista: enRiesgo.slice(0, 40), total: enRiesgo.length, arr: arrEnRiesgo },
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
