-- ══ El país de una cuenta se escribe con su NOMBRE, nunca con el iso ══════════
--
-- QUÉ PASÓ. /api/cron/abm-barrido insertaba `pais: 'MX'`. El goteo selecciona
-- con `.eq('pais', paisDe(f.pais).nombre)`, o sea `'México'`. Resultado: las
-- 7,394 cuentas que trajo el barrido —780 con correo y 354 con WhatsApp, lo
-- más fresco de la base— eran invisibles para TODAS las cadencias de México.
-- No fallaba nada: el goteo enrolaba 10 al día de las viejas y se veía sano.
--
-- POR QUÉ UNA GUARDA Y NO SOLO EL UPDATE. El bug no fue el dato, fue que dos
-- lugares escriben el mismo campo con dos convenciones y nada los obligaba a
-- coincidir. `giro-carga.py` ponía 'México' y el barrido 'MX'; el que estaba
-- mal era el nuevo, pero pudo haber sido al revés. El disparador normaliza a
-- la forma que LEE el goteo, venga de donde venga el insert.

-- 1 · El dato
update abm_cuentas set pais = 'México' where pais = 'MX';

-- 2 · La guarda: iso → nombre, con el mismo mapa que src/lib/crm/abm-paises.ts
create or replace function abm_pais_canonico() returns trigger
language plpgsql as $$
begin
  new.pais := case lower(coalesce(new.pais, 'mx'))
    when 'mx' then 'México'          when 'co' then 'Colombia'
    when 'cl' then 'Chile'           when 'ar' then 'Argentina'
    when 'pe' then 'Perú'            when 'ec' then 'Ecuador'
    when 'cr' then 'Costa Rica'      when 'pa' then 'Panamá'
    when 'uy' then 'Uruguay'         when 'do' then 'República Dominicana'
    when 'gt' then 'Guatemala'       when 'es' then 'España'
    else coalesce(new.pais, 'México')
  end;
  return new;
end $$;

drop trigger if exists abm_cuentas_pais on abm_cuentas;
create trigger abm_cuentas_pais before insert or update of pais on abm_cuentas
for each row execute function abm_pais_canonico();
