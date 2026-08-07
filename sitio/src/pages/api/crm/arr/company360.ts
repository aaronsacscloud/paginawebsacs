// GET /api/crm/arr/company360?id=<company_id> — todo el detalle del cliente en
// un fetch: empresa + actividad SACS, suscripciones, pagos y notas/timeline.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });

  // Contactos con campos completos para el drawer (rol/es_principal pueden no
  // existir si no ha corrido migration-2026-07-contactos-rol.sql → retry sin ellos).
  const CONTACT_FULL = 'id, nombre, apellido, email, whatsapp, telefono, puesto, rol, es_principal, created_at';
  const CONTACT_LEGACY = 'id, nombre, apellido, email, whatsapp, telefono, puesto, created_at';
  const fetchContacts = async () => {
    let r = await supabase.from('contacts').select(CONTACT_FULL).eq('company_id', id).is('archived_at', null).order('created_at').limit(25);
    if (r.error && /rol|es_principal|column|schema cache/i.test(r.error.message || '')) {
      r = await supabase.from('contacts').select(CONTACT_LEGACY).eq('company_id', id).is('archived_at', null).order('created_at').limit(25);
    }
    return r;
  };

  const [co, subs, pays, acts, contacts, quotes] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('subscriptions').select('*').eq('company_id', id).order('created_at'),
    supabase.from('payments').select('*').eq('company_id', id).order('fecha', { ascending: false }).limit(100),
    supabase.from('activities').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(100),
    fetchContacts(),
    supabase.from('quotes').select('id, numero, total, estado, created_at').eq('company_id', id).not('estado', 'in', '(deleted,plantilla)').order('created_at', { ascending: false }).limit(30),
  ]);

  // Cobros de Mercado Pago que NO terminaron en un pago: los rechazos. Van
  // aparte de `payments` a propósito — un cobro rebotado no es un pago, y
  // mezclarlos inflaría el historial de lo que este cliente ha pagado.
  // La tabla puede no existir todavía en un entorno sin migrar: si falla, el
  // 360 completo no se cae por una sección secundaria.
  let cobrosMp: any[] = [];
  try {
    const { data } = await supabase.from('crm_cobros_mp')
      .select('id, mp_payment_id, monto, estado, motivo, detalle_estado, metodo, fecha, payer_email, subscription_id, resolucion')
      .eq('company_id', id).order('fecha', { ascending: false }).limit(50);
    cobrosMp = data || [];
  } catch { /* sección secundaria */ }
  if (co.error) return new Response(JSON.stringify({ error: co.error.message }), { status: 404 });

  // Bookings del cliente (por sus contactos: contact_id o email)
  let bookings: any[] = [];
  try {
    const cts = contacts.data || [];
    const ctIds = cts.map((c: any) => c.id);
    const ctEmails = cts.map((c: any) => String(c.email || '').trim().toLowerCase()).filter(Boolean);
    if (ctIds.length || ctEmails.length) {
      const ors: string[] = [];
      if (ctIds.length) ors.push(`contact_id.in.(${ctIds.join(',')})`);
      if (ctEmails.length) ors.push(`invitee_email.in.(${ctEmails.map(e => `"${e}"`).join(',')})`);
      const { data: bks } = await supabase.from('bookings')
        .select('id, fecha, hora_inicio, estado, google_meet_link, invitee_nombre, event_types(nombre)')
        .or(ors.join(',')).order('fecha', { ascending: false }).limit(30);
      bookings = bks || [];
    }
  } catch { /* bookings opcionales en el 360 */ }

  // ── TIMELINE unificado: activities + pagos + cotizaciones + reuniones ──
  const timeline: any[] = [];
  const ICONO: Record<string, string> = {
    nota: '📝', tarea: '✅', cotizacion: '📋', pago_recibido: '💰', deal_ganado: '🏆',
    stage_change: '📈', demo_agendada: '📅', demo_realizada: '📅', demo_no_show: '📅',
    sistema: '⚙️', llamada: '📞', whatsapp_enviado: '💬', email_enviado: '✉️', lead_created: '✨',
    // Que el cliente ABRA la cotización es la señal más accionable del timeline:
    // merece su propio ícono y no quedarse como un engrane más.
    cotizacion_vista: '👀',
  };
  // Anti-duplicados: las reuniones vienen de `bookings` (fila más rica, con
  // estado y Meet) y las cotizaciones de `quotes` → se OMITEN las activities
  // espejo (demo_* y tipo 'cotizacion') para no mostrar el mismo evento 2 veces.
  const DUPES = new Set(['demo_agendada', 'demo_realizada', 'demo_no_show', 'demo_cancelada', 'cotizacion']);
  // Fechas "naive" (pagos/reuniones) son hora de México → fijarlas a -06:00 para
  // que el orden no se invierta contra los created_at UTC de activities.
  const TZ = '-06:00';
  for (const a of (acts.data || [])) {
    if (a.tipo === 'page_visit' || DUPES.has(a.tipo)) continue; // ruido/duplicados
    timeline.push({ fecha: a.created_at, icono: (a.metadata?.alerta ? '⚠️' : ICONO[a.tipo] || '⚙️'), tipo: a.tipo, titulo: a.titulo, detalle: a.descripcion || '', id: 'a' + a.id, meta: a.metadata || null,
      // La vista lleva a la cotización que se vio: desde el timeline se llega a
      // lo que el cliente estaba mirando, sin ir a buscarlo.
      ...(a.metadata?.quote_id ? { link: `/cotizacion/${a.metadata.quote_id}?admin=1` } : {}) });
  }
  for (const p of (pays.data || [])) {
    timeline.push({ fecha: (p.fecha?.length === 10 ? p.fecha + 'T12:00:00' + TZ : p.fecha) || p.created_at, icono: '💰', tipo: 'pago', titulo: `Pago recibido · $${Math.round(p.monto || 0).toLocaleString()}`, detalle: p.metodo || '', id: 'p' + p.id });
  }
  for (const q of (quotes.data || [])) {
    timeline.push({ fecha: q.created_at, icono: '📋', tipo: 'cotizacion', titulo: `Cotización ${q.numero || ''} · $${Math.round(q.total || 0).toLocaleString()} · ${q.estado}`, detalle: '', id: 'q' + q.id, link: `/cotizacion/${q.id}` });
  }
  for (const b of bookings) {
    const ev: any = Array.isArray(b.event_types) ? b.event_types[0] : b.event_types;
    timeline.push({ fecha: b.fecha + 'T' + (b.hora_inicio || '12:00:00') + TZ, icono: '📅', tipo: 'reunion', titulo: `${ev?.nombre || 'Reunión'} · ${b.estado}`, detalle: b.invitee_nombre || '', id: 'b' + b.id, link: b.google_meet_link || null });
  }
  timeline.sort((x, y) => (Date.parse(y.fecha) || 0) - (Date.parse(x.fecha) || 0));

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
    cobros_mp: cobrosMp,
    activities: acts.data || [],
    quotes: quotes.data || [],
    bookings,
    timeline: timeline.slice(0, 80),
    // Principal primero (si la columna existe), luego por antigüedad.
    contacts: (contacts.data || []).slice().sort((a: any, b: any) => Number(b.es_principal || 0) - Number(a.es_principal || 0)),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
