-- Uso profundo de la cuenta SACS para el CRM (vista 360 + señales de venta).
-- Lo llena el cron /api/cron/sync-sacs-uso (madrugada, progresivo) y el proxy
-- /api/crm/sacs-cuenta-360 (write-through al abrir el drawer).
-- ✅ YA APLICADA en producción vía Management API el 25/jul/2026.
alter table companies add column if not exists uso_sacs jsonb;
alter table companies add column if not exists uso_sync_at timestamptz;
