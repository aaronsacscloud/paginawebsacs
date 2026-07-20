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

function normalizar(body: any) {
  const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensual';
  const precio = Number(body.precio) || 0;
  const mrr = ciclo === 'anual' ? precio / 12 : precio;
  return {
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
    monto_proximo: body.monto_proximo != null ? Number(body.monto_proximo) : precio,
    razon_cancelacion: body.razon_cancelacion || null,
    notas: body.notas || null,
    stripe_subscription_id: body.stripe_subscription_id ? String(body.stripe_subscription_id).trim() : null,
    updated_at: new Date().toISOString(),
  };
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

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });
  const { data: prev } = await supabase.from('subscriptions').select('estado, precio, proxima_factura, nombre_plan, company_id').eq('id', body.id).maybeSingle();
  const upd: any = normalizar(body);
  delete upd.company_id; // la suscripción no cambia de empresa por edición
  if (body.estado === 'cancelada') upd.cancelada_at = new Date().toISOString();
  const { data, error } = await supabase.from('subscriptions').update(upd).eq('id', body.id).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  // Auditoría: qué cambió (estado/precio/fecha) queda en el timeline del cliente
  if (prev) {
    const cambios: string[] = [];
    if (prev.estado !== data.estado) cambios.push(`estado ${prev.estado}→${data.estado}`);
    if (Number(prev.precio) !== Number(data.precio)) cambios.push(`precio $${Number(prev.precio).toLocaleString('es-MX')}→$${Number(data.precio).toLocaleString('es-MX')}`);
    if (prev.proxima_factura !== data.proxima_factura) cambios.push(`próx. factura ${prev.proxima_factura || '—'}→${data.proxima_factura || '—'}`);
    if (cambios.length) {
      await supabase.from('activities').insert({
        tipo: 'sistema', titulo: `Suscripción editada (${data.nombre_plan}): ${cambios.join(' · ')}` + (body.razon_cancelacion ? ` · razón: ${body.razon_cancelacion}` : ''),
        company_id: data.company_id, automatico: true, metadata: { audit: 'sub_update', subscription_id: data.id, cambios },
      }).select().maybeSingle();
    }
  }
  await recalcCompany(data.company_id);
  // churn_event al cancelar (alimenta las métricas de churn existentes)
  if (body.estado === 'cancelada') {
    await supabase.from('churn_events').insert({
      company_id: data.company_id, mrr_lost: data.mrr,
      reason: body.razon_cancelacion || 'sin razón registrada',
      cancelled_at: new Date().toISOString(),
    }).select().maybeSingle();
  }
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
