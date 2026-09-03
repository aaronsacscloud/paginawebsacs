import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { resumenMes, reporteAnual, cerrarMes, mesDe, detalleOportunidad, editarOportunidad } from '../../../lib/crm/finanzas';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const mes = (url.searchParams.get('mes') || mesDe()).slice(0, 7);
  if (url.searchParams.get('reporte') === 'anual') return json(await reporteAnual(Number(url.searchParams.get('anio')) || Number(mes.slice(0, 4))));
  const opId = url.searchParams.get('oportunidad');
  if (opId) { const r = await detalleOportunidad(opId); return r ? json(r) : json({ error: 'No existe' }, 404); }
  // Detalle de UN gasto: la ficha + el historial de pagos de todos los meses (para medir y mejorar lo recurrente).
  const gastoId = url.searchParams.get('gasto');
  if (gastoId) {
    const [{ data: g }, { data: pagos }] = await Promise.all([
      supabase.from('fin_gastos').select('*').eq('id', gastoId).maybeSingle(),
      supabase.from('fin_gastos_pagos').select('*').eq('gasto_id', gastoId).order('mes', { ascending: false }).limit(36),
    ]);
    if (!g) return json({ error: 'No existe' }, 404);
    const hist = (pagos || []).map(p => ({ ...p, monto: Number(p.monto ?? g.monto) }));
    const total = hist.reduce((s, p) => s + p.monto, 0);
    const prom = hist.length ? total / hist.length : Number(g.monto);
    // Puntualidad: pagado antes o el día de cobro del mes.
    const aTiempo = hist.filter(p => { if (!g.dia_cobro) return true; const d = new Date(p.pagado_at); const cdmx = new Date(d.getTime() - 6 * 3600e3); return cdmx.toISOString().slice(0, 7) < p.mes || (cdmx.toISOString().slice(0, 7) === p.mes && cdmx.getUTCDate() <= Number(g.dia_cobro)); }).length;
    return json({ gasto: g, historial: hist, stats: { pagos: hist.length, total, promedio: Math.round(prom), ultimo: hist[0]?.monto ?? null, variacion_pct: hist.length > 1 ? Math.round(((hist[0].monto - prom) / prom) * 100) : null, a_tiempo_pct: hist.length ? Math.round(aTiempo / hist.length * 100) : null } });
  }
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
    const pagadoAt = b.fecha ? new Date(`${String(b.fecha).slice(0, 10)}T18:00:00.000Z`).toISOString() : ahora;
    const { error } = await supabase.from('fin_gastos_pagos').upsert({ gasto_id: b.gasto_id, mes: String(b.mes).slice(0, 7), pagado_at: pagadoAt, monto: b.monto != null && b.monto !== '' ? Number(b.monto) : null, nota: b.nota || null, pagado_por: uid }, { onConflict: 'gasto_id,mes' });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'adeudo_guardar') {
    const a = b.adeudo || {};
    if (!a.nombre || !(Number(a.total) > 0)) return json({ error: 'Falta nombre o total' }, 400);
    const fila: any = { nombre: String(a.nombre).trim(), acreedor: a.acreedor || null, total: Number(a.total), cuota: a.cuota ? Number(a.cuota) : null, dia_pago: a.dia_pago ? Number(a.dia_pago) : null, inicio: a.inicio ? `${String(a.inicio).slice(0, 7)}-01` : `${mesDe()}-01`, fecha_limite: a.fecha_limite || null, notas: a.notas || null, activo: a.activo !== false, updated_at: ahora };
    const q = a.id ? supabase.from('fin_adeudos').update(fila).eq('id', a.id) : supabase.from('fin_adeudos').insert(fila);
    const { error } = await q; return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'adeudo_abonar' && b.adeudo_id && Number(b.monto) > 0) {
    const { error } = await supabase.from('fin_adeudos_abonos').insert({ adeudo_id: b.adeudo_id, mes: String(b.mes || mesDe()).slice(0, 7), fecha: b.fecha ? String(b.fecha).slice(0, 10) : new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10), monto: Number(b.monto), nota: b.nota || null, pagado_por: uid });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'abono_borrar' && b.id) { await supabase.from('fin_adeudos_abonos').delete().eq('id', b.id); return json({ ok: true }); }
  if (b.accion === 'adeudo_borrar' && b.id) { await supabase.from('fin_adeudos').update({ activo: false, updated_at: ahora }).eq('id', b.id); return json({ ok: true }); }
  // COMPROBANTES (punto 12): factura o recibo por pago/abono. Bucket privado; se lee con URL firmada de 1 h.
  if (b.accion === 'comprobante_firmar') {
    const mime = String(b.mime || ''); const bytes = Number(b.bytes || 0);
    if (!/^(application\/pdf|image\/(jpeg|png|webp|heic)|application\/xml|text\/xml)$/.test(mime)) return json({ error: 'Solo PDF, XML o imagen' }, 400);
    if (bytes > 15 * 1024 * 1024) return json({ error: 'Máximo 15 MB' }, 400);
    const ext = String(b.nombre || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${mesDe()}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await supabase.storage.createBucket('comprobantes', { public: false }).catch(() => {});
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUploadUrl(path);
    if (error || !data) return json({ error: error?.message || 'No se pudo firmar' }, 500);
    return json({ ok: true, signedUrl: data.signedUrl, path });
  }
  if (b.accion === 'comprobante_guardar' && b.path) {
    const fila = { comprobante_path: String(b.path), comprobante_nombre: String(b.nombre || '').slice(0, 160) };
    if (b.tipo === 'abono' && b.abono_id) { const { error } = await supabase.from('fin_adeudos_abonos').update(fila).eq('id', b.abono_id); return error ? json({ error: error.message }, 500) : json({ ok: true }); }
    if (b.tipo === 'pago' && b.gasto_id && b.mes) {
      // Si el pago aún no está marcado, adjuntar el comprobante lo marca (la factura es la prueba del pago).
      const mesK = String(b.mes).slice(0, 7);
      const { data: ex } = await supabase.from('fin_gastos_pagos').select('gasto_id').eq('gasto_id', b.gasto_id).eq('mes', mesK).maybeSingle();
      const { error } = ex ? await supabase.from('fin_gastos_pagos').update(fila).eq('gasto_id', b.gasto_id).eq('mes', mesK) : await supabase.from('fin_gastos_pagos').insert({ gasto_id: b.gasto_id, mes: mesK, pagado_at: ahora, pagado_por: uid, ...fila });
      return error ? json({ error: error.message }, 500) : json({ ok: true, marcado: !ex });
    }
    return json({ error: 'Faltan datos del comprobante' }, 400);
  }
  if (b.accion === 'comprobante_ver' && b.path) {
    const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(String(b.path), 3600);
    return error || !data ? json({ error: error?.message || 'No disponible' }, 404) : json({ ok: true, url: data.signedUrl });
  }
  if (b.accion === 'deal_editar' && b.id) return json(await editarOportunidad(String(b.id), b.cambios || {}, uid));
  if (b.accion === 'cerrar_mes' && b.mes) return json(await cerrarMes(String(b.mes).slice(0, 7), uid, b.notas));
  if (b.accion === 'reabrir_mes' && b.mes) { await supabase.from('fin_cierres').delete().eq('mes', String(b.mes).slice(0, 7)); return json({ ok: true }); }
  return json({ error: 'Acción desconocida' }, 400);
};
