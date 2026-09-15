-- Quién es el "top de cada giro" que todavía no hemos consultado en Maps.
--
-- Va como función de la base y no como consulta en el código porque la usan el
-- cron de Maps, la pantalla y lo que venga: si cada uno escribe su propia
-- versión del "top 100", tarde o temprano dos discrepan y nadie sabe cuál es la
-- lista buena.
--
-- El orden importa y no es por estrellas: es por NÚMERO DE RESEÑAS. Un 5.0 con
-- dos reseñas es ruido; un 4.3 con 800 es un negocio de verdad (manual §0).
--
-- Y dentro del top, primero las que NO TIENEN NINGUNA VÍA de contacto: son las
-- únicas que hoy no se pueden trabajar de ninguna forma, así que son las que
-- más rinde destrabar.
create or replace function public.abm_top_sin_maps(
  p_top int default 100, p_giro text default null, p_limite int default 60)
returns table (id uuid, nombre text, ciudad text, giro text, sitio text)
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
  select b.id, b.nombre, b.ciudad, b.giro, b.sitio
    from buenas b
   where b.r <= p_top
     and b.maps_at is null
   order by (b.tiene_email or b.tiene_wa),   -- false primero: los incontactables
            b.google_resenas desc nulls last
   limit p_limite;
$$;
