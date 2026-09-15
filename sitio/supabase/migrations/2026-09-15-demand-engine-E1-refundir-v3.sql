-- DEMAND ENGINE · refundir, versión que NO pierde la evidencia.
--
-- EL ERROR (encontrado al revisar el primer backlog real): la versión anterior
-- hacía el traslado y el borrado dentro del MISMO statement, con CTEs que
-- modifican datos:
--
--     with limpio as (...),
--          mover_s as (update de_senales set cluster_id = grande ...),
--          borrar  as (delete from de_clusters where id = chico ...)
--     select ...
--
-- Todas las CTEs de un statement ven la MISMA foto de los datos, y las acciones
-- de las llaves foráneas se aplican al final. `de_senales.cluster_id` y
-- `de_queries.cluster_id` están declaradas `on delete set null`, así que el
-- borrado del problema absorbido anulaba justo las filas que el update acababa
-- de mudar. Resultado: 1,700 señales procesadas quedaron sin problema, y el más
-- documentado del catálogo pasó a tener 3 en vez de 17. Nada falló en voz alta.
--
-- LA REGLA: mudar y borrar son dos statements, siempre. Primero se mueve todo
-- lo que cuelga, y solo entonces se borra el contenedor vacío.

create or replace function de_refundir_clusters(umbral float default 0.82, max_pasadas int default 5)
returns table (fusionados int, restantes int)
language plpgsql
as $$
declare
  total int := 0; en_pasada int; i int := 0;
begin
  create temp table if not exists _pares (chico uuid, grande uuid) on commit drop;

  loop
    i := i + 1;
    exit when i > greatest(max_pasadas, 1);
    delete from _pares;

    -- Cada problema pregunta por SU vecino más cercano usando el índice HNSW.
    -- Con producto cruzado esto era un millón de comparaciones por pasada.
    insert into _pares (chico, grande)
    select a.id, v.id
    from de_clusters a
    cross join lateral (
      select b.id, b.senales_n, b.created_at, (a.embedding <=> b.embedding) as d
      from de_clusters b
      where b.id <> a.id and b.embedding is not null
      order by a.embedding <=> b.embedding
      limit 1
    ) v
    where a.embedding is not null
      and (1 - v.d) >= umbral
      -- El más documentado absorbe; el empate lo rompe la antigüedad.
      and (v.senales_n, v.created_at) > (a.senales_n, a.created_at);

    -- Nadie absorbe y es absorbido en el mismo barrido: si no, `a` terminaría
    -- apuntando a un problema que acaba de desaparecer.
    delete from _pares p where p.grande in (select chico from _pares);

    select count(*) into en_pasada from _pares;
    exit when en_pasada = 0;

    -- PRIMERO se muda lo que cuelga…
    update de_queries q set cluster_id = p.grande from _pares p where q.cluster_id = p.chico;
    update de_senales s set cluster_id = p.grande from _pares p where s.cluster_id = p.chico;
    -- …y SOLO ENTONCES se borra el contenedor, ya vacío.
    delete from de_clusters c using _pares p where c.id = p.chico;

    total := total + en_pasada;

    update de_clusters c set
      embedding = coalesce((select l2_normalize(avg(q.embedding)) from de_queries q where q.cluster_id = c.id and q.embedding is not null), c.embedding),
      updated_at = now()
    where c.id in (select grande from _pares);
  end loop;

  perform de_recontar_clusters();
  return query select total, (select count(*)::int from de_clusters);
end;
$$;

-- ── REPARACIÓN ──────────────────────────────────────────────────────────────
-- Vuelve a colgar de su problema lo que la versión rota dejó suelto. No hace
-- falta volver a preguntarle a ningún modelo: las consultas conservan su
-- vector, así que basta buscarles el problema más parecido; y cada señal
-- recupera el de su consulta.
create or replace function de_reparar_huerfanos(umbral float default 0.82)
returns table (consultas_recolocadas int, consultas_nuevas int, senales_recolocadas int)
language plpgsql
as $$
declare a int := 0; b int := 0; c int := 0;
begin
  -- 1 · consultas sueltas que sí encuentran un problema parecido
  with cand as (
    select q.id, v.id as cluster_id
    from de_queries q
    cross join lateral (
      select cl.id, (q.embedding <=> cl.embedding) d
      from de_clusters cl where cl.embedding is not null
      order by q.embedding <=> cl.embedding limit 1
    ) v
    where q.cluster_id is null and q.embedding is not null and (1 - v.d) >= umbral
  )
  update de_queries q set cluster_id = cand.cluster_id from cand where q.id = cand.id;
  get diagnostics a = row_count;

  -- 2 · las que no se parecen a nada abren su propio problema
  with sueltas as (
    select id, texto_original, embedding, pais, idioma from de_queries
    where cluster_id is null and embedding is not null
  ), nuevos as (
    insert into de_clusters (problema_canonico, embedding, idioma, pais, naturaleza_dominante, estado)
    select s.texto_original, s.embedding, s.idioma, array[s.pais], 'observada', 'nuevo' from sueltas s
    returning id, problema_canonico, embedding
  )
  update de_queries q set cluster_id = n.id
  from nuevos n where q.cluster_id is null and q.embedding = n.embedding;
  get diagnostics b = row_count;

  -- 3 · cada señal recupera el problema de su consulta
  update de_senales s set cluster_id = q.cluster_id
  from de_queries q
  where s.query_id = q.id and s.cluster_id is null and q.cluster_id is not null;
  get diagnostics c = row_count;

  perform de_recontar_clusters();
  return query select a, b, c;
end;
$$;
