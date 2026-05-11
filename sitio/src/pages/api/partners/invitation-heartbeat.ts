// Partner Invitation Heartbeat
// POST /api/partners/invitation-heartbeat
//
// Endpoint público (sin auth) que recibe pings del cliente desde la página
// pública de la invitación. Acumula tiempo activo, scroll, eventos de
// interacción y calcula el interest score 0-100.
//
// Idempotente por (invitation_id, session_id) — el cliente genera el
// session_id una vez por pestaña y lo manda en cada ping. Si el upsert
// detecta una fila existente, suma deltas.

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

interface HeartbeatPayload {
  invitationId: string;
  sessionId: string;
  deltaSeconds?: number;        // segundos activos desde el último ping
  currentTab?: string;          // tab activo durante el delta
  scrollPct?: number;           // % scroll alcanzado en el tab actual (0-100)
  events?: HeartbeatEvent[];    // eventos discretos desde el último ping
  endSession?: boolean;         // true = el cliente se va (visibilitychange/sendBeacon)
  device?: string;
  userAgent?: string;
  referrer?: string;
  langSwitchedTo?: string;
}

type HeartbeatEvent =
  | { type: 'tab_view'; tab: string; ts: string }
  | { type: 'contract_modal_open' }
  | { type: 'contract_modal_close'; secondsInside: number }
  | { type: 'glossary_open' }
  | { type: 'calc_interaction'; finalState?: any }
  | { type: 'signature_attempted' }
  | { type: 'contract_checkbox' }
  | { type: 'wa_clicked' }
  | { type: 'print_clicked' };

// Cálculo del interest score 0-100 a partir de los acumulados de una sesión
function calcInterestScore(s: {
  total_active_seconds: number;
  contract_modal_opens: number;
  contract_modal_seconds: number;
  calc_interactions: number;
  signature_attempted_at: string | null;
  contract_checkbox_at: string | null;
  wa_clicked: boolean;
}): number {
  let score = 0;

  // Tiempo activo: hasta 25 puntos (a 10 min full)
  score += Math.min(s.total_active_seconds / 600, 1) * 25;

  // Abrir modal del contrato: 15 base
  if (s.contract_modal_opens > 0) score += 15;
  // Tiempo dentro del modal: hasta 10 puntos extra
  score += Math.min(s.contract_modal_seconds / 300, 1) * 10;

  // Usar calculadora: 10
  if (s.calc_interactions > 0) score += 10;

  // Intentó firmar (señal premium): 25
  if (s.signature_attempted_at) score += 25;

  // Marcó checkbox de aceptación: 10
  if (s.contract_checkbox_at) score += 10;

  // Click en WhatsApp (alto intent): 5
  if (s.wa_clicked) score += 5;

  return Math.min(Math.round(score), 100);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as HeartbeatPayload;
    const {
      invitationId, sessionId,
      deltaSeconds = 0, currentTab, scrollPct,
      events = [], endSession,
      device, userAgent, referrer, langSwitchedTo,
    } = body;

    if (!invitationId || !sessionId) {
      return new Response(JSON.stringify({ error: 'invitationId and sessionId required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cap delta to 60s to prevent abuse (ping is supposed to fire every 15s)
    const safeDelta = Math.max(0, Math.min(Math.floor(deltaSeconds), 60));

    // Find existing session
    const { data: existing } = await supabase
      .from('partner_invitation_sessions')
      .select('*')
      .eq('invitation_id', invitationId)
      .eq('session_id', sessionId)
      .maybeSingle();

    const now = new Date().toISOString();
    const row: Record<string, any> = existing ? { ...existing } : {
      invitation_id: invitationId,
      session_id: sessionId,
      started_at: now,
      total_active_seconds: 0,
      time_by_tab: {},
      scroll_by_tab: {},
      contract_modal_opens: 0,
      contract_modal_seconds: 0,
      glossary_opens: 0,
      calc_interactions: 0,
      tab_visits: [],
      wa_clicked: false,
      print_clicked: false,
      device,
      user_agent: userAgent,
      referrer,
    };

    row.last_seen_at = now;
    row.total_active_seconds = (row.total_active_seconds || 0) + safeDelta;

    // Acumula tiempo en el tab actual
    if (currentTab && safeDelta > 0) {
      row.time_by_tab = row.time_by_tab || {};
      row.time_by_tab[currentTab] = (row.time_by_tab[currentTab] || 0) + safeDelta;
    }

    // Scroll: actualiza solo si el nuevo % es mayor
    if (currentTab && typeof scrollPct === 'number' && scrollPct >= 0 && scrollPct <= 100) {
      row.scroll_by_tab = row.scroll_by_tab || {};
      const prev = row.scroll_by_tab[currentTab] || 0;
      if (scrollPct > prev) row.scroll_by_tab[currentTab] = Math.round(scrollPct);
    }

    // Procesa eventos
    for (const ev of events) {
      switch (ev.type) {
        case 'tab_view':
          row.tab_visits = Array.isArray(row.tab_visits) ? row.tab_visits : [];
          // Cap a 50 entradas
          if (row.tab_visits.length < 50) row.tab_visits.push({ tab: ev.tab, ts: ev.ts });
          break;
        case 'contract_modal_open':
          row.contract_modal_opens = (row.contract_modal_opens || 0) + 1;
          break;
        case 'contract_modal_close':
          row.contract_modal_seconds = (row.contract_modal_seconds || 0) + Math.max(0, Math.min(Math.floor(ev.secondsInside || 0), 1800));
          break;
        case 'glossary_open':
          row.glossary_opens = (row.glossary_opens || 0) + 1;
          break;
        case 'calc_interaction':
          row.calc_interactions = (row.calc_interactions || 0) + 1;
          if (ev.finalState) row.calc_final_state = ev.finalState;
          break;
        case 'signature_attempted':
          if (!row.signature_attempted_at) row.signature_attempted_at = now;
          break;
        case 'contract_checkbox':
          if (!row.contract_checkbox_at) row.contract_checkbox_at = now;
          break;
        case 'wa_clicked':
          row.wa_clicked = true;
          break;
        case 'print_clicked':
          row.print_clicked = true;
          break;
      }
    }

    if (langSwitchedTo) row.lang_switched_to = langSwitchedTo;
    if (endSession) row.ended_at = now;

    // Recalcula score
    row.interest_score = calcInterestScore({
      total_active_seconds: row.total_active_seconds,
      contract_modal_opens: row.contract_modal_opens,
      contract_modal_seconds: row.contract_modal_seconds,
      calc_interactions: row.calc_interactions,
      signature_attempted_at: row.signature_attempted_at,
      contract_checkbox_at: row.contract_checkbox_at,
      wa_clicked: row.wa_clicked,
    });

    // Upsert
    if (existing) {
      const updateRow: Record<string, any> = { ...row };
      delete updateRow.id;
      delete updateRow.invitation_id;
      delete updateRow.session_id;
      delete updateRow.started_at;
      const { error } = await supabase
        .from('partner_invitation_sessions')
        .update(updateRow)
        .eq('id', existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('partner_invitation_sessions')
        .insert(row);
      if (error) throw new Error(error.message);
    }

    return new Response(JSON.stringify({ ok: true, score: row.interest_score }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
