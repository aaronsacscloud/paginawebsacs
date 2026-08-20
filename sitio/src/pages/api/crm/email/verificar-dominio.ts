// POST /api/crm/email/verificar-dominio — pide a SendGrid que revise el DNS.
//
// El asistente de configuración necesita responder "¿ya quedó?" sin que nadie
// entre al panel de SendGrid. GET lista los registros que faltan crear; POST
// dispara la validación real y devuelve qué pasó registro por registro.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const KEY = () => (import.meta.env.SENDGRID_API_KEY || '').trim();

/** Los CNAME de un dominio autenticado, en forma copiable. */
function registros(dns: any) {
  return Object.values(dns || {}).map((r: any) => ({
    tipo: String(r.type || 'cname').toUpperCase(),
    host: r.host,
    valor: r.data,
    valido: !!r.valid,
  }));
}

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  if (!KEY()) return json({ error: 'Falta SENDGRID_API_KEY en el entorno.' }, 500);
  if (!t.sendgrid_domain_id) return json({ dominio: null, registros: [], valido: false });

  const r = await fetch(`https://api.sendgrid.com/v3/whitelabel/domains/${t.sendgrid_domain_id}`, {
    headers: { Authorization: `Bearer ${KEY()}` },
  });
  if (!r.ok) return json({ error: `SendGrid ${r.status}` }, 502);
  const d = await r.json();
  return json({ dominio: `${d.subdomain}.${d.domain}`, valido: !!d.valid, registros: registros(d.dns) });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  if (!KEY()) return json({ error: 'Falta SENDGRID_API_KEY en el entorno.' }, 500);

  const body = await request.json().catch(() => ({} as any));

  // Alta de un dominio nuevo (un partner autenticando el suyo).
  if (body?.dominio && !t.sendgrid_domain_id) {
    const partes = String(body.dominio).trim().toLowerCase().split('.');
    const alta = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: partes.join('.'), subdomain: 'em', automatic_security: true }),
    });
    if (!alta.ok) return json({ error: `SendGrid ${alta.status}: ${(await alta.text()).slice(0, 200)}` }, 502);
    const d = await alta.json();
    await supabase.from('email_tenants').update({ sendgrid_domain_id: String(d.id) }).eq('id', t.id);
    return json({ creado: true, dominio: `${d.subdomain}.${d.domain}`, valido: false, registros: registros(d.dns) });
  }

  if (!t.sendgrid_domain_id) return json({ error: 'No hay dominio que verificar.' }, 400);

  const v = await fetch(`https://api.sendgrid.com/v3/whitelabel/domains/${t.sendgrid_domain_id}/validate`, {
    method: 'POST', headers: { Authorization: `Bearer ${KEY()}` },
  });
  const res = await v.json().catch(() => ({}));
  const detalle = res?.validation_results || {};
  return json({
    valido: !!res?.valid,
    registros: Object.entries(detalle).map(([k, val]: [string, any]) => ({
      nombre: k, valido: !!val?.valid, razon: val?.reason || null,
    })),
  });
};
