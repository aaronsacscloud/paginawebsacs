-- 2026-09-04 · Caché de la mitad «sin la regla» de cada prueba. Cada prueba de regla generaba TODOS los casos dos
-- veces con Opus (con y sin), pero la mitad «sin» es idéntica entre pruebas mientras no cambie el guion ni las
-- reglas vigentes. Medido: 264 generaciones Opus en un día, $11.54 — el 58 % del crédito. Con esto se paga una vez.
create table if not exists ti_baseline (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null,
  firma text not null,          -- versión del guion + reglas activas: si cambia, la línea base se rehace
  texto text not null,
  modelo text,
  created_at timestamptz default now(),
  unique (caso_id, firma)
);
create index if not exists ix_ti_baseline_firma on ti_baseline (firma, created_at desc);
