// /api/crm/arr/link-suggestions — para las suscripciones ACTIVAS sin cuenta
// SACS ligada ($256k ARR ciego): sugiere la cuenta por el email del contacto
// (sacsusers vía sacs_api). POST aplica la liga elegida.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';

export const GET: APIRoute = async () => {
  const { data: subs, error } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, estado, arr, company_id, companies(id, nombre, sacs_account), contacts(id, nombre, email)')
    .neq('estado', 'cancelada');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const ciegas = (subs || []).filter((s: any) => !s.companies?.sacs_account);
  const emails = [...new Set(ciegas.map((s: any) => s.contacts?.email).filter(Boolean))].slice(0, 30);

  let porEmail: Record<string, string[]> = {};
  if (emails.length) {
    try {
      const res = await fetch(SACS_API + '/interno/crm/buscar-por-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ emails }),
      });
      if (res.ok) porEmail = (await res.json()).data || {};
    } catch { /* sin sugerencias, la UI permite escribir la cuenta a mano */ }
  }

  const data = ciegas.map((s: any) => ({
    subscription_id: s.id, nombre_plan: s.nombre_plan, ciclo: s.ciclo, estado: s.estado, arr: s.arr,
    company_id: s.company_id, empresa: s.companies?.nombre || '—',
    contacto: s.contacts?.nombre || null, email: s.contacts?.email || null,
    sugerencias: s.contacts?.email ? (porEmail[String(s.contacts.email).toLowerCase()] || []) : [],
  }));
  return new Response(JSON.stringify({ ciegas: data.length, arr_ciego: data.filter(d => d.estado === 'activa').reduce((a, d) => a + Number(d.arr || 0), 0), data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const companyId = body?.company_id;
  const cuenta = String(body?.sacs_account || '').trim().toLowerCase();
  if (!companyId || !cuenta) return new Response(JSON.stringify({ error: 'company_id y sacs_account requeridos' }), { status: 400 });

  // Si otra company ya tiene esa cuenta, avisar (evita partir al cliente en dos)
  const { data: dueña } = await supabase.from('companies').select('id, nombre').eq('sacs_account', cuenta).neq('id', companyId).maybeSingle();
  if (dueña) return new Response(JSON.stringify({ error: `La cuenta ${cuenta} ya está ligada a "${dueña.nombre}". Une los clientes en lugar de duplicar.` }), { status: 409 });

  const { error } = await supabase.from('companies').update({ sacs_account: cuenta }).eq('id', companyId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  await supabase.from('activities').insert({
    tipo: 'sistema', titulo: `Cuenta SACS ligada: ${cuenta}`, company_id: companyId, automatico: true,
    metadata: { link_suggestion: true },
  }).select().maybeSingle();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
