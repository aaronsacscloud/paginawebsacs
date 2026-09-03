-- Decisiones sobre lo que no se pagó (2026-09-04) y flexibilidad del gasto.
create table if not exists fin_gastos_decisiones (
  gasto_id uuid not null references fin_gastos(id) on delete cascade,
  mes text not null,                                   -- mes original del cargo
  decision text not null,                              -- recorrer | prorroga | condonado | no_aplica
  nueva_fecha date, monto numeric, nota text, decidido_por uuid, decidido_at timestamptz default now(),
  primary key (gasto_id, mes)
);
create table if not exists fin_adeudos_decisiones (
  adeudo_id uuid not null references fin_adeudos(id) on delete cascade,
  mes text not null, decision text not null,           -- recorrer | prorroga | condonado
  nueva_fecha date, monto numeric, nota text, decidido_por uuid, decidido_at timestamptz default now(),
  primary key (adeudo_id, mes)
);
alter table fin_adeudos_abonos add column if not exists tipo text not null default 'pago';   -- pago | condonacion
alter table fin_gastos
  add column if not exists moneda_original text, add column if not exists monto_original numeric, add column if not exists tipo_cambio numeric,
  add column if not exists dias_cobro int[], add column if not exists metodo_pago text, add column if not exists cuenta_pago text,
  add column if not exists deducible boolean, add column if not exists centro_costo text default 'empresa',
  add column if not exists monto_min numeric, add column if not exists monto_max numeric, add column if not exists recordatorio_dias int default 3,
  add column if not exists pausado_hasta date, add column if not exists etiquetas text[];
