-- ============================================================================
--  Retiro definitivo del sistema legacy `clients`
--  Fecha: 2026-07-21
--  Contexto: el CRM ya opera 100% sobre el sistema ARR
--            (companies + contacts + subscriptions + payments ligados por
--             company_id / contact_id / subscription_id).
--            La tabla `clients` y la columna `payments.client_id` eran del
--            sistema viejo (datos de demo). Ya se retiró todo el código que las
--            usaba (RevenueHub ClientsView/PaymentsView, /api/revenue/clients,
--            el join de recibos y el fallback del dashboard).
--
--  ⚠️  Es IRREVERSIBLE. Corre primero el PASO 0 (inspección) y revisa los
--      números antes de ejecutar el PASO 1. Si algún pago "real" (no demo)
--      estuviera ligado SOLO por client_id, aparecería en la 2ª consulta.
-- ============================================================================


-- ─── PASO 0 · INSPECCIÓN (no borra nada — córrelo solo y revisa) ────────────

-- 0.1 · Cuántos registros hay en la tabla legacy
SELECT count(*) AS clients_legacy FROM clients;

-- 0.2 · Pagos que dependen SOLO del enlace legacy client_id
--       (tienen client_id pero NO company_id ni subscription_id → perderían su
--        único vínculo al borrar la columna). Idealmente debe dar 0 o solo demo.
SELECT count(*) AS pagos_solo_client_id
FROM payments
WHERE client_id IS NOT NULL
  AND company_id IS NULL
  AND subscription_id IS NULL;

-- 0.3 · Detalle de esos pagos (para ojearlos antes de decidir)
SELECT p.id, p.fecha, p.monto, p.metodo, p.referencia, c.empresa, c.contacto
FROM payments p
LEFT JOIN clients c ON c.id = p.client_id
WHERE p.client_id IS NOT NULL
  AND p.company_id IS NULL
  AND p.subscription_id IS NULL
ORDER BY p.fecha DESC;


-- ─── PASO 1 · RETIRO (destructivo — ejecuta cuando el PASO 0 esté OK) ───────
-- Todo dentro de una transacción: si algo falla, no queda a medias.

BEGIN;

  -- 1.1 · Quitar la columna legacy de payments.
  --       DROP COLUMN elimina también el FK payments.client_id → clients(id).
  --       CASCADE por si hubiera vistas/índices colgando de la columna.
  ALTER TABLE payments DROP COLUMN IF EXISTS client_id CASCADE;

  -- 1.2 · Borrar la tabla legacy. CASCADE por si quedara algún objeto
  --       dependiente (no debería tras 1.1).
  DROP TABLE IF EXISTS clients CASCADE;

COMMIT;


-- ─── PASO 2 · VERIFICACIÓN (debe dar la tabla ya inexistente) ───────────────
SELECT to_regclass('public.clients')          AS tabla_clients;      -- espera: NULL
SELECT column_name FROM information_schema.columns
WHERE table_name = 'payments' AND column_name = 'client_id';         -- espera: 0 filas
