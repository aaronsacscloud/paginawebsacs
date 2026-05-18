import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const stage = url.searchParams.get('stage');
  const contact_id = url.searchParams.get('contact_id');

  let query = supabase
    .from('deals')
    .select('*, contacts(id, nombre, email, whatsapp), companies(id, nombre, plan)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (stage) query = query.eq('stage', stage);
  if (contact_id) query = query.eq('contact_id', contact_id);

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
    titulo: `Deal creado: ${body.nombre}`,
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

    // Activity log para que partner lo vea como movimiento
    await supabase.from('activities').insert({
      contact_id: data.contact_id,
      company_id: data.company_id,
      deal_id: id,
      tipo: 'deal_ganado',
      titulo: `Deal cerrado: ${data.nombre}`,
      metadata: { valor: data.valor_total, plan: data.plan, referrer_partner_id: data.referrer_partner_id },
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
      await cancelCommission(id, `Deal reabierto a ${updates.stage}`);
    } catch (e) {
      console.warn('[crm/deals.PUT] cancelCommission failed:', e);
    }
  }

  return new Response(JSON.stringify(data));
};
