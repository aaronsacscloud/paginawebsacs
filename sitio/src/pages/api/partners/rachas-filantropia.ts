// GET /api/partners/rachas-filantropia — ADMIN: rachas filantrópicas del mes
// por partner DE COBRO (invitación con costo_unico > 0). Alimenta la vista del
// CRM: quién va en qué nivel y a quién empujar (ej. va en 80 pts → un empujón
// llega a 100 y gana +2.5%).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { FIL_TIERS, extraPorPuntos, siguienteTier } from '../../../data/filantropia';

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  // ADMIN only — y a diferencia del patrón viejo de invitations.ts, aquí el
  // anónimo (user null) TAMBIÉN se rechaza: este endpoint expone nombres y
  // actividad de partners. Si el panel del CRM no muestra rachas, es porque
  // la sesión admin no llegó (cookie/x-user-id) — no abrir el endpoint.
  const user = await getCurrentUser(request);
  if (!user || user.role === 'partner') return j({ error: 'forbidden' }, 403);

  // Partners de cobro ACEPTADOS (una invitación cancelada/expirada no es un
  // partner activo aunque tenga costo_unico)
  const { data: invs, error } = await supabase
    .from('partner_invitations')
    .select('id, nombre, empresa, costo_unico, team_member_id, estado, created_at')
    .gt('costo_unico', 0)
    .eq('estado', 'accepted')
    .not('team_member_id', 'is', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) return j({ error: error.message }, 500);

  // DEDUPE por team_member: mismo criterio que content/summary (la invitación
  // más reciente manda) — sin esto un member con 2 invitaciones de cobro salía
  // duplicado en los chips y double-contaba en los contadores.
  const vistos = new Set<string>();
  const deCobro = (invs || []).filter(i => {
    const k = String(i.team_member_id);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  if (!deCobro.length) return j({ mes: null, tiers: FIL_TIERS, partners: [] });

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const memberIds = deCobro.map(i => i.team_member_id);

  // Puntos filantrópicos aprobados del mes, por partner
  const { data: subs } = await supabase
    .from('partner_content_submissions')
    .select('partner_id, puntos, estado, categoria, mes_acreditado')
    .in('partner_id', memberIds)
    .eq('categoria', 'filantropia')
    .eq('mes_acreditado', ym);

  const ptsPor: Record<string, { aprobados: number; pendientes: number }> = {};
  for (const s of subs || []) {
    const k = String(s.partner_id);
    if (!ptsPor[k]) ptsPor[k] = { aprobados: 0, pendientes: 0 };
    if (s.estado === 'approved') ptsPor[k].aprobados += Number(s.puntos || 0);
    else if (s.estado === 'pending_review') ptsPor[k].pendientes += Number(s.puntos || 0);
  }

  const partners = deCobro.map(i => {
    const p = ptsPor[String(i.team_member_id)] || { aprobados: 0, pendientes: 0 };
    const extra = extraPorPuntos(p.aprobados);
    const next = siguienteTier(p.aprobados);
    return {
      invitation_id: i.id,
      nombre: i.nombre || '',
      empresa: i.empresa || '',
      pts_aprobados: p.aprobados,
      pts_pendientes: p.pendientes,
      extra_pct: extra,
      siguiente_tier: next,                                  // null = tope
      faltan: next ? next.pts - p.aprobados : 0,
      // "empujable": está a ≤30 pts del siguiente nivel — un recordatorio rinde
      empujable: !!next && (next.pts - p.aprobados) <= 30 && p.aprobados > 0,
    };
  }).sort((a, b) => b.pts_aprobados - a.pts_aprobados);

  return j({ mes: ym, tiers: FIL_TIERS, partners });
};
