// Registrar que el cliente ABRIÓ su reporte de trabajo.
//
// Lo llama la propia página pública, SIN sesión: por eso vive fuera de /api/crm.
// Misma forma que `api/quotes/vista.ts`, que ya resolvió este problema: no se
// cuentan las aperturas del equipo —el consultor abre su propio reporte diez
// veces y ensuciaría justo la señal que se quiere medir— y una recarga dentro
// de la misma media hora no infla el conteo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b.reporte_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false }, 400);

  const user = await getCurrentUser(request).catch(() => null);
  if (user) return json({ ok: true, ignorada: 'equipo' });

  const segundos = Number.isFinite(Number(b.segundos)) ? Math.min(3600, Math.max(0, Number(b.segundos))) : null;
  const visitor = b.visitor_id ? String(b.visitor_id).slice(0, 80) : null;

  const desde = new Date(Date.now() - 30 * 60000).toISOString();
  const { data: reciente } = await supabase.from('reporte_vistas')
    .select('id').eq('reporte_id', id).eq('visitor_id', visitor || 'x')
    .gte('created_at', desde).limit(1).maybeSingle();

  if (reciente) {
    if (segundos) await supabase.from('reporte_vistas').update({ segundos }).eq('id', reciente.id);
    return json({ ok: true, repetida: true });
  }

  await supabase.from('reporte_vistas').insert({
    reporte_id: id, visitor_id: visitor, segundos,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 200),
  });

  const { data: r } = await supabase.from('reportes_trabajo').select('vistas, primera_vista_at, company_id').eq('id', id).maybeSingle();
  const ahora = new Date().toISOString();
  await supabase.from('reportes_trabajo').update({
    vistas: (r?.vistas || 0) + 1,
    primera_vista_at: r?.primera_vista_at || ahora,
    ultima_vista_at: ahora,
  }).eq('id', id);

  // La primera apertura vale como actividad en la ficha: es el momento en que el
  // cliente pasó de "le mandé el reporte" a "lo está leyendo".
  if (!r?.primera_vista_at && r?.company_id) {
    await supabase.from('activities').insert({
      company_id: r.company_id, tipo: 'reporte_viewed',
      titulo: 'Abrió su reporte de trabajo', automatico: true,
    }).then(() => {}, () => {});
  }
  return json({ ok: true, primera: !r?.primera_vista_at });
};
