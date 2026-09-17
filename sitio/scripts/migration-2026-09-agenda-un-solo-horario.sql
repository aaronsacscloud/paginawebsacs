-- Un solo horario por defecto por persona — 17-sep-2026
--
-- QUÉ PASABA. Andrea tenía TRES filas en `availability_schedules`, las tres
-- `es_default = true`, las tres `activo = true`, creadas el 14-abr-2026 a las
-- 03:43, 03:44 y 03:45. El endpoint de disponibilidad pide
-- `.order('es_default', desc)` y se queda con la primera: con tres empatadas,
-- cuál gana lo decide Postgres, o sea que no lo decide nadie.
--
-- Hoy no se notaba porque las tres dicen lo mismo (12:00–18:00, L-V, tras el
-- cambio del 17-sep). Pero era una trampa puesta: en cuanto alguien edite su
-- horario desde la pantalla, se guarda UNA de las tres y las otras dos quedan
-- con lo viejo — y la agenda empezaría a ofrecer horas distintas según qué fila
-- le tocara ese día. Un bug así no se reporta como bug: se reporta como «a
-- veces me agenda a deshoras», meses después y sin forma de reproducirlo.
--
-- DE DÓNDE SALIERON. De `/api/scheduling/seed.ts`, que inserta el horario por
-- defecto sin preguntar si ya existe. Se corrió tres veces seguidas aquel día.
-- Por eso esto no se arregla sólo borrando filas: mientras el seed pueda
-- correrse otra vez, vuelven.

begin;

-- 1. Se queda la MÁS VIEJA de cada persona; las demás se apagan (no se borran:
--    si alguna resultara ser la que de verdad se estaba usando, el historial de
--    lo que decía sigue ahí para mirarlo).
update availability_schedules s
   set es_default = false, activo = false, updated_at = now()
 where s.es_default
   and s.activo
   and exists (
     select 1 from availability_schedules o
      where o.team_member_id = s.team_member_id
        and o.es_default and o.activo
        and o.created_at < s.created_at
   );

-- 2. El candado. Con esto un segundo `seed` ya no puede duplicar el horario:
--    truena en la inserción en vez de dejar dos verdades conviviendo.
create unique index if not exists availability_schedules_un_default
  on availability_schedules (team_member_id)
  where es_default and activo;

commit;

-- Comprobación: una fila por persona, ni una más.
--   select team_member_id, count(*) from availability_schedules
--    where es_default and activo group by 1 having count(*) > 1;
--
-- LO QUE NO SE TOCA: las dos citas del 18-sep con Andrea (Grecia 10:00, Jose
-- 11:15) quedaron agendadas cuando las mañanas sí estaban abiertas. El horario
-- nuevo manda sobre lo que se puede RESERVAR de aquí en adelante; mover una
-- cita que el cliente ya tiene en su calendario para cuadrarla con una regla
-- que cambió después es un problema para él, no para nosotros.
