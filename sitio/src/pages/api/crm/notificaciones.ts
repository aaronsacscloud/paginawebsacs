// GET  /api/crm/notificaciones?limit=40&solo=no_leidas → { data, no_leidas }
// PUT  { id }        → marca una como leída
// PUT  { todas:true }→ marca todas como leídas
//
// Tolerante a que la tabla no exista todavía: el deploy puede ir antes que el
// SQL y la campana no puede tronar el CRM entero por eso.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const sinTabla = (m?: string) => /relation .* does not exist|schema cache|could not find the table/i.test(m || '');

export const GET: APIRoute = async ({ url }) => {
  const limit = Math.min(Number(url.searchParams.get('limit') || 40), 200);
  const solo = url.searchParams.get('solo') || '';

  let q = supabase.from('crm_notificaciones')
    .select('id, tipo, nivel, titulo, detalle, monto, company_id, subscription_id, payment_id, destino, leida_at, created_at, metadata, companies(id, nombre, sacs_account)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (solo === 'no_leidas') q = q.is('leida_at', null);

  const { data, error } = await q;
  if (error) {
    if (sinTabla(error.message)) return json({ data: [], no_leidas: 0, sin_tabla: true });
    return json({ error: error.message, data: [], no_leidas: 0 }, 200);
  }

  // El badge cuenta TODAS las no leídas, no solo las de esta página: si el
  // contador dependiera del limit, 60 avisos se verían como 40.
  const { count } = await supabase.from('crm_notificaciones')
    .select('id', { count: 'exact', head: true }).is('leida_at', null);

  return json({ data: data || [], no_leidas: count || 0 });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const ahora = new Date().toISOString();

  if (b?.todas) {
    const { error } = await supabase.from('crm_notificaciones').update({ leida_at: ahora }).is('leida_at', null);
    if (error && !sinTabla(error.message)) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  if (!b?.id) return json({ error: 'id requerido (o todas:true)' }, 400);
  const { error } = await supabase.from('crm_notificaciones').update({ leida_at: ahora }).eq('id', b.id);
  if (error && !sinTabla(error.message)) return json({ error: error.message }, 500);
  return json({ ok: true });
};
