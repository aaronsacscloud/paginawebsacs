// POST /api/crm/arr/cleanup-test?key=... — borra contactos de PRUEBA/spam del
// CRM (y sus deals, actividades y companies placeholder). Solo actúa sobre los
// contact_ids que recibe explícitamente; NUNCA borra nada con suscripciones o
// pagos (guard), para que un id equivocado no pueda tirar un cliente real.
// Body: { contact_ids: string[], dry?: boolean }
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

  const out = { contactos: 0, deals: 0, activities: 0, companies: 0, saltados: [] as any[] };
  const companiesTocadas = new Set<string>();

  for (const id of ids) {
    const { data: c } = await supabase.from('contacts').select('id, nombre, email, company_id').eq('id', id).maybeSingle();
    if (!c) { out.saltados.push({ id, motivo: 'no existe' }); continue; }
    // guard: nada que tenga subs o pagos se toca
    const { count: nSubs } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('contact_id', id);
    const { count: nPagos } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('contact_id', id);
    if ((nSubs || 0) > 0 || (nPagos || 0) > 0) { out.saltados.push({ id, nombre: c.nombre, motivo: 'tiene subs/pagos' }); continue; }

    if (!dry) {
      const { count: dDeals } = await supabase.from('deals').delete({ count: 'exact' }).eq('contact_id', id);
      const { count: dActs } = await supabase.from('activities').delete({ count: 'exact' }).eq('contact_id', id);
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
