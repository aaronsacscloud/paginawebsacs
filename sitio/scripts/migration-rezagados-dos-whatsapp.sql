-- 13-sep-2026 · Rezagados: el WhatsApp se reduce a DOS, y con contenido propio.
--
-- Decisión del dueño: a los rezagados se les habla por correo, y de WhatsApp solo
-- dos — uno de saludo el día 1 y uno el día 2 con lo que tenemos anotado de su
-- negocio. De ahí en adelante, solo correo.
--
-- Tenía cuatro, los cuatro en el día 1 (rezagado_curva, rezagado_novedad,
-- rezagado_temporada, rezagado_puerta): cuatro argumentos de venta el mismo día,
-- ninguno un saludo. Se apagan —no se borran, porque son plantillas aprobadas que
-- pueden servir en otra cadencia— y entran las dos nuevas.
begin;
update crm_secuencia_pasos set activo = false
  where secuencia_id = '739989ac-dd75-455c-8711-5bf76c741e18' and canal = 'wa';
insert into crm_secuencia_pasos (secuencia_id, orden, dia, canal, wa_plantilla, activo)
values ('739989ac-dd75-455c-8711-5bf76c741e18', 1, 1, 'wa', 'rezagado_saludo_v1', true),
       ('739989ac-dd75-455c-8711-5bf76c741e18', 2, 2, 'wa', 'rezagado_cuenta_v1', true);
commit;
