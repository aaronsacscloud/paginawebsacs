-- ⚠️ REVERTIDA EL MISMO DÍA — NO LA VUELVAS A CORRER.
-- Me equivoqué de cadencia: el dueño dijo que los DESCALIFICADOS ya no reciben
-- WhatsApp, no los rezagados. Rezagados siempre mandó WhatsApp y así se queda.
-- Lo que deshace esto: migration-2026-09-rezagados-devolver-whatsapp.sql.
-- Se deja el archivo para que quede el rastro de qué se borró y cómo se repuso.
--
-- REZAGADOS: PURO CORREO, SIN WHATSAPP (15-sep-2026)
--
-- Decisión del dueño: la cadencia de rezagados deja de mandar WhatsApp y se
-- queda solo con el correo. Las razones que la sostienen:
--   · el correo se da de baja con un clic y no gasta la ventana de 24 h;
--   · las plantillas de marketing venían fallando en esa línea (131049), y el
--     respaldo de utility nunca dice lo mismo que el mensaje original;
--   · así queda limpia la comparación contra «Descalificados · top of mind»,
--     que nació de esta misma y también es solo correo: el único cambio entre
--     las dos es el RITMO (3 por semana contra 1 por semana), no el canal.
--
-- Se borran los pasos, no se desactivan: un paso apagado sigue apareciendo en
-- la pantalla y confunde a quien la edite.
delete from crm_secuencia_pasos
where canal = 'wa'
  and secuencia_id = (select id from crm_secuencias where nombre = 'Rezagados · top of mind');

-- Comprobación (lo que quedó el día de la migración):
--   Rezagados · top of mind      activa   cada 1 día   31 correos   lun/mié/vie
--   Descalificados · top of mind APAGADA  cada 7 días  31 correos   martes
select s.nombre, s.activa, s.entrada->>'cada_dias' as cada_dias,
       p.canal, count(*) as pasos, array_agg(distinct p.dia_semana) as dias
from crm_secuencias s
join crm_secuencia_pasos p on p.secuencia_id = s.id
where s.nombre in ('Rezagados · top of mind', 'Descalificados · top of mind')
group by 1, 2, 3, 4 order by 1, 4;
