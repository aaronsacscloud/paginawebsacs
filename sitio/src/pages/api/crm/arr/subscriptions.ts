import { conMicroCache } from '../../../../lib/crm/micro-cache';
// /api/crm/arr/subscriptions — GET lista (join company) · POST crea · PUT edita.
// Toda mutación recalcula los agregados (mrr/arr/fecha_renovacion/estado) de la company.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recordDelta } from '../../../../lib/crm/mrr-ledger';

export const prerender = false;

// MRR que una sub aporta a la BASE de ingreso recurrente (para el ledger).
// activa y pendiente_pago cuentan (una vencida no ha cancelado, solo va tarde);
// programada/pausada/cancelada aportan 0. Así una recuperación de dunning
// (pendiente_pago→activa) NO se cuenta como negocio nuevo, y entrar a
// pendiente_pago no se cuenta como churn — solo cancelar lo es.
const mrrAporte = (estado: string, mrr: number) => (estado === 'activa' || estado === 'pendiente_pago' ? Number(mrr || 0) : 0);

export async function recalcCompany(companyId: string) {
  if (!companyId) return;
  const { data: subs } = await supabase.from('subscriptions')
    .select('mrr, arr, estado, proxima_factura').eq('company_id', companyId);
  const activas = (subs || []).filter(s => s.estado === 'activa');
  // MRR/ARR = valor de los PLANES base (una sola definición consistente en todo
  // el CRM). Los add-ons y descuentos ajustan lo que se COBRA (monto_proximo),
  // no la ARR reportada, para no tener dos números de ARR distintos.
  const mrr = activas.reduce((a, s) => a + Number(s.mrr || 0), 0);
  const proximas = activas.map(s => s.proxima_factura).filter(Boolean).sort();
  await supabase.from('companies').update({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    fecha_renovacion: proximas[0] || null,
    estado_cuenta: activas.length ? 'activo'
      : ((subs || []).some(s => s.estado === 'pendiente_pago' || s.estado === 'programada') ? 'vencido'
      : ((subs || []).some(s => s.estado === 'pausada') ? 'pausado'
      : ((subs || []).length ? 'cancelado' : 'prospecto'))),
  }).eq('id', companyId);
}

const _GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado');
  const ciclo = url.searchParams.get('ciclo');
  const companyId = url.searchParams.get('company_id');
  let q = supabase.from('subscriptions')
    .select('*, companies(id, nombre, sacs_account, ultima_venta_at, dias_sin_venta, health_score, estado_cuenta, soporte_abiertos, soporte_estancado, soporte_sentimiento), contacts(id, nombre, email)')
    .order('proxima_factura', { ascending: true, nullsFirst: false });
  if (estado) q = q.eq('estado', estado);
  if (ciclo) q = q.eq('ciclo', ciclo);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q.limit(1000);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  /* `total_pagado` es un contador que alguien tiene que mantener, y no siempre
     se mantiene: el Programa Partners de Super Carnes tiene su pago cobrado y
     ligado a la cotización que lo originó, pero el campo decía 0 y la licencia
     aparecía como si no hubiera producido un peso.
     Aquí se recalcula desde los pagos REALES —los de la suscripción y los de
     su cotización— porque el dinero está en la tabla de pagos, no en un
     contador. Solo se sobreescribe cuando lo real es mayor: si alguien capturó
     un abono a mano en el campo, no se le borra. */
  const subIds = (data || []).map((s: any) => s.id);
  const cotIds = (data || []).map((s: any) => s.quote_id).filter(Boolean);
  if (subIds.length) {
    const [porSub, porCot] = await Promise.all([
      supabase.from('payments').select('subscription_id, monto, estado').in('subscription_id', subIds.slice(0, 500)),
      cotIds.length ? supabase.from('payments').select('quote_id, monto, estado').in('quote_id', cotIds.slice(0, 500)) : Promise.resolve({ data: [] as any[] }),
    ]);
    const suma: Record<string, number> = {};
    ((porSub as any).data || []).filter((p: any) => p.estado !== 'reembolsado')
      .forEach((p: any) => { suma[p.subscription_id] = (suma[p.subscription_id] || 0) + Number(p.monto || 0); });
    const porCotizacion: Record<string, number> = {};
    ((porCot as any).data || []).filter((p: any) => p.estado !== 'reembolsado')
      .forEach((p: any) => { porCotizacion[p.quote_id] = (porCotizacion[p.quote_id] || 0) + Number(p.monto || 0); });
    (data || []).forEach((s: any) => {
      const real = (suma[s.id] || 0) + (s.quote_id ? (porCotizacion[s.quote_id] || 0) : 0);
      if (real > Number(s.total_pagado || 0)) s.total_pagado = Math.round(real * 100) / 100;
    });
  }

  // Fresco siempre: la lista y el KPI se leen juntos tras guardar.
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } });
};

// Columnas agregadas en SQL-4 (plan_id, precio_lista, cancela_al_vencer,
// pausada_hasta, ciclo_siguiente, precio_siguiente). Si el update falla porque
// aún no existen, se reintenta sin ellas (deploy puede ir antes que el SQL).
const COLS_SQL4 = ['plan_id', 'precio_lista', 'cancela_al_vencer', 'pausada_hasta', 'ciclo_siguiente', 'precio_siguiente',
  // SQL-5: trials y contrato multi-año
  'es_trial', 'trial_fin', 'plazo_meses', 'incremento_anual_pct',
  // SQL-6: contexto de la licencia pausada
  'razon_pausa', 'pausa_espera', 'pausada_at'];

async function updateSubTolerante(id: string, upd: any) {
  let res = await supabase.from('subscriptions').update(upd).eq('id', id).select().single();
  if (res.error && /column .* does not exist|could not find|schema cache/i.test(res.error.message || '')) {
    const stripped = { ...upd };
    for (const c of COLS_SQL4) delete stripped[c];
    res = await supabase.from('subscriptions').update(stripped).eq('id', id).select().single();
  }
  return res;
}

function normalizar(body: any) {
  const ciclo = body.ciclo === 'anual' ? 'anual' : body.ciclo === 'vitalicia' ? 'vitalicia' : 'mensual';
  const precio = Number(body.precio) || 0;
  // Vitalicia = pago único (legacy), NO recurrente → no aporta MRR/ARR ni renueva.
  const mrr = ciclo === 'anual' ? precio / 12 : ciclo === 'vitalicia' ? 0 : precio;
  const out: any = {
    company_id: body.company_id || null,
    contact_id: body.contact_id || null,
    nombre_plan: String(body.nombre_plan || '').slice(0, 160),
    ciclo,
    estado: ['activa', 'pendiente_pago', 'pausada', 'cancelada', 'programada'].includes(body.estado) ? body.estado : 'programada',
    precio,
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    fecha_inicio: body.fecha_inicio || null,
    // Vitalicia no renueva → sin próxima factura ni monto próximo.
    proxima_factura: ciclo === 'vitalicia' ? null : (body.proxima_factura || null),
    // '' o 0 NO son un monto válido: Number('') === 0 dejaba próximas facturas
    // de $0 (recordatorios de $0, proyección desinflada, Stripe rechazando el link)
    monto_proximo: ciclo === 'vitalicia' ? null : (() => { const mp = Number(body.monto_proximo); return Number.isFinite(mp) && mp > 0 ? mp : precio; })(),
    razon_cancelacion: body.razon_cancelacion || null,
    notas: body.notas || null,
    stripe_subscription_id: body.stripe_subscription_id ? String(body.stripe_subscription_id).trim() : null,
    updated_at: new Date().toISOString(),
  };
  // catálogo (SQL-4). plan_id es una columna UUID: si llega un slug ('personalizada')
  // Postgres tira 22P02 y el front enseña el error crudo al usuario. Se ignora en
  // silencio lo que no sea uuid — el plan real lo lleva `nombre_plan`.
  const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (body.plan_id !== undefined) out.plan_id = ES_UUID.test(String(body.plan_id || '')) ? body.plan_id : null;
  if (body.precio_lista !== undefined) out.precio_lista = Number(body.precio_lista) || null;
  // Cuántas sucursales cubre ESTA licencia. Va aparte de companies.sucursales
  // —cuántas tiene el negocio— porque una cuenta puede pagar dos licencias de
  // distinto tamaño. Vacío se guarda como null: "no lo sé" es un dato, y
  // asumir 1 haría que un precio por 3 sucursales pareciera estar mal.
  if (body.sucursales !== undefined) {
    const n = Math.round(Number(body.sucursales));
    out.sucursales = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (body.razon_pausa !== undefined) out.razon_pausa = body.razon_pausa || null;
  if (body.pausa_espera !== undefined) out.pausa_espera = body.pausa_espera || null;
  // trials y multi-año (SQL-5)
  if (body.es_trial !== undefined) out.es_trial = !!body.es_trial;
  if (body.trial_fin !== undefined) out.trial_fin = body.trial_fin || null;
  if (body.plazo_meses !== undefined) out.plazo_meses = body.plazo_meses ? Number(body.plazo_meses) : null;
  if (body.incremento_anual_pct !== undefined) out.incremento_anual_pct = body.incremento_anual_pct ? Number(body.incremento_anual_pct) : null;
  /* Lo que el cliente ya pagó por esta licencia. En las vitalicias legacy
     —cobradas antes de que existiera el CRM— capturarlo a mano es la única
     forma de que ese dinero exista en el sistema; hoy 30 de 32 están en cero.
     Solo entra si viene: no mandarlo NO significa borrarlo. */
  if (body.total_pagado !== undefined && body.total_pagado !== null && body.total_pagado !== '') {
    out.total_pagado = Number(body.total_pagado) || 0;
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.nombre_plan || !body?.company_id) return new Response(JSON.stringify({ error: 'nombre_plan y company_id requeridos' }), { status: 400 });
  const { data, error } = await supabase.from('subscriptions').insert(normalizar(body)).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  await recalcCompany(data.company_id);
  // Ledger: si nace ya aportando (activa/pendiente) es un alta; si nace
  // programada (aporte 0) no hay movimiento hasta que se cobre.
  await recordDelta({
    subscription_id: data.id, company_id: data.company_id,
    mrr_anterior: 0, mrr_nuevo: mrrAporte(data.estado, data.mrr),
    motivo: 'alta de suscripción', actor: body.actor || 'admin',
  });
  await supabase.from('activities').insert({
    tipo: 'sistema', titulo: `Suscripción creada: ${data.nombre_plan} (${data.ciclo}) · $${Number(data.precio).toLocaleString('es-MX')}`,
    company_id: data.company_id, automatico: true, metadata: { audit: 'sub_create', subscription_id: data.id },
  }).select().maybeSingle();
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Transiciones de estado permitidas. La UI las deshabilita, pero el servidor
// es la última línea. `activa`↔`pendiente_pago`, pausa/reanuda, cancelar desde
// cualquier estado vivo, y reactivar una cancelada.
const TRANSICIONES: Record<string, string[]> = {
  programada: ['programada', 'activa', 'pendiente_pago', 'cancelada'],
  activa: ['activa', 'pendiente_pago', 'pausada', 'cancelada'],
  pendiente_pago: ['pendiente_pago', 'activa', 'pausada', 'cancelada'],
  pausada: ['pausada', 'activa', 'cancelada'],
  cancelada: ['cancelada', 'activa'],
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });
  const { data: prev } = await supabase.from('subscriptions')
    .select('*').eq('id', body.id).maybeSingle();
  if (!prev) return new Response(JSON.stringify({ error: 'suscripción no encontrada' }), { status: 404 });

  const nuevoEstado = body.estado || prev.estado;
  const hayCambioEstado = nuevoEstado !== prev.estado;
  const esCancelacionNueva = nuevoEstado === 'cancelada' && prev.estado !== 'cancelada';

  // Validar transición
  if (hayCambioEstado && !(TRANSICIONES[prev.estado] || []).includes(nuevoEstado)) {
    return new Response(JSON.stringify({ error: `Transición no permitida: ${prev.estado} → ${nuevoEstado}` }), { status: 400 });
  }
  // razón obligatoria TAMBIÉN en servidor (el modal la valida, pero curl/bugs no)
  if (esCancelacionNueva && !body.razon_cancelacion) {
    return new Response(JSON.stringify({ error: 'razon_cancelacion requerida para cancelar' }), { status: 400 });
  }
  // Pausar exige MOTIVO, no fecha. Antes se pedía `pausada_hasta` para que una
  // pausa no fuera "un cancelado disfrazado", pero el caso real es justo el que
  // no tiene fecha: el cliente ya pagó y congela porque no abrió su plaza —
  // nadie sabe cuándo. Obligar una fecha solo producía fechas inventadas. Lo que
  // de verdad permite gestionarla es POR QUÉ está pausada y QUÉ se espera de él;
  // la fecha estimada queda opcional.
  const esPausaNueva = nuevoEstado === 'pausada' && prev.estado !== 'pausada';
  if (esPausaNueva && !String(body.razon_pausa || '').trim() && !prev.razon_pausa) {
    return new Response(JSON.stringify({ error: 'razon_pausa requerida al pausar (por qué se congela la licencia)' }), { status: 400 });
  }
  // Reactivar una pausada: hay que decir DESDE CUÁNDO quedó activa y CUÁNDO se
  // le cobra. Sin eso la sub vuelve al ARR con una próxima factura vieja (o
  // vacía) y se le cobra mal o no se le cobra.
  const esReactivacionPausa = prev.estado === 'pausada' && nuevoEstado === 'activa';
  if (esReactivacionPausa) {
    if (!body.fecha_inicio) return new Response(JSON.stringify({ error: 'Al reactivar indica desde cuándo quedó activa (fecha_inicio).' }), { status: 400 });
    if (!body.proxima_factura) return new Response(JSON.stringify({ error: 'Al reactivar indica la fecha en que se le va a cobrar (proxima_factura).' }), { status: 400 });
  }

  /* Un PUT parcial NO puede reescribir lo que no le mandaron. `normalizar()`
     está escrito para un alta —rellena con valores por omisión: estado
     'programada', precio 0, ciclo 'mensual'— y al reusarlo aquí, mandar solo
     {id, total_pagado} le cambiaba el estado a la licencia y le ponía el
     precio en cero. Un caso real: a una vitalicia activa de $206,480 la dejó
     en 'programada'. Estos cuatro se toman de lo que ya había cuando no
     vienen; mrr/arr se recalculan solos porque salen de ciclo y precio. */
  const base = { ...body };
  for (const k of ['nombre_plan', 'ciclo', 'estado', 'precio', 'monto_proximo'] as const) {
    if (base[k] === undefined) base[k] = (prev as any)[k];
  }
  const upd: any = normalizar(base);
  // company_id/contact_id: solo se tocan si el cliente los MANDÓ explícitamente
  // (reasignar la sub a la empresa/contacto correcto desde el modal). Si no vienen,
  // se conservan — el normalizar() los dejaba en null y la sub perdía su vínculo,
  // cortando dunning/recordatorios en silencio.
  for (const k of ['company_id', 'contact_id', 'fecha_inicio', 'proxima_factura', 'notas', 'stripe_subscription_id', 'razon_cancelacion', 'plan_id', 'precio_lista', 'sucursales'] as const) {
    if (body[k] === undefined) delete upd[k];
  }

  // ── Los campos de VALOR tampoco se pisan si no vienen ──
  // `normalizar()` arma el registro completo desde cero, así que un PUT PARCIAL
  // —cancelar, por ejemplo, que solo manda id/estado/razón— dejaba
  // `nombre_plan` en '', `ciclo` en 'mensual' y precio/mrr/arr en 0. Se perdía
  // QUÉ tenía contratado el cliente y CUÁNTO, que es justo lo que el reporte de
  // bajas necesita para decir cuánto MRR se fue: por eso el tablero decía
  // "3 bajas · $0 de ARR".
  const cicloEf = body.ciclo === undefined ? prev.ciclo : upd.ciclo;
  const precioEf = body.precio === undefined ? Number(prev.precio) || 0 : upd.precio;
  const mrrEf = cicloEf === 'anual' ? precioEf / 12 : cicloEf === 'vitalicia' ? 0 : precioEf;
  upd.ciclo = cicloEf;
  upd.precio = precioEf;
  upd.mrr = Math.round(mrrEf * 100) / 100;
  upd.arr = Math.round(mrrEf * 12 * 100) / 100;
  if (body.nombre_plan === undefined) upd.nombre_plan = prev.nombre_plan;
  if (body.monto_proximo === undefined) {
    upd.monto_proximo = cicloEf === 'vitalicia' ? null : (prev.monto_proximo ?? precioEf ?? null);
  }

  // ── Cancelación: hoy vs al vencer ──
  // "Al vencer" solo tiene sentido si hay un periodo pagado corriendo (activa):
  // sigue activa hasta que el cron la apague en proxima_factura. Si no está
  // activa (pendiente_pago/programada) no hay nada que respetar → cancela YA
  // (con cancelada_at + churn), nunca la dejes en cancelada sin registrar.
  const cancelarAlVencer = esCancelacionNueva && body.cancela_al_vencer && prev.estado === 'activa';
  const cancelacionInmediata = esCancelacionNueva && !cancelarAlVencer;
  if (cancelarAlVencer) {
    upd.estado = 'activa';
    upd.cancela_al_vencer = true;
  } else if (cancelacionInmediata) {
    upd.estado = 'cancelada';
    upd.cancelada_at = new Date().toISOString();
    upd.cancela_al_vencer = false;
  }
  // Reactivar una cancelada limpia el rastro de cancelación
  if (prev.estado === 'cancelada' && nuevoEstado !== 'cancelada') {
    upd.razon_cancelacion = null;
    upd.cancelada_at = null;
    upd.cancela_al_vencer = false;
  }
  // Pausa / reanudación
  if (nuevoEstado === 'pausada') {
    if (body.pausada_hasta !== undefined) upd.pausada_hasta = body.pausada_hasta || null;
    if (esPausaNueva) upd.pausada_at = new Date().toISOString();
  } else if (prev.estado === 'pausada') {
    // Al salir de la pausa se limpia TODO su contexto: si se quedara, un cliente
    // activo seguiría mostrando "pausado porque…". El histórico queda en la
    // activity que se registra abajo.
    upd.pausada_hasta = null;
    upd.pausada_at = null;
    upd.razon_pausa = null;
    upd.pausa_espera = null;
  }

  // ── Cambio de ciclo: "al renovar" escribe *_siguiente, "ahora" aplica ya ──
  const cambioCiclo = body.ciclo && body.ciclo !== prev.ciclo;
  if (cambioCiclo && body.aplicar_ciclo === 'al_renovar') {
    // no tocar el ciclo/precio vigentes; el cobro los promueve en la renovación
    upd.ciclo = prev.ciclo;
    upd.precio = prev.precio;
    upd.mrr = prev.mrr;
    upd.arr = prev.arr;
    upd.monto_proximo = prev.monto_proximo;
    upd.ciclo_siguiente = body.ciclo;
    upd.precio_siguiente = Number(body.precio) || null;
  }

  const { data, error } = await updateSubTolerante(body.id, upd);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // ── Stripe: cancelar de verdad si se pidió y hay sub ligada ──
  let stripeAviso: string | null = null;
  if (esCancelacionNueva && body.cancelar_stripe && prev.stripe_subscription_id) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-03-31.basil' as any, maxNetworkRetries: 2 });
      if (body.cancela_al_vencer) await stripe.subscriptions.update(prev.stripe_subscription_id, { cancel_at_period_end: true });
      else await stripe.subscriptions.cancel(prev.stripe_subscription_id);
    } catch (e: any) { stripeAviso = 'La sub se canceló en el CRM pero Stripe falló: ' + (e?.message || e) + '. Cancélala en Stripe manualmente.'; }
  }

  // Auditoría: qué cambió queda en el timeline del cliente
  const cambios: string[] = [];
  if (prev.estado !== data.estado) cambios.push(`estado ${prev.estado}→${data.estado}`);
  if (Number(prev.precio) !== Number(data.precio)) cambios.push(`precio $${Number(prev.precio).toLocaleString('es-MX')}→$${Number(data.precio).toLocaleString('es-MX')}`);
  if (cambioCiclo) cambios.push(body.aplicar_ciclo === 'al_renovar' ? `ciclo ${prev.ciclo}→${body.ciclo} (al renovar)` : `ciclo ${prev.ciclo}→${data.ciclo}`);
  if (prev.proxima_factura !== data.proxima_factura) cambios.push(`próx. factura ${prev.proxima_factura || '—'}→${data.proxima_factura || '—'}`);
  if (cancelarAlVencer) cambios.push('cancela al vencer');
  if (cambios.length) {
    await supabase.from('activities').insert({
      tipo: 'sistema', titulo: `Suscripción editada (${data.nombre_plan}): ${cambios.join(' · ')}`
        + (esCancelacionNueva ? ` · razón: ${body.razon_cancelacion}` : '')
        + (esPausaNueva ? ` · pausa: ${body.razon_pausa || prev.razon_pausa}${body.pausa_espera ? ` · esperando: ${body.pausa_espera}` : ''}` : '')
        + (esReactivacionPausa ? ` · reactivada (estuvo pausada por: ${prev.razon_pausa || '—'}) · activa desde ${body.fecha_inicio} · cobra el ${body.proxima_factura}` : ''),
      company_id: data.company_id, automatico: true, metadata: { audit: 'sub_update', subscription_id: data.id, cambios, actor: body.actor || null },
    }).select().maybeSingle();
  }
  await recalcCompany(data.company_id);
  // Si la sub se movió de empresa, recalcular también la anterior (pierde ese ARR).
  if (prev.company_id && prev.company_id !== data.company_id) await recalcCompany(prev.company_id);

  // Ledger MRR: un solo movimiento por el cambio de aporte al ARR (alta,
  // expansión/contracción de precio, churn, reactivación).
  await recordDelta({
    subscription_id: data.id, company_id: data.company_id,
    mrr_anterior: mrrAporte(prev.estado, prev.mrr), mrr_nuevo: mrrAporte(data.estado, data.mrr),
    reactivacion: prev.estado === 'cancelada' && data.estado === 'activa',
    motivo: cambios.join(' · ') || (cancelacionInmediata ? body.razon_cancelacion : null),
    actor: body.actor || 'admin',
  });

  // churn_event SOLO en la transición real a cancelada (inmediata; la "al
  // vencer" lo registra el cron cuando de verdad se apaga)
  if (cancelacionInmediata) {
    const churn: any = { company_id: data.company_id, mrr_lost: data.mrr, reason: body.razon_cancelacion, cancelled_at: new Date().toISOString() };
    let cr = await supabase.from('churn_events').insert({ ...churn, subscription_id: data.id }).select().maybeSingle();
    if (cr.error && /column .* does not exist|schema cache/i.test(cr.error.message || '')) {
      await supabase.from('churn_events').insert(churn).select().maybeSingle();
    }
  }
  return new Response(JSON.stringify({ data, ...(stripeAviso ? { advertencia: stripeAviso } : {}) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// REGLA DE VELOCIDAD: lectura pesada founder-only → micro-caché 45s en la instancia.
export const GET = conMicroCache('arr/subscriptions', 45000, _GET as any);
