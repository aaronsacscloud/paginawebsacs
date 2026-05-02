// POST /api/partners/decline-invitation
// Public — el prospecto rechaza la invitación de partner.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, motivo, detalle } = body || {};
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: invitation } = await supabase
      .from('partner_invitations')
      .select('estado, numero, tipo, nombre')
      .eq('id', id)
      .maybeSingle();

    if (!invitation) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (invitation.estado === 'accepted') {
      return new Response(JSON.stringify({ error: 'already accepted' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('partner_invitations')
      .update({
        estado: 'declined',
        decline_motivo: motivo || 'no_especificado',
        decline_detalle: detalle || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Invitación de partner rechazada: ${invitation.nombre} (${invitation.tipo})`,
        metadata: {
          partner_invitation_id: id,
          partner_invitation_numero: invitation.numero,
          motivo: motivo || null,
          detalle: detalle || null,
        },
        automatico: true,
      });
    } catch {}

    return new Response(JSON.stringify({ ok: true, invitation: data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
