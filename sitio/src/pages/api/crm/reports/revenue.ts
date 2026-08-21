import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { computarSenales } from '../../../../lib/crm/senales';

export const prerender = false;

// Licencia vitalicia = pago único, se excluye del ARR recurrente.
const esVital = (s: any) => s.ciclo === 'vitalicia' || /vitalic/i.test(String(s.nombre_plan || ''));

export const GET: APIRoute = async () => {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  // Active companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, nombre, sacs_account, plan, mrr, arr, sucursales, fecha_renovacion, estado_cuenta, ltv, last_payment_at, contacts(nombre)')
    .is('archived_at', null);

  const active = (companies || []).filter(c => c.estado_cuenta === 'activo');
  const cancelled = (companies || []).filter(c => c.estado_cuenta === 'cancelado');
  const overdue = active.filter(c => c.fecha_renovacion && c.fecha_renovacion < today);
  const upcoming = active.filter(c => c.fecha_renovacion && c.fecha_renovacion >= today && c.fecha_renovacion <= thirtyDaysLater);

  const mrr = active.reduce((s, c) => s + (c.mrr || 0), 0);
  const arr = active.reduce((s, c) => s + (c.arr || 0), 0);
  const avgLtv = active.length > 0 ? active.reduce((s, c) => s + (c.ltv || 0), 0) / active.length : 0;
  const churnRate = (active.length + cancelled.length) > 0 ? Math.round((cancelled.length / (active.length + cancelled.length)) * 100 * 10) / 10 : 0;

  // Revenue by plan
  const byPlan: Record<string, { count: number; mrr: number }> = {};
  for (const c of active) {
    const plan = c.plan || 'sin_plan';
    if (!byPlan[plan]) byPlan[plan] = { count: 0, mrr: 0 };
    byPlan[plan].count++;
    byPlan[plan].mrr += c.mrr || 0;
  }

  // Deudores (overdue)
  const deudores = overdue.map(c => ({
    id: c.id, nombre: (c as any).contacts?.[0]?.nombre || c.nombre, cuenta: (c as any).sacs_account || c.nombre, plan: c.plan, mrr: c.mrr,
    fecha_renovacion: c.fecha_renovacion,
    days_overdue: Math.floor((now.getTime() - new Date(c.fecha_renovacion + 'T00:00:00').getTime()) / 86400000),
  })).sort((a, b) => b.days_overdue - a.days_overdue);

  const montoDeuda = deudores.reduce((s, d) => s + (d.mrr || 0), 0);

  // Payments this month
  const { data: payments } = await supabase
    .from('payments')
    .select('monto, fecha, estado')
    .gte('fecha', thisMonth + '-01');

  // Los anulados son capturas duplicadas: existen como rastro, pero no son dinero.
  const ANULADOS = ['anulado', 'cancelado', 'duplicado'];
  const paymentsThisMonth = (payments || [])
    .filter(p => !ANULADOS.includes(String((p as any).estado || '').toLowerCase()))
    .reduce((s, p) => s + (p.monto || 0), 0);

  // Deals (pipeline)
  const { data: deals } = await supabase
    .from('deals')
    .select('stage, valor_total, valor_mensual, probabilidad, created_at, closed_at, days_in_pipeline')
    .is('archived_at', null);

  const openDeals = (deals || []).filter(d => !['cerrada_ganada', 'cerrada_perdida'].includes(d.stage));
  const wonDeals = (deals || []).filter(d => d.stage === 'cerrada_ganada');
  const lostDeals = (deals || []).filter(d => d.stage === 'cerrada_perdida');
  const pipelineValue = openDeals.reduce((s, d) => s + (d.valor_total || 0), 0);
  const weightedPipeline = openDeals.reduce((s, d) => s + (d.valor_total || 0) * (d.probabilidad / 100), 0);
  const winRate = (wonDeals.length + lostDeals.length) > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;
  const avgDealSize = wonDeals.length > 0 ? wonDeals.reduce((s, d) => s + (d.valor_total || 0), 0) / wonDeals.length : 0;
  const avgDaysToClose = wonDeals.filter(d => d.days_in_pipeline).length > 0 ? Math.round(wonDeals.filter(d => d.days_in_pipeline).reduce((s, d) => s + (d.days_in_pipeline || 0), 0) / wonDeals.filter(d => d.days_in_pipeline).length) : 0;

  // Contacts
  const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).is('archived_at', null);
  const { count: totalLeads } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tipo', 'lead').is('archived_at', null);
  const { count: totalClients } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tipo', 'cliente').is('archived_at', null);

  // Leads this month
  const { count: leadsThisMonth } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tipo', 'lead').gte('created_at', thisMonth + '-01T00:00:00');
  const { count: leadsLastMonth } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tipo', 'lead').gte('created_at', lastMonth + '-01T00:00:00').lt('created_at', thisMonth + '-01T00:00:00');

  // Activities this month
  const { count: activitiesThisMonth } = await supabase.from('activities').select('*', { count: 'exact', head: true }).gte('created_at', thisMonth + '-01T00:00:00');

  // ── ARR/clientes REALES (subs activas, sin vitalicias) + riesgo + radar ──
  // Consistente con la lista de Clientes (/api/crm/arr/clientes), no con companies.*.
  const { data: companiesArr } = await supabase
    .from('companies')
    .select('id, nombre, sacs_account, plan, sucursales, dias_sin_venta, ultima_venta_at, health_score, actividad, uso_sacs, subscriptions(estado, ciclo, nombre_plan, arr, mrr, proxima_factura)')
    .is('archived_at', null);

  let arrReal = 0;
  let clientesActivos = 0;
  const riesgo: any[] = [];
  const radar: any[] = [];
  for (const c of (companiesArr || [])) {
    const subs = (c as any).subscriptions || [];
    if (!subs.length) continue; // cliente real = tiene suscripción
    const activas = subs.filter((s: any) => s.estado === 'activa' && !esVital(s));
    const arrC = activas.reduce((a: number, s: any) => a + Number(s.arr || 0), 0);
    arrReal += arrC;
    if (activas.length > 0) clientesActivos++;
    // Cuentas en riesgo: sin venta ≥5 días.
    if (c.dias_sin_venta != null && c.dias_sin_venta >= 5) {
      riesgo.push({ id: c.id, nombre: c.nombre, cuenta: (c as any).sacs_account || c.nombre, dias_sin_venta: c.dias_sin_venta, ultima_venta_at: (c as any).ultima_venta_at, arr: Math.round(arrC) });
    }
    // Radar: oportunidades de venta (solo con sub activa).
    if (activas.length > 0) {
      const senales = computarSenales(c, activas[0]).filter((s: any) => s.nivel === 'oportunidad');
      if (senales.length) {
        const t = senales[0];
        radar.push({ company_id: c.id, nombre: c.nombre, cuenta: (c as any).sacs_account || c.nombre, titulo: t.titulo, accion: t.accion, tipo: t.tipo, peso: t.peso, mrr: Math.round(activas.reduce((a: number, s: any) => a + Number(s.mrr || 0), 0)) });
      }
    }
  }
  riesgo.sort((a, b) => b.dias_sin_venta - a.dias_sin_venta);
  radar.sort((a, b) => (b.peso || 0) - (a.peso || 0) || (b.mrr || 0) - (a.mrr || 0));

  // ── Cotizaciones VIVAS en dinero (draft + sent + accepted) ──
  const { data: quotesRows } = await supabase.from('quotes').select('total, estado');
  const cotVivas = (quotesRows || []).filter((q: any) => ['draft', 'sent', 'accepted'].includes(q.estado));
  const cotizacionesMonto = cotVivas.reduce((s: number, q: any) => s + Number(q.total || 0), 0);

  // ── META del mes: crm_goals new_arr_mensual (fallback: meta ARR anual / 12) ──
  const anio = now.getFullYear(); const mesN = now.getMonth() + 1;
  const { data: goals } = await supabase.from('crm_goals').select('tipo, anio, mes, monto');
  const metaMes = (goals || []).find((g: any) => g.tipo === 'new_arr_mensual' && g.anio === anio && g.mes === mesN)
    || (goals || []).find((g: any) => g.tipo === 'new_arr_mensual' && g.anio === anio && g.mes == null);
  const metaAnual = (goals || []).find((g: any) => g.tipo === 'arr' && g.anio === anio);
  // Meta explícita gana aunque sea $0; sin meta mensual → anual/12.
  const metaMonto = metaMes ? Number(metaMes.monto || 0) : (metaAnual ? Math.round(Number(metaAnual.monto || 0) / 12) : 0);
  // ARR nuevo VENDIDO este mes: subs creadas en el mes (activa/programada, sin
  // vitalicias) de companies NO archivadas (companiesArr ya viene filtrado).
  const companiasVivas = new Set((companiesArr || []).map((c: any) => c.id));
  const { data: subsMes } = await supabase.from('subscriptions')
    .select('arr, estado, ciclo, nombre_plan, created_at, company_id')
    .gte('created_at', thisMonth + '-01T00:00:00');
  const vendidoMes = (subsMes || [])
    .filter((s: any) => ['activa', 'programada'].includes(s.estado) && !esVital(s) && (!s.company_id || companiasVivas.has(s.company_id)))
    .reduce((a: number, s: any) => a + Number(s.arr || 0), 0);

  // ── Reuniones de HOY (con quién) ──
  const { data: reunionesRaw } = await supabase
    .from('bookings')
    .select('id, hora_inicio, hora_fin, estado, google_meet_link, invitee_nombre, invitee_empresa, host_id, contact_id, event_types(nombre)')
    .eq('fecha', today)
    .not('estado', 'in', '(cancelada,reagendada)')
    .order('hora_inicio', { ascending: true });
  const hostIds = Array.from(new Set((reunionesRaw || []).map((b: any) => b.host_id).filter(Boolean)));
  const hostMap: Record<string, string> = {};
  if (hostIds.length) {
    const { data: hs } = await supabase.from('team_members').select('id, nombre').in('id', hostIds as string[]);
    (hs || []).forEach((h: any) => { hostMap[h.id] = h.nombre; });
  }
  const reunionesHoy = (reunionesRaw || []).map((b: any) => ({
    id: b.id, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin, estado: b.estado,
    meet: b.google_meet_link || null,
    quien: b.invitee_nombre || 'Invitado', empresa: b.invitee_empresa || '',
    tipo: (Array.isArray(b.event_types) ? b.event_types[0]?.nombre : b.event_types?.nombre) || 'Reunión',
    host: b.host_id ? (hostMap[b.host_id] || '') : '',
    contact_id: b.contact_id || null,
  }));

  // Deals by stage
  const stages = ['calificacion', 'demo_agendada', 'demo_realizada', 'cotizacion_enviada', 'negociacion'];
  const dealsByStage = stages.map(s => {
    const stageDeals = openDeals.filter(d => d.stage === s);
    return { stage: s, count: stageDeals.length, value: stageDeals.reduce((sum, d) => sum + (d.valor_total || 0), 0) };
  });

  return new Response(JSON.stringify({
    revenue: {
      mrr, arr, churn_rate: churnRate, avg_ltv: Math.round(avgLtv),
      active_clients: active.length, cancelled_clients: cancelled.length,
      by_plan: byPlan,
      payments_this_month: paymentsThisMonth,
    },
    cobranza: {
      deudores,
      monto_deuda: montoDeuda,
      renovaciones_proximas: upcoming.map(c => ({ id: c.id, nombre: (c as any).contacts?.[0]?.nombre || c.nombre, cuenta: (c as any).sacs_account || c.nombre, plan: c.plan, mrr: c.mrr, fecha_renovacion: c.fecha_renovacion })),
    },
    pipeline: {
      total_value: pipelineValue,
      weighted_value: Math.round(weightedPipeline),
      open_deals: openDeals.length,
      won: wonDeals.length,
      lost: lostDeals.length,
      win_rate: winRate,
      avg_deal_size: Math.round(avgDealSize),
      avg_days_to_close: avgDaysToClose,
      by_stage: dealsByStage,
    },
    contacts: {
      total: totalContacts || 0,
      leads: totalLeads || 0,
      clients: totalClients || 0,
      leads_this_month: leadsThisMonth || 0,
      leads_last_month: leadsLastMonth || 0,
      lead_growth: leadsLastMonth ? Math.round(((leadsThisMonth || 0) - leadsLastMonth) / leadsLastMonth * 100) : 0,
    },
    activity: {
      total_this_month: activitiesThisMonth || 0,
    },
    // ── Bloques del dashboard enfocado ──
    dashboard: {
      arr_real: Math.round(arrReal),
      clientes_activos: clientesActivos,
      oportunidades_monto: Math.round(pipelineValue),
      oportunidades_abiertas: openDeals.length,
      cotizaciones_monto: Math.round(cotizacionesMonto),
      cotizaciones_n: cotVivas.length,
      radar,
      riesgo,
      reuniones_hoy: reunionesHoy,
      meta: {
        monto: metaMonto,
        vendido: Math.round(vendidoMes),
        pct: metaMonto > 0 ? Math.round((vendidoMes / metaMonto) * 100) : null,
        faltante: Math.max(0, Math.round(metaMonto - vendidoMes)),
        pipeline_abierto: Math.round(pipelineValue),
        anio, mes: mesN,
      },
    },
  }));
};
