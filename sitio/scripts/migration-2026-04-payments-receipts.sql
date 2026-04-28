-- ═══════════════════════════════════════════════════════════════════
--  Migration: Pagos relacionados a cotizacion + acuses de pago
--  Fecha: 2026-04-28
--  Autor: Aaron (via Claude Code)
--
--  Aplica todas las alteraciones para el flujo "registrar pagos desde
--  la cotizacion + generar acuses publicos + envio por email".
--
--  Ver plan: ~/.claude/plans/vamos-atrabajr-sobre-la-sparkling-ripple.md
--  Todos los cambios son idempotentes — seguro re-correr.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. payments: relacion con quote + datos del acuse ───
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS comprobante_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS numero_acuse text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS items_cubiertos jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS estado text DEFAULT 'confirmado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_estado_check' AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_estado_check
      CHECK (estado IN ('pendiente','confirmado','reembolsado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON payments(quote_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_numero_acuse
  ON payments(numero_acuse) WHERE numero_acuse IS NOT NULL;

-- ─── 2. quotes: timestamp de pago completo ───
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pagado_fecha timestamptz;

-- ─── 3. Numeracion consecutiva del acuse: AC-YYYY-NNNN ───
CREATE SEQUENCE IF NOT EXISTS payments_acuse_seq;

CREATE OR REPLACE FUNCTION assign_numero_acuse() RETURNS trigger AS $$
DECLARE n bigint;
BEGIN
  IF NEW.numero_acuse IS NULL THEN
    n := nextval('payments_acuse_seq');
    NEW.numero_acuse := 'AC-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_acuse ON payments;
CREATE TRIGGER trg_payments_acuse
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION assign_numero_acuse();

-- ═══════════════════════════════════════════════════════════════════
--  FIN migration-2026-04-payments-receipts.sql
--  Aplicar via Supabase dashboard → SQL editor → paste this file
-- ═══════════════════════════════════════════════════════════════════
