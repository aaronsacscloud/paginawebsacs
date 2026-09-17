-- ARREGLO · `agrupar` llevaba DOS DÍAS muriendo en producción, sin que nadie lo
-- viera.
--
-- El error: «DELETE requires a WHERE clause». Supabase trae encendida la
-- extensión que bloquea UPDATE y DELETE sin WHERE —una red contra el borrado
-- accidental de tablas enteras— y esa red **también aplica dentro de una
-- función y sobre una tabla temporal**. La línea culpable era
-- `delete from _pares;` al principio de cada pasada.
--
-- Ya habíamos tropezado con esto mismo en `de_recontar_enlaces` (un UPDATE sin
-- WHERE, que falló en silencio). Es la segunda vez, y por eso queda anotado
-- aquí: en este proyecto, UPDATE y DELETE SIEMPRE llevan WHERE, aunque la
-- intención sea tocar todas las filas y aunque la tabla sea temporal.
--
-- Cómo se encontró: NO mirando la bitácora. El autodiagnóstico del latido
-- (`sistema.latido`, etapa 6) agrupa las acciones muertas de las últimas 24 h y
-- enseña el error más repetido. Salió a la primera vez que se corrió. Sin eso,
-- el motor llevaba dos días sin fundir problemas duplicados y el síntoma
-- —clusters que se acumulan— habría tardado semanas en ser evidente.
--
-- `truncate` en vez de `delete ... where true`: hace lo que de verdad se quiere
-- (vaciar), es más rápido, y no se puede «simplificar» de vuelta a un DELETE
-- sin WHERE sin que se note.

create or replace function de_refundir_clusters(umbral double precision default 0.82, max_pasadas integer default 5)
returns table(fusionados integer, restantes integer)
language plpgsql
as $$
declare
  total int := 0; en_pasada int; i int := 0;
begin
  create temp table if not exists _pares (chico uuid, grande uuid) on commit drop;

  loop
    i := i + 1;
    exit when i > greatest(max_pasadas, 1);

    -- TRUNCATE y no `delete from _pares`: Supabase rechaza DELETE sin WHERE
    -- incluso en tablas temporales, y eso mataba esta función entera.
    truncate _pares;

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
    -- …y SOLO ENTONCES se borra el contenedor, ya vacío. Mudar y borrar en la
    -- misma sentencia desenganchó 1,700 señales una vez: el `on delete set
    -- null` de la FK ganaba la carrera.
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

comment on function de_refundir_clusters is
  'Funde problemas duplicados usando el índice HNSW. TRUNCATE y no DELETE en la tabla temporal: Supabase bloquea DELETE sin WHERE y eso mató esta función dos días seguidos.';
