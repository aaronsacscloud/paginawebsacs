-- ============================================================================
--  Trazabilidad cotización → suscripción
--  Fecha: 2026-07-21
--  Agrega subscriptions.quote_id para saber de qué cotización nació cada
--  suscripción (hoy no se guardaba). La creación desde mark-accepted ya lo
--  escribe de forma tolerante; esta columna lo persiste.
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_quote_id ON subscriptions(quote_id);

-- Verificación
SELECT column_name FROM information_schema.columns
WHERE table_name = 'subscriptions' AND column_name = 'quote_id';   -- espera: 1 fila
