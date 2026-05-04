-- Auto-approve flag para partner_invitations
-- Cuando es TRUE, al firmar la invitación se aprueba automáticamente
-- (skip "submitted_for_review", crea team_member y manda email de bienvenida).
-- Cuando es FALSE (default), va a revisión por admin como hoy.
--
-- Útil para: invitaciones a partners que el admin ya validó offline,
-- inscripciones masivas, embajadores invitados directamente por relación.

ALTER TABLE partner_invitations ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN partner_invitations.auto_approve IS 'Si TRUE, al firmar se aprueba automáticamente sin revisión admin';
