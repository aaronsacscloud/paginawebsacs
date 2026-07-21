import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

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
    .select('monto, fecha')
    .gte('fecha', thisMonth + '-01');

  const paymentsThisMonth = (payments || []).reduce((s, p) => s + (p.monto || 0), 0);

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
  }));
};
