// GET /api/crm/arr/clientes — la lista REAL de clientes: companies con sus
// suscripciones agregadas, plan del catálogo, contacto, actividad SACS y salud.
// Reemplaza a la tabla legacy `clients` (que tenía datos de demo).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { computarSenales } from '../../../../lib/crm/senales';
import { cargarCatalogo } from '../../../../lib/crm/plan-modulos-db';
import { fotosPorEmpresa } from '../../../../lib/crm/snapshots';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  // `propiedades` (campos personalizados) viaja con cada cliente: es lo que
  // permite que la lista los ofrezca como columnas filtrables sin una consulta
  // por campo. Va en la cadena de reintentos por si el SQL aún no corrió.
  const mkSel = (contactsSel: string) => 'id, nombre, sacs_account, plan, tipo_cuenta, estado_cuenta, sucursales, mrr, arr, fecha_renovacion, health_score, ultima_venta_at, dias_sin_venta, actividad, uso_sacs, propiedades, ' + contactsSel + ', subscriptions(id, estado, ciclo, arr, precio, nombre_plan, proxima_factura, pagos_realizados, total_pagado, contact_id, mp_preapproval_id, mp_payer_email, mp_desfase_at, mp_monto_cobrado)';
  const CONTACTS_NEW = 'contacts(id, nombre, email, whatsapp, telefono, rol, es_principal)';
  const CONTACTS_OLD = 'contacts(id, nombre, email, whatsapp, telefono)';
  // pipeline_stage y rol/es_principal pueden no existir aún (SQL pendiente) →
  // cadena de reintentos quitando primero los campos nuevos que fallen.
  const intentos = [
    'pipeline_stage, ' + mkSel(CONTACTS_NEW),
    'pipeline_stage, ' + mkSel(CONTACTS_OLD),
    mkSel(CONTACTS_NEW),
    mkSel(CONTACTS_OLD),
    ('pipeline_stage, ' + mkSel(CONTACTS_NEW)).replace('propiedades, ', ''),
  ];
  let res: any = null;
  for (const sel of intentos) {
    res = await supabase.from('companies').select(sel).is('archived_at', null);
    if (!res.error || !/pipeline_stage|rol|es_principal|propiedades|column|schema cache/i.test(res.error.message || '')) break;
  }
  const { data: companies, error } = res;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Cuentas SACS por empresa: un cliente puede operar varias (boomfitness+urban
  // del mismo dueño) y en la lista hay que verlas TODAS, si no el renglón no se
  // entiende. Tolerante a que la migración no haya corrido → cae a la principal.
  const cuentasPorEmpresa: Record<string, string[]> = {};
  try {
    const { data: cs } = await supabase.from('company_sacs_accounts')
      .select('company_id, cuenta, es_principal')
      .order('es_principal', { ascending: false }).range(0, 9999);
    for (const r of cs || []) {
      const k = String(r.company_id);
      (cuentasPorEmpresa[k] = cuentasPorEmpresa[k] || []).push(String(r.cuenta));
    }
  } catch { /* tabla ausente → fallback abajo */ }

  // Cobros rebotados por cliente. Va en la LISTA y no solo en el detalle porque
  // es lo que cambia a quién llamas hoy: un cliente al que se le rebotó la
  // tarjeta se ve igual de sano que cualquier otro hasta que abres su ficha.
  const rechazosPorEmpresa: Record<string, { n: number; monto: number; ultimo: string | null }> = {};
  try {
    const desde = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: rs } = await supabase.from('crm_cobros_mp')
      .select('company_id, monto, fecha').eq('estado', 'rejected').gte('fecha', desde).range(0, 999);
    for (const r of rs || []) {
      if (!r.company_id) continue;
      const k = String(r.company_id);
      const a = rechazosPorEmpresa[k] || { n: 0, monto: 0, ultimo: null };
      a.n++; a.monto += Number(r.monto || 0);
      if (!a.ultimo || String(r.fecha) > a.ultimo) a.ultimo = String(r.fecha);
      rechazosPorEmpresa[k] = a;
    }
  } catch { /* la bitácora puede no existir en un entorno sin migrar */ }

  // Catálogo plan→módulos: se carga UNA vez para las ~220 empresas (cacheado 5
  // min en el módulo), no una por cliente.
  const catalogo = await cargarCatalogo();
  // Fotos de uso para las señales de MOMENTO (una query para todas).
  const fotos = await fotosPorEmpresa();

  const data = (companies || [])
    // cliente real = tiene al menos una suscripción registrada
    .filter((c: any) => (c.subscriptions || []).length > 0)
    .map((c: any) => {
      const subs = c.subscriptions || [];
      // Licencia VITALICIA: ciclo 'vitalicia' o plan "Licencia Vitalicia…".
      // Es pago ÚNICO de por vida → NO es ingreso recurrente, se EXCLUYE del ARR
      // (venía inflando el "pendiente" con ARR=precio×12 en estado programada).
      const esVital = (s: any) => s.ciclo === 'vitalicia' || /vitalic/i.test(String(s.nombre_plan || ''));
      const vitalicia = subs.some(esVital);
      // Recurrentes (sin vitalicias) para el ARR:
      const activas = subs.filter((s: any) => s.estado === 'activa' && !esVital(s));
      const pend = subs.filter((s: any) => (s.estado === 'pendiente_pago' || s.estado === 'programada') && !esVital(s));
      // Pausadas: NO suman ARR (no están en `activas`) pero tampoco son un
      // cliente muerto — la licencia ya está pagada y hay que poder verlas.
      const pausadas = subs.filter((s: any) => s.estado === 'pausada');
      // Principal si existe la marca; si no, el primero (comportamiento previo).
      const contacto = (c.contacts || []).find((x: any) => x.es_principal) || (c.contacts || [])[0] || null;
      // Si la empresa no tiene contacto ligado pero una suscripción SÍ referencia
      // un contact_id, lo señalamos (relación que vive en subscriptions, no en la
      // empresa) para poder repararla.
      const subContactId = subs.map((s: any) => s.contact_id).filter(Boolean)[0] || null;
      // Señal de venta/riesgo (misma lógica que Oportunidades) para la columna/filtro.
      const senales = computarSenales(c, activas[0], { catalogo, subsActivas: subs.filter((s: any) => s.estado === 'activa'), snapHoy: fotos[c.id]?.hoy, snapAntes: fotos[c.id]?.antes });
      const top = senales[0] || null;
      return {
        id: c.id, nombre: c.nombre, sacs_account: c.sacs_account,
        cuentas: cuentasPorEmpresa[c.id]?.length ? cuentasPorEmpresa[c.id] : (c.sacs_account ? [String(c.sacs_account)] : []),
        plan: c.plan, tipo_cuenta: c.tipo_cuenta, estado_cuenta: c.estado_cuenta,
        pipeline_stage: c.pipeline_stage ?? null,
        sucursales: c.sucursales,
        contacto: contacto ? { id: contacto.id, nombre: contacto.nombre, email: contacto.email, whatsapp: contacto.whatsapp, telefono: contacto.telefono } : null,
        sub_contact_id: subContactId,
        // Cómo se le cobra a este cliente, resumido para la lista.
        mp: (() => {
          const vivas = subs.filter((s: any) => s.estado !== 'cancelada');
          const auto = vivas.filter((s: any) => s.mp_preapproval_id);
          const rz = rechazosPorEmpresa[c.id] || null;
          return {
            domiciliadas: auto.length,
            manuales: vivas.length - auto.length,
            correo: auto.find((s: any) => s.mp_payer_email)?.mp_payer_email || null,
            desfase: auto.some((s: any) => s.mp_desfase_at),
            rechazos: rz?.n || 0, rechazo_monto: r2(rz?.monto || 0), rechazo_ultimo: rz?.ultimo || null,
          };
        })(),
        subs_total: subs.length, subs_activas: activas.length, subs_pendientes: pend.length,
        subs_pausadas: pausadas.length,
        arr_pausado: r2(pausadas.reduce((a: number, s: any) => a + Number(s.arr || 0), 0)),
        vitalicia,
        vitalicia_pagado: r2(subs.filter(esVital).reduce((a: number, s: any) => a + Number(s.total_pagado || 0), 0)),
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
        total_30d: c.actividad?.total_30d ?? null,
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
    // Vitalicias (ingreso ÚNICO, fuera del ARR): clientes y total pagado de por vida.
    vitalicias: data.filter((c: any) => c.vitalicia).length,
    vitalicias_pagado: r2(data.reduce((a: number, c: any) => a + Number(c.vitalicia_pagado || 0), 0)),
  };
  return new Response(JSON.stringify({ tot, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
