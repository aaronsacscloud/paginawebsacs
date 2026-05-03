// GET /api/partners/dashboard — KPIs del partner: MRR generado, pipeline, comisiones, leaderboard anonimizado.
// Partner ve solo lo suyo; founder ve agregado + breakdown por partner.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });

  const partnerIdQuery = url.searchParams.get('partner_id');
  const scopePartnerId = user.role === 'founder' ? (partnerIdQuery || null) : user.id;

  // ─── Commissions summary ───
  let commQuery = supabase.from('partner_commissions').select('status, commission_amount, deal_id');
  if (scopePartnerId) commQuery = commQuery.eq('partner_id', scopePartnerId);
  const { data: commissions } = await commQuery;
  const commSummary = {
    pending: 0, earned: 0, paid: 0, total_deals: 0,
  };
  for (const c of commissions || []) {
    commSummary.total_deals++;
    const amt = Number(c.commission_amount) || 0;
    if (c.status === 'pending') commSummary.pending += amt;
    else if (c.status === 'earned') commSummary.earned += amt;
    else if (c.status === 'paid') commSummary.paid += amt;
  }

  // ─── MRR generado este mes (deals cerrada_ganada con partner in current month) ───
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  let dealsQuery = supabase
    .from('deals')
    .select('id, valor_total, valor_mensual, stage, closed_at, owner_id, referrer_partner_id, nombre, probabilidad')
    .is('archived_at', null);
  // Para vista de partner: filtrar por referrer_partner_id (modelo nuevo)
  // o owner_id (compat con deals viejos sin referrer). OR-condition en
  // Supabase: usamos .or() para incluir ambos casos.
  if (scopePartnerId) {
    dealsQuery = dealsQuery.or(`referrer_partner_id.eq.${scopePartnerId},owner_id.eq.${scopePartnerId}`);
  }
  const { data: deals } = await dealsQuery;

  const allDeals = deals || [];
  const mrrThisMonth = allDeals
    .filter(d => d.stage === 'cerrada_ganada' && d.closed_at && d.closed_at >= monthStart)
    .reduce((s, d) => s + (Number(d.valor_mensual) || 0), 0);
  const mrrYTD = allDeals
    .filter(d => d.stage === 'cerrada_ganada')
    .reduce((s, d) => s + (Number(d.valor_mensual) || 0), 0);

  // ─── Pipeline (open deals) ───
  const openDeals = allDeals.filter(d => !['cerrada_ganada', 'cerrada_perdida'].includes(d.stage));
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.valor_total) || 0), 0);
  const weightedPipeline = openDeals.reduce((s, d) => s + (Number(d.valor_total) || 0) * (Number(d.probabilidad) || 0) / 100, 0);

  // Kanban breakdown
  const byStage: Record<string, { count: number; valor: number }> = {};
  for (const d of openDeals) {
    const s = d.stage || 'calificacion';
    if (!byStage[s]) byStage[s] = { count: 0, valor: 0 };
    byStage[s].count++;
    byStage[s].valor += Number(d.valor_total) || 0;
  }

  // ─── Leaderboard (only for partner view) ───
  let leaderboard: any[] = [];
  if (user.role === 'partner') {
    // Calcula tu posición entre todos los partners (anonimizado)
    const { data: allPartners } = await supabase.from('team_members').select('id').eq('rol', 'partner');
    const { data: allDealsAll } = await supabase
      .from('deals')
      .select('owner_id, referrer_partner_id, valor_mensual, stage')
      .eq('stage', 'cerrada_ganada')
      .gte('closed_at', monthStart);

    const partnerMrr: Record<string, number> = {};
    for (const p of allPartners || []) partnerMrr[p.id] = 0;
    for (const d of allDealsAll || []) {
      // Atribución prefer referrer (modelo nuevo) sobre owner (legacy)
      const attribTo = (d as any).referrer_partner_id || d.owner_id;
      if (attribTo && partnerMrr[attribTo] !== undefined) {
        partnerMrr[attribTo] = (partnerMrr[attribTo] || 0) + (Number(d.valor_mensual) || 0);
      }
    }

    const ranked = Object.entries(partnerMrr)
      .map(([id, v]) => ({ id, mrr: v }))
      .sort((a, b) => b.mrr - a.mrr);

    const myRank = ranked.findIndex(r => r.id === user.id) + 1;
    const totalPartners = ranked.length;
    const median = totalPartners ? ranked[Math.floor(totalPartners / 2)]?.mrr || 0 : 0;
    const top = ranked[0]?.mrr || 0;

    leaderboard = [
      { rank: myRank, total: totalPartners, your_mrr: partnerMrr[user.id] || 0, median_mrr: median, top_mrr: top },
    ];
  }

  // ─── Founder view: breakdown by partner ───
  let partnersBreakdown: any[] = [];
  if (user.role === 'founder' && !partnerIdQuery) {
    const { data: partners } = await supabase
      .from('team_members')
      .select('id, nombre, email, rol, default_commission_pct')
      .eq('rol', 'partner');
    for (const p of partners || []) {
      const myDeals = allDeals.filter(d => (d as any).referrer_partner_id === p.id || d.owner_id === p.id);
      const myWon = myDeals.filter(d => d.stage === 'cerrada_ganada');
      partnersBreakdown.push({
        id: p.id, nombre: p.nombre, email: p.email,
        deals_abiertos: myDeals.filter(d => !['cerrada_ganada','cerrada_perdida'].includes(d.stage)).length,
        deals_ganados: myWon.length,
        mrr_total: myWon.reduce((s, d) => s + (Number(d.valor_mensual) || 0), 0),
      });
    }
  }

  return new Response(JSON.stringify({
    user: { id: user.id, role: user.role, nombre: user.nombre },
    commissions: commSummary,
    mrr: {
      this_month: Math.round(mrrThisMonth),
      ytd: Math.round(mrrYTD),
    },
    pipeline: {
      total_value: Math.round(pipelineValue),
      weighted: Math.round(weightedPipeline),
      open_count: openDeals.length,
      by_stage: byStage,
    },
    leaderboard,
    partners_breakdown: partnersBreakdown,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
