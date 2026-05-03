// POST /api/partners/provision-fideliza
// Endpoint admin — marca al partner como provisionado en SACS Plan Fideliza
// y le envía email con SOP para acceder.
//
// El provisionamiento real (creación de la cuenta en app.sacscloud.com)
// se hace manual por el admin antes de hacer click en este botón.
// Este endpoint solo registra que ya se provisionó + dispara el email.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { partner_id?: string; nota?: string };
    const partnerId = body.partner_id;
    if (!partnerId) return j({ error: 'partner_id required' }, 400);

    const { data: member } = await supabase
      .from('team_members')
      .select('id, nombre, email, fideliza_account_at')
      .eq('id', partnerId)
      .maybeSingle();
    if (!member) return j({ error: 'partner not found' }, 404);

    if (member.fideliza_account_at) {
      return j({ ok: true, already_provisioned: true });
    }

    const now = new Date().toISOString();
    await supabase
      .from('team_members')
      .update({ fideliza_account_at: now })
      .eq('id', partnerId);

    // Email al partner
    if (member.email) {
      try {
        await notify({
          channel: 'email',
          to: member.email,
          template: 'partner_fideliza_ready',
          data: {
            nombre: member.nombre,
            email: member.email,
            nota: body.nota || '',
            loginUrl: 'https://app.sacscloud.com',
          },
        });
      } catch (e) {
        console.warn('[provision-fideliza] notify failed:', e);
      }
    }

    // Activity
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Plan Fideliza activado para partner: ${member.nombre}`,
        metadata: { partner_id: partnerId, nota: body.nota || null },
        automatico: true,
      });
    } catch {}

    return j({ ok: true, fideliza_account_at: now });
  } catch (err: any) {
    return j({ error: err?.message || String(err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
