-- CRM ARR fase 5 — el LEDGER de movimientos MRR (la pieza fundacional que
-- alimenta NRR/GRR, churn, cohortes, expansión/contracción y forecast) + campos
-- ligeros para trials, add-ons, cupones y contratos multi-año.
-- Idempotente. Pegar en el SQL Editor de Supabase.

-- ── 1 · Ledger de movimientos MRR ──────────────────────────────────────────
-- Cada cambio de MRR de una suscripción deja aquí un renglón. Con esto el ARR
-- deja de ser una foto y se vuelve una película: se puede responder "¿cuánto
-- MRR nuevo/expandido/perdido hubo en junio?" y calcular NRR/GRR/cohortes.
CREATE TABLE IF NOT EXISTS mrr_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id),
  company_id uuid REFERENCES companies(id),
  fecha date NOT NULL DEFAULT current_date,
  -- new: alta · expansion: subió · contraction: bajó · churn: se fue ·
  -- reactivation: regresó · renewal: renovó sin cambio (informativo)
  tipo text NOT NULL CHECK (tipo IN ('new','expansion','contraction','churn','reactivation','renewal')),
  mrr_delta numeric(12,2) NOT NULL DEFAULT 0,   -- +/-  el cambio de MRR
  mrr_anterior numeric(12,2) NOT NULL DEFAULT 0,
  mrr_nuevo numeric(12,2) NOT NULL DEFAULT 0,
  motivo text,                                   -- razón de churn, "cambio de plan", etc.
  actor text,                                    -- quién lo provocó (email/founder/cron/stripe)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mrr_mov_fecha ON mrr_movements(fecha);
CREATE INDEX IF NOT EXISTS idx_mrr_mov_company ON mrr_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_mrr_mov_sub ON mrr_movements(subscription_id);

-- ── 2 · Trials (#7) — estado de prueba con conversión medible ──────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS es_trial boolean NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_fin date;

-- ── 3 · Contrato multi-año (#10) ───────────────────────────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plazo_meses int;              -- 12, 24, 36…
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS incremento_anual_pct numeric(5,2); -- escalador

-- ── 4 · Cupones / descuentos (#6) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id),
  company_id uuid REFERENCES companies(id),
  tipo text NOT NULL DEFAULT 'porcentaje' CHECK (tipo IN ('porcentaje','monto')),
  valor numeric(12,2) NOT NULL,        -- 20 (=20%) o 500 (=$500)
  motivo text,                          -- 'retención', 'lanzamiento', etc.
  vigente_desde date NOT NULL DEFAULT current_date,
  vigente_hasta date,                   -- null = permanente
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 5 · Add-ons como líneas de la suscripción (#8) ─────────────────────────
CREATE TABLE IF NOT EXISTS subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id),
  company_id uuid REFERENCES companies(id),
  nombre text NOT NULL,                 -- 'Sucursal extra', 'Soporte premium', 'Plugin VIP'
  precio numeric(12,2) NOT NULL DEFAULT 0,  -- por ciclo de la sub
  cantidad int NOT NULL DEFAULT 1,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 6 · Reembolsos/ajustes de pago (#10 huecos) ────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reembolsado boolean NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS es_ajuste boolean NOT NULL DEFAULT false; -- monto negativo = reversa
