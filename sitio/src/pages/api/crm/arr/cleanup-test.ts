// POST /api/crm/arr/cleanup-test?key=... — borra contactos de PRUEBA/spam del
// CRM (y sus deals, actividades y companies placeholder). Solo actúa sobre los
// contact_ids que recibe explícitamente; NUNCA borra nada con suscripciones o
// pagos (guard), para que un id equivocado no pueda tirar un cliente real.
// Body: { contact_ids: string[], payment_ids?: string[], dry?: boolean }
// payment_ids: pagos del SEED DEMO a borrar explícitos (id por id, nunca por
// query amplio) — necesario porque el guard de subs/pagos bloquea al contacto
// mientras existan.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const KEY = import.meta.env.CRM_ADMIN_KEY || 'sacs-arr-2026';

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.contact_ids) ? body.contact_ids : [];
  const dry = !!body?.dry;
  if (!ids.length) return new Response(JSON.stringify({ error: 'contact_ids vacío' }), { status: 400 });

  const payIds: string[] = Array.isArray(body?.payment_ids) ? body.payment_ids : [];
  const out = { contactos: 0, deals: 0, activities: 0, companies: 0, pagos: 0, saltados: [] as any[] };
  const companiesTocadas = new Set<string>();

  for (const pid of payIds) {
    // solo pagos sueltos del demo: sin subscription_id y no migrados del Excel
    const { data: p } = await supabase.from('payments').select('id, subscription_id, migrado').eq('id', pid).maybeSingle();
    if (!p) { out.saltados.push({ id: pid, motivo: 'pago no existe' }); continue; }
    if (p.subscription_id || p.migrado) { out.saltados.push({ id: pid, motivo: 'pago ligado a sub real/migrado' }); continue; }
    if (!dry) {
      const { error } = await supabase.from('payments').delete().eq('id', pid);
      if (error) { out.saltados.push({ id: pid, motivo: error.message }); continue; }
    }
    out.pagos++;
  }

  for (const id of ids) {
    const { data: c } = await supabase.from('contacts').select('id, nombre, email, company_id').eq('id', id).maybeSingle();
    if (!c) { out.saltados.push({ id, motivo: 'no existe' }); continue; }
    // guard: nada que tenga subs o pagos se toca
    const { count: nSubs } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('contact_id', id);
    const { count: nPagos } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('contact_id', id);
    if ((nSubs || 0) > 0 || (nPagos || 0) > 0) { out.saltados.push({ id, nombre: c.nombre, motivo: 'tiene subs/pagos' }); continue; }

    if (!dry) {
      // orden por FKs: primero las activities colgadas de sus deals (deal_id),
      // luego las del contacto, luego los deals y al final el contacto.
      const { data: dealRows } = await supabase.from('deals').select('id').eq('contact_id', id);
      for (const dr of dealRows || []) await supabase.from('activities').delete().eq('deal_id', dr.id);
      const { count: dActs } = await supabase.from('activities').delete({ count: 'exact' }).eq('contact_id', id);
      const { count: dDeals, error: eDeals } = await supabase.from('deals').delete({ count: 'exact' }).eq('contact_id', id);
      if (eDeals) { out.saltados.push({ id, nombre: c.nombre, motivo: 'deals: ' + eDeals.message }); continue; }
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) { out.saltados.push({ id, nombre: c.nombre, motivo: error.message }); continue; }
      out.deals += dDeals || 0;
      out.activities += dActs || 0;
    }
    out.contactos++;
    if (c.company_id) companiesTocadas.add(c.company_id);
  }

  // companies placeholder: sin contactos restantes, sin subs y sin pagos → fuera
  for (const coId of companiesTocadas) {
    const { count: nC } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', coId);
    const { count: nS } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('company_id', coId);
    const { count: nP } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('company_id', coId);
    if ((nC || 0) === 0 && (nS || 0) === 0 && (nP || 0) === 0) {
      if (!dry) {
        await supabase.from('deals').delete().eq('company_id', coId);
        await supabase.from('activities').delete().eq('company_id', coId);
        const { error } = await supabase.from('companies').delete().eq('id', coId);
        if (error) continue;
      }
      out.companies++;
    }
  }

  return new Response(JSON.stringify({ dry, ...out }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
