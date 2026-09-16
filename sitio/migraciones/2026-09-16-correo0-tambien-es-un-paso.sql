-- ══ El correo de presentación era plantilla, pero no era PASO ════════════════
--
-- QUÉ PASÓ. La migración del 15-sep metió el correo 0 («por qué le llega este
-- correo») como plantilla en 21 giros, y ahí se quedó: nadie le dio su renglón
-- en abm_pasos. Las cadencias quedaron con OCHO plantillas y SIETE pasos.
--
-- Y los días se leen POR POSICIÓN (src/lib/crm/abm-generar.ts):
--
--     dia: dias[i] ?? [1,3,7,11,16,22,30][i] ?? (i * 4 + 1)
--
-- Con i=7 los dos primeros dan undefined y cae al último: 7*4+1 = 29. O sea
-- que la despedida —«aquí le paro, no quiero seguir llenándole el correo»—
-- se agendaba el día 29 y el correo 6, que propone la demo, el día 30. El
-- adiós llegaba ANTES del último correo de verdad. Y de paso cada correo
-- heredaba el día del siguiente, porque la presentación se comió el día 1.
--
-- No reventó nada y no salió en ningún log: los 21 giros no tienen goteo
-- encendido, así que el desorden estaba guardado esperando el día que se
-- encendieran. Es el MISMO error que ya se había arreglado en novias —está
-- escrito en el comentario de abm-generar.ts— y volvió por la puerta de al
-- lado: se agregó la plantilla sin agregar el paso.
--
-- CÓMO SE ARREGLA. No se parchan los siete pasos viejos: se borran y se
-- vuelven a tender los ocho desde las plantillas. Así el `plantilla_id` no
-- puede quedar apuntando a otro correo, que es justo lo que pasa cuando uno
-- renumera a mano. El ritmo es el de novias, que es el único que ya corrió
-- con ocho correos: 1, 4, 6, 10, 14, 19, 25, 33.

create temp table cad8 as
select k.id cad, k.giro, k.ruta, coalesce(k.region,'mexico') region
from abm_cadencias k
where k.activa
  and (select count(*) from abm_plantillas t
       where t.giro=k.giro and t.ruta=k.ruta and t.canal='email' and t.activa
         and coalesce(t.region,'mexico')=coalesce(k.region,'mexico')) = 8
  and (select count(*) from abm_pasos p
       where p.cadencia_id=k.id and p.canal='email') = 7;

delete from abm_pasos p using cad8 where p.cadencia_id=cad8.cad and p.canal='email';

insert into abm_pasos (cadencia_id, dia, orden, canal, plantilla_id, automatico, nota)
select cad8.cad,
       (array[1,4,6,10,14,19,25,33])[t.orden + 1],
       t.orden + 1, 'email', t.id, true,
       case when t.orden = 0 then 'presentación: de dónde salió el dato' else null end
from cad8
join abm_plantillas t
  on t.giro = cad8.giro and t.ruta = cad8.ruta and t.canal = 'email' and t.activa
 and coalesce(t.region,'mexico') = cad8.region
where t.orden between 0 and 7;

select count(*) cadencias_arregladas from cad8;
