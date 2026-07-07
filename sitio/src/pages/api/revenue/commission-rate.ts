import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

// Tasa de comisión del partner logueado — para mostrar en el editor de
// cotizaciones "tu comisión estimada". Misma fuente que commissions/calculate.ts
// (team_members.default_commission_pct, default 20).

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'partner') {
    return new Response(JSON.stringify({ pct: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { data } = await supabase
    .from('team_members')
    .select('default_commission_pct')
    .eq('id', user.id)
    .maybeSingle();

  const pct = Number(data?.default_commission_pct ?? 20) || 20;
  return new Response(JSON.stringify({ pct }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
