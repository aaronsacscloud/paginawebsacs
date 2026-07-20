-- ═══════════════════════════════════════════════════════════════════
-- CRM ARR — suscripciones (N por empresa), liga a cuenta SACS,
-- actividad real, metas configurables y pagos ligados a suscripción.
-- Idempotente: se puede correr múltiples veces.
-- ═══════════════════════════════════════════════════════════════════

-- 1 · Suscripciones: mensual y anual como ciudadanos de primera clase.
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  nombre_plan text NOT NULL,
  ciclo text NOT NULL CHECK (ciclo IN ('mensual','anual')),
  estado text NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa','pendiente_pago','pausada','cancelada','programada')),
  -- precio = lo que se cobra POR CICLO (mensual: al mes; anual: al año)
  precio numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'MXN',
  -- normalizados para métricas (mensual: mrr=precio; anual: mrr=precio/12)
  mrr numeric(12,2) NOT NULL DEFAULT 0,
  arr numeric(12,2) NOT NULL DEFAULT 0,
  fecha_inicio date,
  proxima_factura date,
  monto_proximo numeric(12,2),
  pagos_realizados integer NOT NULL DEFAULT 0,
  total_pagado numeric(12,2) NOT NULL DEFAULT 0,
  stripe_subscription_id text,
  razon_cancelacion text,
  cancelada_at timestamptz,
  notas text,
  migrada_de_excel boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company  ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_estado   ON subscriptions(estado);
CREATE INDEX IF NOT EXISTS idx_subscriptions_proxima  ON subscriptions(proxima_factura);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ciclo    ON subscriptions(ciclo);

-- 2 · Liga companies ↔ cuenta SACS + actividad real (la llena el cron de sync).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sacs_account text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS actividad jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ultima_venta_at date;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS dias_sin_venta integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS actividad_sync_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_companies_sacs_account ON companies(sacs_account);

-- 3 · Pagos ligados a suscripción (histórico y futuros).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS periodo_cubierto text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS migrado boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);

-- 4 · Metas configurables (ARR global anual y new-ARR mensual opcional).
CREATE TABLE IF NOT EXISTS crm_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL DEFAULT 'arr' CHECK (tipo IN ('arr','new_arr_mensual')),
  anio integer NOT NULL,
  mes integer CHECK (mes BETWEEN 1 AND 12),
  monto numeric(14,2) NOT NULL,
  UNIQUE (tipo, anio, mes)
);
