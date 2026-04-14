import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

// Names to use when not enough real bookings
const FAKE_NAMES = ['María', 'Carlos', 'Ana', 'Roberto', 'Laura', 'Diego', 'Sofía', 'Alejandro', 'Valentina', 'Fernando', 'Camila', 'Jorge', 'Isabella', 'Andrés', 'Daniela', 'Miguel', 'Gabriela', 'José', 'Natalia', 'Luis'];
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const GET: APIRoute = async () => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Real bookings this week
  const { count: realBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekStartStr + 'T00:00:00');

  // Base number + real for social proof (makes it look busier)
  const baseNumber = 180 + (now.getDay() * 15); // Grows through the week
  const displayNumber = baseNumber + (realBookings || 0);

  // Recent bookings for toast notifications
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('invitee_nombre, fecha, created_at')
    .eq('estado', 'confirmada')
    .order('created_at', { ascending: false })
    .limit(10);

  // Build toast data — mix real + generated
  const toasts: Array<{ nombre: string; dia: string; hace: string }> = [];

  // Add real bookings
  for (const b of (recentBookings || []).slice(0, 5)) {
    const firstName = (b.invitee_nombre || '').split(' ')[0];
    if (!firstName) continue;
    const bookDate = new Date(b.fecha + 'T12:00:00');
    const dia = DAYS_ES[bookDate.getDay()];
    const minsAgo = Math.floor((now.getTime() - new Date(b.created_at).getTime()) / 60000);
    const hace = minsAgo < 5 ? 'hace un momento' : minsAgo < 60 ? `hace ${minsAgo} min` : minsAgo < 1440 ? `hace ${Math.floor(minsAgo / 60)}h` : `hace ${Math.floor(minsAgo / 1440)}d`;
    toasts.push({ nombre: firstName, dia, hace });
  }

  // Fill with generated if not enough
  while (toasts.length < 8) {
    const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const daysAhead = Math.floor(Math.random() * 5) + 1;
    const futureDate = new Date(now.getTime() + daysAhead * 86400000);
    const dia = DAYS_ES[futureDate.getDay()];
    const minsAgo = Math.floor(Math.random() * 30) + 2;
    const hace = minsAgo < 10 ? `hace ${minsAgo} min` : `hace ${minsAgo} min`;
    toasts.push({ nombre: name, dia, hace });
  }

  // Shuffle toasts
  for (let i = toasts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toasts[i], toasts[j]] = [toasts[j], toasts[i]];
  }

  // Popular times (most booked hours)
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('hora_inicio')
    .eq('estado', 'confirmada')
    .limit(200);

  const hourCounts: Record<string, number> = {};
  for (const b of (allBookings || [])) {
    const h = (b.hora_inicio || '').slice(0, 5);
    if (h) hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const popularTimes = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([time]) => time);

  // If no data, default popular times
  if (popularTimes.length === 0) {
    popularTimes.push('10:00', '11:00', '14:00');
  }

  // Popular day
  const dayCounts: Record<number, number> = {};
  for (const b of (recentBookings || [])) {
    const d = new Date(b.fecha + 'T12:00:00').getDay();
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  }
  const popularDayIdx = Object.entries(dayCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || '2';
  const popularDay = DAYS_ES[Number(popularDayIdx)] || 'martes';

  // Viewers (semi-random, changes every 3 minutes)
  const seed = Math.floor(now.getTime() / 180000);
  const viewers = 2 + (seed % 4); // 2-5

  return new Response(JSON.stringify({
    bookings_this_week: displayNumber,
    toasts,
    popular_times: popularTimes,
    popular_day: popularDay,
    viewers,
  }), {
    headers: { 'Cache-Control': 'public, max-age=60' }, // Cache 1 min
  });
};
