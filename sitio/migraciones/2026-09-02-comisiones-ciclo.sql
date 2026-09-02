-- ════════════════════════════════════════════════════════════════════════
-- Comisiones · el ciclo de pago, configurable
-- ════════════════════════════════════════════════════════════════════════
--
-- El corte cierra el viernes y se paga el lunes, pero eso estaba escrito en el
-- código. Si mañana el cierre se mueve al jueves, hoy habría que tocar la lib,
-- compilar y desplegar para cambiar un número que es una decisión de negocio.
--
-- Una sola fila: el ciclo es de la empresa, no de cada persona. Un corte por
-- consultor con calendarios distintos volvería imposible cuadrar una semana.
create table if not exists comision_ciclo (
  id            boolean primary key default true,
  -- 1 = lunes … 7 = domingo (ISO). 5 = viernes.
  dia_cierre    integer not null default 5,
  -- Días entre el cierre y el pago. 3 = del viernes al lunes.
  dias_a_pago   integer not null default 3,
  actualizado_at timestamptz not null default now(),
  constraint comision_ciclo_una_fila check (id),
  constraint comision_ciclo_dia_ck   check (dia_cierre between 1 and 7),
  constraint comision_ciclo_pago_ck  check (dias_a_pago between 0 and 14)
);

insert into comision_ciclo (id) values (true) on conflict (id) do nothing;
