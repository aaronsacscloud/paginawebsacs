// Cobranza: solo lo que está pendiente de cobro.
//
// GET  → vencidas separadas por ciclo, tramos de atraso, planes de pago y lo
//        recuperado del mes.
// POST → crea un plan de parcialidades para una anualidad.
// PUT  → registra la gestión (contactado, promesa de pago) o cobra una
//        exhibición.
//
// Dos verdades que gobiernan los montos:
//
//  · En una MENSUAL la deuda se acumula. Una cuenta con nueve meses vencidos no
//    debe una mensualidad: debe nueve. Mostrar el precio del plan como si fuera
//    la deuda es cobrar mal y quedarse corto por $8,100.
//  · Cuando hay PLAN DE PAGOS, la deuda es la exhibición vencida, no la
//    anualidad completa. Reclamar el total de algo que ya se acordó partir es
//    la forma más rápida de perder la conversación.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { planDeCotizacion, exhibicionExigible } from '../../../lib/quotes/plan';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hoy = () => new Date().toISOString().slice(0, 10);
const num = (x: any) => Number(x || 0);
const dias = (f: string) => Math.floor((Date.parse(hoy()) - Date.parse(String(f).slice(0, 10))) / 86400000);

export const GET: APIRoute = async () => {
  const mes1 = hoy().slice(0, 8) + '01';
  // Y el corte de arriba: sin él, un pago capturado con fecha del año que viene
  // —pasa— entraba en "cobrado este mes" y el KPI cobraba $5,500 de más. Se
  // topa en el primer día del mes siguiente.
  const [aa, mm] = mes1.split('-').map(Number);
  const mesFin = new Date(Date.UTC(aa, mm, 1)).toISOString().slice(0, 10);
  const [subsQ, compQ, cobrosQ, pagosQ, cotsQ, abonosQ] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, ciclo, precio, monto_proximo, proxima_factura, estado, total_pagado, pagos_realizados, mp_link_pago, cobranza_estado, cobranza_promesa, cobranza_nota, saldo_favor')
      .in('estado', ['activa', 'pendiente_pago']),
    supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account, dias_sin_venta, ultima_venta_at').is('archived_at', null),
    supabase.from('cobros_programados').select('*').neq('estado', 'cancelada').order('numero'),
    // El detalle del mes, no solo la suma: un KPI que nadie puede abrir es un
    // número que hay que creer. Aquí se ve de quién salió cada peso.
    supabase.from('payments').select('id, monto, fecha, metodo, referencia, subscription_id, quote_id, company_id')
      .gte('fecha', mes1).lt('fecha', mesFin).neq('estado', 'reembolsado').order('fecha', { ascending: false }),
    // Cobranza NO es solo suscripciones: una cotización aceptada sin pagar —o
    // pagada a medias— es dinero comprometido que nadie está persiguiendo.
    supabase.from('quotes').select('id, numero, empresa, contacto, email, total, estado, company_id, aceptado_fecha, vigencia, created_at, link_pago, cobranza_estado, cobranza_promesa, cobranza_nota, notas')
      // 'expired' también entra: una cotización que ya recibió un abono no está
      // vencida —la vigencia caduca el precio, no el cobro— y si se queda fuera
      // desaparece de la cobranza justo cuando hay algo que cobrar.
      .in('estado', ['accepted', 'sent', 'expired']).order('created_at', { ascending: false }),
    supabase.from('payments').select('quote_id, monto').not('quote_id', 'is', null).neq('estado', 'reembolsado'),
  ]);

  const empresas = Object.fromEntries((compQ.data || []).map((c: any) => [c.id, c]));
  const cobros = cobrosQ.data || [];
  const porSub: Record<string, any[]> = {};
  // Un plan de pagos cuelga de una suscripción o de una cotización: partir en
  // exhibiciones una venta de una sola vez es igual de común que partir una
  // anualidad, y hasta ahora esas parcialidades no aparecían en ningún lado.
  const porCot: Record<string, any[]> = {};
  cobros.forEach((c: any) => {
    if (c.subscription_id) (porSub[c.subscription_id] = porSub[c.subscription_id] || []).push(c);
    else if (c.quote_id) (porCot[c.quote_id] = porCot[c.quote_id] || []).push(c);
  });

  const filas = (subsQ.data || [])
    .filter((s: any) => s.ciclo !== 'vitalicia' && s.proxima_factura)
    .map((s: any) => {
      const co = empresas[s.company_id] || {};
      const plan = (porSub[s.id] || []).sort((a: any, b: any) => a.numero - b.numero);
      const precio = num(s.monto_proximo ?? s.precio);

      // Con plan, la deuda es la exhibición vencida más vieja; sin plan, el
      // cargo del periodo (y en mensual, todos los periodos acumulados).
      let deuda = 0, vence: string | null = null, detalle = '', exhibicion: any = null;
      if (plan.length) {
        const pend = plan.filter((x: any) => x.estado === 'pendiente');
        const vencida = pend.find((x: any) => String(x.fecha) < hoy());
        exhibicion = vencida || pend[0] || null;
        deuda = exhibicion ? num(exhibicion.monto) : 0;
        vence = exhibicion?.fecha || null;
        detalle = exhibicion ? `exhibición ${exhibicion.numero} de ${exhibicion.total}` : 'plan liquidado';
      } else {
        vence = String(s.proxima_factura).slice(0, 10);
        const d = dias(vence);
        const favor = num(s.saldo_favor);
        if (s.ciclo === 'mensual' && d > 0) {
          // Los periodos se cuentan mes a mes desde la fecha vencida, no con
          // una división entre 30: un mes no dura 30 días y el redondeo cobraba
          // de más en unos casos y de menos en otros.
          let meses = 0; const f = new Date(vence + 'T12:00:00');
          while (f.toISOString().slice(0, 10) <= hoy() && meses < 120) { meses++; f.setMonth(f.getMonth() + 1); }
          deuda = Math.max(0, precio * meses - favor);
          detalle = meses > 1 ? `${meses} meses × ${Math.round(precio).toLocaleString('es-MX')}` : '1 mes';
          if (favor > 0) detalle += ` · menos ${Math.round(favor).toLocaleString('es-MX')} a favor`;
        } else {
          deuda = Math.max(0, precio - favor);
          detalle = favor > 0 ? `menos ${Math.round(favor).toLocaleString('es-MX')} a favor` : '';
        }
      }

      const d = vence ? dias(vence) : 0;
      return {
        id: s.id, company_id: s.company_id,
        cliente: co.nombre_comercial || co.nombre || 'Cuenta', cuenta: co.sacs_account || null,
        plan: s.nombre_plan, ciclo: s.ciclo, vence, dias: d, deuda: Math.round(deuda), detalle,
        precio: Math.round(precio), pagado: Math.round(num(s.total_pagado)), pagos: num(s.pagos_realizados),
        link: s.mp_link_pago || null,
        gestion: s.cobranza_estado || 'sin_contactar', promesa: s.cobranza_promesa, nota: s.cobranza_nota,
        dias_sin_venta: co.dias_sin_venta ?? null,
        // La señal de uso cambia la conversación: si sigue operando hay con qué
        // cobrar; si ya no usa el sistema, esto no es cobranza, es una baja.
        senal: co.dias_sin_venta == null ? null : co.dias_sin_venta <= 2 ? 'vendiendo' : co.dias_sin_venta <= 10 ? 'tibia' : 'sin vender',
        plan_pagos: plan.map((x: any) => ({ id: x.id, numero: x.numero, total: x.total, fecha: x.fecha, monto: Math.round(num(x.monto)), estado: x.estado, link: x.link_pago })),
        exhibicion_id: exhibicion?.id || null,
      };
    });

  const vencidas = filas.filter((f: any) => f.dias > 0 && f.deuda > 0);
  const porVencer = filas.filter((f: any) => f.dias <= 0 && f.dias >= -30 && f.deuda > 0);
  // Los tramos miran todo lo vencido —suscripciones y parcialidades—, que es
  // justo lo que el filtro de la pantalla necesita.
  let tramoBase: any[] = [];
  const tramo = (a: number, b: number) => tramoBase.filter((f: any) => f.dias >= a && f.dias <= b);
  const suma = (a: any[]) => Math.round(a.reduce((x: number, f: any) => x + f.deuda, 0));

  const recuperado = (pagosQ.data || []).reduce((a: number, p: any) => a + num(p.monto), 0);
  const conPlanSubs = filas.filter((f: any) => f.plan_pagos.length);

  // ── Cotizaciones por cobrar ───────────────────────────────────────────────
  // Solo las que ya son un compromiso: aceptada sin pagar, o pagada a medias.
  // Una cotización enviada sin respuesta es pipeline, no cobranza.
  const abonado: Record<string, number> = {};
  (abonosQ.data || []).forEach((p: any) => { abonado[p.quote_id] = (abonado[p.quote_id] || 0) + num(p.monto); });
  const cotizaciones = (cotsQ.data || []).map((q: any) => {
    const pagado = abonado[q.id] || 0;
    let saldo = Math.round(num(q.total) - pagado);
    let desde = String(q.aceptado_fecha || q.vigencia || q.created_at).slice(0, 10);
    const co = empresas[q.company_id] || {};
    // Las fechas pactadas viven en el meta de la cotización; las de
    // cobros_programados son las que se partieron desde aquí. Se leen las dos y
    // manda la que exista: sin esto, las parcialidades acordadas al cotizar no
    // aparecían en ninguna proyección.
    const delMeta = planDeCotizacion(q, pagado, hoy()).map(x => ({
      id: x.id, numero: x.numero, total: x.total, fecha: x.fecha,
      monto: x.monto > 0 ? x.monto : x.monto_original, estado: x.estado, link_pago: null,
    }));
    const plan = ((porCot[q.id] || []).length ? (porCot[q.id] || []) : delMeta)
      .slice().sort((a: any, b: any) => a.numero - b.numero);
    let detallePlan = '';
    let exhibicion: any = null;
    if (plan.length) {
      // Con plan, lo exigible es la exhibición vencida más vieja —no el saldo
      // completo—: reclamar el total de algo que ya se acordó partir es la forma
      // más rápida de perder la conversación.
      const pend = plan.filter((x: any) => x.estado === 'pendiente');
      exhibicion = pend.find((x: any) => String(x.fecha) < hoy()) || pend[0] || null;
      if (exhibicion) {
        saldo = Math.round(num(exhibicion.monto));
        desde = String(exhibicion.fecha).slice(0, 10);
        detallePlan = `exhibición ${exhibicion.numero} de ${exhibicion.total}`;
      } else { saldo = 0; detallePlan = 'plan liquidado'; }
    }
    return {
      id: q.id, tipo: 'cotizacion', company_id: q.company_id || null,
      cliente: co.nombre_comercial || co.nombre || q.empresa || 'Sin cliente ligado',
      cuenta: co.sacs_account || null,
      plan: `${q.numero} · ${q.estado === 'accepted' ? 'aceptada' : q.estado === 'expired' ? 'con abonos' : 'enviada'}`,
      ciclo: 'cotizacion', vence: desde, dias: dias(desde),
      deuda: saldo, precio: Math.round(num(q.total)), pagado: Math.round(pagado),
      detalle: detallePlan || (pagado > 0 ? `abonó ${Math.round(pagado).toLocaleString('es-MX')} de ${Math.round(num(q.total)).toLocaleString('es-MX')}` : ''),
      link: q.link_pago || null,
      gestion: q.cobranza_estado || 'sin_contactar', promesa: q.cobranza_promesa, nota: q.cobranza_nota,
      dias_sin_venta: co.dias_sin_venta ?? null,
      senal: co.dias_sin_venta == null ? null : co.dias_sin_venta <= 2 ? 'vendiendo' : co.dias_sin_venta <= 10 ? 'tibia' : 'sin vender',
      plan_pagos: plan.map((x: any) => ({ id: x.id, numero: x.numero, total: x.total, fecha: x.fecha, monto: Math.round(num(x.monto)), estado: x.estado, link: x.link_pago })),
      exhibicion_id: exhibicion?.id || null,
    };
  }).filter((q: any) => q.deuda > 0 && (q.pagado > 0 || q.plan_pagos.length > 0 || String(q.plan).includes('aceptada')));
  // Nota: una 'expired' sin abonos ni plan no pasa este filtro — sigue siendo
  // una propuesta que nadie contestó, no cobranza.

  // Parcialidades vivas de los dos mundos, en una sola lista: la anualidad
  // partida y la cotización partida se cobran igual —exhibición por exhibición—
  // y separarlas obligaría a mirar en dos lados el mismo trabajo.
  const conPlan = [...conPlanSubs, ...cotizaciones.filter((c: any) => c.plan_pagos.length)];
  // Y las que se están pagando de a poco sin plan: no hay fechas acordadas, así
  // que no son un plan, pero tampoco son una deuda de un solo golpe.
  const sinPlan = cotizaciones.filter((c: any) => !c.plan_pagos.length && c.pagado > 0);

  // ── El detalle del mes ────────────────────────────────────────────────────
  const planPorSub: Record<string, any> = {};
  filas.forEach((f: any) => { planPorSub[f.id] = f; });
  const nombreCot: Record<string, any> = {};
  (cotsQ.data || []).forEach((q: any) => { nombreCot[q.id] = q; });
  const recuperado_detalle = (pagosQ.data || []).map((p: any) => {
    const sub = planPorSub[p.subscription_id];
    const cot = nombreCot[p.quote_id];
    const co = empresas[p.company_id] || (sub ? { nombre: sub.cliente } : {});
    return {
      id: p.id, fecha: String(p.fecha).slice(0, 10), monto: Math.round(num(p.monto)),
      metodo: p.metodo || '—', referencia: p.referencia || null,
      cliente: sub?.cliente || co.nombre_comercial || co.nombre || cot?.empresa || 'Sin cliente',
      company_id: p.company_id || sub?.company_id || null,
      concepto: sub?.plan || (cot ? `Cotización ${cot.numero}` : p.quote_id ? 'Cotización' : 'Pago suelto'),
      tipo: p.subscription_id ? 'suscripcion' : p.quote_id ? 'cotizacion' : 'otro',
    };
  });

  // ── Lo vencido, junto ──
  // Suscripciones y parcialidades de cotización son el mismo dinero atrasado y
  // se cobran el mismo día: separarlas obligaba a sumar de cabeza.
  const vencidoTodo = [...vencidas, ...cotizaciones.filter((c: any) => c.dias > 0)];
  // ── Lo que cae en lo que resta del mes ──
  // Todavía no vence: es la lista de a quién cobrarle ANTES de que se atrase,
  // que es lo más barato que hay en cobranza.
  const venceMesSubs = filas.filter((f: any) => f.dias <= 0 && f.vence && String(f.vence) < mesFin && f.deuda > 0);
  const venceMesCots = cotizaciones.filter((c: any) => c.dias <= 0 && c.vence && String(c.vence) < mesFin);
  const venceMes = [...venceMesSubs, ...venceMesCots].sort((a: any, b: any) => String(a.vence).localeCompare(String(b.vence)));

  tramoBase = vencidoTodo;
  return json({
    kpis: {
      por_cobrar: suma(vencidas), cuentas: vencidas.length,
      vencido: suma(vencidoTodo), vencido_n: vencidoTodo.length,
      vence_mes: suma(venceMes), vence_mes_n: venceMes.length,
      vence_mes_parcialidades: venceMesCots.length,
      atraso_prom: vencidas.length ? Math.round(vencidas.reduce((a: number, f: any) => a + f.dias, 0) / vencidas.length) : 0,
      atraso_max: vencidas.length ? Math.max(...vencidas.map((f: any) => f.dias)) : 0,
      en_parcialidades: Math.round(conPlan.reduce((a: number, f: any) => a + f.plan_pagos.filter((x: any) => x.estado === 'pendiente').reduce((y: number, x: any) => y + x.monto, 0), 0)),
      planes: conPlan.length,
      exhibiciones_pendientes: conPlan.reduce((a: number, f: any) => a + f.plan_pagos.filter((x: any) => x.estado === 'pendiente').length, 0),
      // Cotizaciones que se están pagando de a poco SIN plan formal: son
      // parcialidades de hecho, y solo se ven si se nombran.
      abonos_sueltos: sinPlan.length,
      recuperado: Math.round(recuperado),
      promesas: [...vencidas, ...cotizaciones].filter((f: any) => f.gestion === 'promesa').length,
      promesas_monto: suma([...vencidas, ...cotizaciones].filter((f: any) => f.gestion === 'promesa')),
      cotizaciones: suma(cotizaciones), cotizaciones_n: cotizaciones.length,
      mes: hoy().slice(0, 7),
    },
    // De lo más fresco a lo más viejo: se lee como una línea de tiempo, y lo que
    // duele —el +90— queda al final, que es donde el ojo se detiene.
    tramos: [
      { k: '1 a 7 días', a: 1, b: 7, monto: suma(tramo(1, 7)), n: tramo(1, 7).length },
      { k: '8 a 30 días', a: 8, b: 30, monto: suma(tramo(8, 30)), n: tramo(8, 30).length },
      { k: '31 a 90', a: 31, b: 90, monto: suma(tramo(31, 90)), n: tramo(31, 90).length },
      { k: '+90 días', a: 91, b: 99999, monto: suma(tramo(91, 99999)), n: tramo(91, 99999).length },
    ],
    // La más vieja primero: es la que más cuesta y la que menos se cobra sola.
    anuales: vencidas.filter((f: any) => f.ciclo === 'anual').sort((a: any, b: any) => b.dias - a.dias),
    mensuales: vencidas.filter((f: any) => f.ciclo === 'mensual').sort((a: any, b: any) => b.dias - a.dias),
    por_vencer: porVencer.sort((a: any, b: any) => a.dias - b.dias),
    vencido: vencidoTodo.sort((a: any, b: any) => b.dias - a.dias),
    vence_mes: venceMes,
    con_plan: conPlan,
    abonos_sueltos: sinPlan,
    cotizaciones: cotizaciones.sort((a: any, b: any) => b.dias - a.dias),
    // Las promesas cruzan tipos: es lo que alguien se comprometió a pagar,
    // venga de una suscripción o de una cotización.
    promesas: [...vencidas, ...cotizaciones].filter((f: any) => f.gestion === 'promesa')
      .sort((a: any, b: any) => String(a.promesa || '').localeCompare(String(b.promesa || ''))),
    recuperado_detalle,
  });
};

// ── Crear el plan de parcialidades ──────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const subId = String(b?.subscription_id || '');
  const quoteId = String(b?.quote_id || '');
  const n = Math.max(2, Math.min(24, Number(b?.exhibiciones) || 0));
  const inicio = String(b?.primera || '').slice(0, 10);
  const cada = b?.cada === 'quincena' ? 15 : 30;
  const montos: number[] = Array.isArray(b?.montos) ? b.montos.map(Number) : [];
  if ((!subId && !quoteId) || !n || !inicio) return json({ error: 'Falta la suscripción o cotización, el número de exhibiciones o la primera fecha.' }, 400);

  // El origen puede ser una anualidad o una cotización. Lo único que cambia es
  // de dónde sale el total y a qué columna se cuelga el plan.
  let companyId: string | null = null, totalBase = 0;
  if (quoteId) {
    const { data: q } = await supabase.from('quotes').select('id, company_id, total').eq('id', quoteId).maybeSingle();
    if (!q) return json({ error: 'Esa cotización ya no existe.' }, 404);
    // Lo ya abonado no se vuelve a partir: se parte lo que falta.
    const { data: pagos } = await supabase.from('payments').select('monto').eq('quote_id', quoteId).neq('estado', 'reembolsado');
    const ya = (pagos || []).reduce((a: number, p: any) => a + num(p.monto), 0);
    companyId = q.company_id; totalBase = num(q.total) - ya;
  } else {
    const { data: sub } = await supabase.from('subscriptions').select('id, company_id, monto_proximo, precio, ciclo').eq('id', subId).maybeSingle();
    if (!sub) return json({ error: 'Esa suscripción ya no existe.' }, 404);
    companyId = sub.company_id; totalBase = num(sub.monto_proximo ?? sub.precio);
  }

  const total = num(b?.total) || totalBase;
  // Reparto igual con el sobrante en la PRIMERA: si se deja en la última, el
  // cliente ve un pago distinto justo al final y llama a preguntar por qué.
  const base = Math.floor(total / n);
  const filas = Array.from({ length: n }, (_, i) => {
    const f = new Date(inicio + 'T12:00:00');
    f.setDate(f.getDate() + cada * i);
    return {
      subscription_id: subId || null, quote_id: quoteId || null, company_id: companyId,
      numero: i + 1, total: n, fecha: f.toISOString().slice(0, 10),
      monto: montos[i] != null ? montos[i] : (i === 0 ? total - base * (n - 1) : base),
      estado: 'pendiente',
    };
  });

  // Un plan nuevo reemplaza al anterior: dos planes vivos sobre la misma
  // suscripción harían que la deuda se cuente dos veces.
  const viejo = supabase.from('cobros_programados').delete().eq('estado', 'pendiente');
  await (quoteId ? viejo.eq('quote_id', quoteId) : viejo.eq('subscription_id', subId));
  const { data, error } = await supabase.from('cobros_programados').insert(filas).select();
  if (error) return json({ error: error.message }, 500);
  const marca = { cobranza_estado: 'plan_pagos', cobranza_at: new Date().toISOString() };
  if (quoteId) await supabase.from('quotes').update(marca).eq('id', quoteId);
  else await supabase.from('subscriptions').update(marca).eq('id', subId);
  return json({ ok: true, plan: data }, 201);
};

// ── Gestión: contactado, promesa de pago, o marcar una exhibición pagada ────
export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));

  if (b?.exhibicion_id) {
    const { error } = await supabase.from('cobros_programados')
      .update({ estado: 'pagada', pago_id: b.pago_id || null, updated_at: new Date().toISOString() })
      .eq('id', b.exhibicion_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const subId = String(b?.subscription_id || '');
  const quoteId = String(b?.quote_id || '');
  if (!subId && !quoteId) return json({ error: 'Falta la suscripción o la cotización.' }, 400);
  const p: any = { cobranza_at: new Date().toISOString() };
  if (['sin_contactar', 'contactado', 'promesa', 'negociando', 'incobrable', 'plan_pagos'].includes(b?.estado)) p.cobranza_estado = b.estado;
  if ('promesa' in b) p.cobranza_promesa = b.promesa || null;
  if ('nota' in b) p.cobranza_nota = String(b.nota || '').slice(0, 500) || null;
  // La misma gestión sirve para las dos: una cotización aceptada sin pagar se
  // persigue igual que una mensualidad, y la promesa tiene que quedar donde
  // vive la deuda.
  const { error } = quoteId
    ? await supabase.from('quotes').update(p).eq('id', quoteId)
    : await supabase.from('subscriptions').update(p).eq('id', subId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
