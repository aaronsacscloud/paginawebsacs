import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { team_member_id } = await request.json();
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
