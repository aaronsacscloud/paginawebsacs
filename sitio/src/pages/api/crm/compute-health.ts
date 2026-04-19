// Vercel Cron nocturno — /api/crm/compute-health
// Computa health_score 0-100 por company usando factores:
//   - Pagos al día: 30 pts
//   - Actividad reciente 30d: 25 pts
//   - Engagement email 90d: 15 pts
//   - Respuesta canales 60d: 10 pts
//   - NPS última: 10 pts
//   - Antigüedad: 10 pts
// Persiste en companies.health_score + health_factors + health_computed_at.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const CRON_SECRET = (import.meta.env.CRON_SECRET || '').trim();

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / 86400000;
}

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  if (CRON_SECRET && !dryRun && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const results: any = { computed: 0, errors: [] as string[] };

  const { data: companies } = await supabase
    .from('companies')
    .select('id, created_at, fecha_renovacion, estado_cuenta, mrr, contact_id')
    .in('estado_cuenta', ['activo', 'trial', 'vencido']);

  for (const c of companies || []) {
    try {
      const factors: any = {};

      // 1. Pagos al día (30 pts)
      if (c.estado_cuenta === 'activo') factors.pagos = 30;
      else if (c.estado_cuenta === 'trial') factors.pagos = 20;
      else if (c.estado_cuenta === 'vencido') {
        const renewDays = c.fecha_renovacion ? daysSince(c.fecha_renovacion) : Infinity;
        if (renewDays <= 7) factors.pagos = 15;
        else if (renewDays <= 30) factors.pagos = 5;
        else factors.pagos = 0;
      } else factors.pagos = 0;

      // 2. Actividad reciente (25 pts) — activities de los últimos 30 días
      const { count: recentActs } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.id)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      factors.actividad = Math.min(25, (recentActs || 0) * 5); // 5 activities = max

      // 3. Email engagement 90d (15 pts) — activities tipo email abierto/respondido
      const { count: emailActs } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.id)
        .eq('tipo', 'email')
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
      factors.email_engagement = Math.min(15, (emailActs || 0) * 3);

      // 4. Respuesta canales 60d (10 pts) — llamadas + WhatsApp
      const { count: callActs } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.id)
        .in('tipo', ['llamada', 'whatsapp'])
        .gte('created_at', new Date(Date.now() - 60 * 86400000).toISOString());
      factors.respuesta = Math.min(10, (callActs || 0) * 2);

      // 5. NPS — placeholder (si existiera tabla nps_responses)
      factors.nps = 5; // neutro por default

      // 6. Antigüedad (10 pts bonus si >12 meses)
      const ageMonths = c.created_at ? (Date.now() - new Date(c.created_at).getTime()) / (86400000 * 30) : 0;
      factors.antiguedad = ageMonths >= 12 ? 10 : Math.round(ageMonths);

      const score = Math.min(100, Math.max(0, Math.round(
        factors.pagos + factors.actividad + factors.email_engagement + factors.respuesta + factors.nps + factors.antiguedad
      )));

      await supabase.from('companies').update({
        health_score: score,
        health_factors: factors,
        health_computed_at: new Date().toISOString(),
      }).eq('id', c.id);

      results.computed++;
    } catch (err) {
      results.errors.push(`company ${c.id}: ${String(err)}`);
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
