// GET /api/scheduling/reuniones — vista admin de TODAS las reuniones (las del
// founder y las de partners) enriquecidas para el tab "Reuniones" del CRM:
//  - host resuelto (nombre del team_member)
//  - invitado clasificado: cliente (company con suscripciones) | prospecto
//    (tiene deal) | contacto (existe en contacts) — con los ids para navegar
//  - partner que refirió el lead, si aplica
// Solo founder/cs (los partners usan su portal con /api/scheduling/bookings).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { isPartner } from '../../../lib/scheduling/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (isPartner(user)) return new Response(JSON.stringify({ error: 'Solo admin' }), { status: 403 });

  const estado = url.searchParams.get('estado');
  const host = url.searchParams.get('host'); // 'mias' | 'partners' | <team_member_id>
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = supabase
    .from('bookings')
    .select('*, event_types(id, nombre, slug, color, duracion_minutos)')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (estado) query = query.eq('estado', estado);
  if (from) query = query.gte('fecha', from);
  if (to) query = query.lte('fecha', to);

  const { data: bookings, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let rows = bookings || [];

  // ── hosts y partners que refirieron (una sola consulta a team_members) ──
  const memberIds = Array.from(new Set(rows.flatMap((b: any) => [b.host_id, b.referrer_partner_id].filter(Boolean))));
  const members: Record<string, any> = {};
  if (memberIds.length) {
    const { data: tms } = await supabase.from('team_members').select('id, nombre, email, rol').in('id', memberIds);
    (tms || []).forEach((t: any) => { members[t.id] = t; });
  }

  // filtro por host (después de resolver: 'mias' = las del user actual)
  if (host === 'mias') rows = rows.filter((b: any) => b.host_id === user.id);
  else if (host === 'partners') rows = rows.filter((b: any) => b.host_id && b.host_id !== user.id && members[b.host_id]?.rol === 'partner');
  else if (host) rows = rows.filter((b: any) => b.host_id === host);

  // ── resolver invitado: por contact_id o por email ──
  const contactIds = Array.from(new Set(rows.map((b: any) => b.contact_id).filter(Boolean)));
  const emails = Array.from(new Set(rows.map((b: any) => String(b.invitee_email || '').trim().toLowerCase()).filter(Boolean)));
  const contactsById: Record<string, any> = {};
  const contactsByEmail: Record<string, any> = {};
  if (contactIds.length) {
    const { data } = await supabase.from('contacts').select('id, nombre, email, company_id').in('id', contactIds);
    (data || []).forEach((c: any) => { contactsById[c.id] = c; });
  }
  if (emails.length) {
    const { data } = await supabase.from('contacts').select('id, nombre, email, company_id').in('email', emails);
    (data || []).forEach((c: any) => { if (c.email) contactsByEmail[c.email.toLowerCase()] = c; });
  }

  // companies de esos contactos, con sus suscripciones para saber si es cliente
  const companyIds = Array.from(new Set(
    [...Object.values(contactsById), ...Object.values(contactsByEmail)].map((c: any) => c.company_id).filter(Boolean)
  ));
  const companies: Record<string, any> = {};
  if (companyIds.length) {
    const { data } = await supabase.from('companies')
      .select('id, nombre, plan, sacs_account, subscriptions(id, estado)')
      .in('id', companyIds).is('archived_at', null);
    (data || []).forEach((co: any) => { companies[co.id] = co; });
  }

  const data = rows.map((b: any) => {
    const contact = (b.contact_id && contactsById[b.contact_id])
      || contactsByEmail[String(b.invitee_email || '').trim().toLowerCase()] || null;
    const company = contact?.company_id ? companies[contact.company_id] : null;
    const esCliente = !!(company && (company.subscriptions || []).length > 0);
    const hostM = b.host_id ? members[b.host_id] : null;
    const refM = b.referrer_partner_id ? members[b.referrer_partner_id] : null;
    return {
      ...b,
      host_nombre: hostM?.nombre || null,
      host_es_partner: hostM?.rol === 'partner',
      host_es_mio: b.host_id === user.id,
      referrer_nombre: refM?.nombre || null,
      invitado_tipo: esCliente ? 'cliente' : (b.deal_id ? 'prospecto' : (contact ? 'contacto' : null)),
      invitado_contact_id: contact?.id || null,
      invitado_company_id: esCliente ? company.id : null,
      invitado_company_nombre: esCliente ? company.nombre : null,
      invitado_plan: esCliente ? company.plan : null,
    };
  });

  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
