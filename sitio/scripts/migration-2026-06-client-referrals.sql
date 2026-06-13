-- ============================================================================
-- Programa "Embajador Sacs" — cada cliente es referidor automático (sin aprobación).
--
-- Distinto del Regalo Buddy (licencia GRATIS, 1 sola, post-curso):
--   • Link PERMANENTE de cada cliente (sacscloud.com/r/<account>), disponible
--     siempre, haya terminado el curso o no.
--   • El referido obtiene 50% OFF su PRIMER AÑO del Plan Vende (1 sucursal).
--   • Cuando el referido PAGA, el cliente referidor gana 40% del valor de la
--     licencia ($2,400) en créditos Sacs (mismo wallet_ledger que el Buddy).
--
-- Todo idempotente (re-correr seguro).
-- ============================================================================

-- ─── 1) wallet_ledger: nuevo kind 'client_referral_commission' ──────────────
-- El CHECK de kind es un constraint con nombre autogenerado. Para agregar un
-- valor hay que recrearlo. Idempotente: DROP IF EXISTS + ADD.
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_kind_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_kind_check CHECK (kind IN (
  'referral_activation_bonus',    -- Buddy: bono cuando el amigo activa año gratis
  'referral_payment_commission',  -- Buddy: 40% cuando el referido paga
  'client_referral_commission',   -- Embajador: 40% de la licencia cuando el referido paga (NUEVO)
  'academia_reward',              -- recompensas de la Academia
  'spend_plugin',                 -- (futuro) gasto en un plugin
  'spend_consultoria',            -- (futuro) gasto en consultoría
  'spend_other',                  -- (futuro) otro gasto
  'adjustment'                    -- ajuste manual auditado
));

-- Idempotencia del bono Embajador: máximo UNA comisión por referido (su 1er pago).
-- Aunque el webhook de Stripe se repita, el segundo insert choca → no paga doble.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_client_commission_once
  ON wallet_ledger(referred_email) WHERE kind = 'client_referral_commission';

-- ─── 2) client_referrals: tracking de referidos del cliente (métricas + CRM) ─
CREATE TABLE IF NOT EXISTS client_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cuenta sacs3 del cliente que refiere (dueño del link /r/<account>).
  referrer_account text NOT NULL,
  -- Datos del referido.
  referred_email text NOT NULL,
  referred_account text,            -- cuenta sacs3 creada al referido (al pagar)
  stripe_subscription_id text,
  -- Embudo: 'started' (entró al registro) → 'paid' (pagó su 1er año).
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'paid', 'cancelled')),
  commission_credited boolean DEFAULT false,  -- si ya se acreditó el 40% al referidor
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  meta jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON client_referrals(referrer_account);
CREATE INDEX IF NOT EXISTS idx_client_referrals_email ON client_referrals(referred_email);
-- Un referido (email) entra una sola vez al embudo de un mismo referidor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_referrals_unique
  ON client_referrals(referrer_account, referred_email);

-- RLS: solo la service key del backend escribe/lee (sin policies = cerrado).
ALTER TABLE client_referrals ENABLE ROW LEVEL SECURITY;
