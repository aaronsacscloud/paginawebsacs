-- ═══════════════════════════════════════════════════════════════════════════
-- SOPORTE · (1) la calificación NATIVA de Intercom y (2) las dudas repetidas.
--
-- 1) Intercom tiene su propia encuesta al cerrar la conversación y la expone en
--    `conversation_rating` de la API. Medido el 2026-08-22: de 150
--    conversaciones traídas, 146 cerradas y CERO con calificación → la opción
--    está APAGADA en el workspace. No hay endpoint REST para prenderla; es un
--    switch en la configuración de Intercom. Las columnas se crean desde ya
--    para que el día que se prenda, el backfill y el webhook la recojan sin
--    tocar código.
--
--    Se guarda además el objeto CRUDO: la documentación pública no rindió la
--    forma exacta del campo y prefiero conservar lo que mande Intercom a
--    perderlo por haber adivinado tres llaves.
--
-- 2) 'duda' como quinto tipo de hallazgo: lo que el cliente NO entendió de algo
--    que el sistema sí hace. No es una mejora (no falta la función, falta
--    saberla usar) y agruparlas por módulo es el temario de un workshop.
-- ═══════════════════════════════════════════════════════════════════════════

alter table crm_soporte_tickets
  add column if not exists rating_intercom        int,
  add column if not exists rating_intercom_at     timestamptz,
  add column if not exists rating_intercom_remark text,
  add column if not exists rating_intercom_raw    jsonb;

create index if not exists ix_soporte_rating_intercom
  on crm_soporte_tickets (rating_intercom) where rating_intercom is not null;

alter table crm_soporte_hallazgos drop constraint if exists crm_soporte_hallazgos_tipo_check;
alter table crm_soporte_hallazgos add constraint crm_soporte_hallazgos_tipo_check
  check (tipo in ('oportunidad','mejora','riesgo','testimonio','duda'));
