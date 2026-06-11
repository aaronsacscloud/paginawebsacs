-- ============================================================================
-- Programa de referidos "Buddy" — Fase 1: multi-Buddy + billetera de créditos.
--
-- Construye sobre migration-2026-06-gifts.sql. Todo idempotente (re-correr seguro).
--
--   1) gifts pasa de "1 regalo por cuenta" a "MUCHOS regalos por cuenta"
--      (historial = muro Tus Buddys), pero solo UNO ACTIVO a la vez.
--   2) wallet_ledger: libro mayor APPEND-ONLY del Saldo Sacs. Cada bono/comisión/
--      recompensa/gasto es una fila INMUTABLE. El saldo = SUMA de filas.
--      Los topes ("$2,000 una vez por regalo", "30% una vez al año por cliente")
--      se hacen cumplir con ÍNDICES ÚNICOS PARCIALES → imposibles de duplicar
--      aunque el webhook de Stripe se dispare repetido.
-- ============================================================================

-- ─── 1) gifts: de 1-por-cuenta a multi-Buddy (1 activo a la vez) ─────────────
-- El índice viejo era UNIQUE(padrino_account) (1 regalo por cuenta de por vida).
DROP INDEX IF EXISTS idx_gifts_padrino_account;
-- Índice NO único para buscar todos los regalos del padrino (historial).
CREATE INDEX IF NOT EXISTS idx_gifts_padrino_account ON gifts(padrino_account);
-- Regla de negocio: solo UN regalo ACTIVO (pendiente o en redención) por cuenta.
-- Permite N regalos redeemed/expired (historial), pero nunca 2 vivos a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gifts_one_active_per_padrino
  ON gifts(padrino_account) WHERE status IN ('pending', 'redeeming');

-- ─── 2) wallet_ledger: billetera única (Saldo Sacs), append-only ─────────────
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dueño del saldo = la cuenta sacs3 del padrino.
  account text NOT NULL,
  -- + crédito (bono/comisión/recompensa) · − gasto. numeric, NUNCA float.
  amount_mxn numeric(12,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'referral_activation_bonus',    -- $2,000 cuando el amigo activa su año gratis
    'referral_payment_commission',  -- 30% cuando el referido paga (1/año/cliente)
    'academia_reward',              -- recompensas de la Academia (dinero real)
    'spend_plugin',                 -- (futuro) gasto en un plugin
    'spend_consultoria',            -- (futuro) gasto en consultoría
    'spend_other',                  -- (futuro) otro gasto
    'adjustment'                    -- ajuste manual auditado
  )),
  -- Concepto legible que ve el usuario en su ledger.
  concepto text NOT NULL,
  -- Trazabilidad / idempotencia.
  gift_code uuid,                   -- regalo que originó el crédito
  referred_email text,              -- ahijado que disparó el crédito
  stripe_payment_id text,           -- pago de Stripe que originó la comisión
  ref_year int,                     -- año fiscal (tope 1/año/cliente del 30%)
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_account ON wallet_ledger(account);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_account_created
  ON wallet_ledger(account, created_at DESC);

-- Idempotencia del BONO de activación: máximo UNO por regalo. Aunque el webhook
-- de Stripe llegue dos veces, el segundo insert choca con este índice → no paga
-- doble. (Solo aplica a filas del bono.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_activation_bonus_once
  ON wallet_ledger(gift_code) WHERE kind = 'referral_activation_bonus';

-- Tope del 30% "una vez al año por cliente": máximo UNA comisión por
-- (referido, año). El segundo intento del mismo año choca → no se duplica.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_commission_once_per_year
  ON wallet_ledger(referred_email, ref_year) WHERE kind = 'referral_payment_commission';

-- RLS: solo la service key del backend escribe/lee (sin policies = cerrado).
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
