// POST /api/auth/forgot-password
// Body: { email }
// Genera token, envía email con link a /partner/reset-password?token=...
// Siempre responde 200 (no revelar si el email existe).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { createPasswordResetToken } from '../../../lib/auth/session';
import { notify } from '../../../lib/notify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { email?: string };
    const email = (body.email || '').trim().toLowerCase();
    if (!email) {
      return json({ ok: true }, 200);
    }

    const { data: member } = await supabase
      .from('team_members')
      .select('id, nombre, email, activo')
      .eq('email', email)
      .maybeSingle();

    if (member && member.activo) {
      const { token } = await createPasswordResetToken(member.id, 'reset');
      const resetUrl = `https://www.sacscloud.com/partner/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await notify({
          channel: 'email',
          to: member.email,
          template: 'partner_password_reset',
          data: { nombre: member.nombre, resetUrl },
        });
      } catch (e) {
        console.warn('[forgot-password] email failed:', e);
      }
    }

    // Always 200, no leak
    return json({ ok: true });
  } catch (err: any) {
    console.error('[forgot-password]', err);
    return json({ ok: true });
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
