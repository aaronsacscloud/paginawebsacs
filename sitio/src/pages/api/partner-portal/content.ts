// GET /api/partner-portal/content   — lista del partner + status de strikes
// POST /api/partner-portal/content  — submit nuevo contenido (o acción filantrópica)
//
// El endpoint también ejecuta el "month rollover": si pasamos a un mes nuevo
// desde la última evaluación del partner, evalúa el mes anterior:
//  - Cumplió META → reset consecutive_failed_months a 0
//  - No cumplió → +1 strike. Si llega a 3, marca suspended_at + suspension_reason
//
// Carry-over: el déficit del mes anterior se suma a la meta del mes actual.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { CONTENT_TYPES, getContentType, META_PUNTOS_MES } from '../../../data/content-types';

export const prerender = false;

const ALLOWED_TIPOS = CONTENT_TYPES.map(c => c.id);
const ALLOWED_PLATAFORMAS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'spotify', 'otro'];

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentYM(): string { return ymOf(new Date()); }
function prevYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return ymOf(d);
}
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Evalúa todos los meses cerrados desde last_period_evaluated hasta el mes anterior
 * al actual. Por cada uno, decide si fue éxito o failure (considerando carry-over)
 * y actualiza consecutive_failed_months. Si llega a 3, suspende.
 */
async function evaluatePeriods(partnerId: string, lastEvaluated: string | null, allApproved: any[]): Promise<{
  consecutive_failed_months: number;
  suspended: boolean;
  evaluated_to: string;
}> {
  const ym = currentYM();
  const monthsByYm: Record<string, number> = {};
  for (const r of allApproved) {
    const k = r.mes_acreditado || 'unknown';
    monthsByYm[k] = (monthsByYm[k] || 0) + Number(r.puntos || 0);
  }

  // Get all closed months (anteriores al actual) en orden cronológico
  const allMonths = Object.keys(monthsByYm).filter(k => k < ym).sort();
  // Find the months that haven't been evaluated yet
  const startFrom = lastEvaluated || (allMonths[0] || ym);
  const toEvaluate = allMonths.filter(m => m > startFrom);

  if (toEvaluate.length === 0) {
    // Read current state without modifying
    const { data: member } = await supabase
      .from('team_members')
      .select('consecutive_failed_months, suspended_at')
      .eq('id', partnerId)
      .maybeSingle();
    return {
      consecutive_failed_months: member?.consecutive_failed_months || 0,
      suspended: !!member?.suspended_at,
      evaluated_to: lastEvaluated || ym,
    };
  }

  // Re-compute from scratch using full history (more robust than incremental)
  let consecutive = 0;
  let carryover = 0;
  let suspended = false;
  for (const m of allMonths) {
    const got = monthsByYm[m] || 0;
    const required = META_PUNTOS_MES + carryover;
    if (got >= required) {
      consecutive = 0;
      carryover = 0; // limpio
    } else {
      consecutive += 1;
      carryover = required - got;
      if (consecutive >= 3) {
        suspended = true;
      }
    }
  }

  // Persist
  const updates: Record<string, any> = {
    consecutive_failed_months: consecutive,
    last_period_evaluated: prevYM(ym), // we evaluated up to last closed month
  };
  if (suspended) {
    // Only set suspended_at the first time
    const { data: existing } = await supabase
      .from('team_members')
      .select('suspended_at')
      .eq('id', partnerId)
      .maybeSingle();
    if (!existing?.suspended_at) {
      updates.suspended_at = new Date().toISOString();
      updates.suspension_reason = `3 meses consecutivos sin alcanzar la meta de ${META_PUNTOS_MES} pts/mes`;
      updates.activo = false;
    }
  }
  try {
    await supabase.from('team_members').update(updates).eq('id', partnerId);
    if (suspended) {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Partner suspendido automáticamente: 3 meses consecutivos sin meta de ${META_PUNTOS_MES} pts`,
        metadata: { partner_id: partnerId, consecutive_failed_months: consecutive },
        automatico: true,
      });
    }
  } catch {}

  return {
    consecutive_failed_months: consecutive,
    suspended,
    evaluated_to: prevYM(ym),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const { data: rows } = await supabase
    .from('partner_content_submissions')
    .select('*')
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  // Get member status (including strikes data)
  const { data: member } = await supabase
    .from('team_members')
    .select('id, last_period_evaluated, consecutive_failed_months, suspended_at, suspension_reason')
    .eq('id', user.id)
    .maybeSingle();

  // Partner DE COBRO (invitación con costo_unico > 0): NO tiene meta mensual
  // obligatoria ni strikes — su filantropía es un incentivo opcional por
  // rachas (data/filantropia.ts). El flag gobierna la evaluación de strikes
  // (que NO debe correr para él) y la UI del portal.
  const { data: invPago } = await supabase
    .from('partner_invitations')
    .select('id, costo_unico')
    .eq('team_member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const esDeCobro = Number(invPago?.costo_unico || 0) > 0;

  const all = rows || [];
  const ym = currentYM();
  const now = new Date();

  // Aggregates
  const approved = all.filter(r => r.estado === 'approved');
  const pending = all.filter(r => r.estado === 'pending_review');
  const rejected = all.filter(r => r.estado === 'rejected');

  const puntosThisMonth = approved
    .filter(r => r.mes_acreditado === ym)
    .reduce((s, r) => s + Number(r.puntos || 0), 0);

  // Per-month breakdown
  const byMes: Record<string, { puntos: number; categoria: { contenido: number; apoyo: number; filantropia: number } }> = {};
  for (const r of approved) {
    const m = r.mes_acreditado || 'unknown';
    if (!byMes[m]) byMes[m] = { puntos: 0, categoria: { contenido: 0, apoyo: 0, filantropia: 0 } };
    byMes[m].puntos += Number(r.puntos || 0);
    const cat: 'contenido' | 'apoyo' | 'filantropia' =
      r.categoria === 'filantropia' ? 'filantropia' :
      r.categoria === 'apoyo' ? 'apoyo' : 'contenido';
    byMes[m].categoria[cat] += Number(r.puntos || 0);
  }

  // Acumulado: meses anteriores con superávit (mantiene compat hacia atrás)
  let acumulado = 0;
  for (const [mes, data] of Object.entries(byMes)) {
    if (mes < ym) acumulado += Math.max(0, data.puntos - META_PUNTOS_MES);
  }

  // Run evaluation logic (writes back if a month rolled over).
  // Partner de cobro: SIN evaluación de strikes — no tiene meta obligatoria;
  // evaluarlo lo marcaría "failed months"/suspendido por una meta que no firmó.
  let evalRes;
  if (esDeCobro) {
    evalRes = { consecutive_failed_months: 0, suspended: false, evaluated_to: member?.last_period_evaluated || null };
    // Saneo del pasado: si ANTES lo marcó la evaluación por meta (strikes o
    // suspensión automática), se limpia — esa meta ya no le aplica. También
    // se AVANZA last_period_evaluated: si algún día vuelve a ser gratuito, la
    // retro-evaluación no debe castigarlo por meses en los que no tenía meta.
    try {
      const upd: Record<string, any> = {};
      if ((member?.consecutive_failed_months ?? 0) > 0) upd.consecutive_failed_months = 0;
      if (member?.suspended_at) { upd.suspended_at = null; upd.suspension_reason = null; upd.activo = true; }
      const prevM = prevYM(ym);
      if (member && member.last_period_evaluated !== prevM) upd.last_period_evaluated = prevM;
      if (Object.keys(upd).length) await supabase.from('team_members').update(upd).eq('id', user.id);
    } catch { /* best-effort */ }
  } else {
    evalRes = await evaluatePeriods(user.id, member?.last_period_evaluated || null, approved);
  }

  // Compute carryover deficit for current month
  const prevMonth = prevYM(ym);
  const prevMonthPts = byMes[prevMonth]?.puntos || 0;
  const prevMonthRequired = META_PUNTOS_MES; // simplificación: deficit del mes anterior solo
  const carryDeficit = Math.max(0, prevMonthRequired - prevMonthPts);
  const requiredThisMonth = META_PUNTOS_MES + (evalRes.consecutive_failed_months > 0 ? carryDeficit : 0);

  // Days remaining in month
  const lastDay = lastDayOfMonth(now.getFullYear(), now.getMonth() + 1);
  const dayOfMonth = now.getDate();
  const daysRemaining = Math.max(0, lastDay - dayOfMonth);
  const daysIntoMonth = dayOfMonth;
  const monthProgressPct = Math.round((dayOfMonth / lastDay) * 100);

  // Status
  let statusLevel: 'active' | 'warning' | 'final_warning' | 'suspended' = 'active';
  if (evalRes.suspended) statusLevel = 'suspended';
  else if (evalRes.consecutive_failed_months >= 2) statusLevel = 'final_warning';
  else if (evalRes.consecutive_failed_months >= 1) statusLevel = 'warning';

  // Build last 6 months history for display
  const historico = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = ymOf(d);
    const data = byMes[k] || { puntos: 0, categoria: { contenido: 0, apoyo: 0, filantropia: 0 } };
    historico.push({
      mes: k,
      label: d.toLocaleString('es-MX', { month: 'long', year: 'numeric' }),
      puntos: data.puntos,
      contenido: data.categoria.contenido,
      apoyo: data.categoria.apoyo,
      filantropia: data.categoria.filantropia,
      cumplido: data.puntos >= META_PUNTOS_MES,
      es_actual: k === ym,
    });
  }

  return j({
    items: all,
    summary: {
      meta: META_PUNTOS_MES,
      mes_actual: ym,
      puntos_mes: puntosThisMonth,
      puntos_acumulados: acumulado,
      progreso_pct: Math.min(100, Math.round((puntosThisMonth / requiredThisMonth) * 100)),
      pending_count: pending.length,
      approved_count: approved.length,
      rejected_count: rejected.length,
      // Grace period + countdown
      required_this_month: requiredThisMonth,
      carry_deficit: carryDeficit,
      days_remaining: daysRemaining,
      days_into_month: daysIntoMonth,
      month_progress_pct: monthProgressPct,
      reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10),
      // Strikes
      consecutive_failed_months: evalRes.consecutive_failed_months,
      status_level: statusLevel,
      suspended: evalRes.suspended,
      suspension_reason: member?.suspension_reason || null,
      historico,
      // Racha filantrópica (partner de cobro): puntos de filantropía del mes
      // en curso — el front pinta la barra 100/300/500 y el extra logrado.
      es_de_cobro: esDeCobro,
      filantropia_mes: byMes[ym]?.categoria?.filantropia || 0,
    },
    tipos: CONTENT_TYPES,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  try {
    const body = await request.json() as {
      url?: string; tipo?: string; descripcion?: string; plataforma?: string;
    };
    const url = (body.url || '').trim().slice(0, 500);
    const tipo = (body.tipo || '').trim();
    const descripcion = (body.descripcion || '').trim().slice(0, 500) || null;
    const plataforma = (body.plataforma || '').trim().toLowerCase().slice(0, 30) || null;

    if (!ALLOWED_TIPOS.includes(tipo)) {
      return j({ error: 'Tipo de contenido inválido' }, 400);
    }

    // Detectar categoría desde el catálogo (contenido | apoyo | filantropia)
    const tipoMeta = getContentType(tipo);
    const categoria: 'contenido' | 'apoyo' | 'filantropia' =
      tipoMeta?.categoria === 'filantropia' ? 'filantropia' :
      tipoMeta?.categoria === 'apoyo' ? 'apoyo' : 'contenido';

    // FILANTROPÍA: la evidencia es foto/video documentado — muchas acciones no
    // viven en una red social. Se acepta URL (Drive/red) O una descripción con
    // sustancia; exigir URL http bloqueaba el core del incentivo del partner
    // de cobro. Contenido/apoyo siguen exigiendo URL pública.
    if (categoria === 'filantropia') {
      if ((!url || !url.startsWith('http')) && (!descripcion || descripcion.length < 20)) {
        return j({ error: 'Comparte el link de tu evidencia (foto/video) o describe la acción (mínimo 20 caracteres).' }, 400);
      }
    } else if (!url || !url.startsWith('http')) {
      return j({ error: 'URL válida requerida (debe empezar con http:// o https://)' }, 400);
    }
    // plataforma no aplica a filantropía (el default del form era 'instagram'
    // → datos basura tipo "voluntariado_animales · instagram")
    const plataformaFinal = categoria === 'filantropia' ? null : plataforma;
    if (plataformaFinal && !ALLOWED_PLATAFORMAS.includes(plataformaFinal)) {
      return j({ error: 'Plataforma inválida' }, 400);
    }

    // Insert (UNIQUE constraint en (partner_id, url) evita duplicados).
    // Filantropía sin URL: placeholder ÚNICO — un '' repetido chocaría con el
    // UNIQUE y el 2º reporte sin link daría "ya enviaste este link antes".
    const urlFinal = url || `filantropia-evidencia:${Date.now()}`;
    const { data, error } = await supabase
      .from('partner_content_submissions')
      .insert({
        partner_id: user.id,
        url: urlFinal,
        tipo,
        categoria,
        descripcion,
        plataforma: plataformaFinal,
        estado: 'pending_review',
        puntos: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return j({ error: 'Ya enviaste este link antes. Si necesitas cambiarlo, escríbenos a partners@sacscloud.com.' }, 409);
      }
      // Si la columna categoria no existe (migration pendiente), retry sin ella
      if (/categoria/.test(error.message || '')) {
        const { data: retryData, error: retryErr } = await supabase
          .from('partner_content_submissions')
          .insert({
            partner_id: user.id, url: urlFinal, tipo, descripcion, plataforma: plataformaFinal,
            estado: 'pending_review', puntos: 0,
          })
          .select()
          .single();
        if (retryErr) return j({ error: retryErr.message }, 500);
        return j({ ok: true, submission: retryData, warning: 'columna categoria pendiente de migration' });
      }
      return j({ error: error.message }, 500);
    }

    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Partner ${user.nombre || user.email} envió ${categoria === 'filantropia' ? 'acción filantrópica' : 'contenido'} para revisión: ${tipoMeta?.nombre || tipo}`,
        metadata: { submission_id: data.id, partner_id: user.id, url, tipo, categoria },
        automatico: true,
      });
    } catch {}

    return j({ ok: true, submission: data });
  } catch (err: any) {
    return j({ error: err?.message || String(err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
