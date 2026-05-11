-- partner_invitation_sessions: tracking granular de interés del partner
-- en su invitación pública. Una fila por "sesión" (gap > 30 min crea nueva).
--
-- Reemplaza el tracking actual (que solo guarda view_count / first_viewed_at /
-- last_viewed_at en la fila de la invitación) con métricas ricas que permiten
-- calcular un "interest score" 0-100.
--
-- Tracking incluido:
--  - Tiempo activo total y por tab (heartbeat cada 15s con visibility API)
--  - Profundidad máxima de scroll por tab
--  - Apertura del modal de contrato (count + segundos dentro)
--  - Apertura del modal de glosario (count)
--  - Interacciones con la calculadora (count + estado final)
--  - Trazo en canvas de firma (sin completar = casi-firma, señal premium)
--  - Check del checkbox "He leído íntegramente el contrato"
--  - Clicks en WhatsApp flotante, Print, cambio de idioma
--  - Visitas a tabs (orden y frecuencia)
--  - Device, country, referrer (contexto del lead)

CREATE TABLE IF NOT EXISTS partner_invitation_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id    UUID NOT NULL REFERENCES partner_invitations(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL,  -- random uuid generado en el cliente
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,    -- se llena en sendBeacon de visibilitychange

  -- Tiempo (en segundos) — heartbeat suma deltas mientras la pestaña es visible
  total_active_seconds INT NOT NULL DEFAULT 0,
  time_by_tab          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ej. {"bienvenida":120,"terminos":340,"red":85}

  -- Scroll depth (porcentaje 0-100) máximo por tab
  scroll_by_tab        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Ej. {"bienvenida":78,"terminos":12}

  -- Contract modal interactions
  contract_modal_opens     INT NOT NULL DEFAULT 0,
  contract_modal_seconds   INT NOT NULL DEFAULT 0,

  -- Glossary modal interactions
  glossary_opens           INT NOT NULL DEFAULT 0,

  -- Calculator interactions
  calc_interactions        INT NOT NULL DEFAULT 0,
  calc_final_state         JSONB,
  -- Ej. {"pruebas":15,"demos":8,"clientes":20,"plan":"fideliza"}

  -- Signature attempt (mousedown en el canvas pero no completó)
  signature_attempted_at   TIMESTAMPTZ,

  -- Acceptance checkbox
  contract_checkbox_at     TIMESTAMPTZ,

  -- FAB clicks
  wa_clicked               BOOLEAN NOT NULL DEFAULT FALSE,
  print_clicked            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Language switching
  lang_switched_to         TEXT,  -- 'en', 'fr', 'it', 'pt' o NULL

  -- Tab visits (array de eventos con cap de 50 entradas)
  tab_visits               JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ej. [{"tab":"bienvenida","ts":"2026-05-12T10:00:00Z"},...]

  -- Context
  device                   TEXT,   -- 'mobile' | 'tablet' | 'desktop'
  user_agent               TEXT,
  country                  TEXT,   -- ISO-3166 alpha-2
  city                     TEXT,
  referrer                 TEXT,

  -- Composite score 0-100 calculado por el endpoint cada update
  interest_score           INT NOT NULL DEFAULT 0,

  -- Idempotencia
  UNIQUE (invitation_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_pis_invitation_started
  ON partner_invitation_sessions (invitation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pis_invitation_score
  ON partner_invitation_sessions (invitation_id, interest_score DESC);

COMMENT ON TABLE partner_invitation_sessions IS
  'Tracking granular por sesión de la invitación pública. Una fila por sesión (gap > 30 min crea nueva). Backbone del interest score del partner.';

COMMENT ON COLUMN partner_invitation_sessions.interest_score IS
  '0-100 composite. Tiempo activo + contract modal + canvas firma + checkbox + calc + retornos.';
