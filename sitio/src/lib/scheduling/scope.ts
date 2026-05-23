// Scope helper para endpoints scheduling.
//
// Patrón: el sistema de scheduling ya es multi-tenant a nivel team_member
// (event_types.owner_id, bookings.host_id, availability_schedules.team_member_id,
// calendar_connections.team_member_id). Falta aplicar el scope en endpoints
// para que partners solo lean/editen sus propios recursos.
//
// Founder y CS pueden actuar sobre cualquier team_member (admin global).
// Partner siempre opera sobre su propio id sin importar lo que mande el cliente.

import type { CurrentUser } from '../auth/scope';

/**
 * Resuelve qué team_member_id se debe usar para esta operación.
 * - Partner: SIEMPRE su propio id (ignora requestedId aunque venga en body/query).
 * - Founder/CS: requestedId si viene, sino su propio id.
 * - Sin user: null (endpoint debe rechazar).
 */
export function resolveSchedulingTarget(
  user: CurrentUser | null | undefined,
  requestedId: string | null | undefined,
): string | null {
  if (!user) return null;
  if (user.role === 'partner') return user.id;
  return requestedId || user.id;
}

/**
 * Verifica que el user pueda actuar sobre un recurso owned por ownerId.
 * Founder/CS: siempre permitido. Partner: solo si es su propio recurso.
 */
export function canActOnSchedulingOwner(
  user: CurrentUser | null | undefined,
  ownerId: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === 'founder' || user.role === 'cs') return true;
  return !!ownerId && ownerId === user.id;
}

export function isPartner(user: CurrentUser | null | undefined): boolean {
  return user?.role === 'partner';
}
