// Vercel Cron nocturno — /api/crm/detect-expansion
// Detecta señales de upsell y las persiste en expansion_signals.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const results: any = { detected: 0, skipped: 0, errors: [] as string[] };

  const { data: companies } = await supabase
    .from('companies')
    .select('id, nombre, plan, sucursales, mrr, created_at, billing_period')
    .eq('estado_cuenta', 'activo');

  for (const c of companies || []) {
    try {
      // 1. mensual_largo: billing_period='mensual' AND >6 meses activo → ofrecer anual
      const months = c.created_at ? (Date.now() - new Date(c.created_at).getTime()) / (86400000 * 30) : 0;
      if (c.billing_period === 'mensual' && months >= 6) {
        const { data: existing } = await supabase
          .from('expansion_signals')
          .select('id')
          .eq('company_id', c.id)
          .eq('signal_type', 'mensual_largo')
          .is('dismissed_at', null)
          .maybeSingle();
        if (!existing) {
          // Anual discount potential (2 months off)
          const opportunityValue = (Number(c.mrr) || 0) * 10; // anual = 10 meses
          await supabase.from('expansion_signals').insert({
            company_id: c.id,
            signal_type: 'mensual_largo',
            opportunity_value: opportunityValue,
            metadata: { months_active: Math.round(months), current_mrr: c.mrr },
          });
          results.detected++;
        } else {
          results.skipped++;
        }
      }

      // 2. sucursales_delta: sucursales actuales > sucursales hace 90d
      // (simplified — hoy solo tenemos snapshot actual, así que esta señal requiere histórico)
      // Para v1: marcar si sucursales >= 5 y plan !== 'automatiza'
      if ((c.sucursales || 0) >= 5 && c.plan && c.plan !== 'automatiza') {
        const { data: existing } = await supabase
          .from('expansion_signals')
          .select('id')
          .eq('company_id', c.id)
          .eq('signal_type', 'plan_bajo_uso_alto')
          .is('dismissed_at', null)
          .maybeSingle();
        if (!existing) {
          await supabase.from('expansion_signals').insert({
            company_id: c.id,
            signal_type: 'plan_bajo_uso_alto',
            opportunity_value: (Number(c.mrr) || 0) * 0.5, // +50% al upgrade
            metadata: { current_plan: c.plan, sucursales: c.sucursales, suggested_plan: 'automatiza' },
          });
          results.detected++;
        } else {
          results.skipped++;
        }
      }
    } catch (err) {
      results.errors.push(`company ${c.id}: ${String(err)}`);
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
