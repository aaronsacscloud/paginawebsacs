-- SEGUIMIENTOS PROMETIDOS · que la sala nueva los recoja sola.
--
-- PEDIDO DEL DUEÑO (21-sep-2026): «cuando estoy en la sala de llamadas hay
-- muchos leads que dicen "llámame en 2 horas". Eso ya está en orden. Lo que hay
-- que optimizar es que a veces el seguimiento es en 1 o 2 días. Yo voy a crear
-- nuevas salas de llamadas: aunque yo cree una sala nueva, si ya tengo una
-- llamada de seguimiento a tal hora en ese día, en automático me tienes que
-- posicionar la llamada para que a esa hora le llame a ese prospecto.
-- Al llamarle debe aparecer en grande "llamando por seguimiento previo de X".
-- Si no contesta, se elimina ese seguimiento, y el WhatsApp que se le manda
-- debe ser distinto para que entienda que fue la llamada que él pidió».
--
-- LO QUE YA EXISTÍA, Y POR QUÉ ESTO ES POCO CÓDIGO
-- El motor ya sabe esperar: un item con `volver_at` no se marca hasta su hora y
-- entonces se adelanta a toda la lista. Eso es lo que hace funcionar el
-- «llámame en dos horas» dentro de la MISMA sala. Lo que no existía es el
-- puente entre una sala y la siguiente: el compromiso vivía en `ti_tareas` y en
-- la agenda, y la sala del día siguiente no lo miraba. Se armaba la lista, y la
-- promesa de ayer se quedaba esperando en Mi día.
--
-- Dos columnas bastan para cerrar ese puente y para poder contar después qué
-- pasó con cada promesa.

-- ① De qué promesa salió este item. Sin esto, al colgar no se sabe qué tarea
--    cerrar, y cerrar «la tarea del teléfono» mezclaría dos promesas distintas
--    del mismo contacto.
alter table tel_sesion_items add column if not exists compromiso_tarea_id uuid;
create index if not exists idx_tel_items_compromiso on tel_sesion_items (compromiso_tarea_id) where compromiso_tarea_id is not null;

comment on column tel_sesion_items.compromiso_tarea_id is
  'La tarea de seguimiento que puso a este contacto en la lista. Con ella, al colgar se sabe exactamente qué promesa se cumplió o se cayó.';

-- ② Qué pasó con la promesa. `estado` ya dice pendiente/hecha; esto dice por
--    qué dejó de estar pendiente, que es lo que el dueño quiere filtrar:
--    «saber a quién no le di seguimiento, en qué fecha y horario acordé».
alter table ti_tareas add column if not exists seguimiento_desenlace text;

comment on column ti_tareas.seguimiento_desenlace is
  'Sólo para seguimientos de llamada: contesto | no_contesto | sin_intentar. «sin_intentar» es la promesa cuya hora pasó sin que se marcara — es la que hay que poder ver.';

-- ── LAS DOS PLANTILLAS DEL CASO ────────────────────────────────────────────
-- El mensaje de «no te encontré» que ya existe NO sirve aquí: a alguien que
-- pidió la llamada hay que decirle que se le llamó A LA HORA QUE ÉL PIDIÓ, o
-- suena a insistencia de vendedor. Por eso dos campos y no uno: Meta obliga a
-- una plantilla de MARKETING fuera de la ventana de 24 h, y una de UTILITY
-- cuando la conversación está abierta — la misma pareja que ya usan la minuta
-- y el resto del CRM.
alter table wa_config add column if not exists seguimiento_plantilla_marketing text;
alter table wa_config add column if not exists seguimiento_plantilla_utility text;

comment on column wa_config.seguimiento_plantilla_marketing is
  'Plantilla para cuando NO contesta la llamada que él mismo pidió (fuera de la ventana de 24 h). Sin ella, no se le manda nada: mandarle la de «te marcamos» genérica sería negar que él la pidió.';

select
  (select count(*) from tel_sesion_items where compromiso_tarea_id is not null) as items_con_compromiso,
  (select count(*) from ti_tareas where estado = 'pendiente' and payload->>'de_llamada' = 'true') as promesas_vivas;
