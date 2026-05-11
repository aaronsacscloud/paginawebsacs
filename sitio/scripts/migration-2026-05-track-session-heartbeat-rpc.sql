-- track_session_heartbeat: función PL/pgSQL que hace upsert atómico + recalcula
-- score en UNA sola operación DB (en lugar de SELECT + UPDATE separados).
--
-- El endpoint Node/Astro `/api/partners/invitation-heartbeat` llama esto via RPC.
-- Reduce ~50% de DB ops del sistema de tracking.
--
-- Idempotente por (invitation_id, session_id). Maneja:
--  - Upsert de la sesión (INSERT si no existe, sino UPDATE)
--  - Acumulación de tiempo total + tiempo por tab
--  - Max scroll por tab
--  - Procesa array de eventos discretos (contract_modal_open/close, glossary,
--    calc, signature, checkbox, wa_click, print_click, tab_view)
--  - Recalcula interest_score 0-100 server-side
--
-- Returns: { ok: true, score: <int> }

CREATE OR REPLACE FUNCTION track_session_heartbeat(
  p_invitation_id     UUID,
  p_session_id        TEXT,
  p_delta_seconds     INT DEFAULT 0,
  p_current_tab       TEXT DEFAULT NULL,
  p_scroll_pct        INT DEFAULT NULL,
  p_events            JSONB DEFAULT '[]'::jsonb,
  p_end_session       BOOLEAN DEFAULT FALSE,
  p_device            TEXT DEFAULT NULL,
  p_user_agent        TEXT DEFAULT NULL,
  p_referrer          TEXT DEFAULT NULL,
  p_lang_switched_to  TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_event       JSONB;
  v_event_type  TEXT;
  v_safe_delta  INT;
  v_score       INT;
BEGIN
  v_safe_delta := GREATEST(0, LEAST(COALESCE(p_delta_seconds, 0), 60));

  -- Asegura que la fila exista (idempotente)
  INSERT INTO partner_invitation_sessions
    (invitation_id, session_id, device, user_agent, referrer)
  VALUES
    (p_invitation_id, p_session_id, p_device, p_user_agent, p_referrer)
  ON CONFLICT (invitation_id, session_id) DO NOTHING;

  -- Update general (tiempo, scroll, contexto, end)
  UPDATE partner_invitation_sessions SET
    last_seen_at = NOW(),
    total_active_seconds = total_active_seconds + v_safe_delta,
    time_by_tab = CASE
      WHEN p_current_tab IS NOT NULL AND v_safe_delta > 0
      THEN jsonb_set(
        COALESCE(time_by_tab, '{}'::jsonb),
        ARRAY[p_current_tab],
        to_jsonb(COALESCE(NULLIF(time_by_tab->>p_current_tab, '')::int, 0) + v_safe_delta)
      )
      ELSE COALESCE(time_by_tab, '{}'::jsonb)
    END,
    scroll_by_tab = CASE
      WHEN p_current_tab IS NOT NULL
        AND p_scroll_pct IS NOT NULL
        AND p_scroll_pct >= 0
        AND p_scroll_pct <= 100
        AND p_scroll_pct > COALESCE(NULLIF(scroll_by_tab->>p_current_tab, '')::int, 0)
      THEN jsonb_set(
        COALESCE(scroll_by_tab, '{}'::jsonb),
        ARRAY[p_current_tab],
        to_jsonb(p_scroll_pct)
      )
      ELSE COALESCE(scroll_by_tab, '{}'::jsonb)
    END,
    lang_switched_to = COALESCE(p_lang_switched_to, lang_switched_to),
    ended_at = CASE WHEN p_end_session THEN NOW() ELSE ended_at END
  WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

  -- Procesa eventos (si los hay)
  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      v_event_type := v_event->>'type';

      IF v_event_type = 'contract_modal_open' THEN
        UPDATE partner_invitation_sessions
          SET contract_modal_opens = contract_modal_opens + 1
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'contract_modal_close' THEN
        UPDATE partner_invitation_sessions
          SET contract_modal_seconds = contract_modal_seconds +
            LEAST(GREATEST(COALESCE((v_event->>'secondsInside')::int, 0), 0), 1800)
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'glossary_open' THEN
        UPDATE partner_invitation_sessions
          SET glossary_opens = glossary_opens + 1
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'calc_interaction' THEN
        UPDATE partner_invitation_sessions SET
          calc_interactions = calc_interactions + 1,
          calc_final_state = CASE WHEN v_event ? 'finalState'
            THEN v_event->'finalState'
            ELSE calc_final_state
          END
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'signature_attempted' THEN
        UPDATE partner_invitation_sessions
          SET signature_attempted_at = COALESCE(signature_attempted_at, NOW())
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'contract_checkbox' THEN
        UPDATE partner_invitation_sessions
          SET contract_checkbox_at = COALESCE(contract_checkbox_at, NOW())
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'wa_clicked' THEN
        UPDATE partner_invitation_sessions
          SET wa_clicked = TRUE
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'print_clicked' THEN
        UPDATE partner_invitation_sessions
          SET print_clicked = TRUE
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;

      ELSIF v_event_type = 'tab_view' THEN
        UPDATE partner_invitation_sessions
          SET tab_visits = CASE
            WHEN jsonb_array_length(COALESCE(tab_visits, '[]'::jsonb)) < 50
            THEN COALESCE(tab_visits, '[]'::jsonb) ||
              jsonb_build_array(jsonb_build_object('tab', v_event->>'tab', 'ts', v_event->>'ts'))
            ELSE tab_visits
          END
          WHERE invitation_id = p_invitation_id AND session_id = p_session_id;
      END IF;
    END LOOP;
  END IF;

  -- Recalcula interest_score basado en estado actualizado
  UPDATE partner_invitation_sessions SET
    interest_score = LEAST(100, ROUND(
      LEAST(total_active_seconds::numeric / 600, 1) * 25 +
      (CASE WHEN contract_modal_opens > 0 THEN 15 ELSE 0 END) +
      LEAST(contract_modal_seconds::numeric / 300, 1) * 10 +
      (CASE WHEN calc_interactions > 0 THEN 10 ELSE 0 END) +
      (CASE WHEN signature_attempted_at IS NOT NULL THEN 25 ELSE 0 END) +
      (CASE WHEN contract_checkbox_at IS NOT NULL THEN 10 ELSE 0 END) +
      (CASE WHEN wa_clicked THEN 5 ELSE 0 END)
    )::int)
  WHERE invitation_id = p_invitation_id AND session_id = p_session_id
  RETURNING interest_score INTO v_score;

  RETURN jsonb_build_object('ok', true, 'score', COALESCE(v_score, 0));
END;
$$;

COMMENT ON FUNCTION track_session_heartbeat IS
  'Upsert atómico + scoring de partner_invitation_sessions. Llamado via RPC desde /api/partners/invitation-heartbeat. Reduce 2 DB ops a 1.';

-- Grant para el rol service_role (que usa el server) — Supabase ya da privs
-- por default a authenticated y service_role, pero ser explícito no hace daño.
GRANT EXECUTE ON FUNCTION track_session_heartbeat(
  UUID, TEXT, INT, TEXT, INT, JSONB, BOOLEAN, TEXT, TEXT, TEXT, TEXT
) TO service_role, authenticated, anon;
