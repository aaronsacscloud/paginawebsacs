-- ⚠️ CORRECCIÓN: el WhatsApp del correo 0 de novias estaba MUERTO.
--
-- Se puso wa.me/524152838733 leyendo la migración del 2026-09-10, que cambiaba
-- el número a ese. Pero esa migración ya fue superada: la fuente de verdad es
-- `wa_numeros`, y ahí +52 1 415 283 8733 está en activo=false, mientras que
-- +52 1 55 9302 7234 es activo=true y es_default=true. Las 61 plantillas de
-- correo del CRM ya usaban el correcto; solo el correo 0 nuevo traía el viejo.
--
-- La lección, para la próxima: el número vigente se lee de `wa_numeros`
-- (activo y es_default), NO de la última migración que lo haya tocado. Una
-- migración dice qué pasó ese día, no qué es cierto hoy.
--
-- Nunca se envió nada con el número malo: el motor sigue pausado y los toques
-- de novias están en borrador.
update abm_plantillas
   set cuerpo = replace(replace(cuerpo, 'wa.me/524152838733', 'wa.me/525593027234'),
                        'wa.me/12058920417', 'wa.me/525593027234')
 where cuerpo like '%wa.me/524152838733%' or cuerpo like '%wa.me/12058920417%';
