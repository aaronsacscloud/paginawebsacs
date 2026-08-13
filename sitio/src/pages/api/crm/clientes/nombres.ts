// GET  /api/crm/clientes/nombres   → cuentas y su nombre de empresa
// PUT  /api/crm/clientes/nombres   { cambios: [{ id, nombre_comercial }] }
//
// El nombre se pobló solo partiendo la cuenta SACS, pero 40 de las 83 activas
// no se pudieron partir y quedaron como el slug con la inicial en mayúscula
// —"Meraki", "Kbiu", "Surtex"—. Corregirlas una por una son 40 visitas a la
// ficha; aquí se escriben todas de corrido.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { nombreDesdeCuenta } from '../../../../lib/crm/nombre-comercial';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const soloActivos = url.searchParams.get('todos') !== '1';
  let q = supabase.from('companies')
    .select('id, nombre, nombre_comercial, sacs_account, estado_cuenta, arr')
    .is('archived_at', null);
  if (soloActivos) q = q.eq('estado_cuenta', 'activo');
  const { data, error } = await q.order('arr', { ascending: false, nullsFirst: false }).limit(1000);
  if (error) return json({ error: error.message }, 500);

  const filas = (data || []).map((c: any) => {
    const cuenta = c.sacs_account || c.nombre || '';
    const auto = nombreDesdeCuenta(cuenta);
    // "Pendiente" no es "vacío": es que nadie lo ha escrito todavía y lo que se
    // muestra es la cuenta capitalizada. Se marca para poder filtrarlas.
    const actual = (c.nombre_comercial || '').trim();
    const pendiente = !actual || (!auto.sugerido && actual === auto.nombre);
    return {
      id: c.id, cuenta, arr: Number(c.arr || 0),
      nombre_comercial: actual || auto.nombre,
      separado: auto.sugerido,
      pendiente,
    };
  });
  return json({
    filas,
    total: filas.length,
    pendientes: filas.filter(f => f.pendiente).length,
    separados: filas.filter(f => f.separado).length,
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const cambios = Array.isArray(b?.cambios) ? b.cambios : [];
  if (!cambios.length) return json({ ok: true, guardados: 0 });

  let guardados = 0;
  const fallidos: string[] = [];
  for (const c of cambios) {
    if (!c?.id) continue;
    const v = String(c.nombre_comercial || '').trim();
    // Vacío = volver a la sugerencia automática, no dejar al cliente sin nombre.
    const { error } = await supabase.from('companies')
      .update({ nombre_comercial: v || null }).eq('id', c.id);
    if (error) fallidos.push(c.id); else guardados++;
  }
  return json({ ok: true, guardados, fallidos });
};
