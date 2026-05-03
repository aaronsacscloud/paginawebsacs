// POST /api/auth/login
// Body: { email, password }
// Side-effects: crea partner_session, setea cookie sacs_session.
// Response 200: { ok: true, role, redirect }

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { verifyPassword } from '../../../lib/auth/password';
import { createSession, buildSessionCookie } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return json({ error: 'Email y contraseña son requeridos' }, 400);
    }

    const { data: member } = await supabase
      .from('team_members')
      .select('id, rol, email, nombre, password_hash, activo')
      .eq('email', email)
      .maybeSingle();

    // Mensaje genérico para no revelar si el email existe
    if (!member || !member.activo || !member.password_hash) {
      return json({ error: 'Credenciales inválidas' }, 401);
    }

    const ok = await verifyPassword(password, member.password_hash);
    if (!ok) {
      return json({ error: 'Credenciales inválidas' }, 401);
    }

    const { token, expiresAt } = await createSession(member.id, {
      ip: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    const role = (member as any).rol || 'partner';
    const redirect = role === 'partner' ? '/partner/portal' : '/admin/crm';

    return new Response(JSON.stringify({ ok: true, role, redirect }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(token, expiresAt),
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
