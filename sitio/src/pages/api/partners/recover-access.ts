// POST /api/partners/recover-access
// Endpoint admin — recupera o reasigna acceso de un partner.
//
// Casos de uso:
// 1. Partner registró con email mal escrito → admin actualiza email correcto
//    y reenvía email de bienvenida + nuevo link para crear contraseña
// 2. Partner perdió acceso → admin genera nuevo reset link sin cambiar email
//
// Body: {
//   team_member_id: string;       // requerido
//   new_email?: string;           // opcional - si viene, actualiza email
//   send_welcome?: boolean;       // default true - manda email con link reset
// }
//
// Side-effects:
// - UPDATE team_members.email si new_email viene y es diferente
// - Crea password_reset_token (modo 'initial' si nunca tuvo password, 'reset' si ya)
// - Envía email partner_approved_user (template usual de bienvenida) al email correcto
// - Activity log
//
// Auth: solo founder/cs (admin) — TODO middleware admin

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { createPasswordResetToken } from '../../../lib/auth/session';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

function isValidEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'founder' && user.role !== 'cs')) {
      return json({ error: 'Solo admin puede recuperar accesos de partner' }, 403);
    }

    const body = await request.json() as {
      team_member_id?: string;
      invitation_id?: string;          // fallback: resolver team_member desde invitación
      new_email?: string;
      send_welcome?: boolean;
    };
    let team_member_id = body.team_member_id;
    const invitation_id = body.invitation_id;
    const new_email = (body.new_email || '').trim().toLowerCase();
    const send_welcome = body.send_welcome !== false;

    if (!team_member_id && !invitation_id) {
      return json({ error: 'team_member_id o invitation_id requerido' }, 400);
    }

    // Resolve team_member_id from invitation if missing
    let invitationForBackfill: any = null;
    if (!team_member_id && invitation_id) {
      const { data: inv } = await supabase
        .from('partner_invitations')
        .select('id, email, nombre, comision_pct, tipo, team_member_id')
        .eq('id', invitation_id)
        .maybeSingle();
      if (!inv) return json({ error: 'invitación no encontrada' }, 404);
      invitationForBackfill = inv;

      if (inv.team_member_id) {
        team_member_id = inv.team_member_id;
      } else if (inv.email) {
        // Buscar team_member por email
        const { data: existing } = await supabase
          .from('team_members')
          .select('id')
          .eq('email', inv.email)
          .maybeSingle();
        if (existing) {
          team_member_id = existing.id;
        } else {
          // Crear team_member ahora — la aprobación falló en algún momento al hacerlo
          const { data: created, error: createErr } = await supabase
            .from('team_members')
            .insert({
              nombre: inv.nombre,
              email: inv.email,
              rol: 'partner',
              default_commission_pct: inv.comision_pct ?? 50,
              activo: true,
            })
            .select('id')
            .single();
          if (createErr) return json({ error: 'no se pudo crear cuenta de partner: ' + createErr.message }, 500);
          team_member_id = created.id;
        }
        // Backfill team_member_id en la invitación
        try {
          await supabase
            .from('partner_invitations')
            .update({ team_member_id })
            .eq('id', invitation_id);
        } catch {/* non-blocking */}
      } else {
        return json({ error: 'invitación sin email — no se puede recuperar acceso' }, 400);
      }
    }

    // Fetch member
    const { data: member, error: fetchErr } = await supabase
      .from('team_members')
      .select('id, nombre, email, activo, password_hash')
      .eq('id', team_member_id!)
      .maybeSingle();

    if (fetchErr || !member) {
      return json({ error: 'partner no encontrado' }, 404);
    }

    let finalEmail = member.email;
    let emailChanged = false;

    // Update email if provided + valid + different
    if (new_email && new_email !== member.email) {
      if (!isValidEmail(new_email)) {
        return json({ error: 'email inválido' }, 400);
      }
      // Check no other team_member uses that email
      const { data: collision } = await supabase
        .from('team_members')
        .select('id')
        .eq('email', new_email)
        .neq('id', team_member_id)
        .maybeSingle();
      if (collision) {
        return json({ error: 'ese email ya está en uso por otro partner' }, 400);
      }
      const { error: updateErr } = await supabase
        .from('team_members')
        .update({ email: new_email, activo: true })
        .eq('id', team_member_id);
      if (updateErr) {
        return json({ error: updateErr.message }, 500);
      }
      finalEmail = new_email;
      emailChanged = true;

      // Also update the invitation email if there's one linked
      try {
        await supabase
          .from('partner_invitations')
          .update({ email: new_email })
          .eq('team_member_id', team_member_id);
      } catch {/* non-blocking */}
    }

    // Generate fresh reset/initial token
    const tokenMode = member.password_hash ? 'reset' : 'initial';
    const { token } = await createPasswordResetToken(team_member_id, tokenMode);
    const setPasswordUrl = `https://www.sacscloud.com/partner/reset-password?token=${encodeURIComponent(token)}&mode=${tokenMode}`;

    // Send welcome/recovery email — capture result so admin sees if Resend failed
    let emailResult: { ok: boolean; reason?: string; id?: string } | null = null;
    if (send_welcome && finalEmail) {
      try {
        const { data: invitation } = await supabase
          .from('partner_invitations')
          .select('tipo, comision_pct, slug_landing, numero')
          .eq('team_member_id', team_member_id)
          .maybeSingle();
        const tipoLabels: Record<string, string> = {
          embajador: 'Embajador SACS',
          distribuidor: 'Distribuidor Autorizado',
          integrador: 'Integrador Certificado',
          reseller: 'Reseller',
          consultor: 'Consultor Partner',
        };
        const programa = tipoLabels[invitation?.tipo || ''] || 'Partner SACS';
        const partnerLandingUrl = invitation?.slug_landing
          ? `https://www.sacscloud.com/p/${invitation.slug_landing}`
          : 'https://www.sacscloud.com';

        emailResult = await notify({
          channel: 'email',
          to: finalEmail,
          template: 'partner_approved_user',
          data: {
            nombre: member.nombre,
            programa,
            comision_pct: invitation?.comision_pct,
            partnerLandingUrl,
            setPasswordUrl,
            loginUrl: 'https://www.sacscloud.com/partner/login',
            nota: emailChanged
              ? 'Tu email se actualizó. Usa este nuevo link para acceder a tu portal.'
              : 'Aquí está tu nuevo link para acceder a tu portal de partner.',
          },
        });
      } catch (e: any) {
        emailResult = { ok: false, reason: e?.message || String(e) };
      }
    }

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: emailChanged
          ? `Admin recuperó acceso de partner ${member.nombre} (email cambiado a ${finalEmail})`
          : `Admin reenvió acceso a partner ${member.nombre}`,
        metadata: {
          team_member_id,
          old_email: member.email,
          new_email: finalEmail,
          email_changed: emailChanged,
          token_mode: tokenMode,
          by_admin: user.id,
        },
        automatico: true,
      });
    } catch {/* non-blocking */}

    return json({
      ok: true,
      email: finalEmail,
      email_changed: emailChanged,
      reset_url: setPasswordUrl, // útil para que admin pueda compartir directo si email no llega
      token_mode: tokenMode,
      email_sent: emailResult?.ok === true,
      email_error: emailResult && !emailResult.ok ? emailResult.reason : null,
    });
  } catch (err: any) {
    console.error('[recover-access]', err);
    return json({ error: err?.message || String(err) }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
