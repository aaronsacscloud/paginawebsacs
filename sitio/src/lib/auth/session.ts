// Partner sessions: cookie-based, stored in partner_sessions table.
// 30 días de duración. Token = 32 bytes random base64url, hashed (SHA256) en DB.

import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '../supabase';

const COOKIE_NAME = 'sacs_session';
const SESSION_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface SessionUser {
  id: string;
  role: 'founder' | 'partner' | 'cs';
  email?: string;
  nombre?: string;
  default_commission_pct?: number;
}

/**
 * Crea sesión nueva, retorna token plano (para setear en cookie).
 */
export async function createSession(
  team_member_id: string,
  meta: { ip?: string; user_agent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('partner_sessions').insert({
    team_member_id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    ip: meta.ip || null,
    user_agent: meta.user_agent || null,
  });
  if (error) throw new Error(`createSession failed: ${error.message}`);

  // touch last_login_at
  await supabase
    .from('team_members')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', team_member_id);

  return { token, expiresAt };
}

/**
 * Lee cookie del request y resuelve sesión → user.
 * Retorna null si no hay cookie, sesión inválida, expirada o revocada.
 */
export async function getSessionFromRequest(request: Request): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  if (!token) return null;
  const tokenHash = hashToken(token);

  const { data: session } = await supabase
    .from('partner_sessions')
    .select('id, team_member_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: member } = await supabase
    .from('team_members')
    .select('id, rol, email, nombre, default_commission_pct, activo')
    .eq('id', session.team_member_id)
    .maybeSingle();

  if (!member || !member.activo) return null;

  return {
    id: member.id,
    role: ((member as any).rol || 'partner') as SessionUser['role'],
    email: member.email,
    nombre: member.nombre,
    default_commission_pct: member.default_commission_pct ?? 50,
  };
}

/**
 * Revoca sesión (logout).
 */
export async function destroySession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await supabase
    .from('partner_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);
}

/**
 * Set-Cookie header value para sesión nueva.
 */
export function buildSessionCookie(token: string, expiresAt: Date): string {
  const isProd = (import.meta.env.PROD || process.env.NODE_ENV === 'production');
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookie(): string {
  const isProd = (import.meta.env.PROD || process.env.NODE_ENV === 'production');
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

// ─── Password reset / initial-set tokens ───
const RESET_TTL_MINUTES = 60;
const INITIAL_TTL_DAYS = 14;

export async function createPasswordResetToken(
  team_member_id: string,
  purpose: 'reset' | 'initial' = 'reset',
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const ttlMs = purpose === 'initial'
    ? INITIAL_TTL_DAYS * 24 * 60 * 60 * 1000
    : RESET_TTL_MINUTES * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  const { error } = await supabase.from('password_reset_tokens').insert({
    team_member_id,
    token_hash: tokenHash,
    purpose,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`createPasswordResetToken failed: ${error.message}`);
  return { token, expiresAt };
}

/**
 * Verifica token, marca como usado, retorna team_member_id.
 * Una sola vez: si ya fue usado, retorna null.
 */
export async function consumePasswordResetToken(
  token: string,
): Promise<{ team_member_id: string; purpose: 'reset' | 'initial' } | null> {
  const tokenHash = hashToken(token);
  const { data } = await supabase
    .from('password_reset_tokens')
    .select('id, team_member_id, expires_at, used_at, purpose')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { team_member_id: data.team_member_id, purpose: data.purpose };
}
