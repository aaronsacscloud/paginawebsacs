// GET /api/partners/content-review            — admin: lista pending + recientes
// POST /api/partners/content-review            — admin: approve / reject submission

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { getContentType, getPuntosByTipo } from '../../../data/content-types';
import { notify } from '../../../lib/notify';

export const prerender = false;

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);
  if (user.role !== 'founder') return j({ error: 'admin only' }, 403);

  const estado = url.searchParams.get('estado') || 'pending_review';

  const { data: rows } = await supabase
    .from('partner_content_submissions')
    .select('*, team_members:partner_id(nombre, email)')
    .eq('estado', estado)
    .order('created_at', { ascending: false })
    .limit(200);

  return j({ items: rows || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);
  if (user.role !== 'founder') return j({ error: 'admin only' }, 403);

  try {
    const body = await request.json() as {
      submission_id?: string;
      action?: 'approve' | 'reject';
      puntos_override?: number;
      mes?: string;          // 'YYYY-MM' — defaults a current
      nota?: string;
    };
    const { submission_id, action } = body;
    if (!submission_id || !action) return j({ error: 'submission_id y action requeridos' }, 400);

    const { data: sub } = await supabase
      .from('partner_content_submissions')
      .select('*, team_members:partner_id(nombre, email)')
      .eq('id', submission_id)
      .maybeSingle();

    if (!sub) return j({ error: 'submission not found' }, 404);
    if (sub.estado !== 'pending_review') return j({ error: `submission ya fue ${sub.estado}` }, 400);

    if (action === 'approve') {
      const puntos = body.puntos_override !== undefined ? Number(body.puntos_override) : getPuntosByTipo(sub.tipo);
      const mes = body.mes || currentYM();
      const { error } = await supabase
        .from('partner_content_submissions')
        .update({
          estado: 'approved',
          puntos,
          mes_acreditado: mes,
          nota_admin: body.nota || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', submission_id);

      if (error) return j({ error: error.message }, 500);

      // Email al partner: contenido aprobado
      const partnerEmail = (sub as any).team_members?.email;
      const partnerNombre = (sub as any).team_members?.nombre || 'partner';
      if (partnerEmail) {
        try {
          await notify({
            channel: 'email',
            to: partnerEmail,
            template: 'partner_content_approved',
            data: {
              nombre: partnerNombre,
              tipo_label: getContentType(sub.tipo)?.nombre || sub.tipo,
              puntos,
              mes,
              url: sub.url,
              portalUrl: 'https://www.sacscloud.com/partner/portal#content',
            },
          });
        } catch (e) { console.warn('[content-review] notify approved failed:', e); }
      }

      try {
        await supabase.from('activities').insert({
          tipo: 'sistema',
          titulo: `Contenido aprobado para ${partnerNombre}: ${getContentType(sub.tipo)?.nombre} · ${puntos} pts`,
          metadata: { submission_id, partner_id: sub.partner_id, puntos, mes },
          automatico: true,
        });
      } catch {}

      return j({ ok: true, puntos, mes });
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('partner_content_submissions')
        .update({
          estado: 'rejected',
          puntos: 0,
          nota_admin: body.nota || 'Rechazado sin motivo especificado',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', submission_id);

      if (error) return j({ error: error.message }, 500);

      const partnerEmail = (sub as any).team_members?.email;
      const partnerNombre = (sub as any).team_members?.nombre || 'partner';
      if (partnerEmail) {
        try {
          await notify({
            channel: 'email',
            to: partnerEmail,
            template: 'partner_content_rejected',
            data: {
              nombre: partnerNombre,
              tipo_label: getContentType(sub.tipo)?.nombre || sub.tipo,
              url: sub.url,
              motivo: body.nota || 'No alineado con el manual',
              portalUrl: 'https://www.sacscloud.com/partner/portal#content',
            },
          });
        } catch (e) { console.warn('[content-review] notify rejected failed:', e); }
      }

      return j({ ok: true });
    }

    return j({ error: `unknown action: ${action}` }, 400);
  } catch (err: any) {
    return j({ error: err?.message || String(err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
