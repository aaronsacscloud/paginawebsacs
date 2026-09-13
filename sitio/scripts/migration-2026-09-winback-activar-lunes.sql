-- Winback · un año sin costo: se enciende el 13-sep-2026 por instrucción del
-- dueño, programada para arrancar el lunes 14 de septiembre a las 12:00 CDMX
-- (18:00 UTC). Hasta esa hora el cron la reporta como «programada» y no enrola
-- ni manda; a partir de ahí entran los 37 churned y sale el correo 1 ese mismo
-- día (ventana 10–18, L–V). Rezagados arranca a las 10 y Crecimiento a las 11
-- del mismo lunes; se escalonan para no juntar tres arranques en la misma hora.
-- Las 5 plantillas de WhatsApp anosincosto_* ya están APPROVED en Meta.
update crm_secuencias
   set activa = true, arranca_at = '2026-09-14T18:00:00+00:00'
 where id = '11111111-2222-4333-8444-5555555555c1';
