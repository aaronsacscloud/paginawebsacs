// POST /api/partners/set-password
// Endpoint admin — fija manualmente la contraseña de un partner al valor que el admin elija.
//
// Caso de uso: el founder quiere darle al partner una contraseña concreta
// (ej. para entregársela por teléfono/WhatsApp) en vez de mandarle un link de reset.
//
// Body: {
//   team_member_id: string;   // requerido
//   new_password: string;     // requerido, mín 8 caracteres
// }
//
// Side-effects:
// - UPDATE team_members.password_hash (bcrypt) + activo=true
// - Revoca todas las partner_sessions activas del partner (lo obliga a re-loguear)
// - Activity log
//
// Auth: solo founder/cs (admin)

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { hashPassword, isValidPassword } from '../../../lib/auth/password';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
      return json({ error: 'Solo admin puede fijar contraseñas de partner' }, 403);
    }

    const body = await request.json() as {
      team_member_id?: string;
      new_password?: string;
    };
    const team_member_id = body.team_member_id;
    const new_password = body.new_password || '';

    if (!team_member_id) {
      return json({ error: 'team_member_id requerido' }, 400);
    }

    const valid = isValidPassword(new_password);
    if (!valid.ok) {
      return json({ error: valid.reason || 'Contraseña inválida' }, 400);
    }

    // Fetch member
    const { data: member, error: fetchErr } = await supabase
      .from('team_members')
      .select('id, nombre, email, rol')
      .eq('id', team_member_id)
      .maybeSingle();

    if (fetchErr || !member) {
      return json({ error: 'partner no encontrado' }, 404);
    }

    // Hash + update
    const password_hash = await hashPassword(new_password);
    const { error: updateErr } = await supabase
      .from('team_members')
      .update({ password_hash, activo: true })
      .eq('id', team_member_id);
    if (updateErr) {
      return json({ error: updateErr.message }, 500);
    }

    // Revoca sesiones activas — el partner deberá entrar con la nueva contraseña
    try {
      await supabase
        .from('partner_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('team_member_id', team_member_id)
        .is('revoked_at', null);
    } catch {/* non-blocking */}

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Admin fijó contraseña manual de partner ${member.nombre}`,
        metadata: {
          team_member_id,
          email: member.email,
          by_admin: user.id,
        },
        automatico: true,
      });
    } catch {/* non-blocking */}

    return json({
      ok: true,
      email: member.email,
      login_url: 'https://www.sacscloud.com/partner/login',
    });
  } catch (err: any) {
    console.error('[set-password]', err);
    return json({ error: err?.message || String(err) }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
