// POST /api/partners/approve-invitation
// Endpoint admin — aprueba una invitación que está en submitted_for_review.
// Side-effects:
// - Marca estado como 'accepted'
// - Crea team_member con rol partner + comisión configurada (idempotente por email)
// - Envía email al partner: "Bienvenido — credenciales SACS"
// - Activity log
//
// POST body: { id: string, nota?: string }
// (no auth check todavía — asumimos que solo admins llegan al endpoint vía
// la admin UI; agregar bearer/cookie check cuando exista middleware admin.)

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

export const prerender = false;

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
    const body = await request.json() as { id?: string; nota?: string };
    const { id, nota } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), {
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

    // Permitir aprobar también desde estados intermedios
    if (!['submitted_for_review', 'sent', 'viewed', 'draft'].includes(invitation.estado)) {
      return new Response(JSON.stringify({ error: `cannot approve from estado=${invitation.estado}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const partnerEmail = invitation.email;
    const partnerName = invitation.aceptado_por || invitation.nombre;

    // Crear team_member (idempotente por email)
    let team_member_id = invitation.team_member_id as string | null;
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
            nombre: partnerName,
            email: partnerEmail,
            rol: 'partner',
            default_commission_pct: invitation.comision_pct ?? 50,
            activo: true,
          })
          .select('id')
          .single();
        if (createErr) {
          console.error('[approve-invitation] team_member create failed:', createErr.message);
        } else {
          team_member_id = created.id;
        }
      }
    }

    // Update meta with approval audit
    const { plain, meta } = parseNotas(invitation.notas);
    meta.approved_at = new Date().toISOString();
    if (nota) meta.approval_note = nota;

    const updates: Record<string, any> = {
      estado: 'accepted',
      notas: buildNotas(plain, meta),
    };
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

    // Email al partner — bienvenida + credenciales
    if (partnerEmail) {
      const tipoLabels: Record<string, string> = {
        embajador: 'Embajador SACS',
        distribuidor: 'Distribuidor Autorizado',
        integrador: 'Integrador Certificado',
        reseller: 'Reseller',
        consultor: 'Consultor Partner',
      };
      const programa = tipoLabels[invitation.tipo] || invitation.tipo || 'Partner SACS';
      const partnerLandingUrl = invitation.slug_landing
        ? `https://www.sacscloud.com/p/${invitation.slug_landing}`
        : `https://www.sacscloud.com/p/${(invitation.numero || '').toLowerCase()}`;

      try {
        await notify({
          channel: 'email',
          to: partnerEmail,
          template: 'partner_approved_user',
          data: {
            nombre: partnerName,
            programa,
            comision_pct: invitation.comision_pct,
            partnerLandingUrl,
            loginUrl: 'https://www.sacscloud.com/admin',
            nota,
          },
        });
      } catch (e) {
        console.warn('[approve-invitation] notify failed:', e);
      }
    }

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Partner aprobado: ${partnerName} (${invitation.tipo})`,
        metadata: {
          partner_invitation_id: id,
          partner_invitation_numero: invitation.numero,
          tipo: invitation.tipo,
          team_member_id,
        },
        automatico: true,
      });
    } catch (e) {
      console.warn('[approve-invitation] activity insert failed:', e);
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
