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
// Sanea return_url: solo permite paths relativos del mismo origen.
function safeReturnUrl(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  // Rechaza protocol-relative (//evil.com) y URLs absolutas.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  // Sin newlines o caracteres raros.
  if (/[\s\x00-\x1f]/.test(raw)) return fallback;
  return raw;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }
  const teamMemberId = resolveSchedulingTarget(user, url.searchParams.get('team_member_id'));
  if (!teamMemberId) {
    return new Response(JSON.stringify({ error: 'team_member_id required' }), { status: 400 });
  }

  // Return URL — partner vuelve a su portal, admin al CRM. Cliente puede
  // pasar return_url explícito; sino default por role.
  const defaultReturn = user.role === 'partner' ? '/partner/portal#agenda' : '/admin/crm?tab=agenda';
  const returnUrl = safeReturnUrl(url.searchParams.get('return_url'), defaultReturn);

  // State: "team_member_id|return_url" (pipe-delimited, simple).
  const state = `${teamMemberId}|${returnUrl}`;
  const authUrl = getAuthUrl(state);
  return new Response(null, {
    status: 302,
    headers: { 'Location': authUrl },
  });
};
