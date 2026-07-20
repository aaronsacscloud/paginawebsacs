-- CRM ARR fase 2 — clasificación de cuentas en Conciliación.
-- Idempotente. Pegar en el SQL Editor de Supabase.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tipo_cuenta text DEFAULT 'sin_clasificar';
CREATE INDEX IF NOT EXISTS idx_companies_tipo_cuenta ON companies(tipo_cuenta);
