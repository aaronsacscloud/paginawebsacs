-- ══ Los 397 correos YA ARMADOS que arrancan en minúscula ════════════════════
--
-- Arreglar la plantilla no arregla lo ya generado. El cuerpo de un toque se
-- escribe al generar la cadencia y ahí se queda: los 1,357 correos aprobados
-- —agendados del 19-sep al 18-oct— traen el texto de ANTES del arreglo.
--
-- 396 aprobados y 1 borrador arrancan en minúscula porque el vocativo
-- `[[si persona]]{{persona}}, [[/si]]` se borró y se llevó la mayúscula.
-- No es solo la despedida: son SEIS de los ocho correos de la cadencia
--
--     no le quiero seguir llenándole…   74
--     le cuento un caso real…           64
--     le cuento cómo entra un modelo…   64
--     le dejo algo útil aunque…         64
--     cuando les propongo esto…         64
--     la parte que más cambia…          64
--
-- y salen a la base de SAPICA, que es el goteo más grande encendido.
--
-- Se revisaron los 397 arranques uno por uno antes de tocar nada: todos son
-- frases normales del español que perdieron su vocativo. Ninguno es una marca
-- en minúscula a propósito (adidas, dportenis), así que capitalizar la primera
-- letra es correcto en los 397 y no hay que revisar caso por caso.
--
-- Solo se toca lo que TODAVÍA NO SALIÓ. Lo enviado queda como está: el
-- historial dice lo que de verdad recibió el prospecto, no lo que nos hubiera
-- gustado mandar.

update abm_toques
set cuerpo = upper(substr(cuerpo, 1, 1)) || substr(cuerpo, 2)
where canal = 'email'
  and estado in ('aprobado', 'borrador', 'programado')
  and cuerpo ~ '^[a-záéíóúñ]';

select count(*) quedan from abm_toques
where canal='email' and estado in ('aprobado','borrador','programado') and cuerpo ~ '^[a-záéíóúñ]';
