// GET /api/crm/arr/company360?id=<company_id> — todo el detalle del cliente en
// un fetch: empresa + actividad SACS, suscripciones, pagos y notas/timeline.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });

  const [co, subs, pays, acts, contacts] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('subscriptions').select('*').eq('company_id', id).order('created_at'),
    supabase.from('payments').select('*').eq('company_id', id).order('fecha', { ascending: false }).limit(100),
    supabase.from('activities').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('contacts').select('id, nombre, email, whatsapp').eq('company_id', id).limit(10),
  ]);
  if (co.error) return new Response(JSON.stringify({ error: co.error.message }), { status: 404 });

  const activas = (subs.data || []).filter(s => s.estado === 'activa');
  const resumen = {
    subs_activas: activas.length,
    arr: activas.reduce((a, s) => a + Number(s.arr || 0), 0),
    mrr: activas.reduce((a, s) => a + Number(s.mrr || 0), 0),
    pagos_totales: (subs.data || []).reduce((a, s) => a + Number(s.pagos_realizados || 0), 0),
    total_pagado: (subs.data || []).reduce((a, s) => a + Number(s.total_pagado || 0), 0),
    proxima_factura: activas.map(s => s.proxima_factura).filter(Boolean).sort()[0] || null,
  };

  return new Response(JSON.stringify({
    company: co.data,
    resumen,
    subscriptions: subs.data || [],
    payments: pays.data || [],
    activities: acts.data || [],
    contacts: contacts.data || [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
