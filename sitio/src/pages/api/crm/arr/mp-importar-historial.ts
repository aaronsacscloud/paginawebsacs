// POST /api/crm/arr/mp-importar-historial { subscription_id, aplicar? }
//
// Trae al CRM los cobros que Mercado Pago ya le hizo a esta suscripción antes
// de que existiera el vínculo. Sin esto, una suscripción que lleva once meses
// cobrándose entra al CRM como si hubiera nacido ayer: sin antigüedad, sin LTV
// y con un historial de pagos vacío que hace ver moroso a quien nunca falló.
//
// LO QUE NO HACE: correr el motor de facturación. Registrar once pagos viejos
// por el camino normal recorrería la próxima factura once meses hacia el futuro
// y ese cliente dejaría de cobrarse. La próxima fecha se toma de Mercado Pago,
// que es quien de verdad sabe cuándo toca el siguiente cargo.
import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';
import { recalcCompany } from './subscriptions';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const r2 = (n: number) => Math.round(n * 100) / 100;
const genAcuse = (fecha: string) => 'AC-' + fecha.slice(2).replace(/-/g, '') + '-' + randomBytes(2).toString('hex').toUpperCase();

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.subscription_id) return json({ error: 'subscription_id requerido' }, 400);
  const aplicar = !!b?.aplicar;

  let cx;
  try { cx = await conexionActiva(); } catch (e: any) { return json({ error: e?.message }, 500); }
  if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago primero.' }, 400);

  const { data: sub } = await supabase.from('subscriptions')
    .select('id, company_id, contact_id, nombre_plan, ciclo, precio, proxima_factura, pagos_realizados, total_pagado, mp_preapproval_id')
    .eq('id', b.subscription_id).maybeSingle();
  if (!sub) return json({ error: 'Suscripción no encontrada' }, 404);
  if (!sub.mp_preapproval_id) return json({ error: 'Esa suscripción no está vinculada a Mercado Pago. Vincúlala primero.' }, 400);

  // Los cobros de una suscripción viven en authorized_payments, no en el
  // buscador de pagos: ahí solo se ve el pago suelto, sin saber de qué
  // suscripción salió.
  let cobros: any[] = [];
  try {
    for (let offset = 0; offset < 500; offset += 50) {
      const r = await mpFetch(`/authorized_payments/search?preapproval_id=${sub.mp_preapproval_id}&limit=50&offset=${offset}`, {}, cx);
      const rs = r.results || r.elements || [];
      cobros = cobros.concat(rs);
      if (rs.length < 50) break;
    }
  } catch (e: any) { return json({ error: 'No se pudo leer el historial en Mercado Pago: ' + (e?.message || e) }, 502); }

  // Lo que ya está registrado, para no duplicar.
  const { data: yaHay } = await supabase.from('payments')
    .select('mp_payment_id').eq('subscription_id', sub.id).not('mp_payment_id', 'is', null);
  const registrados = new Set((yaHay || []).map(p => String(p.mp_payment_id)));

  const nuevos: any[] = [];
  for (const c of cobros) {
    const pid = String(c?.payment?.id || c?.payment_id || '');
    const estado = String(c?.payment?.status || c?.status || '');
    // Solo lo cobrado de verdad: un intento rechazado no es un pago, y meterlo
    // al historial haría ver como pagado un mes que nunca entró.
    if (!pid || estado !== 'approved') continue;
    if (registrados.has(pid)) continue;
    const fecha = String(c?.payment?.date_approved || c?.date_created || '').slice(0, 10);
    const monto = Number(c?.transaction_amount ?? c?.payment?.transaction_amount ?? 0);
    if (!fecha || !(monto > 0)) continue;
    nuevos.push({ mp_payment_id: pid, fecha, monto: r2(monto) });
  }
  // Del más viejo al más nuevo: así el historial se lee en orden y el último
  // pago queda siendo el último de verdad.
  nuevos.sort((a, b2) => a.fecha.localeCompare(b2.fecha));

  if (!aplicar) {
    return json({
      ok: true, simulacion: true,
      cobros_en_mp: cobros.length, ya_registrados: registrados.size,
      por_importar: nuevos.length,
      monto_total: r2(nuevos.reduce((a, n) => a + n.monto, 0)),
      desde: nuevos[0]?.fecha || null, hasta: nuevos[nuevos.length - 1]?.fecha || null,
      data: nuevos,
    });
  }
  if (!nuevos.length) return json({ ok: true, importados: 0, mensaje: 'No hay cobros nuevos que importar.' });

  const filas = nuevos.map(n => ({
    fecha: n.fecha, monto: n.monto, metodo: 'mercadopago',
    referencia: n.mp_payment_id, mp_payment_id: n.mp_payment_id, pasarela: 'mercadopago',
    numero_acuse: genAcuse(n.fecha),
    company_id: sub.company_id, contact_id: sub.contact_id, subscription_id: sub.id,
    periodo_cubierto: sub.ciclo === 'anual' ? n.fecha.slice(0, 4) : n.fecha.slice(0, 7),
    notas: 'Importado del historial de Mercado Pago (ya se cobraba antes de vincularlo).',
    migrado: true,   // no lo generó el CRM: vino de fuera
  }));
  const { data: metidos, error } = await supabase.from('payments').insert(filas).select('id');
  if (error) return json({ error: 'No se pudieron importar: ' + error.message }, 500);

  // Contadores al día. La próxima factura NO se toca aquí: la manda Mercado
  // Pago y ya quedó puesta al vincular.
  await supabase.from('subscriptions').update({
    pagos_realizados: Number(sub.pagos_realizados || 0) + filas.length,
    total_pagado: r2(Number(sub.total_pagado || 0) + filas.reduce((a, f) => a + f.monto, 0)),
    updated_at: new Date().toISOString(),
  }).eq('id', sub.id);
  await recalcCompany(sub.company_id);

  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: sub.company_id, automatico: true,
    titulo: `Historial importado de Mercado Pago: ${filas.length} cobros por $${r2(filas.reduce((a, f) => a + f.monto, 0)).toLocaleString('es-MX')}`,
    descripcion: `De ${filas[0].fecha} a ${filas[filas.length - 1].fecha} · ${sub.nombre_plan}`,
    metadata: { audit: 'mp_import_historial', subscription_id: sub.id, cobros: filas.length },
  }).select().maybeSingle();

  return json({
    ok: true, importados: metidos?.length || filas.length,
    monto_total: r2(filas.reduce((a, f) => a + f.monto, 0)),
    desde: filas[0].fecha, hasta: filas[filas.length - 1].fecha,
  });
};
