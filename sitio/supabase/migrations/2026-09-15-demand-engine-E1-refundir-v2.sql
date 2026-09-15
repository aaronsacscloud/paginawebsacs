-- DEMAND ENGINE · refundir problemas, versión que escala.
--
-- QUÉ ESTABA MAL: la primera versión buscaba, en cada pasada, EL par más
-- parecido de toda la tabla. Eso es un producto cruzado —a 326 problemas eran
-- ~100 mil comparaciones de vector por pasada, y a 990 son un millón— repetido
-- hasta 300 veces. Con 326 tardaba segundos; con 990 se quedó sin tiempo y
-- devolvió vacío. Y como el handler no miraba el error del RPC, la corrida de
-- producción reportó «nada que fundir · 0 problemas» tan campante.
--
-- CÓMO ESCALA AHORA: en vez de buscar el mejor par global, cada problema
-- pregunta por SU vecino más cercano usando el índice HNSW (que existe justo
-- para esto) y se funde hacia el que tiene más señales. Eso convierte cada
-- pasada en una búsqueda por índice en lugar de un barrido completo. Como una
-- fusión puede acercar a un tercero, se repite en barridos —tres o cuatro
-- bastan en la práctica— en vez de cientos.
--
-- Y una regla que evita el enredo: dentro de un mismo barrido, un problema que
-- va a absorber a otro NO puede a su vez ser absorbido. Sin eso, a→b y b→c en
-- la misma pasada dejan a `a` apuntando a algo que acaba de desaparecer.

create or replace function de_refundir_clusters(umbral float default 0.82, max_pasadas int default 5)
returns table (fusionados int, restantes int)
language plpgsql
as $$
declare
  total int := 0; en_pasada int; i int := 0;
begin
  loop
    i := i + 1;
    exit when i > greatest(max_pasadas, 1);

    with vecino as (
      select a.id as chico, v.id as grande
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
        -- El que absorbe es el más documentado; el empate lo rompe la antigüedad.
        and (v.senales_n, v.created_at) > (a.senales_n, a.created_at)
    ),
    -- Nadie absorbe y es absorbido en el mismo barrido.
    limpio as (
      select * from vecino v where v.grande not in (select chico from vecino)
    ),
    mover_q as (
      update de_queries q set cluster_id = l.grande from limpio l where q.cluster_id = l.chico returning 1
    ),
    mover_s as (
      update de_senales s set cluster_id = l.grande from limpio l where s.cluster_id = l.chico returning 1
    ),
    borrar as (
      delete from de_clusters c using limpio l where c.id = l.chico returning 1
    )
    select count(*) into en_pasada from borrar;

    exit when en_pasada = 0;
    total := total + en_pasada;

    -- El centro de cada problema que creció se recalcula con TODO lo que ahora
    -- contiene: si se quedara con el vector del primero que llegó, cada fusión
    -- lo desviaría hacia el ejemplo más viejo en vez de hacia el tema.
    update de_clusters c set
      embedding = coalesce((select l2_normalize(avg(q.embedding)) from de_queries q where q.cluster_id = c.id and q.embedding is not null), c.embedding),
      senales_n = (select count(*) from de_senales s where s.cluster_id = c.id),
      queries_n = (select count(*) from de_queries q where q.cluster_id = c.id),
      updated_at = now()
    where c.updated_at < now() - interval '1 second'
      and exists (select 1 from de_queries q where q.cluster_id = c.id);
  end loop;

  return query select total, (select count(*)::int from de_clusters);
end;
$$;
