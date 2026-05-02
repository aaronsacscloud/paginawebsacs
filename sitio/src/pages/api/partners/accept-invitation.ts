// POST /api/partners/accept-invitation
// Public endpoint llamado desde la página /partners/invitacion/[id] cuando el
// prospecto firma la invitación. Marca la invitación como 'accepted', guarda
// la firma en notas (meta) y crea el team_member con rol 'partner' + comisión
// configurada.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

interface AcceptBody {
  id: string;
  nombre: string;          // nombre completo de quien firma
  firma_base64?: string;   // PNG dataURL del canvas
  email?: string;
  whatsapp?: string;
}

const NOTAS_SEP = '\n---META---\n';

function parseNotas(notas: string | null | undefined) {
  if (!notas) return { plain: '', meta: {} as Record<string, any> };
  const idx = notas.indexOf(NOTAS_SEP);
  if (idx < 0) return { plain: notas, meta: {} as Record<string, any> };
  try {
    const meta = JSON.parse(notas.slice(idx + NOTAS_SEP.length));
    return { plain: notas.slice(0, idx), meta };
  } catch {
    return { plain: notas, meta: {} as Record<string, any> };
  }
}

function buildNotas(plain: string, meta: Record<string, any>): string {
  return `${plain || ''}${NOTAS_SEP}${JSON.stringify(meta)}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as AcceptBody;
    const { id, nombre, firma_base64, email, whatsapp } = body;

    if (!id || !nombre) {
      return new Response(JSON.stringify({ error: 'id and nombre required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: invitation, error: fetchErr } = await supabase
      .from('partner_invitations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !invitation) {
      return new Response(JSON.stringify({ error: 'invitation not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (invitation.estado === 'accepted') {
      return new Response(JSON.stringify({ ok: true, already_accepted: true, invitation }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (invitation.estado === 'declined') {
      return new Response(JSON.stringify({ error: 'invitation was declined' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (invitation.estado === 'expired') {
      return new Response(JSON.stringify({ error: 'invitation expired' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save firma into notas meta
    const { plain, meta } = parseNotas(invitation.notas);
    if (firma_base64) meta.firma_base64 = firma_base64;
    meta.signed_at = new Date().toISOString();
    meta.signed_user_agent = request.headers.get('user-agent') || null;

    const updates: Record<string, any> = {
      estado: 'accepted',
      aceptado_por: nombre,
      aceptado_fecha: new Date().toISOString(),
      notas: buildNotas(plain, meta),
    };

    // Update contact info if user filled it in
    if (email && !invitation.email) updates.email = email;
    if (whatsapp && !invitation.whatsapp) updates.whatsapp = whatsapp;

    // Create team_member with partner role (idempotent on email)
    let team_member_id = invitation.team_member_id as string | null;

    const partnerEmail = email || invitation.email;
    if (!team_member_id && partnerEmail) {
      const { data: existing } = await supabase
        .from('team_members')
        .select('id, rol, default_commission_pct')
        .eq('email', partnerEmail)
        .maybeSingle();

      if (existing) {
        const newRol = existing.rol === 'founder' ? 'founder' : 'partner';
        await supabase
          .from('team_members')
          .update({
            rol: newRol,
            default_commission_pct: invitation.comision_pct ?? existing.default_commission_pct ?? 50,
            activo: true,
          })
          .eq('id', existing.id);
        team_member_id = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('team_members')
          .insert({
            nombre,
            email: partnerEmail,
            rol: 'partner',
            default_commission_pct: invitation.comision_pct ?? 50,
            activo: true,
          })
          .select('id')
          .single();
        if (createErr) {
          console.error('[accept-invitation] team_member create failed:', createErr.message);
        } else {
          team_member_id = created.id;
        }
      }
    }

    if (team_member_id) updates.team_member_id = team_member_id;

    const { data: updated, error: updateErr } = await supabase
      .from('partner_invitations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Activity log (non-blocking)
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Invitación de partner aceptada: ${nombre} (${invitation.tipo})`,
        metadata: {
          partner_invitation_id: id,
          partner_invitation_numero: invitation.numero,
          tipo: invitation.tipo,
          comision_pct: invitation.comision_pct,
          team_member_id,
        },
        automatico: true,
      });
    } catch (e) {
      console.warn('[accept-invitation] activity insert failed:', e);
    }

    return new Response(JSON.stringify({ ok: true, invitation: updated, team_member_id }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
