// GET  /api/crm/demanda/acciones?estado=&tipo=&limite=  — la cola
// POST /api/crm/demanda/acciones  { id, accion: aprobar|rechazar|reintentar|cancelar, motivo }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { resolverAprobacion } from '../../../../lib/demanda/cola';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado');
  const tipo = url.searchParams.get('tipo');
  const ciclo = url.searchParams.get('ciclo');
  const limite = Math.min(Number(url.searchParams.get('limite')) || 100, 500);

  let q = supabase.from('de_acciones')
    .select('id, clave_idem, tipo, prioridad, estado, riesgo, nivel_requerido, intentos, max_intentos, programada_at, iniciada_at, terminada_at, error, resultado, payload, motivo, costo_usd, ciclo_id, created_at')
    .order('created_at', { ascending: false }).limit(limite);
  if (estado) q = q.in('estado', estado.split(','));
  if (tipo) q = q.eq('tipo', tipo);
  if (ciclo) q = q.eq('ciclo_id', ciclo);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, acciones: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  const body = await request.json().catch(() => ({}));
  const { id, accion, motivo } = body || {};
  if (!id || !accion) return json({ ok: false, error: 'faltan id y accion' }, 400);

  if (accion === 'aprobar' || accion === 'rechazar') {
    await resolverAprobacion(id, accion === 'aprobar', user?.id || null, motivo);
    return json({ ok: true });
  }
  if (accion === 'reintentar') {
    // Revivir una acción muerta reinicia el contador: si el humano la resucita
    // es porque arregló la causa, no para que muera en el mismo intento.
    const { error } = await supabase.from('de_acciones').update({
      estado: 'lista', intentos: 0, error: null, lease_hasta: null,
      programada_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id).in('estado', ['muerta', 'fallida', 'rechazada']);
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
  }
  if (accion === 'cancelar') {
    const { error } = await supabase.from('de_acciones').update({
      estado: 'cancelada', motivo: motivo || null, terminada_at: new Date().toISOString(),
    }).eq('id', id).not('estado', 'in', '(terminada,corriendo)');
    return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
  }
  return json({ ok: false, error: 'acción desconocida' }, 400);
};
