import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';

export const prerender = false;

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

  const { data, error } = await supabase
    .from('deals')
    .insert({
      nombre: body.nombre,
      descripcion: body.descripcion || null,
      contact_id: body.contact_id,
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
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Log activity
  await supabase.from('activities').insert({
    contact_id: body.contact_id,
    company_id: body.company_id || null,
    deal_id: data.id,
    tipo: 'sistema',
    titulo: `Oportunidad creada: ${body.nombre}`,
    metadata: { plan: body.plan, valor: body.valor_total, stage: body.stage || 'calificacion' },
    automatico: true,
  });

  // Update contact lifecycle if needed
  if (body.stage && body.stage !== 'cerrada_perdida') {
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
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // Cargar deal previo para detectar transición de stage
  const { data: prev } = await supabase
    .from('deals')
    .select('stage, referrer_partner_id, valor_total, contact_id')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // If deal closed won, update contact and company
  if (updates.stage === 'cerrada_ganada' && data) {
    await supabase
      .from('contacts')
      .update({ tipo: 'cliente', lifecycle_stage: 'cliente' })
      .eq('id', data.contact_id);

    if (data.company_id) {
      await supabase
        .from('companies')
        .update({
          estado_cuenta: 'activo',
          plan: data.plan,
          sucursales: data.sucursales,
          precio_por_sucursal: data.valor_mensual / (data.sucursales || 1),
          mrr: data.valor_mensual,
          arr: data.valor_mensual * 12,
          fecha_inicio: new Date().toISOString().slice(0, 10),
        })
        .eq('id', data.company_id);
    }

    // Sellar closed_at si no estaba
    if (!data.closed_at) {
      await supabase.from('deals').update({ closed_at: new Date().toISOString() }).eq('id', id);
    }

    // Ganar la oportunidad GENERA la suscripción (idempotente, estado 'programada';
    // se activa al primer pago). Cierra la asimetría con la cotización aceptada.
    let subGenerada = false;
    try {
      const { ensureSubscriptionFromDeal } = await import('../../../lib/crm/deal-to-subscription');
      const r = await ensureSubscriptionFromDeal(data, { estado: 'programada' });
      subGenerada = r.created;
    } catch (e) {
      console.warn('[crm/deals.PUT] ensureSubscriptionFromDeal failed:', e);
    }

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
      contact_id: data.contact_id,
      company_id: data.company_id,
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

  return new Response(JSON.stringify(data));
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
