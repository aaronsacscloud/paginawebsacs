-- Ajuste al disparador de 2026-09-16-pais-nombre-canonico.sql tras revisarlo.
--
-- Estaba escrito `coalesce(new.pais,'mx')`, o sea que un insert SIN país salía
-- con 'México' puesto. Hoy no pasa —los tres cargadores lo escriben siempre—
-- pero es exactamente la falla que el disparador venía a evitar: afirmar un
-- dato que nadie dio. Un cargador nuevo que olvide el campo se llevaría un
-- «México» silencioso, y nadie lo notaría hasta que le escribamos «el mapa de
-- las zapaterías de México» a un negocio de Lima.
--
-- Ahora: si viene vacío, se queda vacío. Normalizar no es adivinar.

create or replace function abm_pais_canonico() returns trigger
language plpgsql as $$
begin
  if new.pais is null or btrim(new.pais) = '' then
    new.pais := null;
    return new;
  end if;
  new.pais := case lower(btrim(new.pais))
    when 'mx' then 'México'          when 'co' then 'Colombia'
    when 'cl' then 'Chile'           when 'ar' then 'Argentina'
    when 'pe' then 'Perú'            when 'ec' then 'Ecuador'
    when 'cr' then 'Costa Rica'      when 'pa' then 'Panamá'
    when 'uy' then 'Uruguay'         when 'do' then 'República Dominicana'
    when 'gt' then 'Guatemala'       when 'es' then 'España'
    else new.pais
  end;
  return new;
end $$;
