-- ═══════════════════════════════════════════════════════════
-- CRM SACS — Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nombre text NOT NULL,
  email text NOT NULL UNIQUE,
  rol text NOT NULL DEFAULT 'vendedor' CHECK (rol IN ('admin','vendedor','soporte')),
  activo boolean NOT NULL DEFAULT true
);

-- Seed default team member
INSERT INTO team_members (nombre, email, rol) VALUES ('Admin', 'admin@sacscloud.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 2. Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Identity
  nombre text NOT NULL,
  rfc text,
  razon_social text,
  giro text,
  sitio_web text,
  -- Location
  ciudad text,
  estado_geo text,
  pais text NOT NULL DEFAULT 'MX',
  -- Subscription
  plan text CHECK (plan IN ('vende','controla','fideliza','automatiza')),
  billing_period text CHECK (billing_period IN ('mensual','anual')),
  sucursales int NOT NULL DEFAULT 1,
  precio_por_sucursal decimal(10,2),
  mrr decimal(10,2) NOT NULL DEFAULT 0,
  arr decimal(10,2) NOT NULL DEFAULT 0,
  metodo_pago text CHECK (metodo_pago IN ('transferencia','tarjeta','oxxo','otro')),
  fecha_inicio date,
  fecha_renovacion date,
  estado_cuenta text NOT NULL DEFAULT 'prospecto'
    CHECK (estado_cuenta IN ('prospecto','trial','activo','vencido','cancelado','pausado')),
  -- Health
  health_score int,
  last_payment_at timestamptz,
  months_active int NOT NULL DEFAULT 0,
  ltv decimal(12,2) NOT NULL DEFAULT 0,
  -- Stripe
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Soft delete
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_companies_nombre ON companies(nombre);
CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);
CREATE INDEX IF NOT EXISTS idx_companies_estado ON companies(estado_cuenta);
CREATE INDEX IF NOT EXISTS idx_companies_renovacion ON companies(fecha_renovacion) WHERE estado_cuenta = 'activo';

-- 3. Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Identity
  nombre text NOT NULL,
  apellido text,
  email text,
  whatsapp text,
  telefono text,
  -- Classification
  tipo text NOT NULL DEFAULT 'lead' CHECK (tipo IN ('lead','cliente','partner','churned')),
  lifecycle_stage text NOT NULL DEFAULT 'lead'
    CHECK (lifecycle_stage IN (
      'suscriptor','lead','lead_calificado','oportunidad','cliente','evangelista','churned'
    )),
  -- Source
  fuente text,
  fuente_detalle text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  -- Scoring
  lead_score int NOT NULL DEFAULT 0,
  total_time_on_site int NOT NULL DEFAULT 0,
  pages_visited text,
  page_count int NOT NULL DEFAULT 0,
  visitor_id text,
  -- Sales
  owner_id uuid REFERENCES team_members(id),
  next_followup date,
  last_contact_at timestamptz,
  -- Company link
  company_id uuid REFERENCES companies(id),
  puesto text,
  -- Plan interest (for leads)
  plan_interes text,
  giro text,
  sucursales_interes int,
  -- Migration references
  stripe_customer_id text UNIQUE,
  legacy_client_id uuid,
  -- Soft delete
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp ON contacts(whatsapp);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON contacts(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tipo ON contacts(tipo);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_followup ON contacts(next_followup) WHERE next_followup IS NOT NULL;

-- 4. Deals
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Identity
  nombre text NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  company_id uuid REFERENCES companies(id),
  -- Deal details
  plan text CHECK (plan IN ('vende','controla','fideliza','automatiza')),
  sucursales int NOT NULL DEFAULT 1,
  billing_period text CHECK (billing_period IN ('mensual','anual')),
  valor_mensual decimal(10,2) NOT NULL DEFAULT 0,
  valor_total decimal(12,2) NOT NULL DEFAULT 0,
  -- Pipeline
  stage text NOT NULL DEFAULT 'calificacion'
    CHECK (stage IN (
      'calificacion','demo_agendada','demo_realizada',
      'cotizacion_enviada','negociacion',
      'cerrada_ganada','cerrada_perdida'
    )),
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  probabilidad int NOT NULL DEFAULT 20,
  motivo_perdida text,
  competidor text,
  -- Timing
  fecha_cierre_esperada date,
  closed_at timestamptz,
  days_in_pipeline int,
  -- Links
  quote_id uuid,
  owner_id uuid REFERENCES team_members(id),
  -- Soft delete
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);

-- 5. Activities
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Polymorphic links
  contact_id uuid REFERENCES contacts(id),
  company_id uuid REFERENCES companies(id),
  deal_id uuid REFERENCES deals(id),
  quote_id uuid,
  -- Activity
  tipo text NOT NULL CHECK (tipo IN (
    'nota','llamada',
    'whatsapp_enviado','whatsapp_recibido',
    'email_enviado','email_recibido',
    'demo_agendada','demo_realizada',
    'cotizacion_creada','cotizacion_enviada','cotizacion_vista','cotizacion_aceptada','cotizacion_rechazada',
    'pago_recibido','pago_vencido',
    'stage_change','plan_change',
    'lead_created','form_submitted','page_visit',
    'sistema'
  )),
  titulo text,
  descripcion text,
  metadata jsonb,
  -- Attribution
  created_by uuid REFERENCES team_members(id),
  automatico boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_tipo ON activities(tipo);

-- 6. Add FKs to existing quotes table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='contact_id') THEN
    ALTER TABLE quotes ADD COLUMN contact_id uuid REFERENCES contacts(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='company_id') THEN
    ALTER TABLE quotes ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='deal_id') THEN
    ALTER TABLE quotes ADD COLUMN deal_id uuid REFERENCES deals(id);
  END IF;
END $$;

-- 7. Add FKs to existing payments table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='contact_id') THEN
    ALTER TABLE payments ADD COLUMN contact_id uuid REFERENCES contacts(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='company_id') THEN
    ALTER TABLE payments ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- 8. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts', 'companies', 'deals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- 9. Auto-log stage changes to activities
CREATE OR REPLACE FUNCTION log_contact_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lifecycle_stage IS DISTINCT FROM NEW.lifecycle_stage THEN
    INSERT INTO activities (contact_id, company_id, tipo, titulo, metadata, automatico)
    VALUES (
      NEW.id, NEW.company_id, 'stage_change',
      'Lifecycle: ' || OLD.lifecycle_stage || ' → ' || NEW.lifecycle_stage,
      jsonb_build_object('old_stage', OLD.lifecycle_stage, 'new_stage', NEW.lifecycle_stage, 'object_type', 'contact'),
      true
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_stage_change ON contacts;
CREATE TRIGGER trg_contact_stage_change
  AFTER UPDATE OF lifecycle_stage ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_contact_stage_change();

CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
    -- Auto-set probability
    NEW.probabilidad = CASE NEW.stage
      WHEN 'calificacion' THEN 20
      WHEN 'demo_agendada' THEN 40
      WHEN 'demo_realizada' THEN 60
      WHEN 'cotizacion_enviada' THEN 70
      WHEN 'negociacion' THEN 80
      WHEN 'cerrada_ganada' THEN 100
      WHEN 'cerrada_perdida' THEN 0
      ELSE NEW.probabilidad
    END;
    -- Log activity
    INSERT INTO activities (contact_id, company_id, deal_id, tipo, titulo, metadata, automatico)
    VALUES (
      NEW.contact_id, NEW.company_id, NEW.id, 'stage_change',
      'Deal: ' || OLD.stage || ' → ' || NEW.stage,
      jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage, 'object_type', 'deal'),
      true
    );
    -- Calculate days in pipeline on close
    IF NEW.stage IN ('cerrada_ganada', 'cerrada_perdida') THEN
      NEW.closed_at = now();
      NEW.days_in_pipeline = EXTRACT(DAY FROM (now() - NEW.created_at))::int;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON deals;
CREATE TRIGGER trg_deal_stage_change
  BEFORE UPDATE OF stage ON deals
  FOR EACH ROW EXECUTE FUNCTION log_deal_stage_change();

-- 10. Enable RLS (Row Level Security) — disabled for service_role key
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "Service role full access" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON team_members FOR ALL USING (true) WITH CHECK (true);
