// GET /api/partner-portal/content   — lista del partner (sus submissions)
// POST /api/partner-portal/content  — submit nuevo contenido para revisión
//
// Cada submission queda pending_review. Admin la aprueba con puntos
// desde otro endpoint.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { CONTENT_TYPES, getContentType, META_PUNTOS_MES } from '../../../data/content-types';

export const prerender = false;

const ALLOWED_TIPOS = CONTENT_TYPES.map(c => c.id);
const ALLOWED_PLATAFORMAS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'spotify', 'otro'];

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

  const all = rows || [];
  const ym = currentYM();

  // Aggregates
  const approved = all.filter(r => r.estado === 'approved');
  const pending = all.filter(r => r.estado === 'pending_review');
  const rejected = all.filter(r => r.estado === 'rejected');

  const puntosThisMonth = approved
    .filter(r => r.mes_acreditado === ym)
    .reduce((s, r) => s + Number(r.puntos || 0), 0);

  // Acumulado: meses anteriores con superávit
  const byMes: Record<string, number> = {};
  for (const r of approved) {
    const m = r.mes_acreditado || 'unknown';
    byMes[m] = (byMes[m] || 0) + Number(r.puntos || 0);
  }
  // Carry forward calculation: sum (month - 100) clamped to 0 across past months
  let acumulado = 0;
  for (const [mes, pts] of Object.entries(byMes)) {
    if (mes < ym) {
      acumulado += Math.max(0, pts - META_PUNTOS_MES);
    }
  }

  return j({
    items: all,
    summary: {
      meta: META_PUNTOS_MES,
      mes_actual: ym,
      puntos_mes: puntosThisMonth,
      puntos_acumulados: acumulado,
      progreso_pct: Math.min(100, Math.round((puntosThisMonth / META_PUNTOS_MES) * 100)),
      pending_count: pending.length,
      approved_count: approved.length,
      rejected_count: rejected.length,
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

    if (!url || !url.startsWith('http')) {
      return j({ error: 'URL válida requerida (debe empezar con http:// o https://)' }, 400);
    }
    if (!ALLOWED_TIPOS.includes(tipo)) {
      return j({ error: 'Tipo de contenido inválido' }, 400);
    }
    if (plataforma && !ALLOWED_PLATAFORMAS.includes(plataforma)) {
      return j({ error: 'Plataforma inválida' }, 400);
    }

    // Insert (UNIQUE constraint en (partner_id, url) evita duplicados)
    const { data, error } = await supabase
      .from('partner_content_submissions')
      .insert({
        partner_id: user.id,
        url,
        tipo,
        descripcion,
        plataforma,
        estado: 'pending_review',
        puntos: 0, // se asigna al aprobar
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return j({ error: 'Ya enviaste este link antes. Si necesitas cambiarlo, escríbenos a partners@sacscloud.com.' }, 409);
      }
      return j({ error: error.message }, 500);
    }

    // Activity log
    try {
      await supabase.from('activities').insert({
        tipo: 'sistema',
        titulo: `Partner ${user.nombre || user.email} envió contenido para revisión: ${getContentType(tipo)?.nombre || tipo}`,
        metadata: { submission_id: data.id, partner_id: user.id, url, tipo },
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
