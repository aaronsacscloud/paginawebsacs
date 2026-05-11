// Partner Invitation Heartbeat
// POST /api/partners/invitation-heartbeat
//
// Endpoint público (sin auth) que recibe pings del cliente desde la página
// pública de la invitación. Delega TODO el merge + scoring a la función PL/pgSQL
// `track_session_heartbeat` vía RPC para hacerlo en UNA sola operación DB
// (en lugar de SELECT + UPDATE separados).
//
// Idempotente por (invitation_id, session_id) — el cliente genera el
// session_id una vez por pestaña y lo manda en cada ping.

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

    // Una sola llamada RPC — la función PL/pgSQL hace todo el merge atómicamente
    const { data, error } = await supabase.rpc('track_session_heartbeat', {
      p_invitation_id: invitationId,
      p_session_id: sessionId,
      p_delta_seconds: Math.floor(deltaSeconds || 0),
      p_current_tab: currentTab ?? null,
      p_scroll_pct: typeof scrollPct === 'number' ? Math.round(scrollPct) : null,
      p_events: events,
      p_end_session: !!endSession,
      p_device: device ?? null,
      p_user_agent: userAgent ?? null,
      p_referrer: referrer ?? null,
      p_lang_switched_to: langSwitchedTo ?? null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data || { ok: true, score: 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
