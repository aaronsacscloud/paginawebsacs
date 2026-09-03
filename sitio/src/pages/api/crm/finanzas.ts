import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { resumenMes, reporteAnual, cerrarMes, mesDe } from '../../../lib/crm/finanzas';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const mes = (url.searchParams.get('mes') || mesDe()).slice(0, 7);
  if (url.searchParams.get('reporte') === 'anual') return json(await reporteAnual(Number(url.searchParams.get('anio')) || Number(mes.slice(0, 4))));
  try { return json(await resumenMes(mes)); } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const uid = (user as any).id;
  const b = await request.json().catch(() => ({}));
  const ahora = new Date().toISOString();
  if (b.accion === 'gasto_guardar') {
    const g = b.gasto || {};
    if (!g.nombre || !(Number(g.monto) >= 0)) return json({ error: 'Falta nombre o monto' }, 400);
    const fila: any = { nombre: String(g.nombre).trim(), categoria: g.categoria || 'suscripcion', monto: Number(g.monto), moneda: g.moneda || 'MXN', periodicidad: g.periodicidad || 'mensual', dia_cobro: g.dia_cobro ? Number(g.dia_cobro) : null, inicio: g.inicio ? `${String(g.inicio).slice(0, 7)}-01` : `${mesDe()}-01`, fin: g.fin ? `${String(g.fin).slice(0, 7)}-01` : null, proveedor: g.proveedor || null, notas: g.notas || null, activo: g.activo !== false, probable: !!g.probable, updated_at: ahora };
    const q = g.id ? supabase.from('fin_gastos').update(fila).eq('id', g.id) : supabase.from('fin_gastos').insert(fila);
    const { error } = await q; return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'gasto_borrar' && b.id) { await supabase.from('fin_gastos').delete().eq('id', b.id); return json({ ok: true }); }
  if (b.accion === 'gasto_pagar' && b.gasto_id && b.mes) {
    if (b.pagado === false) { await supabase.from('fin_gastos_pagos').delete().eq('gasto_id', b.gasto_id).eq('mes', b.mes); return json({ ok: true }); }
    const { error } = await supabase.from('fin_gastos_pagos').upsert({ gasto_id: b.gasto_id, mes: String(b.mes).slice(0, 7), pagado_at: ahora, monto: b.monto != null ? Number(b.monto) : null, nota: b.nota || null, pagado_por: uid }, { onConflict: 'gasto_id,mes' });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'cerrar_mes' && b.mes) return json(await cerrarMes(String(b.mes).slice(0, 7), uid, b.notas));
  if (b.accion === 'reabrir_mes' && b.mes) { await supabase.from('fin_cierres').delete().eq('mes', String(b.mes).slice(0, 7)); return json({ ok: true }); }
  return json({ error: 'Acción desconocida' }, 400);
};
