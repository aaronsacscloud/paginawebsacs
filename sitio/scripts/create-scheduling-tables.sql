-- ═══════════════════════════════════════════════════════════
-- Scheduling System — Database Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Event Types
CREATE TABLE IF NOT EXISTS event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  descripcion text,
  duracion_minutos int NOT NULL DEFAULT 30,
  buffer_antes_minutos int NOT NULL DEFAULT 0,
  buffer_despues_minutos int NOT NULL DEFAULT 10,
  aviso_minimo_horas int NOT NULL DEFAULT 2,
  max_reservas_dia int,
  max_dias_adelanto int NOT NULL DEFAULT 30,
  tipo_reunion text NOT NULL DEFAULT 'individual'
    CHECK (tipo_reunion IN ('individual','grupal','round_robin')),
  ubicacion_tipo text NOT NULL DEFAULT 'google_meet'
    CHECK (ubicacion_tipo IN ('google_meet','zoom','whatsapp','presencial','telefono','otro')),
  ubicacion_detalles text,
  color text NOT NULL DEFAULT '#4B7BE5',
  owner_id uuid REFERENCES team_members(id),
  host_ids uuid[] DEFAULT '{}',
  routing_rules jsonb,
  activo boolean NOT NULL DEFAULT true,
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(slug) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_types_activo ON event_types(activo) WHERE activo = true;

-- 2. Availability Schedules
CREATE TABLE IF NOT EXISTS availability_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  team_member_id uuid NOT NULL REFERENCES team_members(id),
  nombre text NOT NULL DEFAULT 'Horario principal',
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  weekly_hours jsonb NOT NULL DEFAULT '[
    {"day":0,"enabled":false,"ranges":[]},
    {"day":1,"enabled":true,"ranges":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]},
    {"day":2,"enabled":true,"ranges":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]},
    {"day":3,"enabled":true,"ranges":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]},
    {"day":4,"enabled":true,"ranges":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]},
    {"day":5,"enabled":true,"ranges":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]},
    {"day":6,"enabled":false,"ranges":[]}
  ]'::jsonb,
  es_default boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_availability_team ON availability_schedules(team_member_id) WHERE activo = true;

-- 3. Availability Overrides
CREATE TABLE IF NOT EXISTS availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  team_member_id uuid NOT NULL REFERENCES team_members(id),
  fecha date NOT NULL,
  ranges jsonb,
  motivo text,
  UNIQUE (team_member_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_overrides_member_date ON availability_overrides(team_member_id, fecha);

-- 4. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_type_id uuid NOT NULL REFERENCES event_types(id),
  host_id uuid NOT NULL REFERENCES team_members(id),
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  timezone_invitado text NOT NULL DEFAULT 'America/Mexico_City',
  timezone_host text NOT NULL DEFAULT 'America/Mexico_City',
  invitee_nombre text NOT NULL,
  invitee_email text NOT NULL,
  invitee_whatsapp text,
  invitee_empresa text,
  invitee_giro text,
  invitee_sucursales text,
  invitee_notas text,
  estado text NOT NULL DEFAULT 'confirmada'
    CHECK (estado IN ('confirmada','cancelada','reagendada','realizada','no_show')),
  cancelacion_motivo text,
  cancelado_por text CHECK (cancelado_por IN ('invitado','host','sistema')),
  reagendada_desde_id uuid REFERENCES bookings(id),
  google_event_id text,
  google_meet_link text,
  contact_id uuid REFERENCES contacts(id),
  deal_id uuid REFERENCES deals(id),
  token_cancelar text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  token_reagendar text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  recordatorio_24h_enviado boolean NOT NULL DEFAULT false,
  recordatorio_1h_enviado boolean NOT NULL DEFAULT false,
  utm_source text,
  utm_medium text,
  utm_campaign text
);

CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_fecha ON bookings(fecha, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_bookings_estado ON bookings(estado) WHERE estado = 'confirmada';
CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_token_cancel ON bookings(token_cancelar);
CREATE INDEX IF NOT EXISTS idx_bookings_token_reschedule ON bookings(token_reagendar);
-- Prevent double booking same host same slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double ON bookings(host_id, fecha, hora_inicio) WHERE estado = 'confirmada';

-- 5. Booking Questions
CREATE TABLE IF NOT EXISTS booking_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type_id uuid NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('text','textarea','select','radio','checkbox','number','phone')),
  label text NOT NULL,
  placeholder text,
  required boolean NOT NULL DEFAULT false,
  options jsonb,
  orden int NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_booking_questions_event ON booking_questions(event_type_id, orden);

-- 6. Booking Answers
CREATE TABLE IF NOT EXISTS booking_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES booking_questions(id),
  valor text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_answers_booking ON booking_answers(booking_id);

-- 7. Calendar Connections
CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  team_member_id uuid NOT NULL REFERENCES team_members(id),
  provider text NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google','outlook')),
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  activo boolean NOT NULL DEFAULT true,
  UNIQUE (team_member_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_member ON calendar_connections(team_member_id) WHERE activo = true;

-- 8. Extend activities for scheduling types
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_tipo_check;
ALTER TABLE activities ADD CONSTRAINT activities_tipo_check CHECK (tipo IN (
  'nota','llamada',
  'whatsapp_enviado','whatsapp_recibido',
  'email_enviado','email_recibido',
  'demo_agendada','demo_realizada','demo_cancelada','demo_reagendada','demo_no_show',
  'cotizacion_creada','cotizacion_enviada','cotizacion_vista','cotizacion_aceptada','cotizacion_rechazada',
  'pago_recibido','pago_vencido',
  'stage_change','plan_change',
  'lead_created','form_submitted','page_visit',
  'sistema',
  'automation_enrolled','automation_completed','automation_goal_achieved',
  'email_automation_sent','email_opened','email_clicked','email_bounced','email_unsubscribed',
  'automation_notification'
));

-- 9. Auto-update triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_types','availability_schedules','bookings','calendar_connections'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- 10. RLS
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON event_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON availability_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON availability_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON booking_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON booking_answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON calendar_connections FOR ALL USING (true) WITH CHECK (true);
