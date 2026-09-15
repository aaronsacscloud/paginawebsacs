-- DEMAND ENGINE · refundir problemas que son el mismo.
--
-- POR QUÉ EXISTE: el umbral de parecido NO es una constante universal, es una
-- propiedad del modelo de embeddings. Sembramos 0.85 —el valor razonable para
-- los modelos de OpenAI— y con los vectores de Gemini truncados a 1536 resultó
-- que el vecino MÁS parecido de todo el conjunto llegaba a 0.849: con ese
-- número no se podía fusionar nada nunca, y 9 de cada 10 señales abrían un
-- problema nuevo. Medido sobre 326 problemas reales: mediana 0.762, p90 0.827.
-- Revisados a mano los pares de la franja, a partir de 0.82 siguen siendo la
-- misma pregunta («el ticket no imprime» / «no se pueden reimprimir tickets»,
-- «cuánto vendí en el mes» / «cómo sacar un reporte de ventas»), y por debajo
-- empiezan a mezclarse cosas distintas.
--
-- Esta función deja el pasado consistente con el umbral nuevo.

create or replace function de_refundir_clusters(umbral float default 0.82, max_pasadas int default 400)
returns table (fusionados int, restantes int)
language plpgsql
as $$
declare
  a uuid; b uuid; n int := 0; i int := 0;
begin
  loop
    i := i + 1;
    exit when i > max_pasadas;

    -- El par más parecido que todavía supera el umbral. Se queda el que más
    -- señales tiene: el problema más documentado absorbe al menos visto, no al
    -- revés.
    select x.id, y.id into a, b
    from de_clusters x
    join de_clusters y
      on y.id <> x.id
     and (1 - (x.embedding <=> y.embedding)) >= umbral
    where x.embedding is not null and y.embedding is not null
      and (x.senales_n, x.created_at) >= (y.senales_n, y.created_at)
    order by (x.embedding <=> y.embedding) asc
    limit 1;

    exit when a is null;

    update de_queries set cluster_id = a where cluster_id = b;
    update de_senales set cluster_id = a where cluster_id = b;

    -- El centro del problema se recalcula con TODO lo que ahora contiene. Si se
    -- quedara con el vector del primero que llegó, cada fusión lo iría
    -- desviando hacia el ejemplo más antiguo en vez de hacia el tema.
    update de_clusters c set
      embedding = coalesce((
        select l2_normalize(avg(q.embedding)) from de_queries q
        where q.cluster_id = a and q.embedding is not null
      ), c.embedding),
      senales_n = (select count(*) from de_senales s where s.cluster_id = a),
      queries_n = (select count(*) from de_queries q where q.cluster_id = a),
      updated_at = now()
    where c.id = a;

    delete from de_clusters where id = b;
    n := n + 1;
    a := null; b := null;
  end loop;

  return query select n, (select count(*)::int from de_clusters);
end;
$$;
