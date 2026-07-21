// /api/crm/arr/subscriptions — GET lista (join company) · POST crea · PUT edita.
// Toda mutación recalcula los agregados (mrr/arr/fecha_renovacion/estado) de la company.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export async function recalcCompany(companyId: string) {
  if (!companyId) return;
  const { data: subs } = await supabase.from('subscriptions')
    .select('mrr, arr, estado, proxima_factura').eq('company_id', companyId);
  const activas = (subs || []).filter(s => s.estado === 'activa');
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

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado');
  const ciclo = url.searchParams.get('ciclo');
  const companyId = url.searchParams.get('company_id');
  let q = supabase.from('subscriptions')
    .select('*, companies(id, nombre, sacs_account, ultima_venta_at, dias_sin_venta, health_score, estado_cuenta), contacts(id, nombre, email)')
    .order('proxima_factura', { ascending: true, nullsFirst: false });
  if (estado) q = q.eq('estado', estado);
  if (ciclo) q = q.eq('ciclo', ciclo);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q.limit(1000);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Columnas agregadas en SQL-4 (plan_id, precio_lista, cancela_al_vencer,
// pausada_hasta, ciclo_siguiente, precio_siguiente). Si el update falla porque
// aún no existen, se reintenta sin ellas (deploy puede ir antes que el SQL).
const COLS_SQL4 = ['plan_id', 'precio_lista', 'cancela_al_vencer', 'pausada_hasta', 'ciclo_siguiente', 'precio_siguiente'];

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
  const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensual';
  const precio = Number(body.precio) || 0;
  const mrr = ciclo === 'anual' ? precio / 12 : precio;
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
    proxima_factura: body.proxima_factura || null,
    // '' o 0 NO son un monto válido: Number('') === 0 dejaba próximas facturas
    // de $0 (recordatorios de $0, proyección desinflada, Stripe rechazando el link)
    monto_proximo: (() => { const mp = Number(body.monto_proximo); return Number.isFinite(mp) && mp > 0 ? mp : precio; })(),
    razon_cancelacion: body.razon_cancelacion || null,
    notas: body.notas || null,
    stripe_subscription_id: body.stripe_subscription_id ? String(body.stripe_subscription_id).trim() : null,
    updated_at: new Date().toISOString(),
  };
  // catálogo (SQL-4)
  if (body.plan_id !== undefined) out.plan_id = body.plan_id || null;
  if (body.precio_lista !== undefined) out.precio_lista = Number(body.precio_lista) || null;
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.nombre_plan || !body?.company_id) return new Response(JSON.stringify({ error: 'nombre_plan y company_id requeridos' }), { status: 400 });
  const { data, error } = await supabase.from('subscriptions').insert(normalizar(body)).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  await recalcCompany(data.company_id);
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
  // pausar exige fecha de reanudación (si no, es un cancelado disfrazado)
  if (nuevoEstado === 'pausada' && prev.estado !== 'pausada' && body.pausada_hasta === undefined && !prev.pausada_hasta) {
    return new Response(JSON.stringify({ error: 'pausada_hasta requerida al pausar (fecha de reanudación)' }), { status: 400 });
  }

  const upd: any = normalizar(body);
  delete upd.company_id; // la suscripción no cambia de empresa por edición
  // Solo pisar campos que el cliente MANDÓ: el modal no envía contact_id y el
  // normalizar() lo dejaba en null en cada edición → la sub perdía su contacto
  // y el dunning/recordatorios dejaban de llegarle a ese cliente en silencio.
  for (const k of ['contact_id', 'fecha_inicio', 'proxima_factura', 'notas', 'stripe_subscription_id', 'razon_cancelacion', 'plan_id', 'precio_lista'] as const) {
    if (body[k] === undefined) delete upd[k];
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
  } else if (prev.estado === 'pausada' && nuevoEstado === 'activa') {
    upd.pausada_hasta = null; // reanudada
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
      tipo: 'sistema', titulo: `Suscripción editada (${data.nombre_plan}): ${cambios.join(' · ')}` + (esCancelacionNueva ? ` · razón: ${body.razon_cancelacion}` : ''),
      company_id: data.company_id, automatico: true, metadata: { audit: 'sub_update', subscription_id: data.id, cambios, actor: body.actor || null },
    }).select().maybeSingle();
  }
  await recalcCompany(data.company_id);

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
