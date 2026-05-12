-- Push subscriptions del portal partner para web push.
-- Cada partner puede tener múltiples suscripciones (1 por device/browser).
-- partner_id es el team_members.id (UUID).

CREATE TABLE IF NOT EXISTS partner_push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  -- Preferencias de tipos de notificación (jsonb flexible)
  -- ej: { pago: true, lead: true, demo: true, partner: true, achievement: true }
  prefs       JSONB NOT NULL DEFAULT '{"pago":true,"lead":true,"demo":true,"partner":true,"achievement":true}'::jsonb,
  -- Estado de la suscripción
  active      BOOLEAN NOT NULL DEFAULT true,
  -- Si el endpoint rechaza pushes, lo marcamos como inactive
  failure_count INT NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  UNIQUE (partner_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_partner ON partner_push_subscriptions(partner_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON partner_push_subscriptions(endpoint);

COMMENT ON TABLE partner_push_subscriptions IS 'Web Push subscriptions del portal partner. Cada partner puede tener N (1 por device/browser).';
COMMENT ON COLUMN partner_push_subscriptions.prefs IS 'Tipos de notificación que el partner quiere recibir: {pago, lead, demo, partner, achievement}';
COMMENT ON COLUMN partner_push_subscriptions.failure_count IS 'Si llega a 3, marcamos active=false y dejamos de enviar';
