-- View tracking en partner_invitations
-- Permite al admin ver en el CRM cuántas veces se abrió cada invitación
-- y cuándo fue la última apertura. Útil para identificar prospectos con
-- interés real (vs los que nunca abrieron).
--
-- Aplicar en Supabase SQL Editor.

ALTER TABLE partner_invitations ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;
ALTER TABLE partner_invitations ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;
ALTER TABLE partner_invitations ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_partner_invitations_last_viewed_at
  ON partner_invitations(last_viewed_at DESC NULLS LAST);

COMMENT ON COLUMN partner_invitations.view_count IS 'Veces que el prospecto (no admin) abrió su invitación';
COMMENT ON COLUMN partner_invitations.first_viewed_at IS 'Primera vez que se abrió (excluye admin previews)';
COMMENT ON COLUMN partner_invitations.last_viewed_at IS 'Última vez que se abrió (excluye admin previews)';
