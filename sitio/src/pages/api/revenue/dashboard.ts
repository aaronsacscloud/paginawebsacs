import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Get all active clients
    const { data: clients } = await supabase.from('clients').select('*');
    // Get all payments
    const { data: payments } = await supabase.from('payments').select('*').order('fecha', { ascending: false });

    const allClients = clients || [];
    const allPayments = payments || [];
    const active = allClients.filter(c => c.estado === 'activo');
    const cancelled = allClients.filter(c => c.estado === 'cancelado');

    // MRR = sum of monthly prices of active clients
    const mrr = active.reduce((s, c) => s + (parseFloat(c.precio_mensual) || 0) * (c.sucursales || 1), 0);
    const arr = mrr * 12;

    // Churn
    const churnRate = allClients.length > 0 ? (cancelled.length / allClients.length * 100) : 0;

    // By plan
    const byPlan: Record<string, { count: number; mrr: number }> = {};
    active.forEach(c => {
      const p = c.plan || 'sin plan';
      if (!byPlan[p]) byPlan[p] = { count: 0, mrr: 0 };
      byPlan[p].count++;
      byPlan[p].mrr += (parseFloat(c.precio_mensual) || 0) * (c.sucursales || 1);
    });

    // Next renewals (next 30 days)
    const today = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);

    const nextRenewals = active
      .filter(c => c.fecha_renovacion && c.fecha_renovacion <= in30Str)
      .sort((a, b) => (a.fecha_renovacion || '').localeCompare(b.fecha_renovacion || ''));

    // Overdue
    const overdue = active.filter(c => c.fecha_renovacion && c.fecha_renovacion < todayStr);

    // Monthly revenue (last 12 months from payments)
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monthlyRevenue[key] = 0;
    }
    allPayments.forEach(p => {
      const key = (p.fecha || '').slice(0, 7);
      if (monthlyRevenue[key] !== undefined) {
        monthlyRevenue[key] += parseFloat(p.monto) || 0;
      }
    });

    return new Response(JSON.stringify({
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeClients: active.length,
      totalClients: allClients.length,
      cancelledClients: cancelled.length,
      churnRate: Math.round(churnRate * 10) / 10,
      byPlan,
      nextRenewals: nextRenewals.slice(0, 20),
      overdue,
      monthlyRevenue,
      recentPayments: allPayments.slice(0, 10),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
