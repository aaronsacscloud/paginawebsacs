-- DEMAND ENGINE · de dónde viene cada problema.
--
-- POR QUÉ: al ver el primer backlog real, dos oportunidades salieron mal
-- tipadas. «agendar una llamada» (28 señales) se propuso como función de
-- producto, y «conocer más sobre el software» como página que atraiga demanda.
-- Las dos son de gente que YA está hablando con nosotros: no hay nada que
-- capturar ahí.
--
-- La regla que faltaba no es otro umbral, es el ORIGEN. El mismo texto
-- significa cosas distintas según quién lo dijo:
--   · soporte y mejoras  → lo dice un cliente que ya paga  → es PRODUCTO
--   · whatsapp y agenda  → lo dice un prospecto            → es DEMANDA
--   · churn y pérdidas   → lo dice quien se fue o no compró → es OBJECIÓN
-- Sin esta columna, el motor confunde «arreglar el producto» con «atraer
-- clientes», que son dos trabajos con dueños distintos.

alter table de_clusters add column if not exists fuentes jsonb not null default '{}'::jsonb;

create or replace function de_recontar_clusters()
returns void
language sql
as $$
  with agg as (
    select c.id,
           coalesce(q.n, 0) as queries_n,
           coalesce(s.n, 0) as senales_n,
           coalesce(s.peso, 0) as peso,
           coalesce(s.fuentes, '{}'::jsonb) as fuentes
    from de_clusters c
    left join (
      select cluster_id, count(*) n from de_queries where cluster_id is not null group by 1
    ) q on q.cluster_id = c.id
    left join (
      select cluster_id, count(*) n, sum(peso)::int peso,
             jsonb_object_agg(fuente, veces) fuentes
      from (select cluster_id, fuente, count(*) veces, sum(peso) peso
            from de_senales where cluster_id is not null group by 1, 2) x
      group by cluster_id
    ) s on s.cluster_id = c.id
  )
  update de_clusters c set
    queries_n = a.queries_n,
    senales_n = a.senales_n,
    frecuencia_estimada = a.peso,
    fuentes = a.fuentes,
    updated_at = now()
  from agg a
  where c.id = a.id
    and (c.queries_n is distinct from a.queries_n
      or c.senales_n is distinct from a.senales_n
      or c.fuentes is distinct from a.fuentes);
$$;
