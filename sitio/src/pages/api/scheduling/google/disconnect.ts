import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolveSchedulingTarget } from '../../../../lib/scheduling/scope';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json().catch(() => ({}));
  const team_member_id = resolveSchedulingTarget(user, body?.team_member_id);
  if (!team_member_id) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  await supabase
    .from('calendar_connections')
    .update({ activo: false })
    .eq('team_member_id', team_member_id)
    .eq('provider', 'google');

  return new Response(JSON.stringify({ success: true }));
};
