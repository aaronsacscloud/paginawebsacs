-- 2026-09-08 · ti_config perdió sus llaves (un escritor leyó la fila vacía por un error transitorio y la reescribió con
-- {...{}, parche}). Tres piezas: (1) historial automático de cada cambio, (2) RPC de parche por concatenación jsonb
-- (no puede borrar llaves), (3) restauración de las llaves perdidas.
create table if not exists ti_config_hist (id bigserial primary key, at timestamptz not null default now(), valor jsonb not null, por text);
create or replace function ti_config_guarda_hist() returns trigger language plpgsql as $$
begin
  if old.valor is distinct from new.valor then insert into ti_config_hist(valor, por) values (old.valor, current_setting('application_name', true)); end if;
  return new;
end $$;
drop trigger if exists trg_ti_config_hist on ti_config;
create trigger trg_ti_config_hist before update on ti_config for each row execute function ti_config_guarda_hist();
create or replace function ti_config_parche(p jsonb) returns jsonb language sql as $$
  update ti_config set valor = coalesce(valor, '{}'::jsonb) || coalesce(p, '{}'::jsonb) where id = 1 returning valor;
$$;
insert into ti_config_hist(valor, por) select valor, 'antes de restaurar 2026-09-08' from ti_config where id = 1;
select ti_config_parche('{"agente_activo": true, "agente_modo": "vivo", "arranque_desde": "2026-09-01T18:29:31.157Z", "agente_prueba_telefonos": []}'::jsonb);
-- la regeneración en bucle: «regenerar: null» (null de JSON) no es NULL de SQL y la fila se volvía a tomar cada tick
update ti_envios set salida = salida - 'regenerar' where salida ? 'regenerar' and salida->'regenerar' = 'null'::jsonb;
