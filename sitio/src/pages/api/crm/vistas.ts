// /api/crm/vistas — vistas guardadas de los datatables del CRM (estilo HubSpot).
// GET    ?tabla=clientes          → lista de vistas de esa tabla
// POST   {id?, tabla, nombre, config} → crea (sin id) o actualiza (con id)
// DELETE {id}                     → elimina
// Requiere scripts/migration-2026-07-crm-vistas.sql; el GET es tolerante si la
// tabla no existe (devuelve vacío + aviso) para no romper el datatable.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const faltaTabla = (msg: string) => /crm_vistas|relation|does not exist|schema cache/i.test(msg || '');

export const GET: APIRoute = async ({ url }) => {
  const tabla = url.searchParams.get('tabla');
  if (!tabla) return json({ error: 'tabla requerida' }, 400);
  const { data, error } = await supabase.from('crm_vistas').select('*').eq('tabla', tabla).order('orden').order('created_at');
  if (error) {
    if (faltaTabla(error.message)) return json({ data: [], sin_migracion: true });
    return json({ error: error.message }, 500);
  }
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b.tabla || !b.nombre) return json({ error: 'tabla y nombre requeridos' }, 400);
  const config = b.config || {};
  // 23) vistas personales vs del equipo (owner_id + compartida) y orden manual.
  const extra: any = {};
  if ('compartida' in b) extra.compartida = !!b.compartida;
  if ('orden' in b) extra.orden = Number(b.orden) || 0;
  let r;
  if (b.id) {
    r = await supabase.from('crm_vistas').update({ nombre: b.nombre, config, ...extra, updated_at: new Date().toISOString() }).eq('id', b.id).select().single();
  } else {
    let owner_id: string | null = null;
    try { const { getCurrentUser } = await import('../../../lib/auth/scope'); owner_id = (await getCurrentUser(request))?.id || null; } catch { /* sin dueño */ }
    r = await supabase.from('crm_vistas').insert({ tabla: b.tabla, nombre: b.nombre, config, owner_id, compartida: 'compartida' in b ? !!b.compartida : true, ...('orden' in b ? { orden: extra.orden } : {}) }).select().single();
  }
  if (r.error) {
    if (faltaTabla(r.error.message)) return json({ error: 'Falta correr scripts/migration-2026-07-crm-vistas.sql en Supabase.' }, 500);
    return json({ error: r.error.message }, 500);
  }
  return json({ data: r.data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b.id) return json({ error: 'id requerido' }, 400);
  const { error } = await supabase.from('crm_vistas').delete().eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
