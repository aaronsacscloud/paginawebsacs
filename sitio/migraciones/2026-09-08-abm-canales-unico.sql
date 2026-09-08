-- Dedupe de abm_canales (632 teléfonos repetidos por el barrido de giros, todos sin_probar)
-- + índice único para que la carga masiva no vuelva a duplicar.
with d as (
  select id, row_number() over (partition by cuenta_id, tipo, lower(valor) order by created_at, id) rn
  from abm_canales
)
delete from abm_canales k using d where d.id = k.id and d.rn > 1;

create unique index if not exists abm_canales_unico on abm_canales (cuenta_id, tipo, lower(valor));
