-- Adeudos (2026-09-03): deudas con total y saldo que se pagan en abonos; lo que no se pagó un mes se junta al siguiente.
create table if not exists fin_adeudos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, acreedor text, total numeric not null, cuota numeric, dia_pago int,
  inicio date not null default date_trunc('month', now())::date, fecha_limite date, notas text, activo boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists fin_adeudos_abonos (
  id uuid primary key default gen_random_uuid(),
  adeudo_id uuid not null references fin_adeudos(id) on delete cascade,
  mes text not null, fecha date not null default (now() at time zone 'America/Mexico_City')::date, monto numeric not null, nota text, pagado_por uuid,
  created_at timestamptz default now()
);
create index if not exists ix_fin_abonos_adeudo on fin_adeudos_abonos(adeudo_id, mes);
insert into fin_gastos (nombre, categoria, monto, periodicidad, dia_cobro, inicio, proveedor, notas)
select 'Filestack', 'suscripcion', 4900, 'mensual', 16, '2026-09-01', 'Filestack', 'Se cobra el 16' where not exists (select 1 from fin_gastos where nombre = 'Filestack');
insert into fin_adeudos (nombre, acreedor, total, cuota, dia_pago, inicio, fecha_limite, notas)
select 'Adeudo Michael Bosch', 'Michael Bosch', 300000, null, 30, '2026-09-01', null, 'Saldo pendiente $300,000; se abona cada día 30. Define la cuota mensual.' where not exists (select 1 from fin_adeudos where nombre = 'Adeudo Michael Bosch');
insert into fin_adeudos (nombre, acreedor, total, cuota, dia_pago, inicio, fecha_limite, notas)
select 'SAT', 'SAT', 48000, 24000, 30, '2026-09-01', '2026-10-31', 'Se puede pagar mitad en septiembre y mitad en octubre; límite fin de octubre.' where not exists (select 1 from fin_adeudos where nombre = 'SAT');
