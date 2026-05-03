-- ════════════════════════════════════════════════════════════════════
--  Migration: Partner Portal foundation
--  Fecha: 2026-05
--
--  Cambios:
--    1. Atribución: referrer_partner_id en bookings, contacts, deals
--    2. partner_commissions: tipo + booking_id + contact_id + nota,
--       deal_id ahora opcional (bonos no requieren deal)
--    3. Auth: password_hash + last_login_at en team_members,
--       password_reset_tokens, partner_sessions
--    4. Fideliza: fideliza_account_at en team_members
--
--  Idempotente. Seguro re-correr.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Atribución partner ───
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referrer_partner_id uuid REFERENCES team_members(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referrer_partner_id uuid REFERENCES team_members(id);
ALTER TABLE deals    ADD COLUMN IF NOT EXISTS referrer_partner_id uuid REFERENCES team_members(id);

CREATE INDEX IF NOT EXISTS idx_bookings_referrer_partner ON bookings(referrer_partner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_referrer_partner ON contacts(referrer_partner_id);
CREATE INDEX IF NOT EXISTS idx_deals_referrer_partner    ON deals(referrer_partner_id);

-- ─── 2. partner_commissions: bonos sin deal + tipo ───
-- deal_id ahora opcional (bonos prueba_gratis y demo_completada no requieren deal)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='partner_commissions' AND column_name='deal_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE partner_commissions ALTER COLUMN deal_id DROP NOT NULL;
  END IF;
END $$;

-- UNIQUE (deal_id) bloquea inserción de bonos sin deal — necesitamos índice condicional
ALTER TABLE partner_commissions DROP CONSTRAINT IF EXISTS partner_commissions_deal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_deal_id_uniq
  ON partner_commissions(deal_id) WHERE deal_id IS NOT NULL;

ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'venta_directa';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name='partner_commissions_tipo_check'
  ) THEN
    ALTER TABLE partner_commissions ADD CONSTRAINT partner_commissions_tipo_check
      CHECK (tipo IN ('venta_directa', 'demo_completada', 'prueba_gratis', 'manual'));
  END IF;
END $$;

ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id);
ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);
ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS nota text;

-- Idempotencia para bonos:
--   - Una sola comisión por booking (demo_completada)
--   - Una sola comisión por contact (prueba_gratis)
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_booking_uniq
  ON partner_commissions(booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_contact_prueba_uniq
  ON partner_commissions(contact_id, tipo) WHERE contact_id IS NOT NULL AND tipo = 'prueba_gratis';

CREATE INDEX IF NOT EXISTS idx_commissions_tipo ON partner_commissions(partner_id, tipo, status);

-- ─── 3. Auth: passwords + sesiones + reset tokens ───
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS fideliza_account_at timestamptz;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset', 'initial')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_member ON password_reset_tokens(team_member_id);

CREATE TABLE IF NOT EXISTS partner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_hash ON partner_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_partner_sessions_member ON partner_sessions(team_member_id, expires_at);
