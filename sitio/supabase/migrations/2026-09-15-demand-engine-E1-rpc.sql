-- DEMAND ENGINE · E1 · funciones de apoyo.

-- ¿Qué problema canónico se parece más a este texto? La comparación por
-- distancia coseno vive en la base y no en el servidor a propósito: traerse
-- todos los vectores a JavaScript para compararlos sería mover megabytes en
-- cada consulta y volvería inviable el día que haya miles de clusters.
create or replace function de_cluster_cercano(v vector(1536), lim int default 1)
returns table (id uuid, problema_canonico text, similitud float)
language sql stable
as $$
  select c.id, c.problema_canonico, 1 - (c.embedding <=> v) as similitud
  from de_clusters c
  where c.embedding is not null and c.estado <> 'descartado'
  order by c.embedding <=> v
  limit greatest(lim, 1);
$$;

-- Lo mismo para no publicar dos veces lo mismo (duplicado semántico).
create or replace function de_queries_cercanas(v vector(1536), lim int default 5)
returns table (id uuid, texto_original text, cluster_id uuid, similitud float)
language sql stable
as $$
  select q.id, q.texto_original, q.cluster_id, 1 - (q.embedding <=> v) as similitud
  from de_queries q
  where q.embedding is not null
  order by q.embedding <=> v
  limit greatest(lim, 1);
$$;

-- Los conteos de cada problema, de una vez. Mantenerlos fila por fila
-- multiplica escrituras y se desincroniza igual en cuanto algo falla a medias.
create or replace function de_recontar_clusters()
returns void
language sql
as $$
  update de_clusters c set
    queries_n = coalesce(q.n, 0),
    senales_n = coalesce(s.n, 0),
    frecuencia_estimada = coalesce(s.peso, 0),
    updated_at = now()
  from (select id from de_clusters) base
  left join (select cluster_id, count(*) n from de_queries where cluster_id is not null group by 1) q on q.cluster_id = base.id
  left join (select cluster_id, count(*) n, sum(peso)::int peso from de_senales where cluster_id is not null group by 1) s on s.cluster_id = base.id
  where c.id = base.id;
$$;
