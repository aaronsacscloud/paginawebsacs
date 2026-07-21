-- ============================================================================
--  Licencia Vitalicia Legacy (pago único, no recurrente)
--  Fecha: 2026-07-21
--  Clientes que pagaron una licencia de por vida (legacy): NO son ARR (no
--  renuevan), pero siguen siendo clientes activos y oportunidad de recurrencia.
--  - ciclo 'vitalicia': mrr/arr = 0, sin próxima factura.
--  - plan en el catálogo (a la medida: el pago único varía).
-- ============================================================================

-- 1) Permitir ciclo 'vitalicia' (el CHECK viejo solo dejaba mensual/anual).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'subscriptions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ciclo%'
  LOOP
    EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_ciclo_check CHECK (ciclo IN ('mensual','anual','vitalicia'));

-- 2) Plan en el catálogo (a la medida).
INSERT INTO plans (slug, nombre, precio_mensual, precio_anual, a_la_medida, activo, orden)
VALUES ('vitalicia_legacy', 'Licencia Vitalicia Legacy', null, null, true, true, 7)
ON CONFLICT (slug) DO NOTHING;

-- Verificación
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'subscriptions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%ciclo%';
SELECT slug, nombre FROM plans WHERE slug = 'vitalicia_legacy';
