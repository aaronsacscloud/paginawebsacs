-- ═══ El GUION de cada reunión + las cuatro salas de la semana ═════════════
--
-- Acuerdo del dueño con Andrea (5-sep-2026): cuatro juntas fijas con temas
-- definidos, para que nadie llegue a preguntarse de qué se habla.
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO PUNTOS DE AGENDA:
-- Los puntos de `espacio_reunion_puntos` se CONSUMEN: al tratarlos quedan en
-- 'tratado' y salen de la lista; lo que no se alcanzó a ver se arrastra. Ese
-- modelo es el correcto para «lo que traigo ESTA semana», y es exactamente el
-- equivocado para el guion fijo: sembrarlo ahí lo borraría en la primera junta
-- y a la segunda nadie sabría qué toca.
--
-- Son dos cosas distintas y ahora se ven distintas:
--   · GUION   — no cambia, se repite cada semana, dice quién presenta qué.
--   · AGENDA  — lo de esta semana, propuesto por quien sea, se trata y se cierra.
--
-- Forma del guion: [{ bloque, quien, puntos: [texto…] }]
--   `quien` es el NOMBRE como se dice en la junta ('Andrea', 'Aaron', 'Los dos'),
--   no un uuid: el guion se lee en voz alta, y además sobrevive a que alguien
--   cambie de cuenta. Quién es responsable de un acuerdo sí es un uuid, pero eso
--   vive en `espacio_acuerdos`, que es donde importa.
--
-- Reversible: alter table espacio_canales drop column guion;
--             (las salas nuevas se borran por nombre, ver el final)

alter table espacio_canales add column if not exists guion jsonb;

-- ── Las cuatro salas ──────────────────────────────────────────────────────
-- Horas: sábado, domingo y martes NO fueron especificadas por el dueño. Se
-- ponen a las 09:00 igual que el lunes, que es la única confirmada, y se
-- cambian desde la sala en cuanto él diga. Dejarlas sin hora habría hecho que
-- el panel no supiera decir «próxima reunión».
insert into espacio_canales (seccion_id, nombre, descripcion, tipo, regla_reunion, orden, creado_por)
select s.id, v.nombre, v.descripcion, 'sala', v.regla::jsonb, v.orden, null
from espacio_secciones s,
     (values
       ('sabado-estrategia', 'Planeación estratégica de la próxima semana', '{"dia_iso":6,"hora":"09:00"}', 0),
       ('domingo-creativo',  'Día creativo · ideas locas',                  '{"dia_iso":7,"hora":"09:00"}', 4),
       ('martes-casa',       'La casa: pagos, presupuesto, plan del finde', '{"dia_iso":2,"hora":"09:00"}', 5)
     ) as v(nombre, descripcion, regla, orden)
where s.nombre = 'Reuniones'
  and not exists (select 1 from espacio_canales c where c.nombre = v.nombre);

-- El lunes ya existía como «La junta de la semana». Se le pone su nombre real:
-- es la junta de ventas y expansión, y llamarla por lo que se hace ahí evita
-- que se le cuelguen temas que no le tocan.
update espacio_canales
   set descripcion = 'Ventas y expansión: resultados, demos, consultorías y campañas',
       regla_reunion = '{"dia_iso":1,"hora":"09:00"}'::jsonb
 where nombre = 'lunes-semanal';

select nombre, descripcion, regla_reunion, orden
  from espacio_canales where tipo = 'sala' order by orden;

-- ── PARA DESHACER ─────────────────────────────────────────────────────────
-- delete from espacio_canales where nombre in ('sabado-estrategia','domingo-creativo','martes-casa');
-- alter table espacio_canales drop column guion;
