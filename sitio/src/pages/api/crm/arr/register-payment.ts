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
import { recordDelta } from '../../../../lib/crm/mrr-ledger';

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
        // Fase 4 — RR/partner: solo se incluye si viene en el body, para no romper el
        // insert mientras la columna partner_id no exista (exec_sql no está disponible;
        // se agrega manual en el SQL Editor de Supabase con scripts/migration-...).
        ...(body.partner_id ? { partner_id: body.partner_id } : {}),
      }).select('*').single();
      if (se) throw new Error('subscription: ' + se.message);
      sub = ns;
    }

    // ── 2 · Registrar el pago ──
    const periodo = sub.ciclo === 'anual' ? fecha.slice(0, 4) : fecha.slice(0, 7);

    // Dedupe: mismo monto para la misma sub en el mismo periodo = casi seguro el
    // mismo cobro capturado dos veces (manual + webhook de Stripe, o doble clic).
    // Sin este guard el total_pagado se duplica y la proxima_factura se recorre
    // DOS ciclos. Se puede insistir con forzar:true (p. ej. dos pagos legítimos
    // iguales el mismo mes).
    if (body.subscription_id && !body.forzar) {
      const { data: dup } = await supabase.from('payments').select('id, fecha')
        .eq('subscription_id', sub.id).eq('periodo_cubierto', periodo).eq('monto', r2(monto))
        .limit(1).maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({
          error: `Ya existe un pago de $${r2(monto).toLocaleString('es-MX')} para esta suscripción en el periodo ${periodo} (${dup.fecha}). Si es un pago distinto legítimo, reenvía con forzar: true.`,
          payment_id: dup.id, duplicado: true,
        }), { status: 409 });
      }
    }

    // Aviso de pago parcial (no bloquea — la política de parciales es decisión
    // de negocio pendiente): que al menos quede visible en el timeline.
    const esperado = Number(sub.monto_proximo ?? sub.precio) || 0;
    const esParcial = body.subscription_id && esperado > 0 && monto < esperado * 0.99;

    const { data: pago, error: pe } = await supabase.from('payments').insert({
      fecha, monto: r2(monto),
      metodo: normMetodo(body.metodo),
      referencia: body.referencia || null,
      notas: body.notas || null,
      company_id: sub.company_id, contact_id: sub.contact_id,
      subscription_id: sub.id, periodo_cubierto: periodo,
      // Fase 4 — atribución RR: solo si hay partner (body o sub), para no romper el
      // insert mientras la columna partner_id no exista.
      ...((body.partner_id || sub.partner_id) ? { partner_id: body.partner_id || sub.partner_id } : {}),
    }).select('id').single();
    if (pe) throw new Error('payment: ' + pe.message);

    // ── 3 · Activar y recorrer la suscripción ──
    // Si había un cambio de ciclo/precio programado "al renovar", este cobro lo
    // promueve: el ciclo nuevo aplica desde ahora (es la renovación).
    const cicloEfectivo: 'mensual' | 'anual' = (sub.ciclo_siguiente === 'anual' || sub.ciclo_siguiente === 'mensual') ? sub.ciclo_siguiente : sub.ciclo;
    const precioEfectivo = sub.precio_siguiente != null ? Number(sub.precio_siguiente) : Number(sub.precio);
    const promoverCiclo = cicloEfectivo !== sub.ciclo || precioEfectivo !== Number(sub.precio);
    const base = (sub.proxima_factura && sub.proxima_factura >= fecha) ? sub.proxima_factura : fecha;
    const updSub: any = {
      estado: 'activa',
      proxima_factura: addCiclo(base, cicloEfectivo),
      pagos_realizados: Number(sub.pagos_realizados || 0) + 1,
      total_pagado: r2(Number(sub.total_pagado || 0) + monto),
      // Pagar renueva: si tenía cancelación "al vencer" pendiente, el pago la
      // revierte (si no, el cron la cancelaría al llegar la nueva fecha aunque
      // el cliente ya renovó y quedaría como churn falso).
      cancela_al_vencer: false,
      updated_at: new Date().toISOString(),
    };
    if (promoverCiclo) {
      const mrrNuevo = cicloEfectivo === 'anual' ? precioEfectivo / 12 : precioEfectivo;
      Object.assign(updSub, {
        ciclo: cicloEfectivo, precio: precioEfectivo, mrr: r2(mrrNuevo), arr: r2(mrrNuevo * 12),
        monto_proximo: precioEfectivo, ciclo_siguiente: null, precio_siguiente: null,
      });
    }
    let subRes = await supabase.from('subscriptions').update(updSub).eq('id', sub.id).select('*').single();
    if (subRes.error && /column .* does not exist|schema cache/i.test(subRes.error.message || '')) {
      // SQL-4 aún no aplicado: quitar columnas nuevas
      delete updSub.ciclo_siguiente; delete updSub.precio_siguiente; delete updSub.cancela_al_vencer;
      subRes = await supabase.from('subscriptions').update(updSub).eq('id', sub.id).select('*').single();
    }
    const { data: subUpd, error: ue } = subRes;
    if (ue) throw new Error('sub update: ' + ue.message);

    // ── 4 · Agregados de la company + last_payment ──
    await recalcCompany(sub.company_id);
    await supabase.from('companies').update({ last_payment_at: new Date().toISOString() }).eq('id', sub.company_id);

    // Ledger MRR. Aporte: activa/pendiente_pago cuentan (misma base que el
    // ledger). Así: programada→activa = alta; cancelada→activa = reactivación;
    // pendiente_pago→activa (recuperación de dunning) = sin movimiento (no es
    // negocio nuevo). Si el pago promovió ciclo/precio, el MRR nuevo lo captura.
    const mrrAntes = (sub.estado === 'activa' || sub.estado === 'pendiente_pago') ? Number(sub.mrr || 0) : 0;
    await recordDelta({
      subscription_id: sub.id, company_id: sub.company_id, fecha,
      mrr_anterior: mrrAntes, mrr_nuevo: Number(subUpd.mrr || 0),
      reactivacion: sub.estado === 'cancelada',
      motivo: promoverCiclo ? `pago + cambio a ${cicloEfectivo}` : 'pago registrado',
      actor: body.actor || 'admin',
    });

    // ── 5 · Actividad (timeline del cliente) ──
    await supabase.from('activities').insert({
      tipo: 'pago_recibido',
      titulo: `Pago registrado: $${r2(monto).toLocaleString('es-MX')} MXN — ${subUpd.nombre_plan} (${subUpd.ciclo})` + (esParcial ? ` ⚠️ PARCIAL (esperado $${r2(esperado).toLocaleString('es-MX')})` : ''),
      metadata: { payment_id: pago.id, subscription_id: sub.id, company_id: sub.company_id, periodo },
      company_id: sub.company_id, contact_id: sub.contact_id,
      automatico: true,
    }).select().maybeSingle();

    // ── 6 · Comisión del partner/RR (si la licencia está atribuida) ──
    // Extra "comisiones ligadas al pago": al abonar una licencia con partner_id, se
    // asienta la comisión (partner_commissions, tipo 'venta_directa', status 'earned')
    // = monto × default_commission_pct del partner. Best-effort: NUNCA rompe el pago.
    let comision: any = null;
    if (sub.partner_id) {
      try {
        const { data: pm } = await supabase.from('team_members').select('default_commission_pct').eq('id', sub.partner_id).maybeSingle();
        const pct = Number(pm?.default_commission_pct) || 0;
        if (pct > 0) {
          const { data: com } = await supabase.from('partner_commissions').insert({
            partner_id: sub.partner_id, tipo: 'venta_directa', deal_id: null,
            contact_id: sub.contact_id, rate_pct: pct, deal_value: r2(monto),
            commission_amount: r2(monto * pct / 100), status: 'earned',
            earned_at: new Date().toISOString(), payment_reference: pago.id,
          }).select('id, commission_amount').maybeSingle();
          comision = com || null;
        }
      } catch (e) { /* la comisión nunca bloquea el registro del pago */ }
    }

    return new Response(JSON.stringify({ ok: true, payment_id: pago.id, subscription: subUpd, comision, ...(esParcial ? { advertencia: `pago parcial: $${r2(monto)} de $${r2(esperado)} esperados` } : {}) }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
};
