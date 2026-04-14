import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  // Get all open deals
  const { data: deals } = await supabase
    .from('deals')
    .select('stage, valor_mensual, valor_total, probabilidad, created_at, closed_at, days_in_pipeline')
    .is('archived_at', null);

  if (!deals) return new Response(JSON.stringify({}));

  const open = deals.filter(d => !['cerrada_ganada', 'cerrada_perdida'].includes(d.stage));
  const won = deals.filter(d => d.stage === 'cerrada_ganada');
  const lost = deals.filter(d => d.stage === 'cerrada_perdida');

  // By stage
  const stages = ['calificacion', 'demo_agendada', 'demo_realizada', 'cotizacion_enviada', 'negociacion'];
  const byStage = stages.map(s => {
    const stageDeals = open.filter(d => d.stage === s);
    return {
      stage: s,
      count: stageDeals.length,
      valor_total: stageDeals.reduce((sum, d) => sum + (d.valor_total || 0), 0),
      valor_ponderado: stageDeals.reduce((sum, d) => sum + (d.valor_total || 0) * (d.probabilidad / 100), 0),
    };
  });

  // Conversion rates between stages
  const stageOrder = [...stages, 'cerrada_ganada'];
  const conversions = stageOrder.slice(1).map((s, i) => {
    const prev = stageOrder[i];
    const prevCount = deals.filter(d => stageOrder.indexOf(d.stage) >= i || d.stage === 'cerrada_ganada' || d.stage === 'cerrada_perdida').length;
    const currCount = deals.filter(d => stageOrder.indexOf(d.stage) >= i + 1 || d.stage === 'cerrada_ganada').length;
    return { from: prev, to: s, rate: prevCount > 0 ? Math.round((currCount / prevCount) * 100) : 0 };
  });

  // Velocity
  const wonWithDays = won.filter(d => d.days_in_pipeline != null);
  const avgDays = wonWithDays.length > 0
    ? Math.round(wonWithDays.reduce((s, d) => s + d.days_in_pipeline!, 0) / wonWithDays.length)
    : 0;

  // Win rate
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;

  // Contacts summary
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('archived_at', null);

  const { count: totalLeads } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'lead')
    .is('archived_at', null);

  const { count: totalClients } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'cliente')
    .is('archived_at', null);

  return new Response(JSON.stringify({
    pipeline: {
      total_open: open.length,
      total_value: open.reduce((s, d) => s + (d.valor_total || 0), 0),
      weighted_value: open.reduce((s, d) => s + (d.valor_total || 0) * (d.probabilidad / 100), 0),
      byStage,
    },
    velocity: { avg_days: avgDays, win_rate: winRate, won: won.length, lost: lost.length },
    conversions,
    contacts: { total: totalContacts || 0, leads: totalLeads || 0, clients: totalClients || 0 },
  }));
};
