// POST /api/partners/accept-invitation
// Endpoint público — el prospecto firma su invitación y la deja en estado
// 'submitted_for_review' (no 'accepted'). El equipo SACS revisa y aprueba
// manualmente desde el admin (POST /api/partners/approve-invitation).
//
// Side-effects:
// - Marca la invitación como submitted_for_review
// - Guarda firma + datos de cobro + dirección en notas (meta)
// - Envía email al prospecto: "Recibimos tu solicitud"
// - Envía email a ventas: "Nueva solicitud de partner"
// - NO crea team_member todavía — eso ocurre en el approve

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify, getSalesInbox } from '../../../lib/notify';

export const prerender = false;

interface PayoutClabe {
  method: 'clabe';
  clabe: string;
  banco: string;
  titular: string;
  rfc?: string;
}
interface PayoutPaypal {
  method: 'paypal';
  email: string;
}
interface PayoutMP {
  method: 'mercadopago';
  mp_id: string;
  titular?: string;
}
type Payout = PayoutClabe | PayoutPaypal | PayoutMP;

interface Direccion {
  calle?: string;
  colonia?: string;
  cp?: string;
  ciudad?: string;
  estado?: string;
}

interface AcceptBody {
  id: string;
  nombre: string;          // nombre completo de quien firma
  firma_base64?: string;   // PNG dataURL del canvas
  email?: string;
  whatsapp?: string;
  empresa?: string;
  direccion?: Direccion;
  payout?: Payout;
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
    const { id, nombre, firma_base64, email, whatsapp, empresa, direccion, payout } = body;

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

    if (invitation.estado === 'submitted_for_review') {
      return new Response(JSON.stringify({ ok: true, already_submitted: true, invitation }), {
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

    // Save firma + onboarding data into notas meta
    const { plain, meta } = parseNotas(invitation.notas);
    if (firma_base64) meta.firma_base64 = firma_base64;
    meta.signed_at = new Date().toISOString();
    meta.signed_user_agent = request.headers.get('user-agent') || null;
    if (direccion) meta.direccion = direccion;
    if (payout) meta.payout = payout;
    meta.submitted_at = new Date().toISOString();

    const updates: Record<string, any> = {
      estado: 'submitted_for_review',
      aceptado_por: nombre,
      aceptado_fecha: new Date().toISOString(), // momento de envío de la solicitud
      notas: buildNotas(plain, meta),
    };

    if (email && !invitation.email) updates.email = email;
    if (whatsapp && !invitation.whatsapp) updates.whatsapp = whatsapp;
    if (empresa && !invitation.empresa) updates.empresa = empresa;

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

    // Auto-approve fast path: if invitation has auto_approve=true, skip review
    // and approve immediately (creates team_member, sends welcome email).
    // (Defensive: solo aplica si la columna existe; si no, el campo viene
    // como undefined y el flujo normal de revisión continúa.)
    if (invitation.auto_approve === true) {
      try {
        const { approveInvitationInternal } = await import('./approve-invitation');
        const result = await approveInvitationInternal(updated, { autoApproved: true });
        return new Response(JSON.stringify({ ok: true, invitation: result.invitation, team_member_id: result.team_member_id, auto_approved: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        console.error('[accept-invitation] auto-approve failed:', e);
        // Si falla auto-approve, queda en submitted_for_review y admin la aprueba manual
      }
    }

    // ── Notifications (non-blocking, errors logged) ──
    const partnerEmail = email || invitation.email;
    const tipoLabels: Record<string, string> = {
      embajador: 'Embajador SACS',
      distribuidor: 'Distribuidor Autorizado',
      integrador: 'Integrador Certificado',
      reseller: 'Reseller',
      consultor: 'Consultor Partner',
    };
    const programa = tipoLabels[invitation.tipo] || invitation.tipo || 'Partner SACS';
    const adminUrl = `https://www.sacscloud.com/admin/crm?tab=partners`;
    const partnerUrl = `https://www.sacscloud.com/partners/invitacion/${id}`;

    // Email to partner — confirmación de recepción
    if (partnerEmail) {
      try {
        await notify({
          channel: 'email',
          to: partnerEmail,
          template: 'partner_submitted_user',
          data: {
            nombre,
            programa,
            partnerUrl,
          },
        });
      } catch (e) {
        console.warn('[accept-invitation] notify partner failed:', e);
      }
    }

    // Email to sales inbox — nueva solicitud para revisar
    try {
      await notify({
        channel: 'email',
        to: getSalesInbox(),
        template: 'partner_submitted_admin',
        data: {
          nombre,
          email: partnerEmail,
          whatsapp: whatsapp || invitation.whatsapp || '',
          empresa: empresa || invitation.empresa || '',
          programa,
          numero: invitation.numero,
          comision_pct: invitation.comision_pct,
          payout,
          direccion,
          adminUrl,
        },
      });
    } catch (e) {
      console.warn('[accept-invitation] notify admin failed:', e);
    }

    // Activity log (non-blocking)
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Solicitud de partner enviada: ${nombre} (${invitation.tipo}) — pendiente de aprobación`,
        metadata: {
          partner_invitation_id: id,
          partner_invitation_numero: invitation.numero,
          tipo: invitation.tipo,
          comision_pct: invitation.comision_pct,
        },
        automatico: true,
      });
    } catch (e) {
      console.warn('[accept-invitation] activity insert failed:', e);
    }

    return new Response(JSON.stringify({ ok: true, invitation: updated }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
