// POST /api/auth/reset-password
// Body: { token, password }
// Consume token (one-time), actualiza team_members.password_hash, crea sesión nueva.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { hashPassword, isValidPassword } from '../../../lib/auth/password';
import {
  consumePasswordResetToken,
  createSession,
  buildSessionCookie,
} from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json() as { token?: string; password?: string };
    const token = (body.token || '').trim();
    const password = body.password || '';

    if (!token) return json({ error: 'Token requerido' }, 400);

    const valid = isValidPassword(password);
    if (!valid.ok) return json({ error: valid.reason }, 400);

    const consumed = await consumePasswordResetToken(token);
    if (!consumed) {
      return json({ error: 'Link inválido o expirado. Solicita uno nuevo.' }, 400);
    }

    const hash = await hashPassword(password);
    const { error: updateErr } = await supabase
      .from('team_members')
      .update({ password_hash: hash })
      .eq('id', consumed.team_member_id);

    if (updateErr) {
      return json({ error: 'No se pudo actualizar la contraseña' }, 500);
    }

    // Auto-login
    const { token: sessToken, expiresAt } = await createSession(consumed.team_member_id, {
      ip: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(JSON.stringify({ ok: true, redirect: '/partner/portal' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(sessToken, expiresAt),
      },
    });
  } catch (err: any) {
    return json({ error: err?.message || String(err) }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
