// POST /api/crm/deals/convertir-cotizacion  { deal_id }
// Convierte una OPORTUNIDAD (deal) en una COTIZACIÓN BORRADOR editable, con el
// plan/valor ya precargados, ligada al cliente/contacto y con back-ref
// deals.quote_id. Devuelve { quote_id, url } para abrir el editor.
// Al ENVIAR la cotización, el flujo existente (quotes PUT → advanceDealStage
// 'cotizacion_enviada') mueve la oportunidad solo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { calcQuoteTotals } from '../../../../lib/quotes/totals';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const dealId = String(body.deal_id || '').trim();
  if (!dealId) return json({ error: 'deal_id requerido' }, 400);

  // Deal + contacto + empresa.
  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, nombre, descripcion, plan, sucursales, billing_period, valor_mensual, valor_total, quote_id, company_id, contact_id, contacts(nombre, email, whatsapp, telefono), companies(nombre)')
    .eq('id', dealId).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!deal) return json({ error: 'oportunidad no encontrada' }, 404);

  // Si ya tiene cotización ligada, la devolvemos (no duplicar).
  if (deal.quote_id) return json({ quote_id: deal.quote_id, url: `/cotizacion/${deal.quote_id}`, reused: true });

  const contacto: any = Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts;
  const empresa: any = Array.isArray(deal.companies) ? deal.companies[0] : deal.companies;
  const anual = deal.billing_period === 'anual';
  const sucursales = Number(deal.sucursales || 1);
  const importe = anual ? Number(deal.valor_total || 0) : Number(deal.valor_mensual || 0);

  // Un ítem "plan" con el importe del deal (mensual o anual).
  const items = [{
    tipo: 'plan',
    nombre: `${deal.plan ? deal.plan.charAt(0).toUpperCase() + deal.plan.slice(1) : 'Licencia SACS'}${sucursales > 1 ? ` · ${sucursales} sucursales` : ''}`,
    descripcion: deal.descripcion || '',
    periodo: anual ? 'anual' : 'mensual',
    cantidad: 1,
    subtotal: Math.round(importe),
  }];
  const t = calcQuoteTotals({ items, iva_mode: 'sin' });

  const nombreContacto = contacto?.nombre || '';
  const cuerpo: any = {
    empresa: empresa?.nombre || deal.nombre || '',
    contacto: nombreContacto,
    email: contacto?.email || '',
    whatsapp: contacto?.whatsapp || contacto?.telefono || '',
    items,
    iva_incluido: false,
    moneda: 'MXN',
    estado: 'draft',
    subtotal: Math.round(t.itemsSubtotal),
    iva_monto: 0,
    total: Math.round(t.grandTotal),
    company_id: deal.company_id || null,
    contact_id: deal.contact_id || null,
    created_via: 'admin',
  };

  // Reusar el POST de quotes (folio COT-NNN + validaciones) en el mismo origen.
  const base = new URL(request.url).origin;
  const rQ = await fetch(base + '/api/revenue/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
    body: JSON.stringify(cuerpo),
  });
  const jQ = await rQ.json().catch(() => ({}));
  if (!rQ.ok || !jQ?.id) return json({ error: jQ?.error || 'No se pudo crear la cotización' }, 502);

  // Back-ref bidireccional deal ↔ quote.
  await supabase.from('deals').update({ quote_id: jQ.id }).eq('id', dealId);
  await supabase.from('quotes').update({ deal_id: dealId }).eq('id', jQ.id);

  return json({ quote_id: jQ.id, numero: jQ.numero, url: `/cotizacion/${jQ.id}` }, 201);
};
