// TRABAJO INTELIGENTE · Ejecutar una tarea: hecha (con resultado), omitir
// (con motivo — el alimento del aprendizaje) o posponer.
// POST { id, accion: 'hecha'|'omitir'|'posponer', resultado?, detalle?, motivo?, texto? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { alCompletar, alOmitir } from '../../../../lib/crm/ti/motor';
import { MOTIVOS_OMITIR } from '../../../../lib/crm/ti/reglas';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const { id, accion } = b || {};
  if (!id || !['hecha', 'omitir', 'posponer'].includes(accion)) return json({ error: 'Falta id o la acción no existe' }, 400);

  const { data: tarea } = await supabase.from('ti_tareas').select('*').eq('id', id).maybeSingle();
  if (!tarea) return json({ error: 'No existe esa tarea' }, 404);
  if (tarea.estado !== 'pendiente') return json({ error: `La tarea ya está ${tarea.estado}` }, 409);

  const ahora = new Date().toISOString();

  if (accion === 'posponer') {
    const horas = Math.min(24, Math.max(1, Number(b.horas) || 2));
    await supabase.from('ti_tareas')
      .update({ vence_at: new Date(Date.now() + horas * 3600e3).toISOString(), updated_at: ahora })
      .eq('id', id);
    return json({ ok: true });
  }

  if (accion === 'omitir') {
    const motivo = MOTIVOS_OMITIR.includes(b.motivo) ? b.motivo : 'otro';
    await supabase.from('ti_tareas')
      .update({ estado: 'omitida', hecho_at: ahora, hecho_por: user.id, updated_at: ahora })
      .eq('id', id);
    await supabase.from('ti_omisiones').insert({
      tarea_id: id, motivo, texto: b.texto || null,
      contexto: { familia: tarea.familia, tipo: tarea.tipo, paso: tarea.paso, prioridad: tarea.prioridad, atrasada: tarea.atrasada, origen: tarea.origen },
    });
    const r = await alOmitir(tarea, motivo);
    return json({ ok: true, ...r });
  }

  // hecha — la llamada exige resultado: de eso depende la siguiente tarea.
  if (tarea.tipo === 'llamada' && !b.resultado) return json({ error: 'La llamada necesita su resultado (contestó/buzón/…)' }, 400);
  await supabase.from('ti_tareas').update({
    estado: 'hecha', resultado: b.resultado || null, resultado_detalle: b.detalle || null,
    hecho_at: ahora, hecho_por: user.id, updated_at: ahora,
  }).eq('id', id);
  const r = await alCompletar(tarea, b.resultado || null, user.id);
  return json({ ok: true, ...r });
};
