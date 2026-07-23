// POST /api/auth/change-password  (usuario LOGUEADO cambia su propia contraseña)
// Body: { current_password, new_password }
// - Requiere sesión válida (cookie sacs_session).
// - Verifica la contraseña actual antes de cambiarla.
// - Revoca TODAS las sesiones del usuario (mata cualquier sesión intrusa); el
//   admin vuelve a iniciar sesión con la contraseña nueva.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { hashPassword, verifyPassword, isValidPassword } from '../../../lib/auth/password';
import { getSessionFromRequest } from '../../../lib/auth/session';

export const prerender = false;

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getSessionFromRequest(request);
    if (!user) return j({ error: 'No autenticado' }, 401);

    const body = await request.json() as { current_password?: string; new_password?: string };
    const current = body.current_password || '';
    const nueva = body.new_password || '';

    const val = isValidPassword(nueva);
    if (!val.ok) return j({ error: val.reason || 'Contraseña inválida' }, 400);

    const { data: member } = await supabase
      .from('team_members')
      .select('id, password_hash')
      .eq('id', user.id)
      .maybeSingle();
    if (!member) return j({ error: 'Usuario no encontrado' }, 404);

    // Si ya tenía contraseña, se exige la actual correcta; si no tenía (cuenta
    // recién creada), se permite fijar la primera sin "actual".
    if (member.password_hash) {
      const ok = await verifyPassword(current, member.password_hash);
      if (!ok) return j({ error: 'La contraseña actual no es correcta' }, 401);
      if (await verifyPassword(nueva, member.password_hash)) {
        return j({ error: 'La nueva contraseña no puede ser igual a la actual' }, 400);
      }
    }

    const password_hash = await hashPassword(nueva);
    const { error } = await supabase.from('team_members').update({ password_hash }).eq('id', user.id);
    if (error) return j({ error: error.message }, 500);

    // Cierra TODAS las sesiones (best-effort): la actual también → re-login.
    try {
      await supabase.from('partner_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('team_member_id', user.id).is('revoked_at', null);
    } catch { /* best-effort */ }

    return j({ ok: true });
  } catch (err: any) {
    return j({ error: err?.message || String(err) }, 500);
  }
};
