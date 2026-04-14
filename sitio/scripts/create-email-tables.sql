-- ═══════════════════════════════════════════════════════════
-- CRM SACS — Email Automation Tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nombre text NOT NULL,
  asunto text NOT NULL,
  preview_text text,
  tipo text NOT NULL DEFAULT 'automatizado'
    CHECK (tipo IN ('promocional','newsletter','automatizado','plain_text','transaccional')),
  layout text NOT NULL DEFAULT 'simple'
    CHECK (layout IN ('simple','newsletter','promocional','bienvenida','seguimiento','custom')),
  bloques jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_compilado text,
  texto_plano text,
  categoria text,
  activo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES team_members(id),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tipo ON email_templates(tipo);
CREATE INDEX IF NOT EXISTS idx_email_templates_activo ON email_templates(activo) WHERE activo = true;

-- 2. Automations (Workflows)
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'lifecycle'
    CHECK (tipo IN ('lifecycle','drip','reenganche','onboarding','custom')),
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','activo','pausado','archivado')),
  enrollment_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  goal_criteria jsonb,
  unenrollment_triggers jsonb DEFAULT '[]'::jsonb,
  suppression_stages text[] DEFAULT '{}',
  allow_reenrollment boolean NOT NULL DEFAULT false,
  reenrollment_delay_hours int DEFAULT 720,
  send_window_start time,
  send_window_end time,
  send_window_timezone text DEFAULT 'America/Mexico_City',
  send_on_weekends boolean NOT NULL DEFAULT false,
  total_enrolled int NOT NULL DEFAULT 0,
  total_completed int NOT NULL DEFAULT 0,
  total_achieved_goal int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES team_members(id),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_automations_estado ON automations(estado);
CREATE INDEX IF NOT EXISTS idx_automations_tipo ON automations(tipo);

-- 3. Automation Steps
CREATE TABLE IF NOT EXISTS automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  orden int NOT NULL,
  parent_step_id uuid REFERENCES automation_steps(id),
  branch_key text,
  tipo text NOT NULL CHECK (tipo IN (
    'send_email','wait','if_then','set_property',
    'create_task','send_notification','enroll_workflow','webhook'
  )),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  activo boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON automation_steps(automation_id, orden);
CREATE INDEX IF NOT EXISTS idx_automation_steps_parent ON automation_steps(parent_step_id);

-- 4. Automation Enrollments
CREATE TABLE IF NOT EXISTS automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  automation_id uuid NOT NULL REFERENCES automations(id),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  current_step_id uuid REFERENCES automation_steps(id),
  estado text NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','completado','goal_achieved','unenrolled','error','pausado')),
  next_action_at timestamptz,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  enrollment_trigger jsonb,
  unenrollment_reason text,
  enrollment_count int NOT NULL DEFAULT 1,
  last_error text,
  error_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_enrollments_automation ON automation_enrollments(automation_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON automation_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_estado ON automation_enrollments(estado) WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS idx_enrollments_next_action ON automation_enrollments(next_action_at)
  WHERE estado = 'activo' AND next_action_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique_active
  ON automation_enrollments(automation_id, contact_id) WHERE estado = 'activo';

-- 5. Email Sends (log de cada envío)
CREATE TABLE IF NOT EXISTS email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  template_id uuid NOT NULL REFERENCES email_templates(id),
  automation_id uuid REFERENCES automations(id),
  enrollment_id uuid REFERENCES automation_enrollments(id),
  step_id uuid REFERENCES automation_steps(id),
  email_to text NOT NULL,
  email_provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  estado text NOT NULL DEFAULT 'queued'
    CHECK (estado IN ('queued','sent','delivered','opened','clicked','bounced','complained','unsubscribed','failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  first_opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  open_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  clicked_links jsonb DEFAULT '[]'::jsonb,
  bounce_type text,
  bounce_reason text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_email_sends_contact ON email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_template ON email_sends(template_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_automation ON email_sends(automation_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_provider_id ON email_sends(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sends_created ON email_sends(created_at DESC);

-- 6. Email Unsubscribes
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  contact_id uuid NOT NULL REFERENCES contacts(id),
  email text NOT NULL,
  reason text,
  scope text NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all','marketing','automation')),
  resubscribed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email)
  WHERE resubscribed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unsubscribes_contact ON email_unsubscribes(contact_id);

-- 7. Extend activities CHECK constraint for email types
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_tipo_check;
ALTER TABLE activities ADD CONSTRAINT activities_tipo_check CHECK (tipo IN (
  'nota','llamada',
  'whatsapp_enviado','whatsapp_recibido',
  'email_enviado','email_recibido',
  'demo_agendada','demo_realizada',
  'cotizacion_creada','cotizacion_enviada','cotizacion_vista','cotizacion_aceptada','cotizacion_rechazada',
  'pago_recibido','pago_vencido',
  'stage_change','plan_change',
  'lead_created','form_submitted','page_visit',
  'sistema',
  'automation_enrolled','automation_completed','automation_goal_achieved',
  'email_automation_sent','email_opened','email_clicked','email_bounced','email_unsubscribed'
));

-- 8. Auto-update updated_at triggers
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['email_templates', 'automations', 'automation_enrollments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- 9. RLS policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON email_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON automations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON automation_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON automation_enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_sends FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON email_unsubscribes FOR ALL USING (true) WITH CHECK (true);
