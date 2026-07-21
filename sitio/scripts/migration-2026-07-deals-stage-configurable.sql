-- ============================================================================
--  Oportunidades: stage configurable
--  Fecha: 2026-07-21
--  Quita el CHECK fijo de deals.stage para permitir etapas personalizadas del
--  pipeline "oportunidad" (Configuración → Pipelines). Las etapas especiales
--  cerrada_ganada / cerrada_perdida siguen usándose por su KEY (no por el CHECK),
--  así que la lógica de cierre/comisión no se rompe si conservas esas keys.
-- ============================================================================

-- Quita cualquier CHECK sobre deals.stage (el nombre autogenerado puede variar).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'deals'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%stage%'
  LOOP
    EXECUTE 'ALTER TABLE deals DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

-- Verificación (no debe listar un check sobre stage)
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'deals'::regclass AND contype = 'c';
