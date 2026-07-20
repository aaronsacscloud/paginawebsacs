// GET /api/crm/arr/payments — listado PLANO de todos los pagos del CRM (sistema ARR),
// con join a company / contact / subscription. Es la base de la vista "Pagos": permite
// ver cada pago con su TIPO (metodo) y su CONCEPTO (plan de la suscripción), por contacto.
//
// Filtros (querystring): company_id, contact_id, subscription_id, metodo, estado,
//   desde (YYYY-MM-DD), hasta, q (busca en referencia). Paginación: limit, offset.
// Devuelve: { payments[], total, porTipo{ metodo: {count, monto} } }
//   porTipo se calcula sobre TODO el set filtrado (no solo la página) para el resumen.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

type Filters = {
  company_id?: string; contact_id?: string; subscription_id?: string;
  metodo?: string; estado?: string; desde?: string; hasta?: string; q?: string;
};

function applyFilters(query: any, f: Filters) {
  if (f.company_id) query = query.eq('company_id', f.company_id);
  if (f.contact_id) query = query.eq('contact_id', f.contact_id);
  if (f.subscription_id) query = query.eq('subscription_id', f.subscription_id);
  if (f.metodo) query = query.eq('metodo', f.metodo);
  if (f.estado) query = query.eq('estado', f.estado);
  if (f.desde) query = query.gte('fecha', f.desde);
  if (f.hasta) query = query.lte('fecha', f.hasta);
  if (f.q) query = query.ilike('referencia', `%${f.q}%`);
  return query;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const f: Filters = {
    company_id: p.get('company_id') || undefined,
    contact_id: p.get('contact_id') || undefined,
    subscription_id: p.get('subscription_id') || undefined,
    metodo: p.get('metodo') || undefined,
    estado: p.get('estado') || undefined,
    desde: p.get('desde') || undefined,
    hasta: p.get('hasta') || undefined,
    q: (p.get('q') || '').trim() || undefined,
  };
  const limit = Math.min(Number(p.get('limit') || 200), 1000);
  const offset = Math.max(0, Number(p.get('offset') || 0));

  try {
    // ── Página de pagos con sus relaciones (a-uno vía FK) ──
    let listQ = supabase.from('payments')
      .select(
        'id, fecha, monto, metodo, referencia, estado, numero_acuse, comprobante_url, notas, periodo_cubierto, stripe_payment_id, subscription_id, company_id, contact_id, migrado, ' +
        'companies(id, nombre, sacs_account), contacts(id, nombre, apellido, email), subscriptions(id, nombre_plan, ciclo)',
        { count: 'exact' }
      )
      .order('fecha', { ascending: false });
    listQ = applyFilters(listQ, f).range(offset, offset + limit - 1);
    const { data, error, count } = await listQ;
    if (error) throw error;

    // ── Resumen por TIPO (metodo) sobre TODO el set filtrado ──
    let aggQ = supabase.from('payments').select('metodo, monto');
    aggQ = applyFilters(aggQ, f).limit(5000);
    const { data: aggData } = await aggQ;
    const porTipo: Record<string, { count: number; monto: number }> = {};
    (aggData || []).forEach((row: any) => {
      const m = String(row.metodo || 'otro').toLowerCase();
      if (!porTipo[m]) porTipo[m] = { count: 0, monto: 0 };
      porTipo[m].count += 1;
      porTipo[m].monto += Number(row.monto) || 0;
    });
    Object.keys(porTipo).forEach((k) => { porTipo[k].monto = r2(porTipo[k].monto); });

    return new Response(
      JSON.stringify({ payments: data || [], total: count ?? (data || []).length, porTipo }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
};
