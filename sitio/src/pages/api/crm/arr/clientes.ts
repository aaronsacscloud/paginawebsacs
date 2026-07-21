// GET /api/crm/arr/clientes — la lista REAL de clientes: companies con sus
// suscripciones agregadas, plan del catálogo, contacto, actividad SACS y salud.
// Reemplaza a la tabla legacy `clients` (que tenía datos de demo).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  const baseSel = 'id, nombre, sacs_account, plan, tipo_cuenta, estado_cuenta, sucursales, mrr, arr, fecha_renovacion, health_score, ultima_venta_at, dias_sin_venta, actividad, contacts(id, nombre, email, whatsapp), subscriptions(id, estado, ciclo, arr, nombre_plan, proxima_factura, pagos_realizados, total_pagado)';
  // pipeline_stage puede no existir aún (SQL pendiente) → reintentar sin él.
  let res = await supabase.from('companies').select('pipeline_stage, ' + baseSel).is('archived_at', null);
  if (res.error && /pipeline_stage|column|schema cache/i.test(res.error.message || '')) {
    res = await supabase.from('companies').select(baseSel).is('archived_at', null);
  }
  const { data: companies, error } = res;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const data = (companies || [])
    // cliente real = tiene al menos una suscripción registrada
    .filter((c: any) => (c.subscriptions || []).length > 0)
    .map((c: any) => {
      const subs = c.subscriptions || [];
      const activas = subs.filter((s: any) => s.estado === 'activa');
      const pend = subs.filter((s: any) => s.estado === 'pendiente_pago' || s.estado === 'programada');
      const contacto = (c.contacts || [])[0] || null;
      return {
        id: c.id, nombre: c.nombre, sacs_account: c.sacs_account,
        plan: c.plan, tipo_cuenta: c.tipo_cuenta, estado_cuenta: c.estado_cuenta,
        pipeline_stage: c.pipeline_stage ?? null,
        sucursales: c.sucursales,
        contacto: contacto ? { nombre: contacto.nombre, email: contacto.email, whatsapp: contacto.whatsapp } : null,
        subs_total: subs.length, subs_activas: activas.length, subs_pendientes: pend.length,
        mrr: r2(activas.reduce((a: number, s: any) => a + Number(s.arr || 0) / 12, 0)),
        arr: r2(activas.reduce((a: number, s: any) => a + Number(s.arr || 0), 0)),
        arr_pendiente: r2(pend.reduce((a: number, s: any) => a + Number(s.arr || 0), 0)),
        pagos_realizados: subs.reduce((a: number, s: any) => a + Number(s.pagos_realizados || 0), 0),
        total_pagado: r2(subs.reduce((a: number, s: any) => a + Number(s.total_pagado || 0), 0)),
        proxima_factura: activas.map((s: any) => s.proxima_factura).filter(Boolean).sort()[0]
          || pend.map((s: any) => s.proxima_factura).filter(Boolean).sort()[0] || null,
        health_score: c.health_score,
        ultima_venta_at: c.ultima_venta_at, dias_sin_venta: c.dias_sin_venta,
        ventas_30d: c.actividad?.ventas_30d ?? null,
      };
    })
    .sort((a: any, b: any) => (b.arr - a.arr) || (b.arr_pendiente - a.arr_pendiente));

  const tot = {
    clientes: data.length,
    activos: data.filter((c: any) => c.subs_activas > 0).length,
    arr: r2(data.reduce((a: number, c: any) => a + c.arr, 0)),
  };
  return new Response(JSON.stringify({ tot, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
