-- Lead que vuelve solo después de meses (2026-09-03): resumen de la historia previa, cacheado por lead.
alter table ti_perfil add column if not exists resumen_historial text;
alter table ti_perfil add column if not exists resumen_historial_at timestamptz;
