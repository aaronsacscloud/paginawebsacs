-- Ronda 2 del módulo de eventos (hallazgos de los referees).
-- · secuencia_id: la cadencia a la que entra cada registro con consentimiento (reusa
--   crm_secuencias en vez de inventar un seguimiento aparte).
-- · bienvenida_email_error: el correo también dice POR QUÉ no salió (baja, cupo, sin config).
-- · consentimiento_version: qué texto de aviso vio la persona; sin eso el "dijo que sí" no prueba nada.
alter table ev_ediciones add column if not exists secuencia_id uuid references crm_secuencias(id) on delete set null;
alter table ev_registros add column if not exists bienvenida_email_error text;
alter table ev_registros add column if not exists consentimiento_version text;
-- Las tareas de seguimiento que se quitaron de la plantilla (ahora el seguimiento vive en
-- contacts.next_followup y en el cron): se borran solo las que nadie palomeó.
delete from ev_tareas where clave in ('meta_dia','sin_seguimiento','calientes','tibios','conversion') and coalesce(hecha, false) = false;
