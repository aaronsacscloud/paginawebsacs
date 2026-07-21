// GET /api/crm/arr/reconciliacion — conciliación de PROVENIENCIA de los pagos:
//  • por fuente: MANUAL (registrado a mano) vs STRIPE (stripe_payment_id presente).
//  • huérfanos: pagos de Stripe SIN suscripción ligada (subscription_id null) →
//    entró dinero pero no se sabe a qué licencia; hay que ligarlo.
//  • sin contacto: pagos con empresa pero sin contact_id → no aparecen en el 360
//    de ningún contacto.
// (Distinto de conciliacion.ts, que descubre CUENTAS con ventas sin suscripción.)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabase.from('payments')
      .select('id, fecha, monto, metodo, referencia, stripe_payment_id, subscription_id, contact_id, company_id, companies(id, nombre), subscriptions(nombre_plan)')
      .order('fecha', { ascending: false }).limit(5000);
    if (error) throw error;
    const rows = data || [];

    const por_fuente = { manual: { count: 0, monto: 0 }, stripe: { count: 0, monto: 0 } };
    const stripe_sin_sub: any[] = [];
    const sin_contacto: any[] = [];
    for (const p of rows as any[]) {
      const esStripe = !!p.stripe_payment_id;
      const b = esStripe ? por_fuente.stripe : por_fuente.manual;
      b.count += 1; b.monto += Number(p.monto) || 0;
      if (esStripe && !p.subscription_id) stripe_sin_sub.push(p);
      if (!p.contact_id && p.company_id) sin_contacto.push(p);
    }
    por_fuente.manual.monto = r2(por_fuente.manual.monto);
    por_fuente.stripe.monto = r2(por_fuente.stripe.monto);

    return new Response(JSON.stringify({
      total: rows.length,
      por_fuente,
      stripe_sin_sub: stripe_sin_sub.slice(0, 50),
      sin_contacto: sin_contacto.slice(0, 50),
      n_stripe_sin_sub: stripe_sin_sub.length,
      n_sin_contacto: sin_contacto.length,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
};
