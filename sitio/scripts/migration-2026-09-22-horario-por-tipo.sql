-- Horario propio por tipo de reunión (22-sep-2026).
-- Pedido del dueño: configurar los horarios de atención de la CONSULTORÍA sin
-- mover los de las demos. Hasta hoy cada anfitrión tenía un solo horario para
-- todo. Si el tipo trae schedule_id se usa ese; si no, el default de siempre.
alter table event_types
  add column if not exists schedule_id uuid references availability_schedules(id) on delete set null;
comment on column event_types.schedule_id is
  'Horario propio de este tipo. Null = el horario default del anfitrión.';
