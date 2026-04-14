import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export const GET: APIRoute = async ({ url }) => {
  const days = Number(url.searchParams.get('days')) || 30;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);

  // Fetch all bookings in period
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, created_at, fecha, hora_inicio, estado, event_type_id')
    .gte('created_at', sinceISO);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const all = bookings || [];
  const total = all.length;

  // By estado
  const byEstado: Record<string, number> = {};
  for (const b of all) {
    byEstado[b.estado] = (byEstado[b.estado] || 0) + 1;
  }

  // No-show rate
  const realizada = byEstado['realizada'] || 0;
  const noShow = byEstado['no_show'] || 0;
  const noShowRate = realizada + noShow > 0
    ? Math.round((noShow / (realizada + noShow)) * 1000) / 10
    : 0;

  // Cancel rate
  const cancelada = byEstado['cancelada'] || 0;
  const cancelRate = total > 0
    ? Math.round((cancelada / total) * 1000) / 10
    : 0;

  // Average lead time
  let totalLeadDays = 0;
  let leadCount = 0;
  for (const b of all) {
    if (b.created_at && b.fecha) {
      const created = new Date(b.created_at);
      const fecha = new Date(b.fecha + 'T00:00:00');
      const diffDays = (fecha.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0) {
        totalLeadDays += diffDays;
        leadCount++;
      }
    }
  }
  const avgLeadTimeDays = leadCount > 0
    ? Math.round((totalLeadDays / leadCount) * 10) / 10
    : 0;

  // Popular day of week
  const dayCounts: Record<number, number> = {};
  for (const b of all) {
    if (b.fecha) {
      const dow = new Date(b.fecha + 'T00:00:00').getDay();
      dayCounts[dow] = (dayCounts[dow] || 0) + 1;
    }
  }
  let popularDay = { day: 0, label: DAY_LABELS[0], count: 0 };
  for (const [d, c] of Object.entries(dayCounts)) {
    if (c > popularDay.count) {
      popularDay = { day: Number(d), label: DAY_LABELS[Number(d)], count: c };
    }
  }

  // Popular hour
  const hourCounts: Record<string, number> = {};
  for (const b of all) {
    if (b.hora_inicio) {
      const hour = b.hora_inicio.slice(0, 5);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  }
  let popularHour = { hour: '09:00', count: 0 };
  for (const [h, c] of Object.entries(hourCounts)) {
    if (c > popularHour.count) {
      popularHour = { hour: h, count: c };
    }
  }

  // By week
  const weekCounts: Record<string, number> = {};
  for (const b of all) {
    if (b.fecha) {
      const d = new Date(b.fecha + 'T00:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(d);
      monday.setDate(diff);
      const weekKey = monday.toISOString().slice(0, 10);
      weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
    }
  }
  const byWeek = Object.entries(weekCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  // By event type (simple counts for backward compat)
  const eventTypeCounts: Record<string, number> = {};
  for (const b of all) {
    if (b.event_type_id) {
      eventTypeCounts[b.event_type_id] = (eventTypeCounts[b.event_type_id] || 0) + 1;
    }
  }

  // Fetch event type names/colors
  const etIds = Object.keys(eventTypeCounts);
  let byEventType: { nombre: string; count: number; color: string }[] = [];
  if (etIds.length > 0) {
    const { data: eventTypes } = await supabase
      .from('event_types')
      .select('id, nombre, color')
      .in('id', etIds);

    if (eventTypes) {
      byEventType = eventTypes.map(et => ({
        nombre: et.nombre,
        count: eventTypeCounts[et.id] || 0,
        color: et.color || '#4B7BE5',
      })).sort((a, b) => b.count - a.count);
    }
  }

  // Per event type detailed metrics
  const nDaysAgo = sinceISO;
  const { data: activeEventTypes } = await supabase.from('event_types').select('id, nombre, color').eq('activo', true);

  const byEventTypeDetailed: Array<{
    id: string;
    nombre: string;
    color: string;
    total: number;
    realizada: number;
    no_show: number;
    cancelada: number;
    reagendada: number;
    completion_rate: number;
    no_show_rate: number;
  }> = [];

  for (const et of (activeEventTypes || [])) {
    const { count: etTotal } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_type_id', et.id).gte('fecha', nDaysAgo);
    const { count: etRealizada } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_type_id', et.id).eq('estado', 'realizada').gte('fecha', nDaysAgo);
    const { count: etNoShow } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_type_id', et.id).eq('estado', 'no_show').gte('fecha', nDaysAgo);
    const { count: etCancelada } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_type_id', et.id).eq('estado', 'cancelada').gte('fecha', nDaysAgo);
    const { count: etReagendada } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('event_type_id', et.id).eq('estado', 'reagendada').gte('fecha', nDaysAgo);

    byEventTypeDetailed.push({
      id: et.id,
      nombre: et.nombre,
      color: et.color || '#4B7BE5',
      total: etTotal || 0,
      realizada: etRealizada || 0,
      no_show: etNoShow || 0,
      cancelada: etCancelada || 0,
      reagendada: etReagendada || 0,
      completion_rate: (etTotal || 0) > 0 ? Math.round(((etRealizada || 0) / (etTotal || 0)) * 100) : 0,
      no_show_rate: ((etRealizada || 0) + (etNoShow || 0)) > 0 ? Math.round(((etNoShow || 0) / ((etRealizada || 0) + (etNoShow || 0))) * 100) : 0,
    });
  }

  return new Response(
    JSON.stringify({
      period_days: days,
      total,
      by_estado: byEstado,
      no_show_rate: noShowRate,
      cancel_rate: cancelRate,
      avg_lead_time_days: avgLeadTimeDays,
      popular_day: popularDay,
      popular_hour: popularHour,
      by_week: byWeek,
      by_event_type: byEventType,
      by_event_type_detailed: byEventTypeDetailed,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
