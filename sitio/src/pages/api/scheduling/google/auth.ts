import type { APIRoute } from 'astro';
import { getAuthUrl } from '../../../../lib/google-calendar';

export const prerender = false;

/**
 * GET /api/scheduling/google/auth?team_member_id=uuid
 * Returns the Google OAuth URL to redirect the user to.
 */
export const GET: APIRoute = async ({ url }) => {
  const teamMemberId = url.searchParams.get('team_member_id');
  if (!teamMemberId) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  const authUrl = getAuthUrl(teamMemberId);
  return new Response(JSON.stringify({ url: authUrl }));
};
