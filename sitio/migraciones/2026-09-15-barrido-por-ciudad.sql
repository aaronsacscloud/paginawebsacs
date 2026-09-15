-- El barrido por ciudad, con memoria de qué se barrió.
--
-- El barrido anterior se quedó con la PRIMERA PÁGINA de cada búsqueda. Google
-- devuelve 20 por página y ofrece más con nextPageToken, que nunca se pidió.
-- Medido: Guadalajara tenía 24 zapaterías y 9 casas de novia; CDMX, 8 casas de
-- novia. Hay cientos.
--
-- Esta tabla recuerda qué pares giro×ciudad ya se barrieron, para no pagarle
-- dos veces a Google por lo mismo ni dejar ciudades sin tocar sin que nadie se
-- entere.
create table if not exists abm_barrido (
  giro       text not null,
  ciudad     text not null,
  barrido_at timestamptz not null default now(),
  primary key (giro, ciudad)
);

-- El catálogo de ciudades sale de la BASE, no de una lista escrita a mano: son
-- las que el barrido viejo ya encontró, ordenadas por cuántos negocios de moda
-- tienen. Así se atiende primero donde hay más, y se agregan solas las que
-- aparezcan en el futuro.
--
-- OJO CON LOS CONURBADOS: para Google, Zapopan no es Guadalajara ni Ecatepec es
-- CDMX. Como el catálogo sale de lo que Maps ya devolvió, los municipios
-- conurbados YA vienen como ciudad propia — que es justo lo que el barrido
-- viejo perdía al buscar solo por la ciudad principal.
create or replace function public.abm_ciudades_pendientes(
  p_giro text, p_limite int default 8)
returns table (ciudad text, estado_geo text, negocios bigint)
language sql stable as $$
  select c.ciudad,
         (array_agg(c.estado_geo order by c.estado_geo) filter (where c.estado_geo is not null))[1] as estado_geo,
         count(*) as negocios
    from abm_cuentas c
   where c.ciudad is not null and c.ciudad <> ''
     and not exists (select 1 from abm_barrido b
                      where b.giro = p_giro and b.ciudad = c.ciudad)
   group by c.ciudad
   order by count(*) desc
   limit p_limite;
$$;
