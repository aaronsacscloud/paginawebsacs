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
import { alertasInasistencia, ESTADOS } from '../../../lib/crm/reuniones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  if (isPartner(user)) return new Response(JSON.stringify({ error: 'Solo admin' }), { status: 403 });

  const estado = url.searchParams.get('estado');
  const host = url.searchParams.get('host'); // 'mias' | 'partners' | <team_member_id>
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const companyId = url.searchParams.get('company_id'); // reuniones de UN cliente (drawer)

  let query = supabase
    .from('bookings')
    .select('*, event_types(id, nombre, slug, color, duracion_minutos, categoria, alerta_inasistencias, requiere_minuta)')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (estado) query = query.eq('estado', estado);
  if (from) query = query.gte('fecha', from);
  if (to) query = query.lte('fecha', to);

  // Filtro por cliente: bookings de sus contactos (por contact_id) o por email
  // de sus contactos (bookings viejos sin contact_id ligado).
  let companyContactIds: string[] = [];
  let companyEmails: string[] = [];
  if (companyId) {
    const { data: cts } = await supabase.from('contacts').select('id, email').eq('company_id', companyId).is('archived_at', null);
    companyContactIds = (cts || []).map((c: any) => c.id);
    companyEmails = (cts || []).map((c: any) => String(c.email || '').trim().toLowerCase()).filter(Boolean);
    // Sin contactos NO se corta: las que se agendan desde la ficha guardan el
    // company_id directo, y antes esa salida temprana las escondía todas.
  }

  const { data: bookings, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let rows = bookings || [];
  if (companyId) {
    rows = rows.filter((b: any) => b.company_id === companyId
      || (b.contact_id && companyContactIds.includes(b.contact_id))
      || (b.invitee_email && companyEmails.includes(String(b.invitee_email).trim().toLowerCase())));
  }

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

  // La alerta se calcula sobre lo que se está devolviendo, no se guarda: si
  // alguien corrige una falta que en realidad fue una cancelación, la alerta
  // desaparece sola. Una bandera guardada se queda encendida para siempre.
  const alertas = companyId ? alertasInasistencia(data) : [];

  return new Response(JSON.stringify({ data, alertas }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// ── POST: agendar desde la ficha del cliente ────────────────────────────────
// No pasa por el flujo público (disponibilidad, tokens, correos al invitado):
// aquí alguien de SACS registra una reunión que ya se acordó por teléfono o por
// WhatsApp. Forzarla por el embudo de reservas sería pedirle al cliente que
// confirme algo que él mismo pidió.
export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  if (isPartner(user)) return json({ error: 'Solo admin' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const eventTypeId = String(b?.event_type_id || '');
  const fecha = String(b?.fecha || '');
  const hora = String(b?.hora_inicio || '');
  if (!eventTypeId || !fecha || !hora) return json({ error: 'Faltan el tipo, la fecha o la hora.' }, 400);

  const { data: tipo } = await supabase.from('event_types')
    .select('id, nombre, duracion_minutos, ubicacion_tipo').eq('id', eventTypeId).maybeSingle();
  if (!tipo) return json({ error: 'Ese tipo de reunión ya no existe.' }, 400);

  const dur = Number(b?.duracion_minutos || tipo.duracion_minutos || 60);
  const [hh, mm] = hora.split(':').map(Number);
  const fin = new Date(2000, 0, 1, hh || 0, mm || 0);
  fin.setMinutes(fin.getMinutes() + dur);
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const fila: any = {
    event_type_id: eventTypeId,
    host_id: b?.host_id || user.id,
    fecha, hora_inicio: hora.slice(0, 5), hora_fin: hhmm(fin),
    timezone_host: 'America/Mexico_City', timezone_invitado: 'America/Mexico_City',
    invitee_nombre: b?.invitee_nombre || null,
    invitee_email: b?.invitee_email || null,
    invitee_empresa: b?.invitee_empresa || null,
    invitee_notas: b?.notas || null,
    company_id: b?.company_id || null,
    contact_id: b?.contact_id || null,
    deal_id: b?.deal_id || null,
    asunto: b?.asunto || null,
    google_meet_link: b?.google_meet_link || null,
    estado: 'agendada',
    origen: 'crm',
    estado_hist: [{ estado: 'agendada', at: new Date().toISOString(), por: user.nombre || user.email || 'CRM' }],
  };
  const { data: creada, error } = await supabase.from('bookings').insert(fila).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data: creada }, 201);
};

// ── PATCH: estado, grabación y minuta ───────────────────────────────────────
export const PATCH: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  if (isPartner(user)) return json({ error: 'Solo admin' }, 403);

  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la reunión.' }, 400);

  const { data: actual } = await supabase.from('bookings').select('id, estado, estado_hist').eq('id', id).maybeSingle();
  if (!actual) return json({ error: 'Esa reunión ya no existe.' }, 404);

  const patch: any = {};
  if (typeof b?.grabacion_url === 'string') patch.grabacion_url = b.grabacion_url.trim() || null;
  if (b?.minuta && typeof b.minuta === 'object') patch.minuta = b.minuta;
  if (typeof b?.asunto === 'string') patch.asunto = b.asunto.trim() || null;

  if (b?.estado && b.estado !== actual.estado) {
    if (!ESTADOS[b.estado]) return json({ error: 'Estado desconocido.' }, 400);
    patch.estado = b.estado;
    // Se APILA, no se pisa: la alerta de inasistencias sale de aquí y tiene que
    // poder mostrarse quién marcó qué y cuándo.
    const hist = Array.isArray(actual.estado_hist) ? actual.estado_hist : [];
    patch.estado_hist = [...hist, {
      estado: b.estado, at: new Date().toISOString(),
      por: user.nombre || user.email || 'CRM', motivo: b?.motivo || null,
    }];
    if (b.estado === 'cancelada') {
      patch.cancelacion_motivo = b?.motivo || null;
      patch.cancelado_por = 'sacs';
    }
  }
  if (!Object.keys(patch).length) return json({ ok: true, sin_cambios: true });

  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('bookings').update(patch).eq('id', id)
    .select('*, event_types(id, nombre, slug, color, duracion_minutos, categoria, alerta_inasistencias)').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};
