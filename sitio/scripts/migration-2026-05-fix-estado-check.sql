-- Fix CHECK constraint en partner_invitations.estado
--
-- El estado 'submitted_for_review' fue introducido en código (apply.ts,
-- accept-invitation.ts) pero nunca se agregó a la constraint original.
-- Esto causaba que cualquier firma real de partner fallara con
-- "violates check constraint partner_invitations_estado_check".
--
-- PostgreSQL no permite modificar CHECK in-place: hay que dropear+recrear.
-- IF EXISTS hace el DROP idempotente.

ALTER TABLE partner_invitations DROP CONSTRAINT IF EXISTS partner_invitations_estado_check;

ALTER TABLE partner_invitations ADD CONSTRAINT partner_invitations_estado_check
  CHECK (estado IN (
    'draft',
    'sent',
    'viewed',
    'submitted_for_review',
    'accepted',
    'declined',
    'expired'
  ));

NOTIFY pgrst, 'reload schema';
