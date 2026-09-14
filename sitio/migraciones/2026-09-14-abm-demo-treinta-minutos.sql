-- 2026-09-14 · La demo es de TREINTA minutos en todo el motor ABM
--
-- POR QUÉ. El dueño fijó hoy el cierre de todos los correos del motor:
-- «Actualmente estamos teniendo demos en línea durante 30 minutos y le
-- mostramos paso a paso cómo optimizar su operación de …». Ese cierre lo
-- pinta el código (lib/crm/abm-correo.ts) en cada correo. Pero los cuerpos y
-- botones de las plantillas —y los 146 toques ya armados que esperan salir—
-- decían «veinte minutos», escritos cuando la demo era más corta. Un correo
-- que arriba dice veinte y abajo treinta se lee a descuido, así que se
-- alinea todo al número que el dueño dijo hoy.
--
-- QUÉ TOCA. Solo texto: «veinte minutos» → «treinta minutos» y
-- «20 minutos» → «30 minutos» en cuerpo y botón de:
--   · las plantillas de CORREO activas (54 cuerpos + 4 botones), y
--   · las 2 plantillas de WhatsApp de novias, que todavía NO están
--     registradas en Meta (se registran después del despliegue, ya con 30).
--   · los toques de correo que aún no salen (borrador/aprobado/programado).
-- NO toca las plantillas de WhatsApp de mayoristas ni ningún toque de
-- WhatsApp: esas ya están aprobadas en Meta con su texto fijo, y cambiar la
-- copia local no cambia lo que Meta manda —solo desalinearía las variables.
-- Tampoco toca nada ya enviado: lo histórico se queda como salió.
--
-- CÓMO SE REVIERTE. Con el reemplazo inverso sobre las mismas filas.

begin;

update abm_plantillas
   set cuerpo = replace(replace(cuerpo, 'veinte minutos', 'treinta minutos'), '20 minutos', '30 minutos'),
       boton_texto = replace(replace(coalesce(boton_texto, ''), 'veinte minutos', 'treinta minutos'), '20 minutos', '30 minutos')
 where activa
   and (canal = 'email' or (canal = 'whatsapp' and giro = 'novias'))
   and (cuerpo ~ '(20|veinte) minutos' or coalesce(boton_texto, '') ~ '(20|veinte) minutos');

-- boton_texto vacío vuelve a null, que es como estaba.
update abm_plantillas set boton_texto = null where boton_texto = '';

update abm_toques
   set cuerpo = replace(replace(cuerpo, 'veinte minutos', 'treinta minutos'), '20 minutos', '30 minutos'),
       boton_texto = replace(replace(boton_texto, 'veinte minutos', 'treinta minutos'), '20 minutos', '30 minutos')
 where canal = 'email'
   and estado in ('borrador', 'aprobado', 'programado')
   and (cuerpo ~ '(20|veinte) minutos' or coalesce(boton_texto, '') ~ '(20|veinte) minutos');

commit;
