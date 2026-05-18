// GET /api/partner-portal/notifications
// Timeline unificado del partner — todo evento atribuible al partner en orden cronológico.
//
// Devuelve eventos derivados de:
//   • partner_link_visits     → clicks en su link
//   • contacts                 → lead registrado vía cookie/link
//   • bookings                 → demo agendada / realizada / cancelada
//   • deals                    → cierre ganado / perdido
//   • partner_commissions      → bono pendiente / earned / pagado
//
// Cada notificación tiene:
//   { id, type, when, severity, title, detail, link (opcional), meta }
//
// Soporta ?since=ISO para deltas y ?limit=N (default 100).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;

type Severity = 'info' | 'success' | 'warning' | 'critical';
type Notification = {
  id: string;
  type:
    | 'visita_link'
    | 'lead_registrado'
    | 'demo_agendada'
    | 'demo_realizada'
    | 'demo_no_show'
    | 'demo_cancelada'
    | 'cliente_pago'
    | 'comision_pendiente'
    | 'comision_earned'
    | 'comision_pagada';
  when: string;          // ISO timestamp
  severity: Severity;
  title: string;
  detail?: string;
  link?: { hash: string; label: string }; // hash interno del portal
  meta?: Record<string, any>;
};

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  const since = url.searchParams.get('since');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 300);

  const partnerId = user.id;
  const sinceFilter = since ? new Date(since).toISOString() : null;

  // 1. Cargar fuentes en paralelo (solo lo atribuible al partner)
  const [visitsRes, contactsRes, bookingsRes, dealsRes, commissionsRes] = await Promise.all([
    supabase
      .from('partner_link_visits')
      .select('id, created_at, slug, visitor_id, referer')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('contacts')
      .select('id, nombre, email, empresa, fuente, lifecycle_stage, created_at, plan_interes')
      .eq('referrer_partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('bookings')
      .select('id, invitee_nombre, invitee_email, invitee_empresa, fecha, hora_inicio, estado, created_at, updated_at, contact_id')
      .eq('referrer_partner_id', partnerId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(150),
    supabase
      .from('deals')
      .select('id, nombre, stage, valor_total, closed_at, created_at, updated_at, contact_id, plan')
      .eq('referrer_partner_id', partnerId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(150),
    supabase
      .from('partner_commissions')
      .select('id, tipo, status, commission_amount, created_at, earned_at, paid_at, nota, contact_id, deal_id, booking_id')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(150),
  ]);

  const out: Notification[] = [];

  // Helper: tomar fecha del registro (priorizar la última transición)
  const pick = (...vals: (string | null | undefined)[]) =>
    vals.find(v => v && v.length) || '';

  // 2. Visitas al link (agrupadas por día para no inundar)
  const visitsByDay = new Map<string, { count: number; latest: string; slug: string }>();
  for (const v of visitsRes.data || []) {
    const day = (v.created_at || '').slice(0, 10);
    const cur = visitsByDay.get(day) || { count: 0, latest: '', slug: v.slug || '' };
    cur.count++;
    if (!cur.latest || v.created_at > cur.latest) cur.latest = v.created_at;
    visitsByDay.set(day, cur);
  }
  for (const [day, info] of visitsByDay.entries()) {
    out.push({
      id: `visit-${day}`,
      type: 'visita_link',
      when: info.latest,
      severity: 'info',
      title: info.count === 1 ? '1 click en tu link' : `${info.count} clicks en tu link`,
      detail: info.slug ? `Slug: ${info.slug}` : undefined,
      meta: { count: info.count, day },
    });
  }

  // 3. Leads registrados (contact_created)
  for (const c of contactsRes.data || []) {
    const empresaTxt = c.empresa ? ` (${c.empresa})` : '';
    out.push({
      id: `contact-${c.id}`,
      type: 'lead_registrado',
      when: c.created_at,
      severity: 'success',
      title: `Nuevo lead atribuido: ${c.nombre || c.email || 'Sin nombre'}${empresaTxt}`,
      detail: c.fuente
        ? `Fuente: ${c.fuente}${c.plan_interes ? ` · interés en plan ${c.plan_interes}` : ''}`
        : (c.plan_interes ? `Interés en plan ${c.plan_interes}` : 'Quedó registrado en tu pipeline'),
      link: { hash: 'leads', label: 'Ver en pipeline' },
      meta: { contact_id: c.id, lifecycle_stage: c.lifecycle_stage },
    });
  }

  // 4. Bookings
  for (const b of bookingsRes.data || []) {
    const when = pick(b.updated_at, b.created_at);
    const empresaTxt = b.invitee_empresa ? ` (${b.invitee_empresa})` : '';
    const fechaDemo = b.fecha
      ? new Date(b.fecha + 'T' + (b.hora_inicio || '12:00') + ':00').toLocaleString('es-MX', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
      : '';

    if (b.estado === 'realizada') {
      out.push({
        id: `booking-realizada-${b.id}`,
        type: 'demo_realizada',
        when,
        severity: 'success',
        title: `Demo completada: ${b.invitee_nombre || b.invitee_email || 'Lead'}${empresaTxt}`,
        detail: fechaDemo ? `Realizada el ${fechaDemo} · genera tu bono de $300` : 'Genera tu bono de $300',
        link: { hash: 'dinero', label: 'Ver bono' },
        meta: { booking_id: b.id, contact_id: b.contact_id },
      });
    } else if (b.estado === 'cancelada') {
      out.push({
        id: `booking-cancelada-${b.id}`,
        type: 'demo_cancelada',
        when,
        severity: 'warning',
        title: `Demo cancelada: ${b.invitee_nombre || 'Lead'}${empresaTxt}`,
        detail: fechaDemo ? `Estaba para el ${fechaDemo}` : 'El cliente canceló la demo',
        link: { hash: 'leads', label: 'Ver pipeline' },
        meta: { booking_id: b.id, contact_id: b.contact_id },
      });
    } else if (b.estado === 'no_show') {
      out.push({
        id: `booking-noshow-${b.id}`,
        type: 'demo_no_show',
        when,
        severity: 'warning',
        title: `No show: ${b.invitee_nombre || 'Lead'}${empresaTxt}`,
        detail: fechaDemo ? `No asistió el ${fechaDemo}` : 'El cliente no se presentó',
        link: { hash: 'leads', label: 'Ver pipeline' },
        meta: { booking_id: b.id, contact_id: b.contact_id },
      });
    } else {
      // confirmada / agendada
      out.push({
        id: `booking-agendada-${b.id}`,
        type: 'demo_agendada',
        when: b.created_at || when,
        severity: 'info',
        title: `Demo agendada: ${b.invitee_nombre || b.invitee_email || 'Lead'}${empresaTxt}`,
        detail: fechaDemo ? `Programada para el ${fechaDemo}` : 'Lead reservó horario en tu landing',
        link: { hash: 'leads', label: 'Ver en pipeline' },
        meta: { booking_id: b.id, contact_id: b.contact_id, fecha: b.fecha },
      });
    }
  }

  // 5. Deals — solo ganados/perdidos (los abiertos ya están como bookings/contacts)
  for (const d of dealsRes.data || []) {
    if (d.stage === 'cerrada_ganada' || d.stage === 'won') {
      out.push({
        id: `deal-won-${d.id}`,
        type: 'cliente_pago',
        when: pick(d.closed_at, d.updated_at, d.created_at),
        severity: 'success',
        title: `Cliente firmó: ${d.nombre || 'Plan'}`,
        detail: `Plan ${d.plan || 'cerrado'}${d.valor_total ? ` · $${Math.round(Number(d.valor_total)).toLocaleString('es-MX')} MXN` : ''} · Tu comisión venta directa se procesa`,
        link: { hash: 'dinero', label: 'Ver comisión' },
        meta: { deal_id: d.id, contact_id: d.contact_id, valor: d.valor_total },
      });
    }
  }

  // 6. Commissions — cada transición de status genera una notif
  for (const cm of commissionsRes.data || []) {
    const tipoLabel =
      cm.tipo === 'prueba_gratis' ? 'Bono prueba gratis'
      : cm.tipo === 'demo_completada' ? 'Bono demo completada'
      : cm.tipo === 'venta_directa' ? 'Comisión venta directa'
      : 'Comisión';
    const amt = `$${Math.round(Number(cm.commission_amount || 0)).toLocaleString('es-MX')}`;

    if (cm.status === 'pending') {
      out.push({
        id: `comm-pending-${cm.id}`,
        type: 'comision_pendiente',
        when: cm.created_at,
        severity: 'info',
        title: `${tipoLabel}: ${amt} pendiente`,
        detail: cm.nota || 'En verificación · pasa a "earned" cuando confirmemos',
        link: { hash: 'dinero', label: 'Ver detalle' },
        meta: { commission_id: cm.id, tipo: cm.tipo, contact_id: cm.contact_id },
      });
    } else if (cm.status === 'earned') {
      out.push({
        id: `comm-earned-${cm.id}`,
        type: 'comision_earned',
        when: pick(cm.earned_at, cm.created_at),
        severity: 'success',
        title: `${tipoLabel}: ${amt} confirmada`,
        detail: 'Se incluye en tu próximo pago del día 1',
        link: { hash: 'dinero', label: 'Ver próximo pago' },
        meta: { commission_id: cm.id, tipo: cm.tipo },
      });
    } else if (cm.status === 'paid') {
      out.push({
        id: `comm-paid-${cm.id}`,
        type: 'comision_pagada',
        when: pick(cm.paid_at, cm.earned_at, cm.created_at),
        severity: 'success',
        title: `${tipoLabel}: ${amt} pagada`,
        detail: 'Depositado a tu cuenta',
        link: { hash: 'dinero', label: 'Histórico' },
        meta: { commission_id: cm.id, tipo: cm.tipo },
      });
    }
  }

  // 7. Ordenar por fecha desc, aplicar since y limit
  let sorted = out
    .filter(n => !!n.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  if (sinceFilter) {
    sorted = sorted.filter(n => n.when > sinceFilter);
  }

  const slice = sorted.slice(0, limit);

  // 8. Stats
  const unreadKey = since ? since : new Date(Date.now() - 7 * 86400000).toISOString();
  const unreadCount = sorted.filter(n => n.when > unreadKey).length;

  return j({
    notifications: slice,
    total: sorted.length,
    unreadCount,
    serverTime: new Date().toISOString(),
  });
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
