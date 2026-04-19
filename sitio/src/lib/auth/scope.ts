// Partner scoping helpers — filter queries + resource access by owner_id.
// Roles: 'founder' (sees everything) | 'partner' (sees only their own) | 'cs' (future)

export interface CurrentUser {
  id: string;
  role: 'founder' | 'partner' | 'cs';
  email?: string;
  nombre?: string;
  default_commission_pct?: number;
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

/** Resolve current user from request — placeholder until auth middleware formalized. */
export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  // v1: basic header-based auth (X-User-Id sent by admin UI after login).
  // Migrar a cookies/Supabase Auth en iteración futura.
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  const { supabase } = await import('../supabase');
  const { data } = await supabase
    .from('team_members')
    .select('id, role, email, nombre, default_commission_pct')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    role: (data.role || 'partner') as CurrentUser['role'],
    email: data.email,
    nombre: data.nombre,
    default_commission_pct: data.default_commission_pct ?? 20,
  };
}
