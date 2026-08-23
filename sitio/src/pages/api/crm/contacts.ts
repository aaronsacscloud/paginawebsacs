import { normalizarTelefono } from '../../../lib/telefono';
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';
import { etapaDeLead } from '../../../lib/crm/lead-etapa';
import { normalizaEstado } from '../../../lib/crm/reuniones';
import { detectaHistorial, norm as normTxt, tel10, claveEmpresa, type Indices } from '../../../lib/crm/lead-historial';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const search = url.searchParams.get('search') || '';
  const tipo = url.searchParams.get('tipo');
  const lifecycle = url.searchParams.get('lifecycle_stage');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('contacts')
    .select('*, companies(id, nombre, plan, sucursales, estado_cuenta, mrr)', { count: 'exact' })
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq('tipo', tipo);
  if (lifecycle) query = query.eq('lifecycle_stage', lifecycle);
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`);
  }

  // Partner scope: only show contacts owned by the user (founder sees all)
  query = applyPartnerScope(query, user, 'owner_id');

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // ── Etapa y esfuerzo, solo si se piden ────────────────────────────────────
  // `?con_etapa=1` lo usa la lista de Leads. Se enriquece aquí y no en una
  // columna guardada porque una columna hay que mantenerla y se queda vieja:
  // la etapa sale de hechos que ya viven en otras tablas. Son TRES consultas
  // para todo el lote, no una por lead.
  let filas: any[] = data || [];
  if (url.searchParams.get('con_etapa') === '1' && filas.length) {
    const ids = filas.map((c: any) => c.id);
    const TOQUES = ['llamada', 'whatsapp_enviado', 'email_enviado'];
    const [acts, books, qs] = await Promise.all([
      supabase.from('activities').select('contact_id, tipo').in('contact_id', ids).in('tipo', TOQUES),
      supabase.from('bookings').select('contact_id, estado, fecha').in('contact_id', ids),
      supabase.from('quotes').select('contact_id').in('contact_id', ids),
    ]);
    const porContacto = new Map<string, { llamadas: number; correos: number; whatsapp: number; reuniones: any[]; cotizaciones: number }>();
    const dame = (id: string) => {
      let x = porContacto.get(id);
      if (!x) { x = { llamadas: 0, correos: 0, whatsapp: 0, reuniones: [], cotizaciones: 0 }; porContacto.set(id, x); }
      return x;
    };
    for (const a of (acts.data || [])) {
      const x = dame(a.contact_id);
      if (a.tipo === 'llamada') x.llamadas++;
      else if (a.tipo === 'email_enviado') x.correos++;
      else if (a.tipo === 'whatsapp_enviado') x.whatsapp++;
    }
    for (const b of (books.data || [])) dame(b.contact_id).reuniones.push({ estado: normalizaEstado(b.estado), fecha: b.fecha });
    for (const q of (qs.data || [])) dame(q.contact_id).cotizaciones++;

    // ── ¿Ya lo conocíamos? ────────────────────────────────────────────────
    // Índices de clientes y cancelados para cruzar por correo, teléfono y
    // nombre de empresa. Son TRES consultas para todo el lote: sin esto, el
    // cruce costaría una consulta por lead y nadie lo pondría en la lista.
    const ix: Indices = { porCorreo: new Map(), porTelefono: new Map(), empresas: new Map(), porNombreEmpresa: new Map() };
    const [viejos, emps, subs] = await Promise.all([
      supabase.from('contacts').select('id, email, whatsapp, telefono, company_id, lifecycle_stage')
        .in('lifecycle_stage', ['cliente', 'churned']).is('archived_at', null).limit(2000),
      supabase.from('companies').select('id, nombre, nombre_comercial, estado_cuenta, arr').is('archived_at', null).limit(2000),
      supabase.from('subscriptions').select('company_id').eq('estado', 'activa').limit(2000),
    ]);
    const conSubActiva = new Set((subs.data || []).map((s2: any) => s2.company_id));
    for (const e of (emps.data || [])) {
      const activa = conSubActiva.has(e.id);
      ix.empresas.set(e.id, { nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, arr: e.arr, activa });
      // Solo entran al índice por nombre las que son o fueron clientes: si
      // entraran los prospectos, dos leads del mismo giro se marcarían entre sí.
      if (activa || ['activo', 'vencido', 'cancelado'].includes(String(e.estado_cuenta))) {
        const k = claveEmpresa(e.nombre_comercial || e.nombre);
        if (k.length >= 4 && !ix.porNombreEmpresa.has(k)) ix.porNombreEmpresa.set(k, { company_id: e.id, nombre: e.nombre_comercial || e.nombre, estado_cuenta: e.estado_cuenta, activa });
      }
    }
    for (const v of (viejos.data || [])) {
      const reg = { lifecycle: v.lifecycle_stage, company_id: v.company_id, contact_id: v.id };
      const em = normTxt(v.email); if (em && !ix.porCorreo.has(em)) ix.porCorreo.set(em, reg);
      const tl = tel10(v.whatsapp || v.telefono); if (tl.length === 10 && !ix.porTelefono.has(tl)) ix.porTelefono.set(tl, reg);
    }

    filas = filas.map((c: any) => {
      const x = porContacto.get(c.id) || { llamadas: 0, correos: 0, whatsapp: 0, reuniones: [], cotizaciones: 0 };
      const toques = x.llamadas + x.correos + x.whatsapp;
      const { etapa, porHechos, manual } = etapaDeLead({
        lifecycle_stage: c.lifecycle_stage, calificacion: c.calificacion, desenlace: c.desenlace,
        toques, last_contact_at: c.last_contact_at, reuniones: x.reuniones,
        cotizaciones: x.cotizaciones, etapa_manual: c.etapa_manual,
      });
      const esLead = ['lead', 'lead_calificado', 'oportunidad'].includes(String(c.lifecycle_stage));
      const empresa = Array.isArray(c.companies) ? c.companies[0] : c.companies;
      const historial = esLead ? detectaHistorial({
        id: c.id, email: c.email, whatsapp: c.whatsapp, telefono: c.telefono,
        company_id: c.company_id, empresa_nombre: empresa?.nombre || null,
      }, ix) : null;
      return { ...c, etapa, etapa_por_hechos: porHechos, etapa_manual_aplicada: manual, historial,
        esfuerzo: { llamadas: x.llamadas, correos: x.correos, whatsapp: x.whatsapp, total: toques },
        n_reuniones: x.reuniones.length, n_cotizaciones: x.cotizaciones };
    });
  }

  return new Response(JSON.stringify({ contacts: filas, total: count }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  // Create or find company if empresa provided
  let company_id = body.company_id || null;
  if (!company_id && body.empresa) {
    // Check if company exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('nombre', body.empresa)
      .limit(1)
      .single();

    if (existing) {
      company_id = existing.id;
    } else {
      const { data: newCo, error: coErr } = await supabase
        .from('companies')
        .insert({
          nombre: body.empresa,
          giro: body.giro || null,
          sucursales: body.sucursales_interes || 1,
        })
        .select('id')
        .single();
      if (coErr) return new Response(JSON.stringify({ error: coErr.message }), { status: 500 });
      company_id = newCo.id;
    }
  }

  // Determine lifecycle stage
  let lifecycle_stage = body.lifecycle_stage || 'lead';
  if (body.lead_score >= 40) lifecycle_stage = 'lead_calificado';

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      nombre: body.nombre,
      apellido: body.apellido || null,
      email: body.email || null,
      whatsapp: normalizarTelefono(body.whatsapp),
      telefono: body.telefono || null,
      tipo: body.tipo || 'lead',
      lifecycle_stage,
      fuente: body.fuente || null,
      fuente_detalle: body.fuente_detalle || null,
      propiedades: body.propiedades || {},
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      lead_score: body.lead_score || 0,
      total_time_on_site: body.total_time_on_site || 0,
      pages_visited: body.pages_visited || null,
      page_count: body.page_count || 0,
      visitor_id: body.visitor_id || null,
      company_id,
      puesto: body.puesto || null,
      plan_interes: body.plan_interes || null,
      giro: body.giro || null,
      sucursales_interes: body.sucursales_interes || null,
      stripe_customer_id: body.stripe_customer_id || null,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Log activity
  await supabase.from('activities').insert({
    contact_id: data.id,
    company_id,
    tipo: 'lead_created',
    titulo: `Nuevo contacto: ${body.nombre}`,
    metadata: { fuente: body.fuente, score: body.lead_score },
    automatico: true,
  });

  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // `empresa` no es columna: es el NOMBRE de la cuenta. Se resuelve a
  // company_id buscando primero y creando después, igual que en el alta. Sin
  // esto, escribir la empresa en la ficha del lead tiraba el update entero.
  if ('empresa' in updates) {
    const nombre = String(updates.empresa || '').trim();
    delete updates.empresa;
    if (!nombre) updates.company_id = null;
    else {
      const { data: existe } = await supabase.from('companies').select('id').ilike('nombre', nombre).limit(1).maybeSingle();
      if (existe?.id) updates.company_id = existe.id;
      else {
        const { data: nueva, error: ce } = await supabase.from('companies')
          .insert({ nombre, estado_cuenta: 'prospecto' }).select('id').single();
        if (ce) return new Response(JSON.stringify({ error: 'No se pudo crear la empresa: ' + ce.message }), { status: 500 });
        updates.company_id = nueva.id;
      }
    }
  }

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
