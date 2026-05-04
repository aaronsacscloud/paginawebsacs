// GET /api/partner-portal/link-stats
// Devuelve: total, únicos, recurrentes, hoy, semana, mes, último, top referrers, ventana de 30 días
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  // Traemos hasta 5000 visitas recientes y agregamos en memoria.
  // A escala mayor cambiamos a vistas materializadas.
  const { data: rows, error } = await supabase
    .from('partner_link_visits')
    .select('visitor_id, referrer, created_at')
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) return j({ error: error.message }, 500);

  const visits = rows || [];
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = now - 7 * dayMs;
  const monthStart = now - 30 * dayMs;

  // Contadores por visitor_id para distinguir únicos vs recurrentes
  const visitorCounts = new Map<string, number>();
  let today = 0, week = 0, month = 0;
  const referrerCounts = new Map<string, number>();
  // Buckets diarios para los últimos 30 días
  const dailyBuckets = new Map<string, number>();

  for (const v of visits) {
    visitorCounts.set(v.visitor_id, (visitorCounts.get(v.visitor_id) || 0) + 1);
    const t = new Date(v.created_at).getTime();
    if (t >= todayStart.getTime()) today++;
    if (t >= weekStart) week++;
    if (t >= monthStart) {
      month++;
      const day = new Date(v.created_at).toISOString().slice(0, 10);
      dailyBuckets.set(day, (dailyBuckets.get(day) || 0) + 1);
    }
    if (v.referrer) {
      const host = parseHost(v.referrer);
      if (host) referrerCounts.set(host, (referrerCounts.get(host) || 0) + 1);
    }
  }

  const total = visits.length;
  const unique = visitorCounts.size;
  const recurring = [...visitorCounts.values()].filter(c => c > 1).length;
  const lastVisitAt = visits[0]?.created_at || null;
  const topReferrers = [...referrerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([host, count]) => ({ host, count }));

  // Daily series: últimos 30 días, llenando huecos con 0
  const daily: { day: string; visits: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    daily.push({ day: key, visits: dailyBuckets.get(key) || 0 });
  }

  // Visitas recientes (últimas 10 sin PII)
  const recent = visits.slice(0, 10).map(v => ({
    when: v.created_at,
    referrer: v.referrer ? parseHost(v.referrer) : null,
    visitor_short: v.visitor_id.slice(0, 8),
    is_recurring: (visitorCounts.get(v.visitor_id) || 0) > 1,
  }));

  return j({
    total,
    unique,
    recurring,
    today,
    week,
    month,
    last_visit_at: lastVisitAt,
    top_referrers: topReferrers,
    daily,
    recent,
  });
};

function parseHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
