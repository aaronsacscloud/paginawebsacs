// Partner scoping helpers — filter queries + resource access by owner_id.
// Roles: 'founder' (sees everything) | 'partner' (sees only their own) | 'cs' (future)

export interface CurrentUser {
  id: string;
  role: 'founder' | 'partner' | 'cs';
  email?: string;
  nombre?: string;
  default_commission_pct?: number;
  foto_url?: string | null;
  permisos?: Record<string, string> | null;
}

/**
 * Apply partner scope filter to a Supabase query builder.
 * Founder/cs bypass the filter; partner limited to their owner_id.
 *
 * Usage:
 *   let query = supabase.from('contacts').select('*');
 *   query = applyPartnerScope(query, user, 'owner_id');
 *   const { data } = await query;
 */
export function applyPartnerScope<T extends { eq: (column: string, value: any) => T }>(
  query: T,
  user: CurrentUser | null | undefined,
  column: string = 'owner_id',
): T {
  if (!user) return query;                       // no user = no filter (public endpoints)
  if (user.role === 'founder') return query;     // founder sees all
  if (user.role === 'cs') return query;          // CS sees all (for now)
  return query.eq(column, user.id);               // partner: only their own
}

/**
 * Check if user can access a resource by its owner_id.
 * Throws 403-equivalent if not.
 */
export function assertCanAccess(user: CurrentUser | null | undefined, resource_owner_id: string | null | undefined): void {
  if (!user) throw new AccessDenied('No authenticated user');
  if (user.role === 'founder' || user.role === 'cs') return;
  if (resource_owner_id === user.id) return;
  throw new AccessDenied(`User ${user.id} cannot access resource owned by ${resource_owner_id || 'none'}`);
}

export class AccessDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDenied';
  }
}

/**
 * Resolve current user from request.
 *
 * Identidad SOLO por cookie de sesión real (`sacs_session` → partner_sessions).
 *
 * ⚠️ SEGURIDAD: antes existía un fallback que confiaba en el header `x-user-id`
 * ("x-user-id: founder" resolvía al primer founder SIN credencial; "x-user-id:
 * <uuid>" suplantaba a cualquier partner). El middleware bloqueaba ese header en
 * /api/crm/* pero NO en /api/partner-portal/*, /api/scheduling/* ni varios
 * /api/partners/*, así que cualquiera podía leer cartera/PII/finanzas de otro
 * partner y hasta cambiar su cuenta de payout, o disparar recover-access como
 * "founder". Se ELIMINÓ el fallback: el header ya no otorga identidad. El admin
 * real se autentica por su cookie de sesión (misma que exige el middleware para
 * /api/crm/*), así que ninguna herramienta legítima se rompe.
 */
export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  try {
    const { getSessionFromRequest } = await import('./session');
    const sessionUser = await getSessionFromRequest(request);
    if (sessionUser) return sessionUser as CurrentUser;
  } catch {
    // módulo de sesión no disponible / error transitorio → sin identidad
  }
  return null;
}
