import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') || 'demo';

  // Load historical bookings (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
    .toISOString()
    .slice(0, 10);
  const { data: history } = await supabase
    .from('bookings')
    .select('hora_inicio, fecha, estado')
    .gte('fecha', ninetyDaysAgo)
    .in('estado', ['realizada', 'no_show']);

  // Count completions by hour
  const hourCounts: Record<string, { total: number; realized: number }> = {};
  const dayCounts: Record<number, { total: number; realized: number }> = {};

  for (const b of history || []) {
    const hour = b.hora_inicio?.slice(0, 2) || '09';
    if (!hourCounts[hour]) hourCounts[hour] = { total: 0, realized: 0 };
    hourCounts[hour].total++;
    if (b.estado === 'realizada') hourCounts[hour].realized++;

    const dow = new Date(b.fecha + 'T12:00:00').getDay();
    if (!dayCounts[dow]) dayCounts[dow] = { total: 0, realized: 0 };
    dayCounts[dow].total++;
    if (b.estado === 'realizada') dayCounts[dow].realized++;
  }

  // Find best hours and days by completion rate
  const bestHours = Object.entries(hourCounts)
    .map(([hour, data]) => ({
      hour,
      rate: data.total > 0 ? data.realized / data.total : 0,
      count: data.total,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  const bestDays = Object.entries(dayCounts)
    .map(([day, data]) => ({
      day: parseInt(day),
      rate: data.total > 0 ? data.realized / data.total : 0,
      count: data.total,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  // Sets for quick lookup in scoring
  const bestHourSet = new Set(bestHours.map((h) => h.hour));
  const bestDaySet = new Set(bestDays.map((d) => d.day));

  // Score function
  function scoreSlot(date: string, time: string): number {
    let score = 0;
    const hour = time.slice(0, 2);
    const dow = new Date(date + 'T12:00:00').getDay();
    const hourNum = parseInt(hour);

    if (bestHourSet.has(hour)) score += 10;
    if (bestDaySet.has(dow)) score += 5;
    if (hourNum >= 9 && hourNum <= 12) score += 3; // Morning bonus
    if (dow === 5 && hourNum >= 14) score -= 5; // Friday afternoon penalty
    if (dow === 1 && hourNum <= 10) score += 2; // Monday morning is productive

    return score;
  }

  return new Response(
    JSON.stringify({
      insights: {
        best_hours: bestHours,
        best_days: bestDays.map((d) => ({
          ...d,
          label: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.day],
        })),
        total_analyzed: (history || []).length,
      },
      scoring_available: true,
      message:
        'Use scoreSlot() with available-slots data to get recommendations',
    }),
  );
};
