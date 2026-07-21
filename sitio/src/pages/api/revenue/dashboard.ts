// Dashboard financiero: MRR, ARR, ARPU, LTV, Churn, Conversion, DSO, cohort retention.
// Sources: companies (MRR active base), invoices (billed/collected), payments (cash), quotes (conversion),
// churn_events (churn reasons), deals (pipeline value).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

type Company = {
  id: string;
  nombre?: string;
  plan?: string | null;
  mrr?: number | null;
  arr?: number | null;
  sucursales?: number | null;
  fecha_renovacion?: string | null;
  estado_cuenta?: string | null;
  contact_id?: string | null;
  created_at?: string | null;
  stripe_subscription_id?: string | null;
  precio_por_sucursal?: number | null;
};

function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastMonthKey(offset = 1): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toISOString().slice(0, 7);
}

export const GET: APIRoute = async () => {
  try {
    // ─── Fetch base tables ───
    const [companiesRes, paymentsRes, invoicesRes, quotesRes, churnRes, dealsRes, clientsRes] = await Promise.all([
      supabase.from('companies').select('id, nombre, plan, mrr, arr, sucursales, fecha_renovacion, estado_cuenta, contact_id, created_at, stripe_subscription_id, precio_por_sucursal'),
      supabase.from('payments').select('id, fecha, monto, metodo, company_id, stripe_payment_id'),
      supabase.from('invoices').select('id, total, moneda, tipo, estado, emitida_at, pagada_at, company_id, quote_id, created_at'),
      supabase.from('quotes').select('id, estado, total, moneda, created_at, aceptado_fecha'),
      supabase.from('churn_events').select('id, mrr_lost, reason, cancelled_at, company_id'),
      supabase.from('deals').select('id, stage, valor_total, valor_mensual, probabilidad, created_at, closed_at'),
      // Tabla legacy `clients` retirada — el dashboard usa solo el sistema ARR
      // (companies/subscriptions). Se deja el slot vacío para no tocar la lógica de fallback.
      Promise.resolve({ data: [] as any[] }),
    ]);

    const companies: Company[] = (companiesRes.data as any[]) || [];
    const payments = paymentsRes.data || [];
    const invoices = (invoicesRes as any).error ? [] : (invoicesRes.data || []);
    const quotes = quotesRes.data || [];
    const churnEvents = (churnRes as any).error ? [] : (churnRes.data || []);
    const deals = dealsRes.data || [];
    const legacyClients = clientsRes.data || [];

    const now = new Date();
    const monthStart = firstDayOfMonth(now).toISOString();
    const prevMonthStart = firstDayOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)).toISOString();
    const todayStr = now.toISOString().slice(0, 10);
    const in30Str = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

    // ─── Active customer base ───
    const activeCompanies = companies.filter(c => c.estado_cuenta === 'activo' || c.estado_cuenta === 'trial');
    const cancelledCompanies = companies.filter(c => c.estado_cuenta === 'cancelado');

    // Fallback to legacy clients if no active companies
    const useCompanies = activeCompanies.length > 0;
    const activeCount = useCompanies ? activeCompanies.length : legacyClients.filter((c: any) => c.estado === 'activo').length;

    // ─── MRR (current) ───
    const mrr = useCompanies
      ? activeCompanies.reduce((s, c) => s + (Number(c.mrr) || 0), 0)
      : legacyClients
          .filter((c: any) => c.estado === 'activo')
          .reduce((s: number, c: any) => s + (parseFloat(c.precio_mensual) || 0) * (c.sucursales || 1), 0);
    const arr = mrr * 12;

    // ─── MRR breakdown (New, Expansion, Contraction, Churn) this month ───
    // New MRR = first payment of a company this month (or first invoice.pagada_at of type recurrente)
    const newMrr = useCompanies
      ? activeCompanies
          .filter(c => c.created_at && c.created_at >= monthStart)
          .reduce((s, c) => s + (Number(c.mrr) || 0), 0)
      : 0;

    // Churn MRR = sum of mrr_lost from churn_events this month
    const churnMrr = churnEvents
      .filter((e: any) => e.cancelled_at && e.cancelled_at >= monthStart)
      .reduce((s: number, e: any) => s + (Number(e.mrr_lost) || 0), 0);

    // Expansion/Contraction: simplified (change in invoice totals for same company this vs last month)
    const invoicesByCompanyThisMonth: Record<string, number> = {};
    const invoicesByCompanyLastMonth: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.tipo !== 'recurrente' || !inv.pagada_at || !inv.company_id) return;
      if (inv.pagada_at >= monthStart) {
        invoicesByCompanyThisMonth[inv.company_id] = (invoicesByCompanyThisMonth[inv.company_id] || 0) + Number(inv.total);
      } else if (inv.pagada_at >= prevMonthStart) {
        invoicesByCompanyLastMonth[inv.company_id] = (invoicesByCompanyLastMonth[inv.company_id] || 0) + Number(inv.total);
      }
    });
    let expansionMrr = 0, contractionMrr = 0;
    for (const cid of Object.keys(invoicesByCompanyThisMonth)) {
      const thisM = invoicesByCompanyThisMonth[cid] || 0;
      const lastM = invoicesByCompanyLastMonth[cid] || 0;
      if (lastM > 0 && thisM > lastM) expansionMrr += (thisM - lastM);
      if (lastM > 0 && thisM < lastM) contractionMrr += (lastM - thisM);
    }

    // Net New MRR = New + Expansion - Contraction - Churn
    const netNewMrr = newMrr + expansionMrr - contractionMrr - churnMrr;

    // ─── ARPU ───
    const arpu = activeCount > 0 ? mrr / activeCount : 0;

    // ─── Churn rate (monthly) ───
    const activeAtMonthStart = activeCount + cancelledCompanies.filter(c => c.created_at && c.created_at < monthStart).length;
    const monthChurnCount = churnEvents.filter((e: any) => e.cancelled_at && e.cancelled_at >= monthStart).length;
    const churnRateMonthly = activeAtMonthStart > 0 ? (monthChurnCount / activeAtMonthStart) * 100 : 0;
    const churnRateAnnual = churnRateMonthly * 12; // simple annualization

    // ─── LTV ≈ ARPU / monthly_churn_rate (decimal) ───
    const ltv = churnRateMonthly > 0 ? arpu / (churnRateMonthly / 100) : arpu * 24; // fallback: 24 months

    // ─── Cash collected this month (sum of payments this month) ───
    const cashThisMonth = payments
      .filter((p: any) => p.fecha && p.fecha >= monthStart)
      .reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0);
    const cashLastMonth = payments
      .filter((p: any) => p.fecha && p.fecha >= prevMonthStart && p.fecha < monthStart)
      .reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0);

    // ─── Billed this month (invoices emitidas) ───
    const billedThisMonth = invoices
      .filter((inv: any) => inv.emitida_at && inv.emitida_at >= monthStart)
      .reduce((s: number, inv: any) => s + (Number(inv.total) || 0), 0);

    // ─── Days Sales Outstanding (DSO) — simplified ───
    const outstandingInvoices = invoices.filter((inv: any) => inv.estado === 'emitida' || inv.estado === 'parcial');
    const outstandingTotal = outstandingInvoices.reduce((s: number, inv: any) => s + (Number(inv.total) || 0), 0);
    const dailyRevenue = cashThisMonth / Math.max(1, now.getDate());
    const dso = dailyRevenue > 0 ? Math.round(outstandingTotal / dailyRevenue) : 0;

    // ─── Quote conversion: accepted+paid / sent ───
    const quotesSent = quotes.filter((q: any) => ['sent', 'accepted', 'paid', 'rejected', 'expired'].includes(q.estado)).length;
    const quotesWon = quotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid').length;
    const conversionRate = quotesSent > 0 ? Math.round((quotesWon / quotesSent) * 100) : 0;

    // ─── Failed payment rate (last 90d) ───
    const ninetyDays = new Date(); ninetyDays.setDate(ninetyDays.getDate() - 90);
    const ninetyDaysIso = ninetyDays.toISOString();
    const { data: failedActivities } = await supabase
      .from('activities')
      .select('id')
      .eq('tipo', 'pago')
      .like('titulo', 'Pago fallido%')
      .gte('created_at', ninetyDaysIso);
    const failedCount = (failedActivities || []).length;
    const paymentsLast90 = payments.filter((p: any) => p.fecha && p.fecha >= ninetyDaysIso.slice(0, 10)).length;
    const failedRate = paymentsLast90 + failedCount > 0 ? Math.round((failedCount / (paymentsLast90 + failedCount)) * 100) : 0;

    // ─── Pipeline value (open deals) ───
    const openDeals = deals.filter((d: any) => !['cerrada_ganada', 'cerrada_perdida'].includes(d.stage));
    const pipelineValue = openDeals.reduce((s: number, d: any) => s + (Number(d.valor_total) || 0), 0);
    const weightedPipeline = openDeals.reduce((s: number, d: any) => s + (Number(d.valor_total) || 0) * (Number(d.probabilidad) || 0) / 100, 0);

    // ─── Next renewals (30 days) + Overdue ───
    const nextRenewals = (useCompanies ? activeCompanies : [])
      .filter(c => c.fecha_renovacion && c.fecha_renovacion <= in30Str)
      .sort((a, b) => (a.fecha_renovacion || '').localeCompare(b.fecha_renovacion || ''))
      .slice(0, 20);
    const overdue = useCompanies ? companies.filter(c => c.estado_cuenta === 'vencido') : [];

    // ─── By plan breakdown ───
    const byPlan: Record<string, { count: number; mrr: number }> = {};
    if (useCompanies) {
      activeCompanies.forEach(c => {
        const p = c.plan || 'sin plan';
        if (!byPlan[p]) byPlan[p] = { count: 0, mrr: 0 };
        byPlan[p].count++;
        byPlan[p].mrr += Number(c.mrr) || 0;
      });
    } else {
      legacyClients
        .filter((c: any) => c.estado === 'activo')
        .forEach((c: any) => {
          const p = c.plan || 'sin plan';
          if (!byPlan[p]) byPlan[p] = { count: 0, mrr: 0 };
          byPlan[p].count++;
          byPlan[p].mrr += (parseFloat(c.precio_mensual) || 0) * (c.sucursales || 1);
        });
    }

    // ─── Monthly revenue chart (last 12 months) ───
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthlyRevenue[d.toISOString().slice(0, 7)] = 0;
    }
    payments.forEach((p: any) => {
      const key = (p.fecha || '').slice(0, 7);
      if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += Number(p.monto) || 0;
    });

    // ─── Churn reasons breakdown ───
    const churnByReason: Record<string, { count: number; mrr_lost: number }> = {};
    churnEvents.forEach((e: any) => {
      const r = e.reason || 'otro';
      if (!churnByReason[r]) churnByReason[r] = { count: 0, mrr_lost: 0 };
      churnByReason[r].count++;
      churnByReason[r].mrr_lost += Number(e.mrr_lost) || 0;
    });

    return new Response(JSON.stringify({
      // Primary KPIs
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      arpu: Math.round(arpu),
      ltv: Math.round(ltv),

      // MRR breakdown
      mrrBreakdown: {
        new: Math.round(newMrr),
        expansion: Math.round(expansionMrr),
        contraction: Math.round(contractionMrr),
        churn: Math.round(churnMrr),
        netNew: Math.round(netNewMrr),
      },

      // Customer counts
      activeClients: activeCount,
      totalClients: companies.length || legacyClients.length,
      cancelledClients: cancelledCompanies.length,

      // Churn
      churnRate: Math.round(churnRateMonthly * 10) / 10,        // monthly %
      churnRateAnnual: Math.round(churnRateAnnual * 10) / 10,   // annualized %
      churnByReason,

      // Conversion + efficiency
      conversionRate,
      failedPaymentRate: failedRate,

      // Cash / billing
      cashThisMonth: Math.round(cashThisMonth),
      cashLastMonth: Math.round(cashLastMonth),
      billedThisMonth: Math.round(billedThisMonth),
      outstandingBilled: Math.round(outstandingTotal),
      dso,

      // Pipeline
      pipelineValue: Math.round(pipelineValue),
      weightedPipeline: Math.round(weightedPipeline),
      openDealsCount: openDeals.length,

      // Distribution
      byPlan,
      nextRenewals,
      overdue,
      monthlyRevenue,

      // Sources
      recentPayments: payments.slice().sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 10),
      dataSource: useCompanies ? 'companies_crm' : 'clients_legacy',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
