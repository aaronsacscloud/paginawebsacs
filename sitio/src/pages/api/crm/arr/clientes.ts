// GET /api/crm/arr/clientes — la lista REAL de clientes: companies con sus
// suscripciones agregadas, plan del catálogo, contacto, actividad SACS y salud.
// Reemplaza a la tabla legacy `clients` (que tenía datos de demo).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { computarSenales } from '../../../../lib/crm/senales';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  const mkSel = (contactsSel: string) => 'id, nombre, sacs_account, plan, tipo_cuenta, estado_cuenta, sucursales, mrr, arr, fecha_renovacion, health_score, ultima_venta_at, dias_sin_venta, actividad, uso_sacs, ' + contactsSel + ', subscriptions(id, estado, ciclo, arr, nombre_plan, proxima_factura, pagos_realizados, total_pagado, contact_id)';
  const CONTACTS_NEW = 'contacts(id, nombre, email, whatsapp, telefono, rol, es_principal)';
  const CONTACTS_OLD = 'contacts(id, nombre, email, whatsapp, telefono)';
  // pipeline_stage y rol/es_principal pueden no existir aún (SQL pendiente) →
  // cadena de reintentos quitando primero los campos nuevos que fallen.
  const intentos = [
    'pipeline_stage, ' + mkSel(CONTACTS_NEW),
    'pipeline_stage, ' + mkSel(CONTACTS_OLD),
    mkSel(CONTACTS_NEW),
    mkSel(CONTACTS_OLD),
  ];
  let res: any = null;
  for (const sel of intentos) {
    res = await supabase.from('companies').select(sel).is('archived_at', null);
    if (!res.error || !/pipeline_stage|rol|es_principal|column|schema cache/i.test(res.error.message || '')) break;
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
      // Principal si existe la marca; si no, el primero (comportamiento previo).
      const contacto = (c.contacts || []).find((x: any) => x.es_principal) || (c.contacts || [])[0] || null;
      // Si la empresa no tiene contacto ligado pero una suscripción SÍ referencia
      // un contact_id, lo señalamos (relación que vive en subscriptions, no en la
      // empresa) para poder repararla.
      const subContactId = subs.map((s: any) => s.contact_id).filter(Boolean)[0] || null;
      // Señal de venta/riesgo (misma lógica que Oportunidades) para la columna/filtro.
      const senales = computarSenales(c, activas[0]);
      const top = senales[0] || null;
      return {
        id: c.id, nombre: c.nombre, sacs_account: c.sacs_account,
        plan: c.plan, tipo_cuenta: c.tipo_cuenta, estado_cuenta: c.estado_cuenta,
        pipeline_stage: c.pipeline_stage ?? null,
        sucursales: c.sucursales,
        contacto: contacto ? { id: contacto.id, nombre: contacto.nombre, email: contacto.email, whatsapp: contacto.whatsapp, telefono: contacto.telefono } : null,
        sub_contact_id: subContactId,
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
        // Señal principal + conteos (para columna/filtro/orden en la tabla).
        senal_nivel: top?.nivel ?? null,
        senal_tipo: top?.tipo ?? null,
        senal_titulo: top?.titulo ?? null,
        senal_accion: top?.accion ?? null,
        senal_peso: top?.peso ?? 0,
        n_oportunidades: senales.filter((s) => s.nivel === 'oportunidad').length,
        n_riesgos: senales.filter((s) => s.nivel === 'riesgo').length,
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
