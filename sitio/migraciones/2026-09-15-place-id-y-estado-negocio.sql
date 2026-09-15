-- La llave para volver a preguntarle a Google, y si el negocio sigue abierto.
--
-- El barrido nacional levantó 44,186 datos de Google Maps y NO guardó ni un
-- place_id. Sin él, volver a consultar una cuenta es una búsqueda por nombre y
-- ciudad: más cara, más lenta y a veces trae el negocio de junto. Es una
-- columna, y no tenerla obliga a pagar dos veces por lo mismo.
--
-- `abierto` viene de businessStatus: OPERATIONAL, CLOSED_TEMPORARILY o
-- CLOSED_PERMANENTLY. Un negocio cerrado permanentemente no se contacta, y hoy
-- no teníamos forma de saberlo — seguía en la cola compitiendo por un lugar
-- con negocios vivos.
alter table abm_cuentas
  add column if not exists place_id text,
  add column if not exists abierto text,
  add column if not exists maps_at timestamptz;

create unique index if not exists abm_cuentas_place_id_uk
  on abm_cuentas (place_id) where place_id is not null;

comment on column abm_cuentas.place_id is
  'Identificador de Google Maps. Permite reconsultar la ficha sin buscar por nombre. Ver MANUAL-PROSPECCION-ABM.md §0.';
comment on column abm_cuentas.abierto is
  'businessStatus de Google: OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY.';
