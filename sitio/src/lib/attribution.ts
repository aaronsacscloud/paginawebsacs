// Partner referral attribution.
// Resolution order:
//   1. ?ref=<partner_id> (URL query, set by /p/[slug] redirects)
//   2. cookie sacs_ref (90 días, set on /p/[slug] visit)
//
// Server-side helpers — usar desde APIs y desde /p/[slug].astro.

import { supabase } from './supabase';

const COOKIE_NAME = 'sacs_ref';
const COOKIE_TTL_DAYS = 90;

export function buildReferrerCookie(partnerId: string): string {
  const isProd = (import.meta.env.PROD || process.env.NODE_ENV === 'production');
  const expires = new Date(Date.now() + COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(partnerId)}`,
    `Path=/`,
    `Expires=${expires.toUTCString()}`,
    `SameSite=Lax`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Resuelve referrer_partner_id de la request.
 * Lee primero ?ref query (gana sobre cookie), luego cookie sacs_ref.
 * Valida que el partner exista en team_members y esté activo.
 * Retorna null si no aplica.
 */
export async function getReferrerFromRequest(request: Request): Promise<string | null> {
  let candidate: string | null = null;

  // 1. Query string ?ref=...
  try {
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get('ref');
    if (fromQuery) candidate = fromQuery;
  } catch {/* ignore */}

  // 2. Cookie sacs_ref
  if (!candidate) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match) candidate = decodeURIComponent(match[1]);
  }

  if (!candidate) return null;

  // Sanity: must be uuid-shaped
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) {
    return null;
  }

  // Validate partner exists + active + role partner
  const { data } = await supabase
    .from('team_members')
    .select('id, rol, activo')
    .eq('id', candidate)
    .maybeSingle();

  if (!data || !data.activo) return null;
  if ((data as any).rol !== 'partner' && (data as any).rol !== 'founder') return null;

  return data.id;
}

/**
 * Body-aware variant: si la request body trae ref_partner_id explícito
 * (e.g. enviado desde un form que lee localStorage), úsalo.
 */
export async function getReferrerFromBody(
  request: Request,
  bodyRefId: string | null | undefined,
): Promise<string | null> {
  if (bodyRefId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyRefId)) {
      return getReferrerFromRequest(request);
    }
    const { data } = await supabase
      .from('team_members')
      .select('id, rol, activo')
      .eq('id', bodyRefId)
      .maybeSingle();
    if (data && data.activo && ((data as any).rol === 'partner' || (data as any).rol === 'founder')) {
      return data.id;
    }
  }
  return getReferrerFromRequest(request);
}

export function getReferrerCookieName() {
  return COOKIE_NAME;
}
