import type { APIRoute } from 'astro';
import { getAuthUrl } from '../../../../lib/google-calendar';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolveSchedulingTarget } from '../../../../lib/scheduling/scope';

export const prerender = false;

/**
 * GET /api/scheduling/google/auth[?team_member_id=uuid]
 * Returns the Google OAuth URL to redirect the user to.
 * Partner siempre conecta su propio calendar (ignora team_member_id externo).
 * Founder/CS pueden conectar el calendar de otro pasando team_member_id.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const teamMemberId = resolveSchedulingTarget(user, url.searchParams.get('team_member_id'));
  if (!teamMemberId) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  const authUrl = getAuthUrl(teamMemberId);
  return new Response(null, {
    status: 302,
    headers: { 'Location': authUrl },
  });
};
