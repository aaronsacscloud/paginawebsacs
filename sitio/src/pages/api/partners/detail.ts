// GET /api/partners/detail?partner_id=X
// Admin-only. Devuelve overview de un partner: invitación, commissions,
// contacts, bookings, deals atribuidos. Para mostrar en el detail drawer
// del CRM PartnersTab.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthenticated' }, 401);
  if (user.role !== 'founder') return j({ error: 'admin only' }, 403);

  const partner_id = url.searchParams.get('partner_id');
  if (!partner_id) return j({ error: 'partner_id required' }, 400);

  // Member info
  const { data: member } = await supabase
    .from('team_members')
    .select('id, nombre, email, rol, default_commission_pct, activo, last_login_at, fideliza_account_at, created_at')
    .eq('id', partner_id)
    .maybeSingle();
  if (!member) return j({ error: 'partner not found' }, 404);

  // Latest invitation
  const { data: invitation } = await supabase
    .from('partner_invitations')
    .select('id, numero, tipo, slug_landing, comision_pct, vigencia, estado, empresa, whatsapp, aceptado_fecha, created_at')
    .eq('team_member_id', partner_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Commissions resumen
  const { data: comms } = await supabase
    .from('partner_commissions')
    .select('id, tipo, status, commission_amount, created_at, earned_at, paid_at, payment_reference, nota')
    .eq('partner_id', partner_id)
    .order('created_at', { ascending: false })
    .limit(50);

  const commsArr = comms || [];
  const sumBy = (s: string) => commsArr.filter(c => c.status === s).reduce((a, c) => a + Number(c.commission_amount || 0), 0);
  const summary = {
    pending: sumBy('pending'),
    earned: sumBy('earned'),
    paid: sumBy('paid'),
    cancelled: sumBy('cancelled'),
    total: commsArr.reduce((a, c) => a + Number(c.commission_amount || 0), 0),
    countByTipo: {
      prueba_gratis: commsArr.filter(c => c.tipo === 'prueba_gratis').length,
      demo_completada: commsArr.filter(c => c.tipo === 'demo_completada').length,
      venta_directa: commsArr.filter(c => c.tipo === 'venta_directa').length,
    },
  };

  // Leads atribuidos
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, nombre, email, lifecycle_stage, fuente, plan_interes, created_at')
    .eq('referrer_partner_id', partner_id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, invitee_nombre, invitee_email, fecha, hora_inicio, estado, created_at')
    .eq('referrer_partner_id', partner_id)
    .order('fecha', { ascending: false })
    .limit(50);

  // Deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, nombre, valor_total, valor_mensual, stage, closed_at, created_at')
    .eq('referrer_partner_id', partner_id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Activity log (sistema)
  const { data: activities } = await supabase
    .from('activities')
    .select('id, tipo, titulo, created_at')
    .like('titulo', `%${member.nombre || ''}%`)
    .order('created_at', { ascending: false })
    .limit(30);

  return j({
    member,
    invitation,
    summary,
    commissions: commsArr,
    contacts: contacts || [],
    bookings: bookings || [],
    deals: deals || [],
    activities: activities || [],
  });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
