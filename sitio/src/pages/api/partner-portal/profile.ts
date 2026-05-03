// GET /api/partner-portal/profile  → datos del partner + invitación
// PUT /api/partner-portal/profile  → actualizar payout / dirección / password

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { hashPassword, verifyPassword, isValidPassword } from '../../../lib/auth/password';

export const prerender = false;

const NOTAS_SEP = '\n---META---\n';
function parseNotas(notas: string | null | undefined) {
  if (!notas) return { plain: '', meta: {} as Record<string, any> };
  const idx = notas.indexOf(NOTAS_SEP);
  if (idx < 0) return { plain: notas, meta: {} };
  try {
    const meta = JSON.parse(notas.slice(idx + NOTAS_SEP.length));
    return { plain: notas.slice(0, idx), meta };
  } catch {
    return { plain: notas, meta: {} };
  }
}
function buildNotas(plain: string, meta: Record<string, any>): string {
  return `${plain || ''}${NOTAS_SEP}${JSON.stringify(meta)}`;
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data: invitation } = await supabase
    .from('partner_invitations')
    .select('id, numero, tipo, slug_landing, comision_pct, vigencia, estado, notas, empresa, whatsapp')
    .eq('team_member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let payout = null, direccion = null;
  if (invitation?.notas) {
    const { meta } = parseNotas(invitation.notas);
    payout = meta.payout || null;
    direccion = meta.direccion || null;
  }

  const partnerLandingUrl = invitation?.slug_landing
    ? `https://www.sacscloud.com/p/${invitation.slug_landing}`
    : (invitation?.numero ? `https://www.sacscloud.com/p/${invitation.numero.toLowerCase()}` : null);

  return j({
    user,
    invitation: invitation ? {
      id: invitation.id,
      numero: invitation.numero,
      tipo: invitation.tipo,
      slug_landing: invitation.slug_landing,
      comision_pct: invitation.comision_pct,
      vigencia: invitation.vigencia,
      estado: invitation.estado,
      empresa: invitation.empresa,
      whatsapp: invitation.whatsapp,
    } : null,
    partnerLandingUrl,
    payout,
    direccion,
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const body = await request.json() as {
    payout?: any;
    direccion?: any;
    nombre?: string;
    whatsapp?: string;
    current_password?: string;
    new_password?: string;
  };

  // ── Cambio de contraseña ──
  if (body.new_password) {
    const valid = isValidPassword(body.new_password);
    if (!valid.ok) return j({ error: valid.reason }, 400);

    const { data: member } = await supabase
      .from('team_members')
      .select('password_hash')
      .eq('id', user.id)
      .maybeSingle();
    if (!member) return j({ error: 'user not found' }, 404);

    if (member.password_hash) {
      // Si ya tenía password, exigir el actual
      if (!body.current_password) return j({ error: 'Contraseña actual requerida' }, 400);
      const ok = await verifyPassword(body.current_password, member.password_hash);
      if (!ok) return j({ error: 'Contraseña actual incorrecta' }, 400);
    }

    const hash = await hashPassword(body.new_password);
    await supabase.from('team_members').update({ password_hash: hash }).eq('id', user.id);
  }

  // ── Datos básicos del team_member ──
  if (body.nombre) {
    await supabase.from('team_members').update({ nombre: body.nombre }).eq('id', user.id);
  }

  // ── Payout / dirección viven en partner_invitations.notas.meta ──
  if (body.payout || body.direccion || body.whatsapp) {
    const { data: inv } = await supabase
      .from('partner_invitations')
      .select('id, notas')
      .eq('team_member_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inv) {
      const { plain, meta } = parseNotas(inv.notas);
      if (body.payout) meta.payout = body.payout;
      if (body.direccion) meta.direccion = body.direccion;
      const updates: Record<string, any> = { notas: buildNotas(plain, meta) };
      if (body.whatsapp) updates.whatsapp = body.whatsapp;
      await supabase.from('partner_invitations').update(updates).eq('id', inv.id);
    }
  }

  return j({ ok: true });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
