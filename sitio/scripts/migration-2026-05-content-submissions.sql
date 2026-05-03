-- ════════════════════════════════════════════════════════════════════
--  Migration: partner_content_submissions
--  Fecha: 2026-05
--
--  Sistema de puntos de contenido para embajadores:
--  partner sube link de su contenido → admin revisa → otorga puntos
--  con base en el tipo. Meta mensual: 100 puntos.
--
--  Idempotente. Seguro re-correr.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partner_content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  partner_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,

  -- Lo que el partner sube
  url text NOT NULL,
  tipo text NOT NULL,        -- ej. 'story_reel' | 'tutorial' | 'caso_uso' | etc
  descripcion text,          -- nota corta del partner
  plataforma text,           -- ej. 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'otro'

  -- Estado de revisión
  estado text NOT NULL DEFAULT 'pending_review'
    CHECK (estado IN ('pending_review', 'approved', 'rejected')),
  puntos numeric(8,2) DEFAULT 0,        -- otorgados al aprobar
  mes_acreditado text,                  -- 'YYYY-MM' al aprobar
  nota_admin text,                      -- razón si rechaza

  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES team_members(id)
);

CREATE INDEX IF NOT EXISTS idx_pcs_partner ON partner_content_submissions(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_estado ON partner_content_submissions(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_mes ON partner_content_submissions(partner_id, mes_acreditado) WHERE estado = 'approved';

-- Constraint: 1 URL por partner (no submit la misma 2x)
CREATE UNIQUE INDEX IF NOT EXISTS partner_content_submissions_url_uniq
  ON partner_content_submissions(partner_id, url);

-- Saldo acumulado de puntos: helper SQL para query rápida
CREATE OR REPLACE FUNCTION partner_content_balance(p_partner_id uuid, p_month text)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(puntos), 0)
  FROM partner_content_submissions
  WHERE partner_id = p_partner_id
    AND estado = 'approved'
    AND mes_acreditado = p_month;
$$ LANGUAGE SQL STABLE;
