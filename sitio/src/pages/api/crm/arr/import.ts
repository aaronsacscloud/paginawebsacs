// POST /api/crm/arr/import?key=... — migra suscripciones (del Excel normalizado)
// a contacts/companies/subscriptions/payments. Idempotente por (email+plan+ciclo):
// re-correr actualiza en lugar de duplicar. Body: { rows: [...] } donde cada row:
// { nombre_plan, ciclo, contacto_nombre, email, sacs_account, estado, precio,
//   mrr, arr, fecha_inicio, proxima_factura, monto_proximo, pagos_realizados,
//   total_pagado, razon_cancelacion, notas }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const KEY = 'sacs-arr-2026';

type Row = {
  nombre_plan: string; ciclo: 'mensual' | 'anual';
  contacto_nombre?: string; email?: string; sacs_account?: string;
  estado: string; precio: number; mrr: number; arr: number;
  fecha_inicio?: string | null; proxima_factura?: string | null;
  monto_proximo?: number | null; pagos_realizados?: number; total_pagado?: number;
  razon_cancelacion?: string | null; notas?: string | null;
};

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response('Forbidden', { status: 403 });

  let body: { rows?: Row[] };
  try { body = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return new Response(JSON.stringify({ error: 'rows vacío' }), { status: 400 });

  const out = { creadas: 0, actualizadas: 0, companies_creadas: 0, contacts_creados: 0, pagos_sembrados: 0, errores: [] as string[] };

  for (const r of rows) {
    try {
      const email = (r.email || '').trim().toLowerCase();

      // ── company por sacs_account, o por nombre; crea si no existe ──
      let companyId: string | null = null;
      const acct = (r.sacs_account || '').trim().toLowerCase() || null;
      if (acct) {
        const { data: co } = await supabase.from('companies').select('id').eq('sacs_account', acct).maybeSingle();
        if (co) companyId = co.id;
      }
      if (!companyId) {
        const nombreEmpresa = acct || r.contacto_nombre || r.nombre_plan;
        const { data: co2 } = await supabase.from('companies').select('id, sacs_account').ilike('nombre', nombreEmpresa).maybeSingle();
        if (co2) {
          companyId = co2.id;
          if (acct && !co2.sacs_account) await supabase.from('companies').update({ sacs_account: acct }).eq('id', co2.id);
        }
      }
      if (!companyId) {
        const { data: nco, error: coe } = await supabase.from('companies').insert({
          nombre: (acct || r.contacto_nombre || r.nombre_plan).slice(0, 120),
          sacs_account: acct,
          billing_period: r.ciclo,
          estado_cuenta: r.estado === 'activa' ? 'activo' : (r.estado === 'cancelada' ? 'cancelado' : (r.estado === 'pausada' ? 'pausado' : 'vencido')),
          fecha_inicio: r.fecha_inicio || null,
          fecha_renovacion: r.proxima_factura || null,
        }).select('id').single();
        if (coe) throw new Error('company: ' + coe.message);
        companyId = nco.id; out.companies_creadas++;
      }

      // ── contacto por email (reusa el del CRM; liga a la company) ──
      let contactId: string | null = null;
      if (email) {
        const { data: c } = await supabase.from('contacts').select('id, company_id').ilike('email', email).maybeSingle();
        if (c) {
          contactId = c.id;
          if (!c.company_id) await supabase.from('contacts').update({ company_id: companyId }).eq('id', c.id);
        } else {
          const { data: nc, error: ce } = await supabase.from('contacts')
            .insert({ nombre: r.contacto_nombre || email, email, tipo: r.estado === 'cancelada' ? 'churned' : 'cliente', lifecycle_stage: r.estado === 'cancelada' ? 'churned' : 'cliente', company_id: companyId })
            .select('id').single();
          if (!ce && nc) { contactId = nc.id; out.contacts_creados++; }
        }
      }

      // ── suscripción idempotente por (company, plan, ciclo) ──
      const subData = {
        company_id: companyId, contact_id: contactId,
        nombre_plan: r.nombre_plan, ciclo: r.ciclo, estado: r.estado,
        precio: r.precio || 0, mrr: r.mrr || 0, arr: r.arr || 0,
        fecha_inicio: r.fecha_inicio || null, proxima_factura: r.proxima_factura || null,
        monto_proximo: r.monto_proximo ?? null,
        pagos_realizados: r.pagos_realizados || 0, total_pagado: r.total_pagado || 0,
        razon_cancelacion: r.razon_cancelacion || null, notas: r.notas || null,
        migrada_de_excel: true, updated_at: new Date().toISOString(),
      };
      const { data: exist } = await supabase.from('subscriptions').select('id')
        .eq('company_id', companyId).eq('nombre_plan', r.nombre_plan).eq('ciclo', r.ciclo).maybeSingle();
      let subId: string;
      if (exist) {
        const { error: ue } = await supabase.from('subscriptions').update(subData).eq('id', exist.id);
        if (ue) throw new Error('sub update: ' + ue.message);
        subId = exist.id; out.actualizadas++;
      } else {
        const { data: ns, error: ie } = await supabase.from('subscriptions').insert(subData).select('id').single();
        if (ie) throw new Error('sub insert: ' + ie.message);
        subId = ns.id; out.creadas++;
      }

      // ── pago histórico agregado (una sola fila 'migrado' con el total) ──
      if ((r.total_pagado || 0) > 0) {
        const { data: yaPagado } = await supabase.from('payments').select('id')
          .eq('subscription_id', subId).eq('migrado', true).maybeSingle();
        if (!yaPagado) {
          const { error: pe } = await supabase.from('payments').insert({
            fecha: r.fecha_inicio || new Date().toISOString().slice(0, 10),
            monto: r.total_pagado, metodo: 'transferencia',
            contact_id: contactId, company_id: companyId, subscription_id: subId,
            migrado: true,
            notas: 'Histórico migrado del Excel: ' + (r.pagos_realizados || 0) + ' pago(s) agregados.',
          });
          if (!pe) out.pagos_sembrados++;
        }
      }

      // ── actualizar agregados de la company (suma de sus suscripciones activas) ──
      const { data: subsCo } = await supabase.from('subscriptions')
        .select('mrr, arr, estado, proxima_factura').eq('company_id', companyId);
      const activas = (subsCo || []).filter(s => s.estado === 'activa');
      const coMrr = activas.reduce((a, s) => a + Number(s.mrr || 0), 0);
      const proximas = activas.map(s => s.proxima_factura).filter(Boolean).sort();
      await supabase.from('companies').update({
        mrr: Math.round(coMrr * 100) / 100,
        arr: Math.round(coMrr * 12 * 100) / 100,
        fecha_renovacion: proximas[0] || null,
        estado_cuenta: activas.length ? 'activo'
          : ((subsCo || []).some(s => s.estado === 'pendiente_pago' || s.estado === 'programada') ? 'vencido'
          : ((subsCo || []).some(s => s.estado === 'pausada') ? 'pausado' : 'cancelado')),
      }).eq('id', companyId);
    } catch (e: any) {
      out.errores.push((r.nombre_plan || '?') + ' / ' + (r.email || r.sacs_account || '?') + ': ' + (e?.message || String(e)));
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
