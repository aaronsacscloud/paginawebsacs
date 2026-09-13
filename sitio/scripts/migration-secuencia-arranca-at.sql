-- 13-sep-2026 · Una secuencia puede quedar PROGRAMADA para arrancar después.
--
-- Hasta hoy solo había «activa o no»: para que una cadencia empezara un lunes a
-- las once había que acordarse de encenderla el lunes a las once. Con `arranca_at`
-- se deja lista y el motor la ignora —ni enrola ni manda— hasta esa hora.
-- Null = arranca en cuanto se activa, que es como se comportaba siempre.
alter table crm_secuencias add column if not exists arranca_at timestamptz;
comment on column crm_secuencias.arranca_at is 'Si está en el futuro, el motor no enrola ni manda por esta secuencia todavía.';
