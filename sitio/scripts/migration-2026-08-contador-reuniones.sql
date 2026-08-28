-- Contador de reuniones por contacto.
--
-- Por qué materializado y no calculado al vuelo: el objetivo es FILTRAR
-- ("leads con 2+ reuniones", "los que cancelaron alguna"), y eso pide columnas
-- reales. Mismo criterio que `contacts.estatus_lead`.
--
-- Por qué TRIGGER y no llamadas desde los endpoints: hay cuatro caminos que
-- tocan bookings (book, cancel, reschedule, confirm-attendance) y mañana puede
-- haber un quinto. Cablear cada uno es garantizar que el quinto se olvide.
-- El trigger no se puede saltar.

alter table contacts
  add column if not exists reuniones_total        int not null default 0,
  add column if not exists reuniones_agendadas    int not null default 0,
  add column if not exists reuniones_completadas  int not null default 0,
  add column if not exists reuniones_canceladas   int not null default 0,
  add column if not exists reuniones_no_asistio   int not null default 0,
  add column if not exists reuniones_reagendadas  int not null default 0,
  add column if not exists ultima_reunion_fecha   date;

comment on column contacts.reuniones_total is
  'Bookings del contacto. OJO: una reunión reagendada deja el booking viejo en estado reagendada y crea uno nuevo, así que dos reagendas de la MISMA cita suman 3 al total. Para "reuniones de verdad" usar total - reagendadas.';
comment on column contacts.reuniones_agendadas is 'En estado confirmada: la que está por venir.';
comment on column contacts.reuniones_no_asistio is 'No-shows. Es la métrica que la secuencia de demo agendada existe para bajar.';

create or replace function recalcular_reuniones_contacto(p_contact uuid)
returns void language sql as $$
  update contacts c set
    reuniones_total       = x.total,
    reuniones_agendadas   = x.agendadas,
    reuniones_completadas = x.completadas,
    reuniones_canceladas  = x.canceladas,
    reuniones_no_asistio  = x.no_asistio,
    reuniones_reagendadas = x.reagendadas,
    ultima_reunion_fecha  = x.ultima
  from (
    select
      count(*)                                            as total,
      count(*) filter (where estado = 'confirmada')       as agendadas,
      count(*) filter (where estado = 'asistio')          as completadas,
      count(*) filter (where estado = 'cancelada')        as canceladas,
      count(*) filter (where estado = 'no_asistio')       as no_asistio,
      count(*) filter (where estado = 'reagendada')       as reagendadas,
      max(fecha)                                          as ultima
    from bookings where contact_id = p_contact
  ) x
  where c.id = p_contact;
$$;

create or replace function trg_reuniones_contacto()
returns trigger language plpgsql as $$
begin
  -- Cubre el cambio de dueño: si un booking se reasigna de contacto, ambos
  -- lados quedan bien, no solo el nuevo.
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') and old.contact_id is not null then
    perform recalcular_reuniones_contacto(old.contact_id);
  end if;
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.contact_id is not null then
    perform recalcular_reuniones_contacto(new.contact_id);
  end if;
  return null;
end $$;

drop trigger if exists bookings_contador_reuniones on bookings;
create trigger bookings_contador_reuniones
  after insert or update of estado, contact_id, fecha or delete on bookings
  for each row execute function trg_reuniones_contacto();

-- Índice para el caso de uso: "enséñame los leads con más de una reunión".
create index if not exists idx_contacts_reuniones_total
  on contacts (reuniones_total) where reuniones_total > 0;

-- Relleno de los que ya existen.
select recalcular_reuniones_contacto(id)
  from contacts where id in (select distinct contact_id from bookings where contact_id is not null);
