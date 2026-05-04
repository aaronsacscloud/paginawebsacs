-- Fix CHECK constraint en team_members.rol
--
-- El schema original (create-crm-tables.sql) permitía solo:
--   'admin','vendedor','soporte'
-- Pero el código de auth (lib/auth/scope.ts, applyPartnerScope) usa:
--   'founder','partner','cs'
-- Causaba que cualquier INSERT/UPDATE de team_members con rol moderno
-- fallara con "violates check constraint team_members_rol_check".
--
-- Fix: expandir constraint para aceptar el set completo (legacy + moderno).
-- Idempotente con DROP IF EXISTS.

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_rol_check;

ALTER TABLE team_members ADD CONSTRAINT team_members_rol_check
  CHECK (rol IN ('admin','vendedor','soporte','founder','partner','cs'));

NOTIFY pgrst, 'reload schema';
