// GET /api/partner-portal/summary
// KPIs del portal: próximo pago, pendiente, bonos del mes, total año.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const partnerId = user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString();

  // Próximo pago = sum de earned (no paid)
  // Pendiente = sum de pending
  const { data: rows } = await supabase
    .from('partner_commissions')
    .select('id, status, tipo, commission_amount, created_at, earned_at, paid_at')
    .eq('partner_id', partnerId)
    .neq('status', 'cancelled');

  const all = rows || [];
  const sum = (filter: (r: any) => boolean) =>
    all.filter(filter).reduce((acc, r) => acc + Number(r.commission_amount || 0), 0);

  const proximoPago = sum(r => r.status === 'earned');
  const pendiente   = sum(r => r.status === 'pending');
  const totalAno    = sum(r => (r.paid_at && r.paid_at >= yearStart) || (r.earned_at && r.earned_at >= yearStart));

  // Bonos del mes (count + sum por tipo)
  const inMonth = (r: any) => (r.created_at || '') >= monthStart;
  const bonosMes = {
    prueba_gratis_count: all.filter(r => inMonth(r) && r.tipo === 'prueba_gratis').length,
    prueba_gratis_sum:   sum(r => inMonth(r) && r.tipo === 'prueba_gratis'),
    demo_completada_count: all.filter(r => inMonth(r) && r.tipo === 'demo_completada').length,
    demo_completada_sum:   sum(r => inMonth(r) && r.tipo === 'demo_completada'),
    venta_directa_count: all.filter(r => inMonth(r) && r.tipo === 'venta_directa').length,
    venta_directa_sum:   sum(r => inMonth(r) && r.tipo === 'venta_directa'),
  };

  // Counts de leads atribuidos
  const { count: leadsCount } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_partner_id', partnerId);

  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_partner_id', partnerId);

  const { count: bookingsRealizadasCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_partner_id', partnerId)
    .eq('estado', 'realizada');

  return j({
    user: { id: user.id, nombre: user.nombre, email: user.email, default_commission_pct: user.default_commission_pct },
    proximoPago,
    pendiente,
    totalAno,
    bonosMes,
    leads: {
      total: leadsCount || 0,
      bookings: bookingsCount || 0,
      bookings_realizadas: bookingsRealizadasCount || 0,
    },
  });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
