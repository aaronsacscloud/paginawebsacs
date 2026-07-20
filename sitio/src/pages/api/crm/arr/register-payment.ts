// POST /api/crm/arr/register-payment — el flujo "agrego un pago y se activa el ARR".
// Sirve para cliente nuevo (crea company+contact+sub) y para renovación manual.
// Body: {
//   subscription_id?          — si existe: renovación/activación de esa sub
//   company_id? | empresa? + sacs_account? + contacto_nombre? + email?  — cliente nuevo
//   nombre_plan?, ciclo?, precio?                                       — sub nueva
//   monto, fecha?, metodo?, referencia?, notas?
// }
// Efectos: crea payment → sub pasa a 'activa' → recorre proxima_factura un ciclo
// → suma pagos_realizados/total_pagado → recalcula agregados de la company.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcCompany } from './subscriptions';

export const prerender = false;

const r2 = (n: number) => Math.round(n * 100) / 100;

function addCiclo(fecha: string, ciclo: 'mensual' | 'anual'): string {
  const d = new Date(fecha + 'T12:00:00Z');
  if (ciclo === 'anual') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Fase 5 — normaliza el tipo de pago a un set estándar (para agrupar "por tipo" con
// confianza). No hay CHECK en BD; se normaliza aquí al escribir.
function normMetodo(m: any): string {
  const s = String(m || 'transferencia').toLowerCase().trim();
  if (s === 'card' || s.includes('tarjeta')) return 'tarjeta';
  if (s.includes('stripe')) return 'stripe';
  if (s.includes('transfer') || s === 'spei') return 'transferencia';
  if (s === 'cash' || s.includes('efectivo')) return 'efectivo';
  if (s.includes('oxxo')) return 'oxxo';
  return ['transferencia', 'tarjeta', 'stripe', 'efectivo', 'oxxo', 'otro'].includes(s) ? s : 'otro';
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 });
  const monto = Number(body.monto);
  if (!isFinite(monto) || monto <= 0) return new Response(JSON.stringify({ error: 'monto requerido' }), { status: 400 });
  const fecha = body.fecha || new Date().toISOString().slice(0, 10);

  try {
    // ── 1 · Resolver suscripción (existente o crearla junto con company/contact) ──
    let sub: any = null;
    if (body.subscription_id) {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('id', body.subscription_id).single();
      if (error || !data) throw new Error('suscripción no encontrada');
      sub = data;
    } else {
      // cliente/sub nuevos
      let companyId = body.company_id || null;
      if (!companyId) {
        const nombreEmpresa = String(body.empresa || body.sacs_account || body.contacto_nombre || '').trim();
        if (!nombreEmpresa) throw new Error('empresa o company_id requeridos para cliente nuevo');
        const acct = (body.sacs_account || '').trim().toLowerCase() || null;
        if (acct) {
          const { data: co } = await supabase.from('companies').select('id').eq('sacs_account', acct).maybeSingle();
          if (co) companyId = co.id;
        }
        if (!companyId) {
          const { data: co2 } = await supabase.from('companies').select('id').ilike('nombre', nombreEmpresa).maybeSingle();
          if (co2) companyId = co2.id;
        }
        if (!companyId) {
          const { data: nco, error: coe } = await supabase.from('companies')
            .insert({ nombre: nombreEmpresa.slice(0, 120), sacs_account: acct, estado_cuenta: 'activo', fecha_inicio: fecha })
            .select('id').single();
          if (coe) throw new Error('company: ' + coe.message);
          companyId = nco.id;
        }
      }
      let contactId: string | null = null;
      const email = (body.email || '').trim().toLowerCase();
      if (email) {
        const { data: c } = await supabase.from('contacts').select('id').ilike('email', email).maybeSingle();
        if (c) contactId = c.id;
        else {
          const { data: nc } = await supabase.from('contacts')
            .insert({ nombre: body.contacto_nombre || email, email, tipo: 'cliente', lifecycle_stage: 'cliente', company_id: companyId })
            .select('id').maybeSingle();
          contactId = nc?.id || null;
        }
      }
      const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensual';
      const precio = Number(body.precio) || monto;
      const mrr = ciclo === 'anual' ? precio / 12 : precio;
      const { data: ns, error: se } = await supabase.from('subscriptions').insert({
        company_id: companyId, contact_id: contactId,
        nombre_plan: String(body.nombre_plan || 'Licencia SACS').slice(0, 160),
        ciclo, estado: 'programada', precio,
        mrr: r2(mrr), arr: r2(mrr * 12),
        fecha_inicio: fecha, proxima_factura: fecha, monto_proximo: precio,
        partner_id: body.partner_id || null, // Fase 4 — RR/partner que vende la licencia
      }).select('*').single();
      if (se) throw new Error('subscription: ' + se.message);
      sub = ns;
    }

    // ── 2 · Registrar el pago ──
    const periodo = sub.ciclo === 'anual' ? fecha.slice(0, 4) : fecha.slice(0, 7);
    const { data: pago, error: pe } = await supabase.from('payments').insert({
      fecha, monto: r2(monto),
      metodo: normMetodo(body.metodo),
      referencia: body.referencia || null,
      notas: body.notas || null,
      company_id: sub.company_id, contact_id: sub.contact_id,
      subscription_id: sub.id, periodo_cubierto: periodo,
      partner_id: body.partner_id || sub.partner_id || null, // Fase 4 — atribución RR
    }).select('id').single();
    if (pe) throw new Error('payment: ' + pe.message);

    // ── 3 · Activar y recorrer la suscripción ──
    const base = (sub.proxima_factura && sub.proxima_factura >= fecha) ? sub.proxima_factura : fecha;
    const { data: subUpd, error: ue } = await supabase.from('subscriptions').update({
      estado: 'activa',
      proxima_factura: addCiclo(base, sub.ciclo),
      pagos_realizados: Number(sub.pagos_realizados || 0) + 1,
      total_pagado: r2(Number(sub.total_pagado || 0) + monto),
      updated_at: new Date().toISOString(),
    }).eq('id', sub.id).select('*').single();
    if (ue) throw new Error('sub update: ' + ue.message);

    // ── 4 · Agregados de la company + last_payment ──
    await recalcCompany(sub.company_id);
    await supabase.from('companies').update({ last_payment_at: new Date().toISOString() }).eq('id', sub.company_id);

    // ── 5 · Actividad (timeline del cliente) ──
    await supabase.from('activities').insert({
      tipo: 'pago_recibido',
      titulo: `Pago registrado: $${r2(monto).toLocaleString('es-MX')} MXN — ${subUpd.nombre_plan} (${subUpd.ciclo})`,
      metadata: { payment_id: pago.id, subscription_id: sub.id, company_id: sub.company_id, periodo },
      company_id: sub.company_id, contact_id: sub.contact_id,
      automatico: true,
    }).select().maybeSingle();

    return new Response(JSON.stringify({ ok: true, payment_id: pago.id, subscription: subUpd }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
};
