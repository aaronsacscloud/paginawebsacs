// GET  /api/crm/arr/diagnostico-relaciones  → reporte de relaciones rotas.
// POST /api/crm/arr/diagnostico-relaciones  { dry_run } → repara las seguras.
//
// Problema: hay clientes (companies con suscripción) que salen "sin contacto"
// porque NINGÚN `contacts.company_id` apunta a esa empresa. Pero la relación SÍ
// existe en otro lado: la suscripción referencia un `contact_id` (contacto que
// no quedó ligado a la empresa), o coinciden por `stripe_customer_id`.
//
// El diagnóstico clasifica cada cliente-sin-contacto:
//   reparable_sub    → una suscripción referencia un contacto libre → ligarlo.
//   reparable_stripe → el stripe_customer_id de la empresa coincide con un
//                      contacto libre → ligarlo.
//   conflicto        → el contacto de la suscripción ya pertenece a OTRA empresa.
//   sin_candidato    → no hay a quién ligar (falta capturar el contacto).
// La reparación (POST, dry_run=true por defecto) solo aplica los dos "reparable".
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const KEY = 'sacs-arr-2026';

async function cargar() {
  const [companies, subs, contacts] = await Promise.all([
    supabase.from('companies').select('id, nombre, sacs_account, stripe_customer_id').is('archived_at', null).range(0, 9999),
    supabase.from('subscriptions').select('id, company_id, contact_id, estado, arr').range(0, 9999),
    supabase.from('contacts').select('id, nombre, email, company_id, stripe_customer_id').is('archived_at', null).range(0, 9999),
  ]);
  return { companies: companies.data || [], subs: subs.data || [], contacts: contacts.data || [] };
}

function analizar(companies: any[], subs: any[], contacts: any[]) {
  const contactById = new Map<string, any>();
  const contactsByCompany = new Map<string, any[]>();
  const contactByStripe = new Map<string, any>();
  for (const c of contacts) {
    contactById.set(c.id, c);
    if (c.company_id) { const a = contactsByCompany.get(c.company_id) || []; a.push(c); contactsByCompany.set(c.company_id, a); }
    if (c.stripe_customer_id) contactByStripe.set(c.stripe_customer_id, c);
  }
  const subsByCompany = new Map<string, any[]>();
  for (const s of subs) { if (!s.company_id) continue; const a = subsByCompany.get(s.company_id) || []; a.push(s); subsByCompany.set(s.company_id, a); }

  const companyById = new Map<string, any>();
  for (const co of companies) companyById.set(co.id, co);

  const reparables: any[] = [];   // { company, contact, via }  → ligar contact.company_id
  const conflictos: any[] = [];
  const sinCandidato: any[] = [];

  for (const co of companies) {
    const misSubs = subsByCompany.get(co.id) || [];
    if (misSubs.length === 0) continue;                 // no es "cliente real"
    if ((contactsByCompany.get(co.id) || []).length > 0) continue; // ya tiene contacto

    // Candidato 1: contacto referenciado por alguna suscripción.
    let elegido: any = null, via = '';
    for (const s of misSubs) {
      if (!s.contact_id) continue;
      const c = contactById.get(s.contact_id);
      if (!c) continue;
      if (!c.company_id) { elegido = c; via = 'reparable_sub'; break; }
      if (c.company_id !== co.id) { conflictos.push({ company_id: co.id, empresa: co.nombre, contact_id: c.id, contacto: c.nombre, pertenece_a: companyById.get(c.company_id)?.nombre || c.company_id }); }
    }
    // Candidato 2: por stripe_customer_id de la empresa.
    if (!elegido && co.stripe_customer_id) {
      const c = contactByStripe.get(co.stripe_customer_id);
      if (c && !c.company_id) { elegido = c; via = 'reparable_stripe'; }
    }

    if (elegido) reparables.push({ company_id: co.id, empresa: co.nombre, sacs_account: co.sacs_account, contact_id: elegido.id, contacto: elegido.nombre, email: elegido.email, via });
    else if (!conflictos.some((x) => x.company_id === co.id)) sinCandidato.push({ company_id: co.id, empresa: co.nombre, sacs_account: co.sacs_account, subs: misSubs.length });
  }

  const huerfanos = contacts.filter((c) => !c.company_id).length;
  const subsSinContacto = subs.filter((s) => s.company_id && !s.contact_id).length;
  const clientesSinContacto = reparables.length + conflictos.length + sinCandidato.length;

  return {
    resumen: {
      companies_total: companies.length,
      contactos_total: contacts.length,
      contactos_huerfanos_sin_empresa: huerfanos,
      suscripciones_sin_contacto: subsSinContacto,
      clientes_sin_contacto: clientesSinContacto,
      reparables: reparables.length,
      conflictos: conflictos.length,
      sin_candidato: sinCandidato.length,
    },
    reparables, conflictos, sin_candidato: sinCandidato,
  };
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  const { companies, subs, contacts } = await cargar();
  return new Response(JSON.stringify(analizar(companies, subs, contacts)), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, url }) => {
  if (url.searchParams.get('key') !== KEY) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  const body = await request.json().catch(() => ({} as any));
  const dryRun = body.dry_run !== false; // default TRUE
  const { companies, subs, contacts } = await cargar();
  const rep = analizar(companies, subs, contacts);

  let ligados = 0; const errores: string[] = [];
  if (!dryRun) {
    for (const r of rep.reparables) {
      const { error } = await supabase.from('contacts').update({ company_id: r.company_id }).eq('id', r.contact_id);
      if (error) errores.push(`${r.empresa}: ${error.message}`); else ligados++;
    }
  }
  return new Response(JSON.stringify({ dry_run: dryRun, por_ligar: rep.reparables.length, ligados, errores, resumen: rep.resumen, conflictos: rep.conflictos, sin_candidato: rep.sin_candidato }), { headers: { 'Content-Type': 'application/json' } });
};
