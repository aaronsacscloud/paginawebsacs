// Puntos 4, 5 y 9 · lo que dicen TODAS las ferias juntas.
//
// GET → { filas (una por edición vivida o por vivir, con su embudo), historico,
//         plan (por año: presupuesto y lo que se espera de vuelta), canales
//         (costo por cliente de los otros canales, para comparar), fit_medido }
// POST {accion:'recalcular_fit'} → vuelve a medir el fit de cada evento y lo guarda.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien } from '../../../../lib/crm/abm.lib';
import { compararEdiciones, conversionHistorica, planAnual, canalesParaComparar, recalcularFitMedido } from '../../../../lib/crm/eventos-analisis.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const filas = await compararEdiciones();
  const ids = filas.map(f => f.edicion_id);
  const metas: Record<string, any> = {};
  if (ids.length) {
    const { data } = await supabase.from('ev_ediciones').select('id, meta_registros, meta_clientes').in('id', ids);
    for (const m of data || []) metas[m.id] = m;
  }
  const [canales, fit] = await Promise.all([
    canalesParaComparar(),
    supabase.from('ev_eventos').select('id, nombre, slug, fit_puntaje, fit_medido, fit_medido_nota, fit_medido_at').not('fit_medido', 'is', null).order('fit_medido', { ascending: false }),
  ]);
  return json({ filas, historico: conversionHistorica(filas), plan: planAnual(filas, metas), canales, fit_medido: fit.data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (b.accion === 'recalcular_fit') return json({ ok: true, eventos: await recalcularFitMedido() });
  return json({ error: 'acción desconocida' }, 400);
};
