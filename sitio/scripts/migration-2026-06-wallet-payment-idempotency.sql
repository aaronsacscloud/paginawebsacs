-- ============================================================================
-- Idempotencia ROBUSTA de comisiones de referido — respaldo por stripe_payment_id.
--
-- Bug review: la idempotencia de las comisiones (Buddy y Embajador) se apoyaba
-- en índices únicos por referred_email. Pero si el email del referido no se
-- resuelve (customer Stripe sin email / fallo al leerlo), queda NULL — y en
-- Postgres los NULL NO colisionan en un índice único → doble acreditación posible.
--
-- stripe_payment_id (el invoice.id) SIEMPRE está poblado en las comisiones y es
-- único por pago, así que es la llave de idempotencia correcta e independiente
-- del email. Cubre AMBOS programas.
--
-- Idempotente (re-correr seguro).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_commission_once_per_payment
  ON wallet_ledger(stripe_payment_id)
  WHERE kind IN ('client_referral_commission', 'referral_payment_commission')
    AND stripe_payment_id IS NOT NULL;
