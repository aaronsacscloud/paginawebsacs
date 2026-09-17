-- ══ La cadencia pasa de 33 a 26 días ═════════════════════════════════════════
--
-- Decisión del dueño (17-sep-2026) tras ver el reparto real:
--
--     correo 1 → día  1   ┐
--     correo 2 → día  4   │ los primeros cuatro caben en 10 días
--     correo 3 → día  6   │
--     correo 4 → día 10   ┘
--     correo 5 → día 14
--     correo 6 → día 19   ┐ y luego TRES correos en catorce días, cuando
--     correo 7 → día 25   │ quien iba a contestar ya decidió en los
--     correo 8 → día 33   ┘ primeros diez
--
-- El arranque no se toca —ahí es donde se decide— y se junta la cola:
--
--     1, 3, 5, 8, 12, 16, 21, 26
--
-- Lo que se gana: la cadencia cierra una semana antes y la cola deja de ser
-- tres correos espaciados que ya nadie está esperando. Lo que se arriesga: más
-- correos en menos tiempo se siente como más presión. Por eso se junta el
-- final y no el principio, y el hueco más chico sigue siendo de dos días.
--
-- Esto NO cambia los correos ya agendados: sus fechas son absolutas y ya están
-- escritas en `abm_toques`. Aplica a lo que se genere de aquí en adelante,
-- incluidas las 134 cadencias que se regeneran hoy con el guion nuevo.
--
-- Las 6 cadencias de 7 pasos (aliados y operadores, que no llevan correo de
-- presentación) se comprimen igual, sin el último salto.

update abm_pasos p set dia = (array[1,3,5,8,12,16,21,26])[p.orden]
from abm_cadencias k
where k.id = p.cadencia_id and p.canal = 'email' and k.activa
  and p.orden between 1 and 8
  and (select count(*) from abm_pasos x where x.cadencia_id = k.id and x.canal = 'email') = 8;

update abm_pasos p set dia = (array[1,3,5,8,12,16,21])[p.orden]
from abm_cadencias k
where k.id = p.cadencia_id and p.canal = 'email' and k.activa
  and p.orden between 1 and 7
  and (select count(*) from abm_pasos x where x.cadencia_id = k.id and x.canal = 'email') = 7;

select n_pasos, count(*) cadencias, string_agg(distinct dias, ' | ') ritmos from (
  select k.id, count(*) n_pasos, string_agg(p.dia::text, ',' order by p.orden) dias
  from abm_cadencias k join abm_pasos p on p.cadencia_id = k.id and p.canal = 'email'
  where k.activa group by k.id) z group by 1 order by 1;
