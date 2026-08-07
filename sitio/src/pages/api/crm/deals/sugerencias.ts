// GET  /api/crm/deals/sugerencias        → la bandeja de sugerencias
// POST /api/crm/deals/sugerencias { generar: true, dias? }  → las recalcula
// POST { id, aceptar: true }             → se vuelve oportunidad de verdad
// POST { id, descartar: true, motivo? }  → desaparece de la bandeja
//
// ═══ Por qué existen aparte ═══
//
// Dos cosas que el sistema ya sabe y nadie estaba trabajando:
//   · las RENOVACIONES que vienen — ARR que ya es tuyo y que se pierde por no
//     tocarlo a tiempo; es la venta más barata que hay;
//   · las SEÑALES DE USO (expansion_signals) — la cuenta que abrió sucursales o
//     que está topando su plan.
//
// Pero generarlas directo al pipeline sería peor que no tenerlas: el pronóstico
// se llenaría de dinero que nadie ha ido a buscar, y un pronóstico inflado no se
// vuelve a creer. Por eso nacen como SUGERENCIA: no cuentan en ningún KPI hasta
// que alguien las acepta, y descartarlas las quita de la vista.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const mesDe = (f: string | null) => String(f || '').slice(0, 7);

/** Etapa inicial del pipeline de oportunidades (la primera abierta). */
async function primeraEtapa(): Promise<string> {
  const { data } = await supabase.from('pipelines').select('stages').eq('tipo', 'oportunidad').maybeSingle();
  const st = (data?.stages || []).find((s: any) => !/ganad|perdid/i.test(s.key));
  return st?.key || 'calificacion';
}

/**
 * Renovaciones que vienen: una suscripción ANUAL viva que vence dentro de la
 * ventana. Las mensuales no generan sugerencia — renovar cada mes no es una
 * venta, es cobranza, y llenaría la bandeja de ruido todos los días.
 */
async function generarRenovaciones(dias: number, stage: string) {
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: subs } = await supabase.from('subscriptions')
    .select('id, company_id, contact_id, nombre_plan, ciclo, precio, mrr, proxima_factura, estado, companies(nombre)')
    .eq('ciclo', 'anual').in('estado', ['activa', 'pendiente_pago'])
    .gte('proxima_factura', hoy).lte('proxima_factura', limite)
    .limit(300);

  let creadas = 0;
  for (const s of subs || []) {
    if (!s.company_id) continue;
    const periodo = mesDe(s.proxima_factura);
    const emp: any = Array.isArray(s.companies) ? s.companies[0] : s.companies;
    const precio = Number(s.precio || 0);
    const fila: any = {
      nombre: `Renovación ${s.nombre_plan} · ${emp?.nombre || 'cliente'}`,
      company_id: s.company_id, contact_id: s.contact_id || null,
      stage, probabilidad: 60,
      categoria: 'renovacion', origen: 'auto_renovacion', es_sugerencia: true,
      renueva_subscription_id: s.id, renueva_periodo: periodo,
      fecha_cierre_esperada: s.proxima_factura,
      sugerencia_motivo: `Vence el ${s.proxima_factura} y son ${money(precio)} al año que ya son tuyos. Renovar cuesta mucho menos que vender de nuevo.`,
      items: [{ tipo: 'plan', nombre: s.nombre_plan, cantidad: 1, precio_unitario: precio, ciclo: 'anual', descuento_pct: 0 }],
      mrr: Number(s.mrr || precio / 12), valor_mensual: Number(s.mrr || precio / 12),
      valor_unico: 0, valor_total: precio, tipo_ingreso: 'recurrente', billing_period: 'anual',
    };
    // El índice único (suscripción, periodo) es el que evita repetirla: si ya
    // está, el insert choca y se ignora.
    const { error } = await supabase.from('deals').insert(fila);
    if (!error) creadas++;
    else if (!/duplicate key|23505/i.test(error.message || '')) console.warn('[sugerencias] renovación:', error.message);
  }
  return creadas;
}

/**
 * Señales de uso abiertas con valor: la cuenta ya dijo que necesita más. El CRM
 * las detecta desde hace tiempo y morían en una bandeja aparte.
 */
async function generarDeSenales(stage: string) {
  const { data: senales } = await supabase.from('expansion_signals')
    .select('id, company_id, signal_type, titulo, detalle, accion, opportunity_value, estado, companies(nombre)')
    .in('estado', ['nueva', 'contactado'])
    .gt('opportunity_value', 0)
    .limit(120);

  let creadas = 0;
  for (const sg of senales || []) {
    if (!sg.company_id) continue;
    // Si ya hay una oportunidad viva de esa señal (o de ese cliente sin cerrar
    // creada por el sistema), no se propone otra.
    const { data: ya } = await supabase.from('deals')
      .select('id').eq('company_id', sg.company_id).eq('origen', 'auto_senal')
      .is('descartada_at', null).limit(1).maybeSingle();
    if (ya) continue;

    const emp: any = Array.isArray(sg.companies) ? sg.companies[0] : sg.companies;
    const anual = Number(sg.opportunity_value || 0);
    const mrr = Math.round((anual / 12) * 100) / 100;
    const { data: ct } = await supabase.from('contacts').select('id').eq('company_id', sg.company_id).limit(1).maybeSingle();
    const { error } = await supabase.from('deals').insert({
      nombre: `Upsell · ${emp?.nombre || 'cliente'} — ${String(sg.titulo || sg.signal_type).slice(0, 80)}`,
      company_id: sg.company_id, contact_id: ct?.id || null,
      stage, probabilidad: 30,
      categoria: 'upsell', origen: 'auto_senal', es_sugerencia: true,
      sugerencia_motivo: [sg.detalle, sg.accion].filter(Boolean).join(' · ').slice(0, 500),
      items: [{ tipo: 'personalizado', nombre: String(sg.titulo || 'Expansión').slice(0, 120), cantidad: 1, precio_unitario: mrr, ciclo: 'mensual', descuento_pct: 0 }],
      mrr, valor_mensual: mrr, valor_unico: 0, valor_total: Math.round(mrr * 12),
      tipo_ingreso: 'recurrente', billing_period: 'mensual',
      descripcion: `Generada desde la señal "${String(sg.titulo || sg.signal_type).slice(0, 100)}"`,
    } as any);
    if (!error) creadas++;
    else if (!/duplicate key|23505/i.test(error.message || '')) console.warn('[sugerencias] señal:', error.message);
  }
  return creadas;
}

/**
 * Retención: clientes que se están yendo. Hoy el churn solo se registra cuando
 * YA pasó, y eso no se pelea. Una oportunidad de retención vale el MRR en
 * riesgo — no es venta nueva y por eso va con su propia categoría: mezclarla
 * con el pipeline de venta inflaría el pronóstico con dinero que, en el mejor
 * de los casos, solo se conserva.
 *
 * Dos señales duras, no corazonadas: cobro rechazado reciente sin resolver, o
 * la cuenta lleva más de 30 días sin vender (es un punto de venta: si no vende,
 * no lo está usando).
 */
async function generarRetencion(stage: string) {
  const hace45 = new Date(Date.now() - 45 * 86400000).toISOString();
  const [{ data: rebotes }, { data: subs }] = await Promise.all([
    supabase.from('crm_cobros_mp').select('company_id, subscription_id, monto, motivo')
      .in('estado', ['rejected', 'cancelled']).gte('fecha', hace45).not('company_id', 'is', null).limit(100),
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, precio, mrr, estado, companies(nombre, dias_sin_venta)')
      .in('estado', ['activa', 'pendiente_pago']).limit(500),
  ]);

  const porRebote = new Map((rebotes || []).map((r: any) => [r.company_id, r]));
  let creadas = 0;
  for (const s of subs || []) {
    if (!s.company_id) continue;
    const emp: any = Array.isArray(s.companies) ? s.companies[0] : s.companies;
    const rebote = porRebote.get(s.company_id);
    const sinVender = Number(emp?.dias_sin_venta || 0);
    const motivo = rebote
      ? `Se le rechazó un cobro de ${money(Number(rebote.monto || 0))} (${rebote.motivo || 'tarjeta rechazada'}) y sigue sin resolverse.`
      : sinVender >= 30
        ? `Lleva ${sinVender} días sin vender en SACS. Un punto de venta que no vende es un cliente que ya se fue, aunque siga pagando.`
        : null;
    if (!motivo) continue;

    const { data: ya } = await supabase.from('deals').select('id')
      .eq('company_id', s.company_id).eq('categoria', 'retencion')
      .is('descartada_at', null).is('closed_at', null).limit(1).maybeSingle();
    if (ya) continue;

    const mrr = Number(s.mrr || 0);
    const { error } = await supabase.from('deals').insert({
      nombre: `Retener · ${emp?.nombre || 'cliente'}`,
      company_id: s.company_id, stage, probabilidad: 50,
      categoria: 'retencion', origen: rebote ? 'auto_cobro_rechazado' : 'auto_sin_uso', es_sugerencia: true,
      sugerencia_motivo: motivo + ` En riesgo: ${money(mrr * 12)} de ARR.`,
      mrr, valor_mensual: mrr, valor_unico: 0, valor_total: Math.round(mrr * 12),
      tipo_ingreso: 'recurrente', billing_period: 'mensual',
      // Periodo por MES: si se descarta y el cliente vuelve a estar en riesgo
      // el mes que viene, se puede volver a proponer. Con una clave fija, un
      // descarte la enterraba para siempre.
      renueva_subscription_id: s.id, renueva_periodo: 'retencion-' + new Date().toISOString().slice(0, 7),
    } as any);
    if (!error) creadas++;
  }
  return creadas;
}

export const GET: APIRoute = async ({ url }) => {
  const { data, error } = await supabase.from('deals')
    .select('*, companies(id, nombre, sacs_account), contacts(id, nombre, email, whatsapp)')
    .eq('es_sugerencia', true).is('descartada_at', null)
    .order('fecha_cierre_esperada', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) return json({ data: [], error: error.message });

  const filas = data || [];
  return json({
    data: filas,
    resumen: {
      total: filas.length,
      renovaciones: filas.filter((d: any) => d.categoria === 'renovacion').length,
      upsells: filas.filter((d: any) => d.categoria === 'upsell').length,
      retencion: filas.filter((d: any) => d.categoria === 'retencion').length,
      // El MRR en riesgo se reporta APARTE del potencial: retener no es crecer.
      mrr_en_riesgo: Math.round(filas.filter((d: any) => d.categoria === 'retencion').reduce((a: number, d: any) => a + Number(d.mrr || 0), 0)),
      // Se reporta aparte, y se dice que NO cuenta: si este número se mezclara
      // con el pipeline, el pronóstico contaría dinero que nadie fue a buscar.
      valor_sugerido: Math.round(filas.reduce((a: number, d: any) => a + Number(d.valor_total || 0), 0)),
      mrr_sugerido: Math.round(filas.reduce((a: number, d: any) => a + Number(d.mrr || 0), 0)),
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));

  if (b?.generar) {
    const stage = await primeraEtapa();
    const dias = Math.min(365, Number(b.dias) || 60);
    const [renov, senales, retencion] = await Promise.all([
      generarRenovaciones(dias, stage), generarDeSenales(stage), generarRetencion(stage),
    ]);
    return json({ ok: true, renovaciones: renov, upsells: senales, retencion, dias });
  }

  if (!b?.id) return json({ error: 'id requerido' }, 400);
  const { data: d } = await supabase.from('deals').select('id, nombre, company_id, contact_id, es_sugerencia').eq('id', b.id).maybeSingle();
  if (!d) return json({ error: 'No encontré esa sugerencia.' }, 404);
  if (!d.es_sugerencia) return json({ error: 'Esa oportunidad ya está aceptada.' }, 409);

  if (b.descartar) {
    // No se borra: se archiva con el motivo. Es lo único que después permite
    // saber qué señal vale y cuál es ruido — borrarla tira esa información.
    await supabase.from('deals').update({
      descartada_at: new Date().toISOString(), descarte_motivo: b.motivo || null,
    }).eq('id', b.id);
    await supabase.from('activities').insert({
      tipo: 'sistema', automatico: true, company_id: d.company_id, deal_id: d.id,
      titulo: `Sugerencia descartada: ${d.nombre}`, descripcion: b.motivo || null,
      metadata: { audit: 'sugerencia_descartada' },
    }).select().maybeSingle();
    return json({ ok: true, descartada: true });
  }

  if (b.aceptar) {
    await supabase.from('deals').update({ es_sugerencia: false, aceptada_at: new Date().toISOString() }).eq('id', b.id);
    await supabase.from('activities').insert({
      tipo: 'sistema', automatico: true, company_id: d.company_id, deal_id: d.id,
      titulo: `Sugerencia aceptada: ${d.nombre}`,
      descripcion: 'A partir de aquí cuenta en el pipeline y en el pronóstico.',
      metadata: { audit: 'sugerencia_aceptada' },
    }).select().maybeSingle();
    return json({ ok: true, aceptada: true });
  }

  return json({ error: 'Falta la acción: aceptar, descartar o generar.' }, 400);
};
