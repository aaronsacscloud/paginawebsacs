-- ═══════════════════════════════════════════════════════════════════
--  Migration: Partner Invitations
--  Fecha: 2026-05-02
--
--  Tablas nuevas:
--    - partner_invitations (propuesta para que un prospecto se vuelva
--      partner SACS — embajador, distribuidor, integrador, etc.)
--
--  Es paralelo a `quotes`: cada invitación tiene un link público,
--  tabs configurables, firma digital, y al aceptarse genera el
--  team_member con rol 'partner' y la comisión configurada.
--
--  Idempotente (IF NOT EXISTS). Seguro re-correr.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Folio público estilo PA-001
  numero text UNIQUE,

  -- Tipo de partner: embajador (free + 50%), distribuidor (paga + %),
  -- integrador (B2B), reseller, etc. Extensible.
  tipo text NOT NULL DEFAULT 'embajador'
    CHECK (tipo IN ('embajador','distribuidor','integrador','reseller','consultor')),

  -- Datos del prospecto
  nombre text NOT NULL,
  email text,
  whatsapp text,
  empresa text,
  ciudad text,
  pais text DEFAULT 'MX',

  -- Comisión / términos
  comision_pct numeric(5,2) NOT NULL DEFAULT 50,
  moneda text NOT NULL DEFAULT 'MXN',
  costo_unico numeric(12,2) NOT NULL DEFAULT 0,
  costo_mensual numeric(12,2) NOT NULL DEFAULT 0,

  -- Slug para landing personalizada del partner (ej. "juanperez")
  slug_landing text,

  -- Vigencia de la oferta
  vigencia date,

  -- Lo que incluye ser partner (jsonb array of {icon, title, detail})
  beneficios jsonb DEFAULT '[]'::jsonb,

  -- Compromisos / qué tiene que hacer el partner
  -- (jsonb array of {title, detail, frequency} ej: 3-4 videos al mes)
  compromisos jsonb DEFAULT '[]'::jsonb,

  -- Tabulador de recompensas adicionales
  -- {demo_agendada: 200, demo_completada: 500, venta_directa_pct: 50}
  tabulador jsonb DEFAULT '{}'::jsonb,

  -- Términos legales / condiciones especiales
  terminos text,

  -- Notas internas + meta (firma, template, custom toggles)
  notas text,

  -- Diseño visual
  template text NOT NULL DEFAULT 'modern'
    CHECK (template IN ('modern','dark','classic')),

  -- Estado
  estado text NOT NULL DEFAULT 'draft'
    CHECK (estado IN ('draft','sent','viewed','accepted','declined','expired')),
  aceptado_por text,
  aceptado_fecha timestamptz,
  decline_motivo text,
  decline_detalle text,

  -- Auditoría
  invited_by uuid REFERENCES team_members(id),
  team_member_id uuid REFERENCES team_members(id),  -- creado al aceptar
  contact_id uuid REFERENCES contacts(id),

  -- Soft delete
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_partner_invitations_estado
  ON partner_invitations(estado) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_invitations_tipo
  ON partner_invitations(tipo) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_invitations_email
  ON partner_invitations(email) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_invitations_slug
  ON partner_invitations(slug_landing) WHERE slug_landing IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_partner_invitations_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_invitations_updated_at ON partner_invitations;
CREATE TRIGGER trg_partner_invitations_updated_at
BEFORE UPDATE ON partner_invitations
FOR EACH ROW EXECUTE FUNCTION update_partner_invitations_updated_at();

-- ─── 2. Folio counter (PA-001, PA-002, ...) ───
CREATE OR REPLACE FUNCTION next_partner_invitation_numero() RETURNS text AS $$
DECLARE
  next_num int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::int), 0) + 1
    INTO next_num
    FROM partner_invitations;
  RETURN 'PA-' || LPAD(next_num::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Activity events: log invitación enviada / aceptada / rechazada ───
-- (Reutiliza tabla `activities` existente; sólo metadata.partner_invitation_id)
