-- CRM · Pagos v2 — atribución a RR/partner + índices para el listado de pagos.
-- Correr una vez en el SQL Editor de Supabase (exec_sql no está disponible en esta
-- instancia). Idempotente. Luego el endpoint POST /api/crm/arr/setup?key=sacs-arr-2026
-- lo verifica (payments_partner / subscriptions_partner = ok).

-- Fase 4 — atribución a PARTNER/RR (quién vende/atiende la licencia).
-- team_members es la tabla de partners (misma que usa partner_commissions.partner_id).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE payments      ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

-- Fase 5 — índices para listar/agrupar pagos rápido (por tipo, fecha, contacto/empresa).
CREATE INDEX IF NOT EXISTS idx_payments_metodo        ON payments(metodo);
CREATE INDEX IF NOT EXISTS idx_payments_fecha         ON payments(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_payments_company       ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_contact       ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription  ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_partner       ON payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_partner  ON subscriptions(partner_id);
