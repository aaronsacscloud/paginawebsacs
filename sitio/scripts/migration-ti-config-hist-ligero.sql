-- 2026-09-11 · ti_config_hist guardaba una versión por CADA cambio, incluidas las marcas de reloj (observado_hasta,
-- eventos_marca, latido…) que se escriben cada minuto: 6,000 filas en tres días. Ahora solo guarda cuando cambia algo
-- que no sea una marca, y conserva las últimas 500.
create or replace function ti_config_guarda_hist() returns trigger language plpgsql as $$
declare marcas text[] := array['observado_hasta','eventos_marca','latido_despliegue','agente_marca','calificacion_marca','agente_citas_marca','planificador_ultimo','plantillas_agente'];
begin
  if (old.valor - marcas) is distinct from (new.valor - marcas) then
    insert into ti_config_hist(valor, por) values (old.valor, current_setting('application_name', true));
    delete from ti_config_hist where id in (select id from ti_config_hist order by id desc offset 500);
  end if;
  return new;
end $$;
-- limpieza de lo acumulado: se conservan las últimas 200 y la primera (la fila «antes de restaurar»)
delete from ti_config_hist where id not in (select id from ti_config_hist order by id desc limit 200) and por is distinct from 'antes de restaurar 2026-09-08';
select count(*) as quedan from ti_config_hist;
