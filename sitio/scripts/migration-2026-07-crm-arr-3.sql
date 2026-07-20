-- CRM ARR fase 3 — planes nuevos del catálogo: personalizada y soporte_premium.
-- Idempotente. Pegar en el SQL Editor de Supabase.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_check;
ALTER TABLE companies ADD CONSTRAINT companies_plan_check
  CHECK (plan IN ('vende','controla','fideliza','automatiza','personalizada','soporte_premium'));
