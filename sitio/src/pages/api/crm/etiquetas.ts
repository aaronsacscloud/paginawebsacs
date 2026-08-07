// Etiquetas del CRM — un solo catálogo para clientes, oportunidades y
// suscripciones. Si cada sección tuviera las suyas, "Joyería" existiría tres
// veces escrita de tres formas y ningún filtro cruzaría.
//
// GET  /api/crm/etiquetas                      → catálogo + cuántas cosas etiqueta cada una
// GET  /api/crm/etiquetas?entidad=company&entidad_id=… → las de UNA cosa
// GET  /api/crm/etiquetas?entidad=deal&mapa=1  → { entidad_id: [etiquetas] } para pintar listas
// POST { nombre, color?, descripcion? }        → crea (idempotente por nombre)
// POST { etiqueta_id|nombre, entidad, entidad_id } → asigna
// POST { etiqueta_id, entidad, entidad_id, quitar: true } → desasigna
// PUT  { id, nombre?, color?, descripcion? }   → renombra / recolorea
// DELETE { id }                                → borra la etiqueta y sus asignaciones
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ENTIDADES = ['company', 'deal', 'subscription'];
const sinTabla = (m?: string) => /relation .* does not exist|schema cache|could not find the table/i.test(m || '');

export const GET: APIRoute = async ({ url }) => {
  const entidad = url.searchParams.get('entidad') || '';
  const entidadId = url.searchParams.get('entidad_id') || '';
  const mapa = url.searchParams.get('mapa') === '1';

  const { data: cat, error } = await supabase.from('crm_etiquetas')
    .select('id, nombre, color, descripcion').order('nombre');
  if (error) {
    // El deploy puede ir antes que el SQL: sin etiquetas el CRM funciona igual.
    if (sinTabla(error.message)) return json({ data: [], asignaciones: [], mapa: {}, sin_tabla: true });
    return json({ error: error.message, data: [] });
  }
  const porId = new Map((cat || []).map(e => [e.id, e]));

  // Las de UNA cosa concreta.
  if (entidad && entidadId) {
    const { data } = await supabase.from('crm_etiqueta_asignaciones')
      .select('etiqueta_id').eq('entidad', entidad).eq('entidad_id', entidadId);
    return json({ data: (data || []).map(a => porId.get(a.etiqueta_id)).filter(Boolean) });
  }

  // Mapa entidad_id → etiquetas, para pintar una lista entera sin N consultas.
  if (entidad && mapa) {
    const { data } = await supabase.from('crm_etiqueta_asignaciones')
      .select('etiqueta_id, entidad_id').eq('entidad', entidad).limit(5000);
    const m: Record<string, any[]> = {};
    for (const a of data || []) {
      const et = porId.get(a.etiqueta_id);
      if (!et) continue;
      (m[a.entidad_id] ||= []).push(et);
    }
    return json({ data: cat || [], mapa: m });
  }

  // Catálogo con uso: una etiqueta que no etiqueta nada es candidata a borrarse,
  // y sin el conteo nadie se entera de que sobra.
  const { data: asig } = await supabase.from('crm_etiqueta_asignaciones').select('etiqueta_id, entidad').limit(20000);
  const uso: Record<string, any> = {};
  for (const a of asig || []) {
    const u = (uso[a.etiqueta_id] ||= { total: 0, company: 0, deal: 0, subscription: 0 });
    u.total++; u[a.entidad] = (u[a.entidad] || 0) + 1;
  }
  return json({ data: (cat || []).map(e => ({ ...e, uso: uso[e.id] || { total: 0, company: 0, deal: 0, subscription: 0 } })) });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const entidad = String(b.entidad || '');
  const entidadId = String(b.entidad_id || '');

  // ── Asignar / quitar ──
  if (entidad && entidadId) {
    if (!ENTIDADES.includes(entidad)) return json({ error: 'entidad inválida' }, 400);

    let etiquetaId = b.etiqueta_id || null;
    // Se puede etiquetar escribiendo el nombre: si no existe, se crea. Obligar a
    // pasar por un catálogo antes de poder etiquetar es lo que hace que nadie
    // etiquete.
    if (!etiquetaId && b.nombre) {
      const nombre = String(b.nombre).trim();
      if (!nombre) return json({ error: 'nombre vacío' }, 400);
      const { data: ya } = await supabase.from('crm_etiquetas').select('id').ilike('nombre', nombre).maybeSingle();
      if (ya) etiquetaId = ya.id;
      else {
        const { data: nueva, error } = await supabase.from('crm_etiquetas')
          .insert({ nombre, color: b.color || '#4B7BE5' }).select('id').maybeSingle();
        if (error || !nueva) return json({ error: error?.message || 'No se pudo crear la etiqueta' }, 500);
        etiquetaId = nueva.id;
      }
    }
    if (!etiquetaId) return json({ error: 'etiqueta_id o nombre requerido' }, 400);

    if (b.quitar) {
      await supabase.from('crm_etiqueta_asignaciones').delete()
        .eq('etiqueta_id', etiquetaId).eq('entidad', entidad).eq('entidad_id', entidadId);
      return json({ ok: true, quitada: true });
    }
    const { error } = await supabase.from('crm_etiqueta_asignaciones')
      .insert({ etiqueta_id: etiquetaId, entidad, entidad_id: entidadId });
    // Choque de índice único = ya la tenía. No es un error para quien etiqueta.
    if (error && !/duplicate key|23505/i.test(error.message || '')) return json({ error: error.message }, 500);
    return json({ ok: true, etiqueta_id: etiquetaId });
  }

  // ── Crear etiqueta suelta ──
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return json({ error: 'nombre requerido' }, 400);
  const { data: ya } = await supabase.from('crm_etiquetas').select('id, nombre, color').ilike('nombre', nombre).maybeSingle();
  if (ya) return json({ ok: true, data: ya, existia: true });
  const { data, error } = await supabase.from('crm_etiquetas')
    .insert({ nombre, color: b.color || '#4B7BE5', descripcion: b.descripcion || null }).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  const upd: any = {};
  if (b.nombre !== undefined) upd.nombre = String(b.nombre).trim();
  if (b.color !== undefined) upd.color = b.color;
  if (b.descripcion !== undefined) upd.descripcion = b.descripcion || null;
  const { data, error } = await supabase.from('crm_etiquetas').update(upd).eq('id', b.id).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  // Las asignaciones caen por cascada: borrar la etiqueta la quita de todo.
  const { error } = await supabase.from('crm_etiquetas').delete().eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
