// GET /api/partner-portal/leads
// Listado de leads/contacts/bookings/deals atribuidos a este partner.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, nombre, email, whatsapp, lifecycle_stage, fuente, plan_interes, created_at')
    .eq('referrer_partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, invitee_nombre, invitee_email, fecha, hora_inicio, estado, created_at, contact_id')
    .eq('referrer_partner_id', user.id)
    .order('fecha', { ascending: false })
    .limit(100);

  const { data: deals } = await supabase
    .from('deals')
    .select('id, nombre, valor_total, stage, created_at, contact_id, closed_at')
    .eq('referrer_partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return j({
    contacts: contacts || [],
    bookings: bookings || [],
    deals:    deals    || [],
  });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
