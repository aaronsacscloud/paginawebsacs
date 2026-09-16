-- 16-sep-2026 · `abm_top_sin_maps` devuelve también el PAÍS de la cuenta.
--
-- Por qué: el cron diario `abm-maps` toma de aquí las mejores cuentas sin
-- consultar en Google y las busca con «<nombre> <ciudad> México» y
-- regionCode MX — hardcodeado, de cuando la base era solo mexicana. Con las
-- 3,565 cuentas nuevas de once países, esas son justo las que encabezan el
-- top (7,000 reseñas en Madrid o Barcelona): buscar «ARTENOVIA Huelva México»
-- devuelve otro negocio o ninguno, y lo que encuentre se le pega a la ficha
-- equivocada. Ya alcanzó a 35 cuentas de fuera.
--
-- La función solo suma una columna; el filtro de qué cuentas entran no cambia.
drop function if exists abm_top_sin_maps(integer, text, integer);

create function abm_top_sin_maps(p_top integer default 100, p_giro text default null, p_limite integer default 60)
returns table(id uuid, nombre text, ciudad text, giro text, sitio text, pais text)
language sql stable as $$
  with buenas as (
    select c.*,
           row_number() over (partition by c.giro
                              order by c.google_resenas desc nulls last,
                                       c.google_rating desc nulls last) r
      from abm_cuentas c
     where c.google_rating >= 3.7
       and c.etapa is distinct from 'no_contactar'
       and c.ya_es_cliente is null
       and (p_giro is null or c.giro = p_giro))
  select b.id, b.nombre, b.ciudad, b.giro, b.sitio, coalesce(b.pais, 'México')
    from buenas b
   where b.r <= p_top
     and b.maps_at is null
   order by (b.tiene_email or b.tiene_wa),   -- false primero: los incontactables
            b.google_resenas desc nulls last
   limit p_limite;
$$;

select count(*) filter (where pais <> 'México') de_fuera, count(*) total from abm_top_sin_maps(100, null, 60);
