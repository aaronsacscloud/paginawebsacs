-- El índice único de ev_expositores era parcial (where abm_cuenta_id is not null) y
-- PostgREST hace ON CONFLICT (edicion_id, abm_cuenta_id) sin el predicado: Postgres no
-- lo encuentra y "Armar la lista" tronaba con 500. Un índice completo sirve igual: dos
-- nulos nunca chocan entre sí.
drop index if exists ev_expositores_ux;
create unique index if not exists ev_expositores_ux on ev_expositores (edicion_id, abm_cuenta_id);
