// Estado de la conexión Google Calendar del team_member.
// Partner: siempre su propio estado (ignora team_member_id externo).
// Founder/CS: pueden consultar otro team_member vía query param.

import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolveSchedulingTarget } from '../../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  const teamMemberId = resolveSchedulingTarget(user, url.searchParams.get('team_member_id'));
  if (!teamMemberId) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  const { data } = await supabase
    .from('calendar_connections')
    .select('calendar_id, activo, created_at, token_expires_at')
    .eq('team_member_id', teamMemberId)
    .eq('provider', 'google')
    .maybeSingle();

  return new Response(JSON.stringify({
    connected: !!(data && data.activo),
    calendar_id: data?.calendar_id || null,
    connected_at: data?.created_at || null,
    token_expires_at: data?.token_expires_at || null,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
