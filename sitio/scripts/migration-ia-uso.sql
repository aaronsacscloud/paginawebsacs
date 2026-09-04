-- 2026-09-04 · Cada llamada a la IA, registrada. Antes solo se guardaba el costo de algunas (el envío, la
-- propuesta de reactivación); las clasificaciones, las pruebas de reglas y los crons no dejaban rastro, así que
-- no se podía responder «¿en qué se fue el crédito?». Ahora sí.
create table if not exists ia_uso (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  proposito text,                       -- de dónde salió la llamada (archivo/función)
  input_tokens int default 0,
  output_tokens int default 0,
  cache_read int default 0,
  cache_write int default 0,
  busquedas_web int default 0,
  costo_usd numeric(10,5) default 0,
  ok boolean default true,
  error text,
  ms int,
  created_at timestamptz default now()
);
create index if not exists ix_ia_uso_created on ia_uso (created_at desc);
create index if not exists ix_ia_uso_proposito on ia_uso (proposito, created_at desc);
