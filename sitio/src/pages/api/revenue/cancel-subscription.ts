// Cancela una suscripción Stripe con flujo de retención.
// POST { company_id, reason, reason_detail, retention_accepted }
// - Si retention_accepted=true → aplica coupon 20% off 3 meses (subscription_schedules)
// - Si false → cancel_at_period_end=true, crea deal cerrada_perdida, contacts.churned, churn_event

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-03-31.basil',
});

const REASONS: Record<string, string> = {
  precio: 'Precio',
  no_uso: 'No lo estoy usando',
  competidor: 'Me cambié a otra solución',
  feature_falta: 'Le falta una feature clave',
  cerro_negocio: 'Cerró el negocio',
  otro: 'Otro',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { company_id, reason, reason_detail, retention_accepted } = body || {};
    if (!company_id) return new Response(JSON.stringify({ error: 'company_id requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (!reason || !REASONS[reason]) return new Response(JSON.stringify({ error: 'reason inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const { data: company, error: cErr } = await supabase
      .from('companies')
      .select('id, nombre, contact_id, stripe_customer_id, stripe_subscription_id, mrr, moneda')
      .eq('id', company_id)
      .single();

    if (cErr || !company) return new Response(JSON.stringify({ error: 'empresa no encontrada' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    // ─── Retention accepted: apply 20% off 3 months via coupon ───
    if (retention_accepted && company.stripe_subscription_id) {
      try {
        // Create (or re-use) retention coupon
        let couponId: string | null = null;
        try {
          const coupons = await stripe.coupons.list({ limit: 100 });
          const existing = coupons.data.find(c => c.id === 'SACS_RETENTION_20OFF_3M');
          if (existing) couponId = existing.id;
        } catch {}
        if (!couponId) {
          const created = await stripe.coupons.create({
            id: 'SACS_RETENTION_20OFF_3M',
            percent_off: 20,
            duration: 'repeating',
            duration_in_months: 3,
            name: 'Retención SACS 20% off 3 meses',
          });
          couponId = created.id;
        }

        await stripe.subscriptions.update(company.stripe_subscription_id, {
          discounts: [{ coupon: couponId }],
        });

        await supabase.from('activities').insert({
          contact_id: company.contact_id,
          company_id: company.id,
          tipo: 'sistema',
          titulo: 'Retención aceptada — 20% off 3 meses',
          metadata: { event: 'retention_accepted', reason, reason_detail, coupon: couponId },
          automatico: true,
        });

        return new Response(JSON.stringify({ success: true, retention_applied: true, coupon: couponId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // ─── Cancel at period end ───
    if (company.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(company.stripe_subscription_id, {
          cancel_at_period_end: true,
          metadata: { churn_reason: reason, churn_detail: reason_detail || '' },
        });
      } catch (err) {
        console.error('[cancel-subscription] stripe update error:', err);
      }
    }

    // Update company
    await supabase.from('companies').update({
      estado_cuenta: 'cancelado',
    }).eq('id', company.id);

    // Update contact lifecycle
    if (company.contact_id) {
      await supabase.from('contacts')
        .update({ lifecycle_stage: 'churned', tipo: 'churned' })
        .eq('id', company.contact_id);
    }

    // Insert churn event (table may not exist yet)
    try {
      await supabase.from('churn_events').insert({
        company_id: company.id,
        contact_id: company.contact_id || null,
        reason,
        reason_detail: reason_detail || null,
        mrr_lost: company.mrr || 0,
        cancelled_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[cancel-subscription] churn_events insert failed:', err);
    }

    // Create cerrada_perdida deal
    const { data: deal } = await supabase.from('deals').insert({
      nombre: `Churn — ${company.nombre}`,
      contact_id: company.contact_id,
      company_id: company.id,
      stage: 'cerrada_perdida',
      probabilidad: 0,
      valor_total: (company.mrr || 0) * 12,
      valor_mensual: company.mrr || 0,
      motivo_perdida: reason,
      closed_at: new Date().toISOString(),
    }).select().maybeSingle();

    await supabase.from('activities').insert({
      contact_id: company.contact_id,
      company_id: company.id,
      deal_id: (deal as any)?.id || null,
      tipo: 'sistema',
      titulo: `Cancelación — ${REASONS[reason]}`,
      metadata: { event: 'subscription_cancelled', reason, reason_detail: reason_detail || null },
      automatico: true,
    });

    return new Response(JSON.stringify({ success: true, cancelled: true, deal_id: (deal as any)?.id || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
