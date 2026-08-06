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

  // De dónde salen los cobros de una suscripción, en orden de preferencia:
  //   1 · authorized_payments — lo correcto, cuando responde.
  //   2 · el buscador de pagos filtrando por `metadata.preapproval_id`. Suena a
  //       rodeo pero es lo que funciona: en esta cuenta authorized_payments
  //       devuelve vacío para suscripciones que sí tienen cobros, y el único
  //       dato que amarra el pago con su suscripción es ese campo de metadata.
  let cobros: any[] = [];
  try {
    for (let offset = 0; offset < 500; offset += 50) {
      const r = await mpFetch(`/authorized_payments/search?preapproval_id=${sub.mp_preapproval_id}&limit=50&offset=${offset}`, {}, cx);
      const rs = r.results || r.elements || [];
      cobros = cobros.concat(rs);
      if (rs.length < 50) break;
    }
  } catch { /* se intenta por el otro camino */ }

  if (!cobros.length) {
    const meses = Math.min(36, Number(b?.meses) || 24);
    const desde = new Date(Date.now() - meses * 30 * 86400000).toISOString();
    try {
      const todos: any[] = [];
      for (let offset = 0; offset < 2000; offset += 50) {
        const r = await mpFetch(`/v1/payments/search?sort=date_created&criteria=desc&limit=50&offset=${offset}`
          + `&range=date_created&begin_date=${encodeURIComponent(desde)}&end_date=NOW`, {}, cx);
        const rs = r.results || [];
        todos.push(...rs);
        if (rs.length < 50 || todos.length >= (r.paging?.total || 0)) break;
      }
      cobros = todos
        .filter(p => String(p?.metadata?.preapproval_id || '') === String(sub.mp_preapproval_id))
        // Se normaliza a la forma de authorized_payments para que abajo haya un
        // solo camino y no dos ramas que se van separando con el tiempo.
        .map(p => ({ payment: p, transaction_amount: p.transaction_amount, date_created: p.date_created }));
    } catch (e: any) { return json({ error: 'No se pudo leer el historial en Mercado Pago: ' + (e?.message || e) }, 502); }
  }

  // Lo que ya está registrado, para no duplicar.
  const { data: yaHay } = await supabase.from('payments')
    .select('id, fecha, monto, mp_payment_id').eq('subscription_id', sub.id);
  const registrados = new Set((yaHay || []).filter(p => p.mp_payment_id).map(p => String(p.mp_payment_id)));
  // Los capturados A MANO son el caso peligroso: el mismo cobro ya está en el
  // CRM pero sin `mp_payment_id`, así que la comparación por id no lo ve y se
  // importaría otra vez. El resultado sería un cliente con el doble de pagos y
  // un total_pagado inflado — y eso se descubre cuadrando, meses después.
  // Cuando coinciden monto y fecha (±4 días, porque la captura manual casi
  // nunca es el mismo día), se ADOPTA el existente en vez de insertar otro.
  const manuales = (yaHay || []).filter(p => !p.mp_payment_id)
    .map(p => ({ id: p.id, fecha: String(p.fecha), monto: Number(p.monto) }));
  const adoptar = (fecha: string, monto: number) => {
    const i = manuales.findIndex(p => Math.abs(p.monto - monto) < 0.5
      && Math.abs((Date.parse(p.fecha) - Date.parse(fecha)) / 86400000) <= 4);
    return i >= 0 ? manuales.splice(i, 1)[0] : null;   // splice: uno no adopta dos
  };

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
    const ya = adoptar(fecha, r2(monto));
    nuevos.push({ mp_payment_id: pid, fecha, monto: r2(monto), adopta: ya?.id || null, adopta_fecha: ya?.fecha || null });
  }
  // Del más viejo al más nuevo: así el historial se lee en orden y el último
  // pago queda siendo el último de verdad.
  nuevos.sort((a, b2) => a.fecha.localeCompare(b2.fecha));

  const aInsertar = nuevos.filter(n => !n.adopta);
  const aAdoptar = nuevos.filter(n => n.adopta);

  if (!aplicar) {
    return json({
      ok: true, simulacion: true,
      cobros_en_mp: cobros.length, ya_registrados: registrados.size,
      por_importar: aInsertar.length,
      por_emparejar: aAdoptar.length,   // ya estaban capturados a mano
      monto_total: r2(aInsertar.reduce((a, n) => a + n.monto, 0)),
      desde: nuevos[0]?.fecha || null, hasta: nuevos[nuevos.length - 1]?.fecha || null,
      data: nuevos,
    });
  }
  if (!nuevos.length) return json({ ok: true, importados: 0, mensaje: 'No hay cobros nuevos que importar.' });

  // Los capturados a mano solo se marcan con su cobro de MP: ni se duplican ni
  // se vuelven a sumar a los contadores.
  for (const n of aAdoptar) {
    await supabase.from('payments').update({
      mp_payment_id: n.mp_payment_id, pasarela: 'mercadopago',
    }).eq('id', n.adopta);
  }

  const filas = aInsertar.map(n => ({
    fecha: n.fecha, monto: n.monto, metodo: 'mercadopago',
    referencia: n.mp_payment_id, mp_payment_id: n.mp_payment_id, pasarela: 'mercadopago',
    numero_acuse: genAcuse(n.fecha),
    company_id: sub.company_id, contact_id: sub.contact_id, subscription_id: sub.id,
    periodo_cubierto: sub.ciclo === 'anual' ? n.fecha.slice(0, 4) : n.fecha.slice(0, 7),
    notas: 'Importado del historial de Mercado Pago (ya se cobraba antes de vincularlo).',
    migrado: true,   // no lo generó el CRM: vino de fuera
  }));
  // Puede no quedar nada por insertar si TODO estaba capturado a mano: en ese
  // caso el trabajo ya se hizo arriba (emparejar) y aquí no hay más que hacer.
  if (!filas.length) {
    return json({ ok: true, importados: 0, emparejados: aAdoptar.length, mensaje: 'Los cobros ya estaban capturados; quedaron emparejados con Mercado Pago.' });
  }

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
    emparejados: aAdoptar.length,
    monto_total: r2(filas.reduce((a, f) => a + f.monto, 0)),
    desde: filas[0].fecha, hasta: filas[filas.length - 1].fecha,
  });
};
