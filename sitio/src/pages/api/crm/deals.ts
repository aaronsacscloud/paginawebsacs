import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';
import { calcularTotales } from '../../../lib/crm/deal-items';

export const prerender = false;

// El dinero de una oportunidad SIEMPRE se deriva de sus líneas, nunca se confía
// de lo que mande el front: si el modal y el servidor calcularan por separado,
// tarde o temprano el pipeline diría una cosa y la suscripción otra.
// valor_mensual se conserva sincronizado con mrr porque de ahí cuelgan las
// comisiones a socios y el código viejo.
function derivarMontos(body: any): Record<string, any> {
  if (!Array.isArray(body?.items)) return {};
  const t = calcularTotales(body.items, body.descuento_pct);
  return {
    items: body.items,
    descuento_pct: body.descuento_pct ?? null,
    mrr: t.mrr, valor_mensual: t.mrr,
    valor_unico: t.valor_unico,
    valor_total: t.valor_total,
    tipo_ingreso: t.tipo_ingreso,
    billing_period: t.billing_period,
  };
}

// Columnas de la migración de ago-2026. El deploy puede ir antes que el SQL:
// si faltan, se reintenta sin ellas — perder el desglose es aceptable, perder
// la oportunidad no.
const COLS_V2 = ['items', 'mrr', 'valor_unico', 'descuento_pct', 'tipo_ingreso', 'subscription_id', 'categoria', 'origen', 'es_sugerencia'];
const sinColumna = (m?: string) => /column .* does not exist|schema cache|could not find/i.test(m || '');
// Cliente NUEVO o UPSELL: la propiedad "deal type" de HubSpot (net new vs
// repeat business). No es cosmética — vender por primera vez y ampliarle a
// quien ya te compra cuestan distinto, tardan distinto y solo una es
// crecimiento nuevo. Se deduce de si esa empresa ya tenía suscripción.
async function categoriaAuto(companyId?: string | null): Promise<string> {
  if (!companyId) return 'nuevo';
  const { data } = await supabase.from('subscriptions').select('id')
    .eq('company_id', companyId).in('estado', ['activa', 'pendiente_pago', 'pausada', 'programada']).limit(1).maybeSingle();
  return data ? 'upsell' : 'nuevo';
}

function sinV2(o: Record<string, any>) {
  const c = { ...o };
  for (const k of COLS_V2) delete c[k];
  return c;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const stage = url.searchParams.get('stage');
  const contact_id = url.searchParams.get('contact_id');
  const company_id = url.searchParams.get('company_id');

  let query = supabase
    .from('deals')
    .select('*, contacts(id, nombre, email, whatsapp), companies(id, nombre, plan)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  // Las SUGERENCIAS (renovaciones y señales que generó el sistema) no son
  // pipeline: nadie ha ido a buscar ese dinero todavía. Si contaran aquí, el
  // pronóstico se inflaría solo y dejaría de creerse. Viven en su propia
  // bandeja (/api/crm/deals/sugerencias) hasta que alguien las acepta.
  if (url.searchParams.get('incluir_sugerencias') !== '1') query = query.or('es_sugerencia.is.null,es_sugerencia.eq.false');
  query = query.is('descartada_at', null);
  const categoria = url.searchParams.get('categoria');
  if (categoria) query = query.eq('categoria', categoria);

  if (stage) query = query.eq('stage', stage);
  if (contact_id) query = query.eq('contact_id', contact_id);
  if (company_id) query = query.eq('company_id', company_id);

  // Partner scope: only show deals owned by the user (founder sees all)
  query = applyPartnerScope(query, user, 'owner_id');

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const fila: any = {
    nombre: body.nombre,
    descripcion: body.descripcion || null,
    contact_id: body.contact_id || null,
    company_id: body.company_id || null,
    plan: body.plan || null,
    sucursales: body.sucursales || 1,
    billing_period: body.billing_period || null,
    valor_mensual: body.valor_mensual || 0,
    valor_total: body.valor_total || 0,
    stage: body.stage || 'calificacion',
    fecha_cierre_esperada: body.fecha_cierre_esperada || null,
    quote_id: body.quote_id || null,
    owner_id: body.owner_id || null,
    origen: body.origen || 'manual',
    categoria: body.categoria || (await categoriaAuto(body.company_id)),
    ...derivarMontos(body),
  };

  let { data, error } = await supabase.from('deals').insert(fila).select().single();
  if (error && sinColumna(error.message)) ({ data, error } = await supabase.from('deals').insert(sinV2(fila)).select().single());
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Log activity
  await supabase.from('activities').insert({
    contact_id: body.contact_id || null,
    company_id: body.company_id || null,
    deal_id: data.id,
    tipo: 'sistema',
    titulo: `Oportunidad creada: ${body.nombre}`,
    metadata: { plan: body.plan, valor: body.valor_total, stage: body.stage || 'calificacion' },
    automatico: true,
  });

  // Update contact lifecycle if needed
  if (body.contact_id && body.stage && body.stage !== 'cerrada_perdida') {
    await supabase
      .from('contacts')
      .update({ lifecycle_stage: 'oportunidad' })
      .eq('id', body.contact_id)
      .in('lifecycle_stage', ['lead', 'lead_calificado', 'suscriptor']);
  }

  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
  const updates: any = { ...rest, ...derivarMontos(body) };

  // Cargar deal previo para detectar transición de stage
  const { data: prev } = await supabase
    .from('deals')
    .select('stage, referrer_partner_id, valor_total, contact_id, motivo_perdida')
    .eq('id', id)
    .maybeSingle();

  // ── Perder SIN decir por qué es lo que impide mejorar ──
  // La columna existía desde el principio y estaba vacía en las 8 perdidas: sin
  // el motivo, en tres meses nadie sabe si se pierde por precio, por función o
  // por no dar seguimiento — y sin eso no hay nada que corregir. Es el "loss
  // reason" obligatorio de Pipedrive. Se valida en el SERVIDOR porque la UI se
  // puede saltar (curl, automatizaciones, el kanban al arrastrar).
  const pasaAPerdida = typeof updates.stage === 'string' && /perdid/i.test(updates.stage) && !/perdid/i.test(String(prev?.stage || ''));
  if (pasaAPerdida && !String(updates.motivo_perdida || prev?.motivo_perdida || '').trim()) {
    return new Response(JSON.stringify({
      error: 'Escribe por qué se perdió: es lo único que después permite corregir precio, producto o seguimiento.',
      requiere: 'motivo_perdida',
    }), { status: 400 });
  }
  if (pasaAPerdida) updates.closed_at = updates.closed_at || new Date().toISOString();

  let { data, error } = await supabase.from('deals').update(updates).eq('id', id).select().single();
  if (error && sinColumna(error.message)) ({ data, error } = await supabase.from('deals').update(sinV2(updates)).eq('id', id).select().single());
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Lo que el cierre dejó, para poder decírselo al vendedor en el momento.
  let cierre: any = null;

  // If deal closed won, update contact and company
  if (updates.stage === 'cerrada_ganada' && data) {
    // Ganar TIENE que dejar algo: cliente + suscripción + pago único. Antes esto
    // solo corría si la oportunidad ya traía empresa, y la que no la traía se
    // quedaba ganada sin cliente y sin cobro — ganada de mentiras.
    try {
      const { materializarDealGanado } = await import('../../../lib/crm/deal-cierre');
      cierre = await materializarDealGanado(data);
      if (cierre.company_id) data.company_id = cierre.company_id;
    } catch (e: any) {
      console.warn('[crm/deals.PUT] materializarDealGanado failed:', e);
      cierre = { avisos: ['No se pudo generar la suscripción: ' + (e?.message || e)] };
    }

    if (data.contact_id) {
      await supabase.from('contacts').update({ tipo: 'cliente', lifecycle_stage: 'cliente' }).eq('id', data.contact_id);
    }

    if (data.company_id) {
      // companies.mrr/arr los recalcula recalcCompany desde las suscripciones
      // vivas: escribirlos aquí a mano los separaba del ARR real en cuanto la
      // sub cambiaba de precio.
      await supabase.from('companies').update({
        estado_cuenta: 'activo',
        ...(data.plan ? { plan: data.plan } : {}),
        ...(data.sucursales ? { sucursales: data.sucursales } : {}),
        fecha_inicio: new Date().toISOString().slice(0, 10),
      }).eq('id', data.company_id);
      try {
        const { recalcCompany } = await import('./arr/subscriptions');
        await recalcCompany(data.company_id);
      } catch { /* best-effort */ }
    }

    // Sellar closed_at si no estaba
    if (!data.closed_at) {
      await supabase.from('deals').update({ closed_at: new Date().toISOString() }).eq('id', id);
    }
    const subGenerada = !!cierre?.sub_creada || !!cierre?.unico_creado;

    // Encolar ONBOARDING del cliente nuevo (idempotente — no duplica si ya
    // se encoló al aceptar la cotización).
    try {
      const { enqueueOnboarding } = await import('../../../lib/crm/onboarding');
      await enqueueOnboarding(data.company_id || null, data.contact_id || null, id);
    } catch (e) {
      console.warn('[crm/deals.PUT] enqueueOnboarding failed:', e);
    }

    // Activity log para que partner lo vea como movimiento
    await supabase.from('activities').insert({
      contact_id: data.contact_id || null,
      company_id: data.company_id || null,
      deal_id: id,
      tipo: 'deal_ganado',
      titulo: `Oportunidad ganada: ${data.nombre}${subGenerada ? ' · suscripción generada' : ''}`,
      metadata: { valor: data.valor_total, plan: data.plan, referrer_partner_id: data.referrer_partner_id, suscripcion_generada: subGenerada },
      automatico: true,
    });

    // Comisión venta_directa al partner referido (idempotente)
    if (data.referrer_partner_id) {
      try {
        const { createCommissionForDeal } = await import('../../../lib/commissions/calculate');
        await createCommissionForDeal({
          deal_id: id,
          partner_id: data.referrer_partner_id,
          deal_value: Number(data.valor_total || 0),
        });
      } catch (e) {
        console.warn('[crm/deals.PUT] createCommissionForDeal failed:', e);
      }
    }
  }

  // Si se reabre un deal previamente ganado → cancelar comisión venta_directa
  if (prev?.stage === 'cerrada_ganada' && updates.stage && updates.stage !== 'cerrada_ganada') {
    try {
      const { cancelCommission } = await import('../../../lib/commissions/calculate');
      await cancelCommission(id, `Oportunidad reabierta a ${updates.stage}`);
    } catch (e) {
      console.warn('[crm/deals.PUT] cancelCommission failed:', e);
    }
  }

  // `cierre` viaja de vuelta para poder decirle al vendedor QUÉ quedó creado.
  // Un "ganada ✓" sin decir si nació la suscripción es exactamente el silencio
  // que dejó una venta de $44,505 sin cliente y sin cobro.
  return new Response(JSON.stringify(cierre ? { ...data, cierre } : data));
};

// DELETE /api/crm/deals  { ids: [...] }  — borrar oportunidades de verdad.
//
// Existe por la basura de antes del proceso: decenas de "Deal — Fulano" que
// nadie trabajó nunca y que ensucian el pipeline, el ponderado y la lectura de
// lo que sí está vivo. Marcarlas perdidas no sirve para eso — una perdida es
// información (se compitió y no se ganó); esto es ruido que no debió existir.
//
// Tres tablas apuntan a deals con NO ACTION (borrar sin soltarlas falla), así
// que primero se sueltan:
//   · quotes    → la cotización es un documento real, sobrevive sin su deal
//   · bookings  → la reunión pasó, no se borra por limpiar el pipeline
//   · activities→ el rastro se queda en el timeline del cliente
//
// Y una cuarta apunta con CASCADE: partner_commissions. Por eso NO se borra una
// oportunidad con comisión PAGADA — el borrado se llevaría el registro del pago
// a un socio, que es justo lo que jamás se debe perder por una limpieza.
export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : (body?.id ? [body.id] : []);
  if (!ids.length) return new Response(JSON.stringify({ error: 'ids requerido' }), { status: 400 });
  if (ids.length > 200) return new Response(JSON.stringify({ error: 'Máximo 200 por vez.' }), { status: 400 });

  const { data: deals } = await supabase.from('deals').select('id, nombre, company_id, contact_id, stage, valor_total').in('id', ids);
  if (!deals?.length) return new Response(JSON.stringify({ error: 'No encontré esas oportunidades.' }), { status: 404 });

  // Comisiones pagadas → intocables. Se dice CUÁLES, o el usuario cree que se
  // borraron todas y no vuelve a revisar.
  const { data: comis } = await supabase.from('partner_commissions')
    .select('deal_id, status, paid_at').in('deal_id', ids);
  const protegidas = new Set((comis || [])
    .filter((c: any) => c.paid_at || c.status === 'pagada' || c.status === 'paid')
    .map((c: any) => c.deal_id));

  const borrables = deals.filter(d => !protegidas.has(d.id)).map(d => d.id);
  const omitidas = deals.filter(d => protegidas.has(d.id)).map(d => ({ id: d.id, nombre: d.nombre, motivo: 'tiene una comisión pagada a un socio' }));
  if (!borrables.length) {
    return new Response(JSON.stringify({ error: 'Ninguna se puede borrar: todas tienen comisión pagada.', omitidas }), { status: 409 });
  }

  // Soltar las hijas ANTES del delete (NO ACTION = el borrado falla si no).
  await supabase.from('quotes').update({ deal_id: null }).in('deal_id', borrables);
  await supabase.from('bookings').update({ deal_id: null }).in('deal_id', borrables);
  await supabase.from('activities').update({ deal_id: null }).in('deal_id', borrables);

  const { error } = await supabase.from('deals').delete().in('id', borrables);
  if (error) return new Response(JSON.stringify({ error: error.message, omitidas }), { status: 500 });

  // Rastro de la limpieza: sin esto, mañana nadie sabe por qué se vació el
  // pipeline de abril.
  const filas = deals.filter(d => borrables.includes(d.id)).map(d => ({
    tipo: 'sistema', automatico: true, company_id: d.company_id || null,
    titulo: `Oportunidad eliminada: ${d.nombre}`,
    descripcion: `Estaba en "${d.stage}" por $${Number(d.valor_total || 0).toLocaleString('es-MX')}. Se borró en una limpieza del pipeline.`,
    metadata: { audit: 'deal_delete', deal_id: d.id, stage: d.stage, valor_total: d.valor_total },
  })).filter(f => f.company_id);
  if (filas.length) await supabase.from('activities').insert(filas);

  return new Response(JSON.stringify({ ok: true, borradas: borrables.length, omitidas }), { status: 200 });
};
