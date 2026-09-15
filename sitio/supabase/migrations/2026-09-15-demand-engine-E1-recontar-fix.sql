-- DEMAND ENGINE · arreglo del recuento por problema.
--
-- EL ERROR: el agregado se hacía en dos niveles —primero por (problema,
-- fuente), luego por problema— y el `count(*)` de arriba contaba las FILAS del
-- primer nivel, que son las fuentes distintas, no las señales. Como ningún
-- problema recibe de más de tres o cuatro sitios, el catálogo entero mostraba
-- «visto 3 veces» como máximo, y el problema más documentado —17 mensajes
-- pidiendo reimprimir tickets— aparecía empatado con cualquier caso suelto.
--
-- El daño real no era el número: era la PRIORIDAD. El score usa la frecuencia,
-- así que todo pesaba lo mismo y el backlog quedaba ordenado por casi nada.
create or replace function de_recontar_clusters()
returns void
language sql
as $$
  with por_fuente as (
    select cluster_id, fuente, count(*) veces, sum(peso) peso
    from de_senales where cluster_id is not null group by 1, 2
  ),
  agg as (
    select c.id,
           coalesce(q.n, 0) as queries_n,
           coalesce(s.veces, 0) as senales_n,     -- suma de señales, NO de fuentes
           coalesce(s.peso, 0) as peso,
           coalesce(s.fuentes, '{}'::jsonb) as fuentes
    from de_clusters c
    left join (select cluster_id, count(*) n from de_queries where cluster_id is not null group by 1) q
      on q.cluster_id = c.id
    left join (
      select cluster_id, sum(veces)::int veces, sum(peso)::int peso, jsonb_object_agg(fuente, veces) fuentes
      from por_fuente group by cluster_id
    ) s on s.cluster_id = c.id
  )
  update de_clusters c set
    queries_n = a.queries_n, senales_n = a.senales_n,
    frecuencia_estimada = a.peso, fuentes = a.fuentes, updated_at = now()
  from agg a
  where c.id = a.id
    and (c.queries_n is distinct from a.queries_n
      or c.senales_n is distinct from a.senales_n
      or c.fuentes is distinct from a.fuentes);
$$;
