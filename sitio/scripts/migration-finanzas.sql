-- Finanzas del negocio (2026-09-03): gastos propios (suscripciones, nómina, etc.), pagos por mes y cierres mensuales.
create table if not exists fin_gastos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, categoria text not null default 'suscripcion',   -- suscripcion | nomina | comision | marketing | impuestos | otro
  monto numeric not null default 0, moneda text not null default 'MXN',
  periodicidad text not null default 'mensual',                          -- mensual | anual | unico
  dia_cobro int, inicio date not null default date_trunc('month', now())::date, fin date,
  proveedor text, notas text, activo boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists fin_gastos_pagos (
  gasto_id uuid not null references fin_gastos(id) on delete cascade,
  mes text not null,                       -- 'YYYY-MM'
  pagado_at timestamptz default now(), monto numeric, nota text, pagado_por uuid,
  primary key (gasto_id, mes)
);
create table if not exists fin_cierres (
  mes text primary key,                    -- 'YYYY-MM'
  ingresos numeric not null default 0, por_cobrar_pendiente numeric not null default 0,
  gastos numeric not null default 0, comisiones numeric not null default 0, nomina numeric not null default 0,
  utilidad numeric not null default 0, detalle jsonb, notas text,
  cerrado_at timestamptz default now(), cerrado_por uuid
);
