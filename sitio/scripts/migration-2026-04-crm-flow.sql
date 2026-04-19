-- ═══════════════════════════════════════════════════════════════════
--  Migration: CRM end-to-end flow (quote → deal → pagos → contacto 360)
--  Fecha: 2026-04-19
--  Autor: Aaron (via Claude Code)
--
--  Aplica todas las alteraciones necesarias para el plan:
--  /Users/anonimoanonimo/.claude/plans/binary-swimming-stonebraker.md
--
--  Todos los cambios son idempotentes (DO $$ ... IF NOT EXISTS ... $$).
--  Seguro de correr múltiples veces.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. quotes: agregar campos faltantes ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='rechazado_fecha') THEN
    ALTER TABLE quotes ADD COLUMN rechazado_fecha timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_estado ON quotes(estado);
CREATE INDEX IF NOT EXISTS idx_quotes_deal_id ON quotes(deal_id);

-- ─── 2. payments: agregar stripe_payment_id ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='stripe_payment_id') THEN
    ALTER TABLE payments ADD COLUMN stripe_payment_id text;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_id ON payments(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;
  END IF;
END $$;

-- ─── 3. invoices: nueva tabla para facturación ───
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Referencias
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,

  -- Identificadores fiscales
  numero_interno text UNIQUE,
  numero_fiscal text,             -- UUID del SAT
  rfc_cliente text,
  razon_social text,
  uso_cfdi text,
  regimen_fiscal text,

  -- Montos
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  iva numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'MXN',

  -- Tipo y estado
  tipo text CHECK (tipo IN ('unica','recurrente','credito','complemento_pago','parcial')) DEFAULT 'unica',
  estado text CHECK (estado IN ('borrador','emitida','pagada','cancelada','parcial')) DEFAULT 'borrador',
  metodo_pago text,
  forma_pago_sat text,

  -- Stripe
  stripe_invoice_id text UNIQUE,

  -- Archivos
  pdf_url text,
  xml_url text,

  -- Timestamps
  emitida_at timestamptz,
  pagada_at timestamptz,
  cancelada_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_estado ON invoices(estado);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- ─── 4. stripe_events_processed: idempotencia de webhooks ───
CREATE TABLE IF NOT EXISTS stripe_events_processed (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events_processed(event_type);

-- ─── 5. companies: agregar health_score + health_factors ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='health_score') THEN
    ALTER TABLE companies ADD COLUMN health_score integer CHECK (health_score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='health_factors') THEN
    ALTER TABLE companies ADD COLUMN health_factors jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='health_computed_at') THEN
    ALTER TABLE companies ADD COLUMN health_computed_at timestamptz;
  END IF;
END $$;

-- ─── 6. saved_views: vistas guardadas (HubSpot-style) ───
CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  scope text NOT NULL CHECK (scope IN ('contacts','deals','quotes','companies','payments','invoices')),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort jsonb,
  owner_id uuid REFERENCES team_members(id),
  shared boolean DEFAULT false,
  is_default boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_saved_views_scope ON saved_views(scope);
CREATE INDEX IF NOT EXISTS idx_saved_views_owner_id ON saved_views(owner_id);

-- ─── 7. expansion_signals: señales de upsell ───
CREATE TABLE IF NOT EXISTS expansion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('sucursales_delta','mensual_largo','plan_bajo_uso_alto','nps_promoter','high_engagement')),
  detected_at timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES team_members(id),
  opportunity_value numeric(12,2),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_expansion_signals_company ON expansion_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_expansion_signals_active ON expansion_signals(company_id, signal_type) WHERE dismissed_at IS NULL;

-- ─── 8. churn_events: historial de cancelaciones ───
CREATE TABLE IF NOT EXISTS churn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id),
  contact_id uuid REFERENCES contacts(id),
  reason text NOT NULL CHECK (reason IN ('precio','no_uso','competidor','feature_falta','cerro_negocio','otro')),
  reason_detail text,
  mrr_lost numeric(12,2) NOT NULL DEFAULT 0,
  cancelled_at timestamptz DEFAULT now(),
  winback_campaign_id uuid,
  winback_scheduled_at timestamptz,
  retained boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_churn_events_company ON churn_events(company_id);
CREATE INDEX IF NOT EXISTS idx_churn_events_cancelled_at ON churn_events(cancelled_at DESC);

-- ─── 9. Seed saved views para cotizaciones (solo si no existen) ───
INSERT INTO saved_views (scope, name, description, filters, shared, is_default)
VALUES
  ('quotes', 'Todas', 'Todas las cotizaciones', '{}'::jsonb, true, true),
  ('quotes', 'Activas', 'Borradores + enviadas', '{"estado_in":["draft","sent"]}'::jsonb, true, false),
  ('quotes', 'Por vencer', 'Enviadas con vigencia <= 5 días', '{"estado":"sent","vigencia_within_days":5}'::jsonb, true, false),
  ('quotes', 'Rechazadas', 'Con motivo capturado', '{"estado":"rejected"}'::jsonb, true, false)
ON CONFLICT DO NOTHING;

-- ─── 10. Trigger: updated_at automático en invoices ───
CREATE OR REPLACE FUNCTION update_invoices_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_invoices_updated_at();

-- ═══════════════════════════════════════════════════════════════════
--  FIN migration-2026-04-crm-flow.sql
--  Para aplicar: psql "$DATABASE_URL" -f sitio/scripts/migration-2026-04-crm-flow.sql
--  O vía Supabase dashboard → SQL editor → paste this file
-- ═══════════════════════════════════════════════════════════════════
